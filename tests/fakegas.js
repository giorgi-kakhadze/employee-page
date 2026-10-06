/* Runs tool/Code.gs in Node with in-memory stand-ins for the Apps Script services. */
/* Test stand-in for Google Apps Script: runs tool/Code.gs in Node with an in-memory Drive. Used by tests/sync_*.test.js. */
const fs = require('fs'), crypto = require('crypto');
module.exports = function (codePath, opts) {
  opts = opts || {};
  const files = {};            // name -> string
  const cache = {}, props = {};
  function file(name) { return { getName: () => name, getBlob: () => ({ getDataAsString: () => files[name] }), setContent: (s) => { files[name] = s; }, getId: () => 'id-' + name, setTrashed() { delete files[name]; }, getMimeType: () => 'application/json' }; }
  const folder = { getId: () => 'folder', getFilesByName: (n) => { let done = !(n in files); return { hasNext: () => !done, next: () => { done = true; return file(n); } }; }, createFile: (n, c) => { files[n] = c; return file(n); },
    getFiles: () => { const ks = Object.keys(files); let i = 0; return { hasNext: () => i < ks.length, next: () => file(ks[i++]) }; } };
  const G = {
    DriveApp: { getFoldersByName: () => { let d = false; return { hasNext: () => !d, next: () => { d = true; return folder; } }; }, createFolder: () => folder },
    CacheService: { getScriptCache: () => ({ get: (k) => cache[k] || null, put: (k, v) => { cache[k] = v; }, remove: (k) => { delete cache[k]; } }) },
    PropertiesService: { getScriptProperties: () => ({ getProperty: (k) => props[k] || null, setProperty: (k, v) => { props[k] = v; } }) },
    LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
    Utilities: { DigestAlgorithm: { SHA_256: 'sha256' }, computeDigest: (a, s) => Array.from(crypto.createHash('sha256').update(s, 'utf8').digest()).map(b => b > 127 ? b - 256 : b),
      formatDate: (d, tz, p) => { const s = new Date(d).toISOString(); return p === 'yyyy-MM' ? s.slice(0, 7) : s.slice(0, 10); }, base64Decode: (s) => Buffer.from(s, 'base64'), base64Encode: (b) => Buffer.from(b).toString('base64') },
    Session: { getScriptTimeZone: () => 'UTC', getEffectiveUser: () => ({ getEmail: () => 'owner@x.com' }) },
    ContentService: { MimeType: { JSON: 'json' }, createTextOutput: (s) => ({ setMimeType() { return this; }, getContent: () => s }) },
    MailApp: { sendEmail() {} }, UrlFetchApp: { fetch() { throw new Error('no network in tests'); } }, ScriptApp: {}
  };
  let src = fs.readFileSync(codePath, 'utf8').replace("const ADMIN_SECRET = 'CHANGE-ME-ADMIN-KEY'", "const ADMIN_SECRET = 'ADMKEY'");
  const api = new Function(...Object.keys(G), src + '; return { doPost: doPost, sh_: sh_ };')(...Object.values(G));
  return {
    files,
    post(body) { return JSON.parse(api.doPost({ postData: { contents: typeof body === 'string' ? body : JSON.stringify(body) } }).getContent()); },
    data() { return JSON.parse(files['tool-data.json'] || '{"keys":{}}'); },
    setData(d) { files['tool-data.json'] = JSON.stringify(d); },
    addUser(email, pwHash, name) { const a = JSON.parse(files['access.json'] || '{"users":{}}'); a.users[email] = { name, ph: api.sh_(pwHash), status: 'approved', at: Date.now() }; files['access.json'] = JSON.stringify(a); },
    tasks() { const k = this.data().keys.totTasks; return k ? JSON.parse(k.v) : []; }
  };
};
