/* Audit: the admin keys printed in the shipped scripts are public. Left unchanged they must never give admin rights. */
const fs = require('fs'), path = require('path'), os = require('os'), vm = require('vm');
let fails = 0; function ok(n, c, x) { if (!c) fails++; console.log((c ? '  ✅ ' : '  ❌ ') + n + (c ? '' : '  → ' + x)); }
/* 1. Code.gs (single-file edition) deployed with the default ADMIN_SECRET */
const src = fs.readFileSync(path.join(__dirname, '..', 'tool', 'Code.gs'), 'utf8').replace("const ADMIN_SECRET = 'CHANGE-ME-ADMIN-KEY'", 'const ADMIN_SECRET = "CHANGE-ME-ADMIN-KEY"'), tmp = path.join(os.tmpdir(), 'code-default.gs'); fs.writeFileSync(tmp, src);
const gas = require('./fakegas')(tmp); require('./seed')(gas);
let r = gas.post({ action: 'pull', admin: 'CHANGE-ME-ADMIN-KEY' });
ok('Code.gs: the default admin key is refused with a clear message', /still the default/.test(r.error || '') && !r.keys, JSON.stringify(r).slice(0, 160));
r = gas.post({ action: 'push', admin: 'CHANGE-ME-ADMIN-KEY', keys: { totAccessPolicy: { v: '{}', t: Date.now() } } });
ok('Code.gs: nothing can be written with it', !!r.error && !r.ok, JSON.stringify(r).slice(0, 160));
/* the normal case still works (the test stand-in sets a real key) */
const gas2 = require('./fakegas')(path.join(__dirname, '..', 'tool', 'Code.gs')); require('./seed')(gas2);
r = gas2.post({ action: 'pull', admin: 'ADMKEY' }); ok('Code.gs: a changed admin key works as before', !!r.keys && !r.error, JSON.stringify(r).slice(0, 120));
/* 2. the mailer / Dynamics script the tool offers for copying */
const html = fs.readFileSync(path.join(__dirname, '..', 'tool', 'PTF-pass-to-floor-Gunda.html'), 'utf8'), a = html.indexOf('    var CODE = ['), b = html.indexOf("\"}\"].join('\\n');", a), MS = eval('[' + html.slice(html.indexOf('[', a) + 1, b + 3) + ']').join('\n');
const sb = { Utilities: {}, Session: {}, ContentService: { createTextOutput: (s) => ({ s, setMimeType() { return this; } }), MimeType: { JSON: 1 } }, PropertiesService: { getScriptProperties: () => ({ getProperty: () => null, setProperty() {} }) }, MailApp: { sendEmail() { throw new Error('should not send'); } }, DriveApp: {}, SpreadsheetApp: {}, MimeType: {}, UrlFetchApp: {} };
vm.createContext(sb); vm.runInContext(MS, sb); const call = (o) => JSON.parse(sb.doPost({ postData: { contents: JSON.stringify(o) } }).s);
let m = call({ key: 'CHANGE-THIS-ADMIN-SECRET', action: 'test', to: 'a@yourcompany.com' });
ok('mailer script: the default admin key is refused and says the keys are still defaults', /still the defaults/.test(m.error || ''), JSON.stringify(m));
m = call({ key: 'CHANGE-THIS-TEAM-SECRET', action: 'mistakes', items: [] }); ok('mailer script: the default team key is refused too', /wrong key/.test(m.error || ''), JSON.stringify(m));
console.log('audit_default_keys: ' + (fails ? fails + ' FAILED' : 'ALL PASSED')); process.exit(fails ? 1 : 0);
