'use strict';
/* Test helpers: start the real server (dev mode, in-memory SQLite or the local PostgreSQL) on a random port, and sign people in through the dev login. */
const os = require('os'), fs = require('fs'), path = require('path');
const { load } = require('../src/config'), { createApp } = require('../src/app');
async function start(env, opts) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ptf-'));
  const cfg = load(Object.assign({ PTF_ENV: 'dev', PTF_DEV_LOGIN: '1', PTF_SQLITE_FILE: ':memory:', PTF_DATA_DIR: dir, PTF_TZ: 'UTC', PTF_PUBLIC_URL: 'http://127.0.0.1:0' }, env || {}));
  cfg.quiet = true;
  const app = await createApp(cfg, Object.assign({ noJobs: true }, opts || {}));
  const port = await app.listen(0, '127.0.0.1'); cfg.publicUrl = 'http://127.0.0.1:' + port;
  const base = cfg.publicUrl;
  return { app, cfg, base, port, dir, state: app.state,
    async close() { await app.close(); try { fs.rmSync(dir, { recursive: true, force: true }); } catch (e) {} },
    /* a plain HTTP client that keeps its cookie, for server tests */
    async client(email, o) {
      o = o || {}; let ck = ''; const c = { email, csrf: '' };
      const take = (r) => { const sc = r.headers.getSetCookie ? r.headers.getSetCookie() : []; sc.forEach((x) => { const kv = x.split(';')[0]; const nm = kv.split('=')[0]; ck = ck.split('; ').filter((y) => y && y.split('=')[0] !== nm).concat(/=$/.test(kv) ? [] : [kv]).join('; '); }); };
      c.get = async (p, h) => { const r = await fetch(base + p, { redirect: 'manual', headers: Object.assign({ cookie: ck }, h || {}) }); take(r); return r; };
      c.post = async (p, body, h) => { const r = await fetch(base + p, { method: 'POST', redirect: 'manual', headers: Object.assign({ cookie: ck, 'content-type': 'application/json', 'x-ptf-csrf': c.csrf }, h || {}), body: typeof body === 'string' ? body : JSON.stringify(body) }); take(r); return r; };
      c.rpc = async (body) => (await c.post('/api/rpc', body)).json();
      c.emp = async (body) => (await c.post('/api/employee', body)).json();
      if (email) { await c.get('/dev/login?email=' + encodeURIComponent(email) + (o.admin ? '&admin=1' : '') + (o.name ? '&name=' + encodeURIComponent(o.name) : '')); const s = await c.get('/api/session'); if (s.status === 200) c.csrf = (await s.json()).csrf; }
      return c;
    }
  };
}
module.exports = { start };
