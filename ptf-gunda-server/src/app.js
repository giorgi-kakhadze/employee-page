'use strict';
const http = require('http'), fs = require('fs'), path = require('path'), crypto = require('crypto'), zlib = require('zlib');
const { State } = require('./store/state');
const makeEnv = require('./rules/env'), createRules = require('./rules/rules');
const sessionsFactory = require('./auth/session'), oidcFactory = require('./auth/oidc');
const filesFactory = require('./services/files'), auditFactory = require('./services/audit'), mailFactory = require('./services/mail');
const U = require('./http/util'), securityHeaders = require('./http/headers');

const EMPLOYEE_ACTIONS = ['me', 'reqNew', 'reqCancel'];
const WRITE_ACTIONS = ['push', 'reqNew', 'reqCancel'];
const KNOWN_ACTIONS = ['pull', 'push', 'me', 'reqNew', 'reqCancel', 'login', 'video', 'videoGet', 'projNotify', 'pjFileUp', 'pjFileGet', 'list', 'setStatus', 'remove', 'request'];

async function createApp(cfg, opts) {
  opts = opts || {};
  const log = opts.log || ((...a) => { if (!cfg.quiet) console.log(...a); });
  const state = await State.open(cfg), db = state.d;
  const files = filesFactory(cfg.dataDir), audit = auditFactory(db), sessions = sessionsFactory(db, cfg);
  const mail = mailFactory(db, cfg, opts.sentMail);
  const props = {}; for (const r of await db.q(`SELECT k,v FROM meta WHERE k LIKE 'prop:%'`)) props[r.k.slice(5)] = r.v;
  const env = makeEnv({ salt: cfg.salt, tz: cfg.tz, files, props, seq: () => state.seq, seqOf: () => state.seqOf, log: (m) => console.error(m),
    onProp: (k, v) => { db.q(`INSERT INTO meta(k,v,seq) VALUES(?,?,0) ON CONFLICT(k) DO UPDATE SET v=excluded.v`, ['prop:' + k, v]).catch(() => {}); },
    onMail: (to, s, b) => mail.enqueue(to, s, b) });
  const rules = createRules(env);
  const { sign, unsign } = U.signer(cfg.sessionSecret), limit = U.limiter(), baseHeaders = securityHeaders(cfg);
  const oidc = cfg.entra.clientId ? oidcFactory(cfg, sign, unsign, { authority: opts.authority, fetchJson: opts.fetchJson }) : null;
  const pub = path.join(__dirname, '..', 'public'), assets = new Map();
  function loadAssets() {
    assets.clear();
    if (!fs.existsSync(pub)) return;
    for (const f of fs.readdirSync(pub)) {
      const full = path.join(pub, f); if (!fs.statSync(full).isFile()) continue;
      const buf = fs.readFileSync(full), ext = path.extname(f), type = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.json': 'application/json' }[ext] || 'application/octet-stream';
      assets.set(f, { buf, type, gz: buf.length > 1024 ? zlib.gzipSync(buf, { level: 9 }) : null, etag: '"' + crypto.createHash('sha1').update(buf).digest('hex').slice(0, 20) + '"' });
    }
  }
  loadAssets();

  const ipOf = (req) => { if (cfg.trustProxy) { const x = String(req.headers['x-azure-clientip'] || req.headers['x-forwarded-for'] || '').split(',')[0].trim(); if (x) return x.replace(/:\d+$/, ''); } return req.socket.remoteAddress || ''; };
  const sse = new Set(); let sseTimer = null, ssePending = false;
  state.on(() => { ssePending = true; if (sseTimer) return; sseTimer = setTimeout(() => { sseTimer = null; if (!ssePending) return; ssePending = false; const m = 'data: {"seq":' + state.seq + '}\n\n'; for (const r of sse) { try { r.write(m); } catch (e) {} } }, 400); });

  function sendAsset(req, res, name, extra) {
    const a = assets.get(name); if (!a) return false;
    const h = Object.assign({ 'Content-Type': a.type, 'ETag': a.etag, 'Cache-Control': 'no-cache', 'Vary': 'Accept-Encoding' }, extra || {});
    if (req.headers['if-none-match'] === a.etag) { res.writeHead(304, h); res.end(); return true; }
    let body = a.buf; if (a.gz && /\bgzip\b/.test(req.headers['accept-encoding'] || '')) { body = a.gz; h['Content-Encoding'] = 'gzip'; }
    h['Content-Length'] = body.length; res.writeHead(200, h); res.end(body); return true;
  }
  function redirect(res, url, cookies) { const h = { Location: url, 'Cache-Control': 'no-store' }; if (cookies) h['Set-Cookie'] = cookies; res.writeHead(302, h); res.end(); }
  function page(res, status, title, text, extra) {
    const body = '<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>' + title + '</title><body style="font:16px/1.5 system-ui,Segoe UI,Arial;background:#0e1220;color:#e8ecf8;display:flex;min-height:100vh;align-items:center;justify-content:center;margin:0"><div style="max-width:420px;padding:24px;text-align:center"><div style="font-size:40px">🔐</div><h2>' + title + '</h2><p style="opacity:.8">' + text + '</p>' + (extra || '') + '</div></body>';
    res.writeHead(status, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(body);
  }

  /* who is calling: the session behind the cookie */
  async function who(req) {
    const raw = U.parseCookies(req.headers.cookie)[sessions.cookieName]; const s = await sessions.get(raw);
    if (!s) return null; return { sid: s.id, email: s.email, name: s.name, admin: s.admin, csrf: s.csrf };
  }
  const isStaff = (id) => id.admin || !!rules.whoIs_(state.cur, id.email).role;

  async function establish(res, req, u, redirectTo) {
    const s = await sessions.create(u, { ip: ipOf(req), ua: req.headers['user-agent'] });
    audit.log(u.email, 'login', u.admin ? 'admin' : 'user', ipOf(req));
    redirect(res, redirectTo || '/', [U.cookie(sessions.cookieName, s.raw, { maxAge: s.maxAge, secure: cfg.prod }), U.cookie(cfg.prod ? '__Host-ptf_oidc' : 'ptf_oidc', '', { maxAge: 0, secure: cfg.prod })]);
  }

  /* run one tool request (the single-file tool's pull / push / etc.) */
  async function rpc(id, b, allowed, ip) {
    const act = b && b.action;
    if (typeof act !== 'string' || KNOWN_ACTIONS.indexOf(act) < 0) return { error: 'unknown' };
    if (allowed && allowed.indexOf(act) < 0) return { error: 'not allowed' };
    if (act === 'list') return { users: [] };
    if (act === 'setStatus' || act === 'remove') return { ok: true };
    if (act === 'request') return { status: 'approved' };
    const who = { email: id.email, name: id.name, admin: id.admin };
    let r;
    if (WRITE_ACTIONS.indexOf(act) >= 0) r = await state.mutate((cur) => rules.handle(b, who, cur));
    else { await state.settled(); r = rules.handle(b, who, state.cur); }
    mail.flushQueue().catch(() => {});
    if (act === 'push') { const n = Object.keys(b.keys || {}).length; if ((r.denied && r.denied.length) || (r.conflicts && r.conflicts.length)) audit.log(id.email, 'push.refused', 'denied=' + (r.denied || []).join(',').slice(0, 300) + ' conflicts=' + (r.conflicts || []).length, ip); else if (n && cfg.auditEveryPush) audit.log(id.email, 'push', n + ' keys', ip); }
    if (act === 'videoGet' || act === 'pjFileGet') audit.log(id.email, act, String(b.id || '').slice(0, 60), ip);
    return r;
  }

  async function route(req, res) {
    const url = new URL(req.url, 'http://x'), p = url.pathname, m = req.method, ip = ipOf(req);
    if (cfg.frontDoorId && p !== '/healthz' && req.headers['x-azure-fdid'] !== cfg.frontDoorId) { res.writeHead(403); return res.end(); }

    if (p === '/healthz') { let ok = true; try { await db.q('SELECT 1 AS x'); } catch (e) { ok = false; } return U.sendJson(req, res, ok ? 200 : 503, { ok, seq: state.seq }); }
    if (p === '/static/shim.js' || p === '/static/portal.js') { if (sendAsset(req, res, p.slice(8))) return; }

    /* ---- sign-in ---- */
    if (p === '/auth/login' && m === 'GET') {
      if (!limit('auth:' + ip, cfg.limits.authPerMin, 60e3)) return page(res, 429, 'Too many attempts', 'Wait a minute and try again.');
      if (!oidc) return page(res, 503, 'Sign-in is not configured', 'Ask the administrator to configure Microsoft sign-in.');
      const st = oidc.start(url.searchParams.get('to') || '/'); return redirect(res, st.url, U.cookie(cfg.prod ? '__Host-ptf_oidc' : 'ptf_oidc', st.cookie, { maxAge: 600, secure: cfg.prod, sameSite: 'Lax' }));
    }
    if (p === '/auth/callback' && m === 'GET') {
      if (!limit('auth:' + ip, cfg.limits.authPerMin, 60e3)) return page(res, 429, 'Too many attempts', 'Wait a minute and try again.');
      if (!oidc) return page(res, 503, 'Sign-in is not configured', '');
      try { const u = await oidc.finish(Object.fromEntries(url.searchParams), U.parseCookies(req.headers.cookie)[cfg.prod ? '__Host-ptf_oidc' : 'ptf_oidc']); return await establish(res, req, u, u.returnTo); }
      catch (e) { audit.log('', 'login.failed', String(e.message).slice(0, 200), ip); return page(res, 401, 'Sign-in failed', String(e.message).replace(/[<>&]/g, ''), '<p><a style="color:#7aa7ff" href="/auth/login">Try again</a></p>'); }
    }
    if (p === '/dev/login' && m === 'GET' && cfg.devLogin && !cfg.prod) {   // tests and local demos only; refused at start in production
      const email = String(url.searchParams.get('email') || '').toLowerCase(); if (!/^[^@\s]+@[^@\s]+$/.test(email)) return page(res, 400, 'Bad e-mail', '');
      return establish(res, req, { email, name: url.searchParams.get('name') || email.split('@')[0], admin: url.searchParams.get('admin') === '1' }, url.searchParams.get('to') || '/');
    }
    if (p === '/auth/logout') {
      const raw = U.parseCookies(req.headers.cookie)[sessions.cookieName]; const id = await who(req); if (id) audit.log(id.email, 'logout', '', ip); await sessions.destroy(raw);
      const ck = U.cookie(sessions.cookieName, '', { maxAge: 0, secure: cfg.prod }); return redirect(res, oidc && cfg.prod ? oidc.logoutUrl() : '/signed-out', ck);
    }
    if (p === '/signed-out') return page(res, 200, 'Signed out', 'You are signed out.', '<p><a style="color:#7aa7ff" href="/auth/login">Sign in again</a></p>');

    /* ---- everything below needs a session ---- */
    const id = await who(req);
    if (!id) {
      if (p.startsWith('/api/')) return U.sendJson(req, res, 401, { error: 'signed out' }, { 'Cache-Control': 'no-store' });
      if (m === 'GET' && (p === '/' || p === '/employee' || p === '/tool')) return redirect(res, '/auth/login?to=' + encodeURIComponent(p));
      res.writeHead(404); return res.end();
    }

    if (m === 'GET' && (p === '/' || p === '/tool' || p === '/employee')) {
      const staff = isStaff(id);
      const want = p === '/' ? (staff ? 'tool' : 'employee') : p === '/tool' ? 'tool' : 'employee';
      if (want === 'tool' && !staff) { audit.log(id.email, 'tool.denied', 'no staff role', ip); return redirect(res, '/employee'); }
      return sendAsset(req, res, want === 'tool' ? 'tool.html' : 'employee.html', { 'Cache-Control': 'no-store' }) || page(res, 503, 'Not built', 'Run npm run build.');
    }
    if (m === 'GET' && p === '/api/session') {
      return U.sendJson(req, res, 200, { email: id.email, name: id.name, admin: id.admin, staff: isStaff(id), csrf: id.csrf, version: '4.0' }, { 'Cache-Control': 'no-store' });
    }
    if (m === 'GET' && p === '/api/boot.js') {   // the tool's data for this person, written into the page before the tool starts
      if (!isStaff(id)) { res.writeHead(403); return res.end(); }
      await state.settled();
      const r = rules.handle({ action: 'pull' }, { email: id.email, name: id.name, admin: id.admin }, state.cur);
      const role = id.admin ? 'admin' : rules.whoIs_(state.cur, id.email).role;
      const boot = { keys: r.keys || {}, seq: r.seq, updatedAt: r.updatedAt, user: { email: id.email, name: id.name, admin: id.admin, role }, csrf: id.csrf, site: opts.site || '' };
      return U.sendBuf(req, res, 200, Buffer.from('window.__PTF_BOOT=' + JSON.stringify(boot).replace(/</g, '\\u003c') + ';'), 'text/javascript; charset=utf-8', { 'Cache-Control': 'no-store' });
    }
    if (m === 'GET' && p === '/api/events') {
      if (!isStaff(id) || sse.size >= 3000) { res.writeHead(sse.size >= 3000 ? 503 : 403); return res.end(); }
      res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store', 'Connection': 'keep-alive', 'X-Accel-Buffering': 'no' });
      res.write('retry: 5000\n\ndata: {"seq":' + state.seq + '}\n\n'); sse.add(res);
      const hb = setInterval(() => { try { res.write(': hb\n\n'); } catch (e) {} }, 25000);
      req.on('close', () => { clearInterval(hb); sse.delete(res); }); return;
    }
    if (m === 'GET' && p === '/api/admin/audit') {
      if (!id.admin) { res.writeHead(403); return res.end(); } await audit.flush();
      return U.sendJson(req, res, 200, { rows: await audit.recent(url.searchParams.get('n')), chain: url.searchParams.get('verify') === '1' ? await audit.verify() : undefined }, { 'Cache-Control': 'no-store' });
    }
    if (m === 'POST' && (p === '/api/rpc' || p === '/api/employee')) {
      // CSRF: a custom header that a cross-site form or image cannot send, plus the Origin check
      if (req.headers['x-ptf-csrf'] !== id.csrf) { audit.log(id.email, 'csrf.refused', p, ip); return U.sendJson(req, res, 403, { error: 'forbidden' }); }
      const org = req.headers.origin; if (org && cfg.publicUrl && org !== cfg.publicUrl) { audit.log(id.email, 'origin.refused', String(org).slice(0, 100), ip); return U.sendJson(req, res, 403, { error: 'forbidden' }); }
      if (!limit('rpc:' + id.sid, cfg.limits.rpcPerMin, 60e3)) return U.sendJson(req, res, 429, { error: 'busy' }, { 'Retry-After': '10' });
      let b; try { b = JSON.parse(await U.readBody(req, cfg.limits.bodyBytes)); } catch (e) { return U.sendJson(req, res, e.status || 400, { error: e.status === 413 ? 'too large' : 'bad request' }); }
      if (!b || typeof b !== 'object' || Array.isArray(b)) return U.sendJson(req, res, 400, { error: 'bad request' });
      if (p === '/api/rpc' && !isStaff(id)) return U.sendJson(req, res, 403, { error: 'not allowed' });
      const r = await rpc(id, b, p === '/api/employee' ? EMPLOYEE_ACTIONS : null, ip);
      return U.sendJson(req, res, 200, r, { 'Cache-Control': 'no-store' });
    }
    res.writeHead(404); res.end();
  }

  const server = http.createServer((req, res) => {
    for (const k in baseHeaders) res.setHeader(k, baseHeaders[k]);
    route(req, res).catch((e) => { console.error('[http]', req.method, req.url.split('?')[0], e && e.stack || e); if (!res.headersSent) { res.writeHead(500, { 'Content-Type': 'application/json' }); res.end('{"error":"server error"}'); } else res.end(); });
  });
  server.requestTimeout = 60000; server.headersTimeout = 15000; server.keepAliveTimeout = 65000; server.maxRequestsPerSocket = 0;

  /* ---- background work ---- */
  const timers = [];
  const every = (ms, fn, name) => timers.push(setInterval(() => { Promise.resolve().then(fn).catch((e) => console.error('[job ' + name + ']', e.message)); }, ms));
  if (!opts.noJobs) {
    every(1000, () => state.catchUp(), 'catchup');                      // pick up what other instances saved
    every(15000, () => mail.work(), 'mail');
    every(10 * 60e3, () => sessions.sweep(), 'sessions');
    every(60 * 60e3, async () => { files.cleanVideos(62); await mail.cleanup(); }, 'cleanup');
    every(60e3, async () => {                                           // 07:00 local: the daily project e-mail; once a day across all instances
      const hh = new Intl.DateTimeFormat('en-GB', { timeZone: cfg.tz, hour: '2-digit', hourCycle: 'h23' }).format(new Date()); if (hh !== '07') return;
      await state.mutate((cur) => { rules.runDigest(cur, { email: '', name: '' }); }); await mail.flushQueue();
    }, 'digest');
    every(24 * 3600e3, () => require('./services/backup').run(state, cfg), 'backup');
  }

  return {
    server, state, sessions, audit, mail, files, rules, env, cfg, reloadAssets: loadAssets,
    listen: (port, host) => new Promise((r) => server.listen(port === undefined ? cfg.port : port, host || '0.0.0.0', () => r(server.address().port))),
    async close() { timers.forEach(clearInterval); for (const r of sse) { try { r.end(); } catch (e) {} } sse.clear(); await new Promise((r) => server.close(r)); server.closeAllConnections && server.closeAllConnections(); await audit.flush(); await mail.flushQueue(); await state.close(); }
  };
}
module.exports = { createApp };
