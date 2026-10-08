'use strict';
/* A drop-in replacement for tests/fakegas.js that runs the PORTED rules (src/rules/rules.js) instead of tool/Code.gs.
   The old tests call  gas.post({ action, email, pwHash | admin | idToken ... })  and inspect gas.data(); this adapter keeps that interface and
   maps the old credentials to a verified identity: admin key -> admin session, email + registered password hash -> that e-mail,
   'gtok:<email>' -> that e-mail (the employee page). Everything after identity is the real server rule code. */
const crypto = require('crypto'), path = require('path');
const makeEnv = require('../src/rules/env'), createRules = require('../src/rules/rules');
module.exports = function (codePath) {
  let fileN = 0; const uploads = []; let cur = { keys: {}, updatedAt: 0, del: {} }, seq = 0; const seqOf = {}, users = {}, filesStore = {};
  const files = { CH: 1572864, chunk(o) { const bytes = Buffer.from(o.data || '', 'base64'); uploads.push({ i: o.i }); const k = o.owner + '|' + o.up; const s = (filesStore[k] = filesStore[k] || { parts: [] }); s.parts[o.i] = bytes; if (o.i < o.n - 1) return { ok: true }; const all = Buffer.concat(s.parts); if (all.length !== o.size) return { error: 'upload incomplete, start again' }; const id = 'drive-file-' + (++fileN); filesStore[id] = { name: o.name, mime: o.mime, kind: o.kind, bytes: all }; delete filesStore[k]; return { ok: true, fileId: id }; },
    info(id) { const f = filesStore[id]; return f && f.bytes ? { id, name: f.name, mime: f.mime, size: f.bytes.length, kind: f.kind } : null; },
    read(id, i) { const f = filesStore[id]; if (!f || !f.bytes) return null; const s0 = i * 1572864; if (s0 >= f.bytes.length) return null; return { n: Math.max(1, Math.ceil(f.bytes.length / 1572864)), data: f.bytes.subarray(s0, s0 + 1572864).toString('base64') }; } };
  const props = {}, env = makeEnv({ salt: 'test-salt', tz: 'UTC', files, props, seq: () => seq, seqOf: () => seqOf });
  const rules = createRules(env);
  const sh = (s) => crypto.createHash('sha256').update('test-salt' + s).digest('hex');
  const api = {
    files: {}, uploads, mails: env.mails, props, cache: {}, driveFiles: filesStore,
    post(body) {
      const b = typeof body === 'string' ? (() => { try { return JSON.parse(body); } catch (e) { return null; } })() : body;
      let id = null;
      if (b && typeof b === 'object') {
        const em = String(b.email || '').trim().toLowerCase();
        if (b.admin === 'ADMKEY') id = { email: em || 'admin@test', name: 'Admin', admin: true };
        else if (typeof b.idToken === 'string' && /^gtok:(.+)$/.test(b.idToken)) id = { email: /^gtok:(.+)$/.exec(b.idToken)[1].trim().toLowerCase(), name: '' };
        else if (em && users[em] && users[em].ph === sh(String(b.pwHash || '')) && users[em].status === 'approved') id = { email: em, name: users[em].name };
        else if (b.action === 'request') return { status: 'pending' };
        else if (b.action === 'login') return { status: em && users[em] && users[em].ph === sh(String(b.pwHash || '')) ? users[em].status : 'bad' };
      }
      if (!id) return b && b.action === 'me' ? { error: 'sign-in invalid' } : (b && /^req(New|Cancel)$/.test(b.action) ? { error: 'sign-in invalid' } : (b && typeof b === 'object' && !Array.isArray(b) ? { error: 'not allowed' } : { error: 'bad request' }));
      env.mails.length = env.mails.length;   // (same array object)
      const before = Object.assign({}, cur.keys), r = rules.handle(b, id, cur);
      let chg = false; Object.keys(cur.keys).forEach(k => { if (cur.keys[k] !== before[k]) { seqOf[k] = ++seq; chg = true; } });
      if (chg && b.action === 'push') { try { rules.runDigest(cur, id); } catch (e) {} }   /* the single-file edition sends the daily project e-mail on the first save of the day; the server edition does it at 07:00 (scheduler). Same code, so the tests still check its content. */
      return JSON.parse(JSON.stringify(r));
    },
    data() { return JSON.parse(JSON.stringify(cur.keys && Object.keys(cur.keys).length ? cur : { keys: {} })); },
    setData(d) { cur = { keys: d.keys || {}, updatedAt: d.updatedAt || 0, del: d.del || {} }; Object.keys(cur.keys).forEach(k => { seqOf[k] = ++seq; }); },
    addUser(email, pwHash, name) { users[email] = { name, ph: sh(pwHash), status: 'approved' }; },
    tasks() { const k = cur.keys.totTasks; return k ? JSON.parse(k.v) : []; }
  };
  return api;
};
