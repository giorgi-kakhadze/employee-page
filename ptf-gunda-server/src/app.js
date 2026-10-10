'use strict';
const http = require('http'), fs = require('fs'), path = require('path'), crypto = require('crypto'), zlib = require('zlib');
const { State } = require('./store/state');
const makeEnv = require('./rules/env'), createRules = require('./rules/rules');
const sessionsFactory = require('./auth/session'), oidcFactory = require('./auth/oidc');
const filesFactory = require('./services/files'), auditFactory = require('./services/audit'), mailFactory = require('./services/mail');
const U = require('./http/util'), securityHeaders = require('./http/headers');

/* per-person settings that are not shared data (theme, sounds, which location was open last). Kept on the server so they follow the person, not the laptop. */
const PREF_KEYS = ['totAppTheme', 'totAppStyle', 'totSoundPrefs', 'totMusicPrefs', 'totConsentV1', 'totLastSite', 'rememberSupervisor', 'supFirstName'];
const EMPLOYEE_ACTIONS = ['me', 'reqNew', 'reqCancel', 'ack'];
const WRITE_ACTIONS = ['push', 'reqNew', 'reqCancel', 'ack'];
const KNOWN_ACTIONS = ['pull', 'push', 'me', 'reqNew', 'reqCancel', 'ack', 'login', 'video', 'videoGet', 'projNotify', 'ackRemind', 'reqMail', 'pjFileUp', 'pjFileGet', 'list', 'setStatus', 'remove', 'request'];

async function createApp(cfg, opts) {
  opts = opts || {};
  const log = opts.log || ((...a) => { if (!cfg.quiet) console.log(...a); });
  const state = await State.open(cfg), db = state.d;
  const files = filesFactory(cfg.dataDir), audit = auditFactory(db), sessions = sessionsFactory(db, cfg);
  const mail = mailFactory(db, cfg, opts.sentMail);
  const props = {}; for (const r of await db.q(`SELECT k,v FROM meta WHERE k LIKE 'prop:%'`)) props[r.k.slice(5)] = r.v;
  if (props.EMPLOYEE_PAGE_URL == null && cfg.publicUrl && !/:0$/.test(cfg.publicUrl)) props.EMPLOYEE_PAGE_URL = cfg.publicUrl.replace(/\/$/, '') + '/employee';   /* the link in reminder e-mails */
  const env = makeEnv({ salt: cfg.salt, tz: cfg.tz, files, props, seq: () => state.seq, seqOf: () => state.seqOf, log: (m) => console.error(m),
    onProp: (k, v) => { db.q(`INSERT INTO meta(k,v,seq) VALUES(?,?,0) ON CONFLICT(k) DO UPDATE SET v=excluded.v`, ['prop:' + k, v]).catch(() => {}); },
    onMail: (to, s, b) => mail.enqueue(to, s, b) });
  const rules = createRules(env);
  /* how long the rule code takes per action (milliseconds of CPU, it is synchronous); printed by the metrics line, so capacity can be planned from real numbers */
  const stats = { m: {}, h: {}, rec(a, ms) { const e = this.m[a] || (this.m[a] = []); if (e.length < 5000) e.push(ms); }, http(a, ms) { const e = this.h[a] || (this.h[a] = []); if (e.length < 5000) e.push(ms); },
    sum(m) { const o = {}; Object.keys(m).forEach((a) => { const s = m[a].slice().sort((x, y) => x - y), n = s.length; o[a] = { n, p50: +s[Math.floor(n * 0.5)].toFixed(2), p95: +s[Math.floor(n * 0.95)].toFixed(2), p99: +s[Math.floor(n * 0.99)].toFixed(2), max: +s[n - 1].toFixed(1) }; }); return o; },
    take() { const o = { rules: this.sum(this.m), http: this.sum(this.h) }; this.m = {}; this.h = {}; return o; } };
  const { sign, unsign } = U.signer(cfg.sessionSecret), limit = U.limiter(), baseHeaders = securityHeaders(cfg);
  const oidc = cfg.entra.clientId ? oidcFactory(cfg, sign, unsign, { authority: opts.authority, fetchJson: opts.fetchJson }) : null;
  const pub = path.join(__dirname, '..', 'public'), assets = new Map();
  function loadAssets() {
    assets.clear();
    if (!fs.existsSync(pub)) return;
    for (const f of fs.readdirSync(pub)) {
      const full = path.join(pub, f); if (!fs.statSync(full).isFile()) continue;
      const buf = fs.readFileSync(full), ext = path.extname(f), type = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.json': 'application/json', '.webmanifest': 'application/manifest+json' }[ext] || 'application/octet-stream';
      assets.set(f, { buf, type, gz: buf.length > 1024 ? zlib.gzipSync(buf, { level: 9 }) : null, etag: '"' + crypto.createHash('sha1').update(buf).digest('hex').slice(0, 20) + '"' });
    }
  }
  loadAssets();

  /* big values are the same for many people (the schedule of a location, the employee list). JSON-escaping them again for every person was a third of the server's work,
     so the escaped text of each big value is kept (64 most recent versions) and pasted into the answer. */
  const frag = new Map(); let fragBytes = 0;
  function fragOf(v) { let e = frag.get(v); if (!e) { e = Buffer.from(JSON.stringify(v)); frag.set(v, e); fragBytes += e.length; while (fragBytes > 160 * 1048576 && frag.size > 1) { const k = frag.keys().next().value; fragBytes -= frag.get(k).length; frag.delete(k); } } return e; }
  /* the answer to a pull as a Buffer: small parts are text, big shared values are pasted in as bytes (no 9 MB string is ever built) */
  function pullBuf(r, tail) {
    const bufs = []; let txt = '{"keys":{', first = true;
    for (const k of Object.keys(r.keys || {})) { const x = r.keys[k]; txt += (first ? '' : ',') + JSON.stringify(k) + ':'; first = false;
      if (x && typeof x.v === 'string' && x.v.length > 20000) { bufs.push(Buffer.from(txt + '{"v":')); bufs.push(fragOf(x.v)); txt = ',"t":' + (+x.t || 0) + '}'; } else txt += JSON.stringify(x); }
    txt += '},"updatedAt":' + (+r.updatedAt || 0) + ',"seq":' + (+r.seq || 0) + ',"delta":' + (r.delta ? 'true' : 'false') + (tail || '');
    bufs.push(Buffer.from(txt)); return Buffer.concat(bufs);
  }
  /* admission control for the heavy answers (a whole page of data is 4-9 MB): at most 6 are built and sent at once, the rest wait their turn (up to 600 waiting).
     A crowd all opening the tool at the same moment is then slower for the last ones, but the server never builds hundreds of 9 MB answers in memory at once. */
  const gate = { n: 0, max: cfg.bootConcurrency || 6, q: [],
    async enter(res) {
      let held = false, gone = false;
      res.on('close', () => { gone = true; if (held) { held = false; const nx = this.q.shift(); if (nx) nx(); else this.n--; } });
      res.on('finish', () => { if (held) { held = false; const nx = this.q.shift(); if (nx) nx(); else this.n--; } });
      if (this.n >= this.max) { if (this.q.length >= 600) return false; const ok = await new Promise((r) => { const f = () => r(true); f.res = res; this.q.push(f); setTimeout(() => { const ix = this.q.indexOf(f); if (ix >= 0) { this.q.splice(ix, 1); r(false); } }, 60000).unref(); }); if (!ok) return false; } else this.n++;
      if (res.destroyed || gone) { const nx = this.q.shift(); if (nx) nx(); else this.n--; return false; }
      held = true; return true;
    } };
  const ipOf = (req) => { if (cfg.trustProxy) { const x = String(req.headers['x-azure-clientip'] || req.headers['x-forwarded-for'] || '').split(',')[0].trim(); if (x) return /^\d+\.\d+\.\d+\.\d+:\d+$/.test(x) ? x.replace(/:\d+$/, '') : x; } return req.socket.remoteAddress || ''; };
  const sse = new Set(); let sseTimer = null, ssePending = false;
  const tvSse = new Set(); let tvTimer = null; const tvSites = new Set();
  state.on((ev) => { for (const k of ev.keys || []) { const q = rules.parseKey_(k); if (q && (q.name === 'totSchedule' || q.name === 'totTvScreens')) tvSites.add(q.site); } if (!tvSites.size || tvTimer) return; tvTimer = setTimeout(() => { tvTimer = null; const s = new Set(tvSites); tvSites.clear(); for (const r of tvSse) { if (!s.has(r._site)) continue; try { r.write('data: {"changed":1}\n\n'); } catch (e) {} } }, 300); });
  const sseSites = new Set(); let sseAll = false;   // which locations changed since the last notice
  state.on((ev) => { for (const k of ev.keys || []) { const q = rules.parseKey_(k); if (!q) continue; if (['totAccessPolicy', 'totAccessGrants', 'totAccessAsks', 'totSites'].indexOf(q.name) >= 0) sseAll = true; else sseSites.add(q.site); }
    ssePending = true; if (sseTimer) return; sseTimer = setTimeout(() => { sseTimer = null; if (!ssePending) return; ssePending = false; const m = 'data: {"seq":' + state.seq + '}\n\n', all = sseAll, sites = new Set(sseSites); sseAll = false; sseSites.clear(); for (const r of sse) { if (!all && !sites.has(r._site)) continue; try { r.write(m); } catch (e) {} } }, 400); });

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
  async function rpc(id, b, allowed, ip, lab) {
    const act = b && b.action;
    if (typeof act !== 'string' || KNOWN_ACTIONS.indexOf(act) < 0) return { error: 'unknown' };
    if (allowed && allowed.indexOf(act) < 0) return { error: 'not allowed' };
    if (act === 'list') return { users: [] };
    if (act === 'setStatus' || act === 'remove') return { ok: true };
    if (act === 'request') return { status: 'approved' };
    const who = { email: id.email, name: id.name, admin: id.admin };
    let r, ms = 0;
    const timed = (cur) => { const t0 = process.hrtime.bigint(); try { return rules.handle(b, who, cur); } finally { ms = Number(process.hrtime.bigint() - t0) / 1e6; } };
    if (WRITE_ACTIONS.indexOf(act) >= 0) r = await state.mutate(timed);
    else { await state.settled(); r = timed(state.cur); }
    stats.rec(act, ms); if (lab) lab.l = lab.l + ':' + act;
    mail.flushQueue().catch(() => {});
    if (act === 'push') { const n = Object.keys(b.keys || {}).length; if ((r.denied && r.denied.length) || (r.conflicts && r.conflicts.length)) audit.log(id.email, 'push.refused', 'denied=' + (r.denied || []).join(',').slice(0, 300) + ' conflicts=' + (r.conflicts || []).length, ip); else if (n && cfg.auditEveryPush) audit.log(id.email, 'push', n + ' keys', ip); }
    if (act === 'videoGet' || act === 'pjFileGet') audit.log(id.email, act, String(b.id || '').slice(0, 60), ip);
    return r;
  }

  async function route(req, res) {
    if (req.url.startsWith('//')) { res.writeHead(404); return res.end(); }
    const url = new URL(req.url, 'http://x'), p = url.pathname, m = req.method, ip = ipOf(req);
    if (cfg.frontDoorId && p !== '/healthz' && req.headers['x-azure-fdid'] !== cfg.frontDoorId) { res.writeHead(403); return res.end(); }

    if (p === '/healthz') { let ok = true; try { await db.q('SELECT 1 AS x'); } catch (e) { ok = false; } return U.sendJson(req, res, ok ? 200 : 503, { ok }); }
    if (p === '/static/shim.js' || p === '/static/pre.js') { if (sendAsset(req, res, p.slice(8))) return; }
    if (/^\/(employee-sw\.js|employee\.webmanifest|pwa-icon-(180|192|512|maskable-512)\.png)$/.test(p)) { if (sendAsset(req, res, p.slice(1), p === '/employee-sw.js' ? { 'Service-Worker-Allowed': '/employee' } : { 'Cache-Control': 'public, max-age=86400' })) return; }   /* the phone app files: public, no personal data */

    /* ---- lobby screens: no sign-in, a long secret token in the link; they get the rotation of their scope and nothing else ---- */
    if (m === 'GET' && (p.startsWith('/tv/') || p === '/api/tv' || p === '/api/tv-events')) {
      if (cfg.tvIps.length && !cfg.tvIps.some((x) => ip === x || ip.startsWith(x))) { audit.log('tv', 'tv.refused', 'address not allowed', ip); res.writeHead(403); return res.end(); }
      if (!limit('tv:' + ip, 240, 60e3)) { res.writeHead(429, { 'Retry-After': '30' }); return res.end(); }
      const tok = p.startsWith('/tv/') ? p.slice(4).replace(/\/$/, '') : String(url.searchParams.get('t') || '');
      const known = /^[A-Za-z0-9_-]{24,80}$/.test(tok) ? rules.tvToken(tok, state.cur) : null;
      if (!known) { audit.log('tv', 'tv.unknown', '', ip); if (p.startsWith('/tv/')) return page(res, 404, 'Screen not found', 'This screen link is not valid. Ask your coordinator for a new one.'); return U.sendJson(req, res, 404, { error: 'not found' }, { 'Cache-Control': 'no-store' }); }
      if (p.startsWith('/tv/')) { if (limit('tvopen:' + tok + ip, 1, 600e3)) audit.log('tv', 'tv.open', known.id, ip); return sendAsset(req, res, 'tv.html', { 'Cache-Control': 'no-store' }) || page(res, 503, 'Not built', 'Run npm run build.'); }
      if (p === '/api/tv') { const r = rules.tv({ token: tok, d: url.searchParams.get('d'), h: url.searchParams.get('h') }, state.cur); return U.sendJson(req, res, r.error ? 404 : 200, r, { 'Cache-Control': 'no-store' }); }
      if ([...tvSse].filter((r) => r._ip === ip).length >= 8 || tvSse.size >= 1500) { res.writeHead(429); return res.end(); }
      res._ip = ip; res._site = known.site; res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store', 'Connection': 'keep-alive', 'X-Accel-Buffering': 'no' });
      res.write('retry: 5000\n\ndata: {"hello":1}\n\n'); tvSse.add(res); const thb = setInterval(() => { try { res.write(': hb\n\n'); } catch (e) {} }, 25000); req.on('close', () => { clearInterval(thb); tvSse.delete(res); }); return;
    }

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
      if (!limit('boot:' + id.sid, 30, 60e3)) return page(res, 429, 'Slow down', 'Reloading too fast. Wait a minute.');
      if (!(await gate.enter(res))) { res.writeHead(503, { 'Retry-After': '5' }); return res.end(); }
      await state.settled();
      const w = id.admin ? { role: 'admin', sites: null } : rules.whoIs_(state.cur, id.email);
      let site = String(url.searchParams.get('site') || '').replace(/[^a-z0-9-]/g, '').slice(0, 30);
      const okSite = (s) => s && (w.sites ? w.sites.indexOf(s) >= 0 : true);
      if (!okSite(site)) site = w.sites ? (w.sites.indexOf('main') >= 0 ? 'main' : (w.sites[0] || 'main')) : 'main';
      const r = rules.handle({ action: 'pull', site }, { email: id.email, name: id.name, admin: id.admin }, state.cur);
      const role = w.role;
      let prefs = {}; try { const pr = (await db.q('SELECT v FROM prefs WHERE email=?', [id.email]))[0]; if (pr) prefs = JSON.parse(pr.v) || {}; } catch (e) {}
      const boot = { prefs, keys: r.keys || {}, seq: r.seq, updatedAt: r.updatedAt, user: { email: id.email, name: id.name, admin: id.admin, role }, csrf: id.csrf, site };
      const small = JSON.stringify({ user: boot.user, csrf: boot.csrf, site: boot.site, prefs: boot.prefs }).replace(/</g, '\\u003c').slice(1);
      return U.sendBuf(req, res, 200, Buffer.concat([Buffer.from('window.__PTF_BOOT='), pullBuf(r, ',' + small), Buffer.from(';')]), 'text/javascript; charset=utf-8', { 'Cache-Control': 'no-store' });
    }
    if (m === 'GET' && p === '/api/events') {
      if (!isStaff(id) || sse.size >= 3000) { res.writeHead(sse.size >= 3000 ? 503 : 403); return res.end(); }
      if ([...sse].filter((r) => r._sid === id.sid).length >= 4) { res.writeHead(429); return res.end(); }
      res._sid = id.sid; res._site = String(url.searchParams.get('site') || 'main').replace(/[^a-z0-9-]/g, '').slice(0, 30) || 'main';
      res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store', 'Connection': 'keep-alive', 'X-Accel-Buffering': 'no' });
      res.write('retry: 5000\n\ndata: {"seq":' + state.seq + '}\n\n'); sse.add(res);
      const raw = U.parseCookies(req.headers.cookie)[sessions.cookieName];
      const hb = setInterval(async () => { try { if (!(await sessions.get(raw, { peek: true }))) { res.end(); return; } res.write(': hb\n\n'); } catch (e) {} }, 25000);   // a signed-out or expired session loses its live channel
      req.on('close', () => { clearInterval(hb); sse.delete(res); }); return;
    }
    if (m === 'GET' && p === '/api/admin/audit') {
      if (!id.admin) { res.writeHead(403); return res.end(); } await audit.flush();
      return U.sendJson(req, res, 200, { rows: await audit.recent(url.searchParams.get('n')), chain: url.searchParams.get('verify') === '1' ? await audit.verify() : undefined }, { 'Cache-Control': 'no-store' });
    }
    if (m === 'POST' && p === '/api/prefs') {
      if (req.headers['x-ptf-csrf'] !== id.csrf) return U.sendJson(req, res, 403, { error: 'forbidden' });
      if (!limit('prefs:' + id.sid, 60, 60e3)) return U.sendJson(req, res, 429, { error: 'busy' });
      let b; try { b = JSON.parse(await U.readBody(req, 32768)); } catch (e) { return U.sendJson(req, res, 400, { error: 'bad request' }); }
      const o = {}; let n = 0; if (!b || typeof b.prefs !== 'object' || Array.isArray(b.prefs)) return U.sendJson(req, res, 400, { error: 'bad request' });
      for (const k of PREF_KEYS) if (typeof b.prefs[k] === 'string') { o[k] = b.prefs[k].slice(0, 4000); n += o[k].length; }
      if (n > 16000) return U.sendJson(req, res, 413, { error: 'too large' });
      await db.q('INSERT INTO prefs(email,v,t) VALUES(?,?,?) ON CONFLICT(email) DO UPDATE SET v=excluded.v,t=excluded.t', [id.email, JSON.stringify(o), Date.now()]);
      return U.sendJson(req, res, 200, { ok: true }, { 'Cache-Control': 'no-store' });
    }
    if (m === 'POST' && (p === '/api/rpc' || p === '/api/employee')) {
      // CSRF: a custom header that a cross-site form or image cannot send, plus the Origin check
      if (req.headers['x-ptf-csrf'] !== id.csrf) { audit.log(id.email, 'csrf.refused', p, ip); return U.sendJson(req, res, 403, { error: 'forbidden' }); }
      const org = req.headers.origin; if (org && cfg.publicUrl && org !== cfg.publicUrl) { audit.log(id.email, 'origin.refused', String(org).slice(0, 100), ip); return U.sendJson(req, res, 403, { error: 'forbidden' }); }
      if (!limit('rpc:' + id.sid, cfg.limits.rpcPerMin, 60e3)) return U.sendJson(req, res, 429, { error: 'busy' }, { 'Retry-After': '10' });
      let b; try { b = JSON.parse(await U.readBody(req, cfg.limits.bodyBytes)); } catch (e) { return U.sendJson(req, res, e.status || 400, { error: e.status === 413 ? 'too large' : 'bad request' }); }
      if (!b || typeof b !== 'object' || Array.isArray(b)) return U.sendJson(req, res, 400, { error: 'bad request' });
      if (p === '/api/rpc' && !isStaff(id)) return U.sendJson(req, res, 403, { error: 'not allowed' });
      if (p === '/api/employee' && !limit('emp:' + id.email, 20, 60e3)) return U.sendJson(req, res, 429, { error: 'busy' }, { 'Retry-After': '10' });
      if (b.action === 'pull' && !(+b.since > 0)) { if (!limit('fullpull:' + id.email, cfg.limits.fullPullPerMin, 60e3)) return U.sendJson(req, res, 429, { error: 'busy' }, { 'Retry-After': '10' }); if (!(await gate.enter(res))) return U.sendJson(req, res, 503, { error: 'busy' }, { 'Retry-After': '5' }); }
      const lab = req._lab = { l: p === '/api/employee' ? 'employee' : 'rpc' }; const r = await rpc(id, b, p === '/api/employee' ? EMPLOYEE_ACTIONS : null, ip, lab);
      if (b.action === 'pull' && r && r.keys) return U.sendBuf(req, res, 200, pullBuf(r, '}'), 'application/json; charset=utf-8', { 'Cache-Control': 'no-store' });
      return U.sendJson(req, res, 200, r, { 'Cache-Control': 'no-store' });
    }
    res.writeHead(404); res.end();
  }

  const server = http.createServer((req, res) => {
    for (const k in baseHeaders) res.setHeader(k, baseHeaders[k]);
    const t0 = process.hrtime.bigint(); res.on('finish', () => { const p = req.url.split('?')[0]; stats.http(req._lab ? req._lab.l : p === '/api/boot.js' ? 'boot' : p === '/' || p === '/employee' || p === '/tool' ? 'page' : p.startsWith('/dev/login') || p.startsWith('/auth') ? 'sign-in' : 'other', Number(process.hrtime.bigint() - t0) / 1e6); });
    route(req, res).catch((e) => { console.error('[http]', req.method, req.url.split('?')[0], e && e.stack || e); if (!res.headersSent) { res.writeHead(500, { 'Content-Type': 'application/json' }); res.end('{"error":"server error"}'); } else res.end(); });
  });
  server.requestTimeout = 60000; server.headersTimeout = 15000; server.keepAliveTimeout = 65000; server.maxRequestsPerSocket = 0;

  /* ---- background work ---- */
  const timers = [];
  const every = (ms, fn, name) => timers.push(setInterval(() => { Promise.resolve().then(fn).catch((e) => console.error('[job ' + name + ']', e.message)); }, ms));
  if (!opts.noJobs) {
    every(1000, () => db.lock(() => state.catchUp()), 'catchup');                      // pick up what other instances saved
    every(15000, () => mail.work(), 'mail');
    every(10 * 60e3, () => sessions.sweep(), 'sessions');
    every(60 * 60e3, async () => { files.cleanVideos(62); await mail.cleanup(); }, 'cleanup');
    every(60e3, async () => {                                           // 07:00 local: the daily project e-mail; once a day across all instances
      const hh = new Intl.DateTimeFormat('en-GB', { timeZone: cfg.tz, hour: '2-digit', hourCycle: 'h23' }).format(new Date()); if (hh !== '07') return;
      await db.lock(async () => { for (const r of await db.q(`SELECT k,v FROM meta WHERE k LIKE 'prop:%'`)) props[r.k.slice(5)] = r.v; rules.runDigest(state.cur, { email: '', name: '' }); }); await mail.flushQueue();
    }, 'digest');
    every(24 * 3600e3, () => require('./services/backup').run(state, cfg), 'backup');
  }

  return {
    server, state, sessions, audit, mail, files, rules, env, cfg, stats, reloadAssets: loadAssets,
    listen: (port, host) => new Promise((r) => server.listen(port === undefined ? cfg.port : port, host || '0.0.0.0', () => r(server.address().port))),
    async close() { timers.forEach(clearInterval); for (const r of sse) { try { r.end(); } catch (e) {} } sse.clear(); for (const r of tvSse) { try { r.end(); } catch (e) {} } tvSse.clear(); await new Promise((r) => server.close(r)); server.closeAllConnections && server.closeAllConnections(); await audit.flush(); await mail.flushQueue(); await state.close(); }
  };
}
module.exports = { createApp };
