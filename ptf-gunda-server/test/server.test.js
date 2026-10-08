'use strict';
/* HTTP and security tests of the server, run against the real server in dev mode (in-memory SQLite). */
const { ok, section, done, P, sample, iso } = require('./util');
const { start } = require('./lib'), { load } = require('../src/config');
(async () => {
  const S = await start({ PTF_RPC_PER_MIN: '60' }), st = S.state;
  await st.replaceAll({ keys: sample() });
  const anon = await S.client(null), admin = await S.client('boss@x.com', { admin: true }), mgr = await S.client('mgr@x.com'), lead = await S.client('lead@x.com'), ana = await S.client('ana@x.com');

  section('1. Nothing without sign-in');
  let r = await anon.get('/'); ok('the tool page redirects to Microsoft sign-in', r.status === 302 && /\/auth\/login/.test(r.headers.get('location')), r.status + ' ' + r.headers.get('location'));
  r = await anon.get('/employee'); ok('the employee page too', r.status === 302);
  r = await anon.post('/api/rpc', { action: 'pull' }); ok('the API answers 401', r.status === 401);
  r = await anon.get('/api/boot.js'); ok('the data bootstrap answers 401', r.status === 401);
  r = await anon.get('/api/events'); ok('the live channel answers 401', r.status === 401);
  r = await anon.get('/api/admin/audit'); ok('the audit trail answers 401', r.status === 401);
  r = await anon.get('/static/shim.js'); ok('only the public script is served without sign-in', r.status === 200);
  r = await anon.get('/static/tool.html'); ok('the tool file is not served as a public static file', r.status === 404);
  r = await anon.get('/healthz'); ok('health check works without sign-in and reveals nothing but ok', r.status === 200 && Object.keys(await r.json()).sort().join() === 'ok,seq');

  section('2. Security headers');
  r = await anon.get('/healthz'); const h = (n) => r.headers.get(n) || '';
  ok('Content-Security-Policy forbids framing, other hosts and plugins', /frame-ancestors 'none'/.test(h('content-security-policy')) && /connect-src 'self'/.test(h('content-security-policy')) && /object-src 'none'/.test(h('content-security-policy')) && /default-src 'none'/.test(h('content-security-policy')));
  ok('nosniff, no framing, no referrer', h('x-content-type-options') === 'nosniff' && h('x-frame-options') === 'DENY' && h('referrer-policy') === 'no-referrer');
  ok('the server does not announce its software', !h('x-powered-by') && !/express|node/i.test(h('server')));
  ok('cross-origin isolation headers are set', h('cross-origin-opener-policy') === 'same-origin' && h('cross-origin-resource-policy') === 'same-origin');

  section('3. Configuration fails closed');
  const bad = load({ PTF_ENV: 'production' });
  ok('production without settings refuses to start (lists what is missing)', bad.errors.length >= 6, bad.errors.length + ' problems');
  ok('production refuses dev login', load({ PTF_ENV: 'production', PTF_DEV_LOGIN: '1' }).errors.some((e) => /DEV_LOGIN/.test(e)));
  ok('production needs https, long secrets, a database and a company domain', ['https', 'PTF_SALT', 'PTF_SESSION_SECRET', 'DATABASE_URL', 'PTF_ALLOWED_DOMAINS'].every((w) => bad.errors.some((e) => e.indexOf(w) >= 0)));
  const good = load({ PTF_ENV: 'production', PTF_PUBLIC_URL: 'https://ptf.example.com', PTF_SALT: 's'.repeat(30), PTF_SESSION_SECRET: 'x'.repeat(40), DATABASE_URL: 'postgres://u@h/db', ENTRA_TENANT_ID: 't', ENTRA_CLIENT_ID: 'c', ENTRA_CLIENT_SECRET: 's', PTF_ALLOWED_DOMAINS: 'example.com', PTF_MAIL_FROM: 'ptf@example.com' });
  ok('a complete production configuration is accepted', good.errors.length === 0, good.errors);

  section('4. CSRF and origin');
  r = await mgr.post('/api/rpc', { action: 'pull' }, { 'x-ptf-csrf': 'wrong' }); ok('a wrong CSRF token is refused', r.status === 403);
  r = await mgr.post('/api/rpc', { action: 'pull' }, { 'x-ptf-csrf': '' }); ok('a missing CSRF token is refused', r.status === 403);
  r = await mgr.post('/api/rpc', { action: 'pull' }, { origin: 'https://evil.example' }); ok('a request from another site is refused', r.status === 403);
  r = await mgr.post('/api/rpc', { action: 'pull' }); ok('the real page works', r.status === 200 && !!(await r.json()).keys);
  r = await mgr.post('/api/rpc', { action: 'pull' }, { 'x-ptf-csrf': ana.csrf }); ok("another person's CSRF token does not work", r.status === 403);

  section('5. Who may call what');
  r = await ana.get('/tool'); ok('an employee without a staff role cannot open the tool', r.status === 302 && /\/employee$/.test(r.headers.get('location')));
  r = await ana.get('/'); ok('the front address shows them the employee page', r.status === 200 && /My work page/.test(await r.text()));
  r = await ana.post('/api/rpc', { action: 'pull' }); ok('and cannot call the staff API', r.status === 403);
  r = await ana.get('/api/boot.js'); ok('nor load the staff data', r.status === 403);
  ok('the employee API gives only their own data', (await ana.emp({ action: 'me' })).email === 'ana@x.com');
  ok('the employee API refuses pull and push', (await ana.emp({ action: 'pull' })).error === 'not allowed' && (await ana.emp({ action: 'push', keys: {} })).error === 'not allowed');
  r = await mgr.get('/'); ok('staff get the tool', r.status === 200 && /Server Edition/.test(await r.text()));
  const boot = await (await mgr.get('/api/boot.js')).text(); ok("the manager's bootstrap holds their data but no integration secrets", /employeeDataSource/.test(boot) && !/secret-trigger/.test(boot));
  ok('boot data cannot break out of its script tag', !/<\/script/i.test(boot));
  ok('a non-staff employee cannot read other people through any action', ['pull', 'login'].every(async (a) => (await ana.emp({ action: a })).error === 'not allowed'));

  section('6. The server decides who you are');
  const forged = await mgr.rpc({ action: 'push', email: 'boss@x.com', admin: 'anything', keys: { totAccessPolicy: { v: JSON.stringify({ users: { 'mgr@x.com': { role: 'manager' } } }), t: Date.now() } } });
  ok('a manager cannot write the access policy, even claiming to be admin', (forged.denied || []).indexOf('totAccessPolicy') >= 0, forged);
  const pm = await mgr.rpc({ action: 'pull', email: 'boss@x.com', admin: true }); ok('and does not get admin-only data by claiming to be admin', !pm.keys.totIntegrations);
  const pa = await admin.rpc({ action: 'pull' }); ok('the signed-in admin does', !!pa.keys.totIntegrations);
  const forgedAnn = await lead.rpc({ action: 'push', keys: { totAnnouncements: { v: JSON.stringify([{ id: 'a9', title: 'Fake', body: 'x', toRoles: [], fromName: 'Mia Manager', fromEmail: 'mgr@x.com', created: Date.now(), u: Date.now() }]), t: Date.now() } } });
  const annNow = JSON.parse(st.cur.keys.totAnnouncements.v); ok('a shift lead cannot post an announcement in the manager\'s name', !annNow.some((a) => a.id === 'a9') || forgedAnn.denied.length > 0, forgedAnn);

  section('7. Sessions');
  const prodCfg = load({ PTF_ENV: 'production', PTF_PUBLIC_URL: 'https://ptf.example.com', PTF_SALT: 's'.repeat(30), PTF_SESSION_SECRET: 'x'.repeat(40), DATABASE_URL: 'postgres://u@h/db', ENTRA_TENANT_ID: 't', ENTRA_CLIENT_ID: 'c', ENTRA_CLIENT_SECRET: 's', PTF_ALLOWED_DOMAINS: 'example.com', PTF_MAIL_FROM: 'a@b.c' });
  const sessionsFactory = require('../src/auth/session'); const sp = sessionsFactory(st.d, Object.assign({}, prodCfg));
  const cs = await sp.create({ email: 'z@x.com', name: 'Z', admin: false }, { ip: '1.2.3.4', ua: 'test' });
  ok('the production cookie name starts with __Host-', sp.cookieName === '__Host-ptf_sid');
  const row = (await st.d.q('SELECT id FROM sessions WHERE email=?', ['z@x.com']))[0]; ok('the database stores a hash of the token, not the token', row && row.id !== cs.raw && row.id.length === 64);
  ok('the token is long and random', cs.raw.length >= 40);
  ok('a session is found by its token', !!(await sp.get(cs.raw)) && !(await sp.get(cs.raw + 'x')));
  await sp.destroy(cs.raw); ok('and gone after logout', !(await sp.get(cs.raw)));
  const sidle = sessionsFactory(st.d, Object.assign({}, prodCfg, { sessionIdleMinutes: 1 })), c2 = await sidle.create({ email: 'i@x.com' }, {});
  await st.d.q('UPDATE sessions SET last=? WHERE email=?', [Date.now() - 5 * 60e3, 'i@x.com']); ok('an idle session expires', !(await sidle.get(c2.raw)));
  const c3 = await sp.create({ email: 'e@x.com' }, {}); await st.d.q('UPDATE sessions SET expires=? WHERE email=?', [Date.now() - 1000, 'e@x.com']); ok('a session past its lifetime expires', !(await sp.get(c3.raw)));
  const lo = await mgr.get('/auth/logout'); ok('logout clears the cookie', lo.status === 302 && /Max-Age=0/.test((lo.headers.getSetCookie() || []).join(';'))); r = await mgr.post('/api/rpc', { action: 'pull' }); ok('and the old cookie no longer works', r.status === 401);
  const loc = await fetch(S.base + '/dev/login?email=cookie@x.com', { redirect: 'manual' }); const sc = (loc.headers.getSetCookie() || []).join(';');
  ok('the session cookie is HttpOnly and SameSite', /HttpOnly/.test(sc) && /SameSite=Lax/.test(sc), sc);

  section('8. Limits');
  const mgr2 = await S.client('mgr@x.com'); let n429 = 0, n200 = 0; for (let i = 0; i < 80; i++) { const x = await mgr2.post('/api/rpc', { action: 'pull', since: 999999 }); if (x.status === 429) n429++; else if (x.status === 200) n200++; }
  ok('a runaway client is slowed down (60 per minute in this test)', n429 > 0 && n200 >= 55, n200 + ' ok, ' + n429 + ' refused');
  const big = await admin.post('/api/rpc', JSON.stringify({ action: 'push', keys: { x: { v: 'a'.repeat(7 * 1024 * 1024), t: 1 } } })); ok('a 7 MB request is refused', big.status === 413);
  r = await admin.post('/api/rpc', '{bad json'); ok('broken JSON is answered with JSON, not a crash', r.status === 400 && (await r.json()).error === 'bad request');
  r = await admin.post('/api/rpc', '[1,2]'); ok('an array body is refused', r.status === 400);
  r = await admin.rpc({ action: 'constructor' }); ok('an unknown action is refused', r.error === 'unknown');
  r = await admin.get('/nothing-here'); ok('unknown paths are 404', r.status === 404);

  section('9. Delta sync');
  const A = await S.client('mgr@x.com'), Bc = await S.client('lead@x.com');
  const f = await A.rpc({ action: 'pull' }); ok('a first pull is a full pull with a sequence number', f.delta === false && f.seq > 0 && Object.keys(f.keys).length >= 4, { delta: f.delta, seq: f.seq });
  const same = await A.rpc({ action: 'pull', since: f.seq }); ok('a pull with nothing new returns no keys', same.delta === true && Object.keys(same.keys).length === 0, Object.keys(same.keys));
  const pushed = await Bc.rpc({ action: 'push', keys: { totProjects: { v: JSON.stringify([]), t: Date.now() } } });
  const d1 = await A.rpc({ action: 'pull', since: f.seq }); ok('after somebody saves, only that key (and the filtered lists that depend on it) comes, not the big ones', d1.delta === true && !!d1.keys.totProjects && !d1.keys.employeeDataSource && !d1.keys.totBonusCfg, Object.keys(d1.keys));
  await admin.rpc({ action: 'push', keys: { totAccessPolicy: { v: JSON.stringify({ users: { 'mgr@x.com': { role: 'manager', sites: ['main'] }, 'lead@x.com': { role: 'shift_lead', sites: ['main'] } }, roles: {}, depts: {} }), t: Date.now() } } });
  const d2 = await A.rpc({ action: 'pull', since: d1.seq }); ok('when access rules changed everything is sent again', d2.delta === false);
  const d3 = await A.rpc({ action: 'pull', since: 99999999 }); ok('a sequence from the future is treated as a full pull', d3.delta === false);
  const cur = await A.rpc({ action: 'pull' }), t0 = cur.keys.totBonusCfg.t;
  const c1 = await A.rpc({ action: 'push', keys: { totBonusCfg: { v: JSON.stringify({ programs: [] }), t: Date.now(), bt: t0 } } }); ok('a save based on the current version is accepted', (c1.conflicts || []).length === 0 && (c1.denied || []).length === 0, c1);
  const c2x = await A.rpc({ action: 'push', keys: { totBonusCfg: { v: JSON.stringify({ programs: [1] }), t: Date.now(), bt: t0 } } }); ok('a save based on an old version is reported as a conflict', c2x.conflicts && c2x.conflicts.indexOf('totBonusCfg') >= 0, c2x);

  section('10. Files (videos and project attachments)');
  const chunk = Buffer.alloc(1572864, 7), last = Buffer.alloc(1000, 9), size = chunk.length + last.length;
  const up1 = await admin.rpc({ action: 'video', up: 'u1', i: 0, n: 2, size, mime: 'video/mp4', name: 'a.mp4', data: chunk.toString('base64') }); ok('the first video piece is accepted', up1.ok === true && !up1.fileId, up1);
  const up2 = await admin.rpc({ action: 'video', up: 'u1', i: 1, n: 2, size, mime: 'video/mp4', name: 'a.mp4', data: last.toString('base64') }); ok('the last piece completes it and returns a file id', up2.ok && /^f[0-9a-f]+$/.test(up2.fileId), up2);
  const g1 = await admin.rpc({ action: 'videoGet', id: up2.fileId, i: 1 }); ok('the admin can watch it back, piece by piece', g1.ok && g1.n === 2 && Buffer.from(g1.data, 'base64').length === 1000 && g1.mime === 'video/mp4', g1.error);
  const g2 = await (await S.client('fmd@x.com')).rpc({ action: 'videoGet', id: up2.fileId, i: 0 }); ok('a scheduling coordinator without the "watch videos" right cannot', g2.error === 'not allowed', g2);
  const up3 = await (await S.client('fmd@x.com')).rpc({ action: 'video', up: 'u9', i: 0, n: 1, size: 10, mime: 'video/mp4', name: 'b.mp4', data: Buffer.alloc(10).toString('base64') }); ok('and cannot upload one either', up3.error === 'not allowed', up3);
  const g3 = await admin.rpc({ action: 'videoGet', id: '../../etc/passwd', i: 0 }); ok('a path-like file id is refused', g3.error === 'bad id', g3);
  const up4 = await admin.rpc({ action: 'video', up: 'u2', i: 0, n: 2, size: 5000, mime: 'video/mp4', name: 'c.mp4', data: Buffer.alloc(100).toString('base64') }); const up5 = await admin.rpc({ action: 'video', up: 'u2', i: 1, n: 2, size: 5000, mime: 'video/mp4', name: 'c.mp4', data: Buffer.alloc(100).toString('base64') }); ok('an upload whose size does not add up is refused', up5.error && !up5.fileId, up5);

  section('11. Audit trail');
  await S.app.audit.flush(); const ar = await admin.get('/api/admin/audit?verify=1'); const aj = await ar.json();
  ok('the audit trail records sign-ins and refusals', aj.rows.some((x) => x.action === 'login') && aj.rows.some((x) => x.action === 'csrf.refused'), aj.rows.map((x) => x.action).slice(0, 8).join());
  ok('its hash chain is intact', aj.chain && aj.chain.ok === true && aj.chain.rows > 5, aj.chain);
  r = await mgr.get('/api/admin/audit'); ok('only the admin can read it', r.status === 403 || r.status === 401);
  const mid = (await st.d.q('SELECT id FROM audit ORDER BY id LIMIT 1 OFFSET 3'))[0].id; await st.d.q(`UPDATE audit SET detail='tampered' WHERE id=?`, [mid]);
  const av = await S.app.audit.verify(); ok('editing one row is detected, and where', av.ok === false && av.brokenAt === Number(mid), av);

  section('12. Live updates');
  const http = require('http'); const sse = await S.client('mgr@x.com'), got = [];
  const conn = await new Promise((resolve) => { const rq = http.get(S.base + '/api/events', { headers: { cookie: sse.cookie() } }, (res) => { res.setEncoding('utf8'); res.on('data', (d) => got.push(d)); resolve({ rq, res }); }); });
  await new Promise((r) => setTimeout(r, 200)); ok('the live channel opens as an event stream', conn.res.statusCode === 200 && /text\/event-stream/.test(conn.res.headers['content-type']) && /"seq":\d+/.test(got.join('')));
  const before = got.length; await admin.rpc({ action: 'push', keys: { totTeams: { v: '[]', t: Date.now() } } }); await new Promise((r) => setTimeout(r, 900));
  ok('when anybody saves, it says so (and only sends a number, never data)', got.length > before && /"seq":\d+/.test(got.slice(before).join('')) && !/totTeams|\[\]/.test(got.slice(before).join('')), got.slice(before));
  conn.rq.destroy(); const ana2 = await S.client('ana@x.com'); r = await ana2.get('/api/events'); ok('an employee without a staff role cannot listen', r.status === 403);

  await S.close(); done('server');
})().catch((e) => { console.error(e); process.exit(1); });
