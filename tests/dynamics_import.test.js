/* Microsoft Dynamics 365 as the HR source in the single-file edition: the Google script (the text the tool offers for pasting) talks to Dynamics; the tool shows the fields and imports the people with the usual safety rules. A fake Dynamics runs here. */
const path = require('path'), fs = require('fs'), vm = require('vm'), http = require('http'), tool = path.join(__dirname, '..', 'tool', 'PTF-pass-to-floor-Gunda.html'), code = path.join(__dirname, '..', 'tool', 'Code.gs');
const gas = require('./fakegas')(code); require('./seed')(gas);
let fails = 0; function ok(n, c, x) { if (!c) fails++; console.log((c ? '  ✅ ' : '  ❌ ') + n + (c ? '' : '  → ' + x)); }
const MURL = 'https://script.google.com/macros/s/MAILER/exec';
(async () => {
  /* the real script text from the tool */
  const html = fs.readFileSync(tool, 'utf8'), a = html.indexOf('    var CODE = ['), b = html.indexOf("\"}\"].join('\\n');", a); const SRC = eval('[' + html.slice(html.indexOf('[', a) + 1, b + 3) + ']').join('\n');
  /* a fake Dynamics */
  const D = http.createServer((req, res) => { let bd = ''; req.on('data', c => bd += c); req.on('end', () => { const base = 'http://127.0.0.1:' + D.address().port;
    if (req.method === 'POST') { const p = new URLSearchParams(bd); res.writeHead(p.get('client_secret') === 'S3CR3T' ? 200 : 401, { 'content-type': 'application/json' }); return res.end(JSON.stringify(p.get('client_secret') === 'S3CR3T' ? { access_token: 'TOK' } : { error: 'invalid_client', error_description: 'Invalid client secret' })); }
    res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify(req.url.indexOf('page=2') > 0 ? { value: [{ PersonnelNumber: 'H3', Name: 'Mariam Kiknadze', PrimaryContactEmail: 'mariam@x.com', EmploymentStartDate: '2024-05-05T00:00:00Z' }] } : { value: [{ PersonnelNumber: 'H1', Name: 'Ana Beridze', PrimaryContactEmail: 'ana@x.com', EmploymentStartDate: '2024-03-01T00:00:00Z', Position: 'Game Presenter' }, { PersonnelNumber: 'H2', Name: 'Dato Lomidze', EmploymentEndDate: '2025-01-31T00:00:00Z' }], '@odata.nextLink': base + '/data/Workers?page=2' })); }); });
  await new Promise(r => D.listen(0, '127.0.0.1', r)); const DB = 'http://127.0.0.1:' + D.address().port;
  /* run the script text with Google's services faked: the Dynamics address must be https://...dynamics.com in the real script, so the test uses a loopback address through a patched check */
  const props = { ADMIN_KEY: '', DYN_TENANT: '11111111-2222-3333-4444-555555555555', DYN_CLIENT_ID: 'cid', DYN_SECRET: 'S3CR3T', DYN_RESOURCE: 'https://contoso.operations.dynamics.com' };
  const fetchSync = require('child_process');
  const sandbox = { console, Utilities: { formatDate: (d) => d.toISOString().slice(0, 10) }, Session: { getScriptTimeZone: () => 'UTC' }, ContentService: { createTextOutput: (s) => ({ s, setMimeType() { return this; } }), MimeType: { JSON: 1 } }, PropertiesService: { getScriptProperties: () => ({ getProperty: (k) => props[k] == null ? null : props[k], setProperty() {}, deleteProperty() {}, getProperties: () => props }) }, MailApp: { sendEmail() {} }, DriveApp: {}, SpreadsheetApp: {}, MimeType: {}, LockService: {}, CacheService: {} };
  /* UrlFetchApp is synchronous in Apps Script: answer from a table of canned replies made by calling the fake Dynamics first */
  const replies = {};
  const get = (u, o) => new Promise((res, rej) => { const q = http.request(u, { method: (o && o.method) || 'GET', headers: (o && o.headers) || {} }, r => { let t = ''; r.on('data', c => t += c); r.on('end', () => res({ code: r.statusCode, text: t })); }); q.on('error', rej); if (o && o.body) q.write(o.body); q.end(); });
  const pre = async () => { replies.token = await get(DB + '/oauth2/v2.0/token', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: 'client_secret=S3CR3T' }); replies.bad = await get(DB + '/oauth2/v2.0/token', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: 'client_secret=no' }); replies.p1 = await get(DB + '/data/Workers?$top=5000'); replies.p2 = await get(DB + '/data/Workers?page=2'); };
  await pre(); const R = (x) => ({ getContentText: () => x.text, getResponseCode: () => x.code });
  let fetched = [];
  sandbox.UrlFetchApp = { fetch: (u, o) => { fetched.push(u); if (/login\.microsoftonline\.com/.test(u)) return R(o.payload.client_secret === 'S3CR3T' ? replies.token : replies.bad); if (/page=2/.test(u)) return R(replies.p2); return R({ code: 200, text: replies.p1.text.replace(DB, 'https://contoso.operations.dynamics.com') }); } };
  replies.p1.text = replies.p1.text.split(DB).join('https://contoso.operations.dynamics.com'); replies.p2.text = replies.p2.text.split(DB).join('https://contoso.operations.dynamics.com');
  vm.createContext(sandbox); vm.runInContext(SRC.replace("var ADMIN_KEY = 'CHANGE-THIS-ADMIN-SECRET';", "var ADMIN_KEY = 'ADM';"), sandbox);
  const call = (b) => JSON.parse(sandbox.doPost({ postData: { contents: JSON.stringify(b) } }).s);
  console.log('1. The Google script (the text the tool offers)');
  let j = call({ key: 'ADM', action: 'dynamics', mode: 'pull' });
  ok('only the admin key may ask; the team key and a wrong key are refused', /^wrong key/.test(call({ key: 'ADM2', action: 'dynamics' }).error));
  ok('the pull returns the people in the import columns (3 people from 2 pages)', j.ok && j.count === 3 && JSON.stringify(j.data[0]) === JSON.stringify(['Full Name', 'HR ID', 'Email Address', 'Start Date', 'End Date', 'Position', 'Status']) && j.data[1][1] === 'H1' && j.data[3][1] === 'H3', JSON.stringify(j).slice(0, 300));
  ok('the person with a past end date is Terminated, the others Employed', j.data[2][6] === 'Terminated' && j.data[1][6] === 'Employed');
  ok('the second page was read from the same Dynamics address', fetched.some(u => /page=2/.test(u)));
  j = call({ key: 'ADM', action: 'dynamics', mode: 'preview' }); ok('preview lists the field names and the first records', j.ok && j.keys.indexOf('PersonnelNumber') >= 0 && j.sample.length === 2, JSON.stringify(j).slice(0, 200));
  props.DYN_SECRET = 'no'; j = call({ key: 'ADM', action: 'dynamics', mode: 'pull' }); ok('a wrong secret gives the reason from Microsoft, not the secret', /sign-in failed/.test(j.error) && /Invalid client secret/.test(j.error), j.error); props.DYN_SECRET = 'S3CR3T';
  props.DYN_RESOURCE = 'https://evil.example.com'; j = call({ key: 'ADM', action: 'dynamics' }); ok('an address that is not a Dynamics address is refused', /DYN_RESOURCE/.test(j.error), j.error); props.DYN_RESOURCE = 'https://contoso.operations.dynamics.com';
  delete props.DYN_CLIENT_ID; j = call({ key: 'ADM', action: 'dynamics' }); ok('not set up: says which Script properties to add', /DYN_CLIENT_ID/.test(j.error), j.error); props.DYN_CLIENT_ID = 'cid';
  /* the tool */
  console.log('2. The tool: Scheduled import with Microsoft Dynamics');
  const H = await require('./harness')(tool, gas), P = await H.open({ admin: true }); await P.setViewportSize({ width: 1500, height: 1000 }); await P.sync();
  await P.route(MURL, async rt => { const o = JSON.parse(rt.request().postData() || '{}'); let out; try { out = call(o); } catch (e) { out = { error: 'script crash: ' + e.message }; } await rt.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(out) }); });
  await P.evaluate((u) => { localStorage.setItem('totMailerCfg', JSON.stringify({ url: u, key: 'ADM', role: 'admin' })); switchView('home'); }, MURL); await P.waitForTimeout(500);
  const vis = await P.evaluate(() => { try { siInit(); } catch (e) {} const d = document.getElementById('schedImp'); d.open = true; return { shown: d.style.display !== 'none', src: document.getElementById('siSrc').value, dyn: document.getElementById('siDynBox').style.display, drive: document.getElementById('siDriveBox').style.display, txt: d.innerText.slice(0, 400) }; });
  ok('the panel offers Microsoft Dynamics (default) and the Drive folder', vis.shown && vis.src === 'dynamics' && vis.dyn !== 'none' && vis.drive === 'none' && /Dynamics/.test(vis.txt), JSON.stringify(vis));
  await P.evaluate(() => siDynPreview()); await P.waitForTimeout(800); const msg = await P.evaluate(() => document.getElementById('siMsg').innerText);
  ok('"Show fields" prints the fields found and the first record', /Connected/.test(msg) && /PersonnelNumber/.test(msg) && /Ana Beridze/.test(msg), msg);
  await P.evaluate(() => { document.getElementById('siSrc').value = 'dynamics'; siNowBtn(); }); await P.waitForTimeout(1500);
  const eds = await P.evaluate(() => JSON.parse(localStorage.getItem('employeeDataSource') || '[]'));
  ok('Import now fills Employee Data: 3 people with their HR IDs', eds.length === 3 && eds.map(e => e.workId).sort().join() === 'H1,H2,H3', JSON.stringify(eds.map(e => [e.fullName, e.workId, e.status])));
  ok('names, e-mail, status and dates came through', eds.find(e => e.workId === 'H1').fullName === 'Ana Beridze' && /ana@x\.com/.test(JSON.stringify(eds.find(e => e.workId === 'H1'))) && eds.find(e => e.workId === 'H2').status === 'Terminated', JSON.stringify(eds.find(e => e.workId === 'H1')));
  ok('the message says what changed (3 new)', /Updated from Dynamics: 3 new, 0 updated/.test(await P.evaluate(() => document.getElementById('siMsg').innerText)), await P.evaluate(() => document.getElementById('siMsg').innerText));
  /* the tool keeps what only it holds; Dynamics updates what HR owns; nobody is removed */
  await P.evaluate(() => { const L = JSON.parse(localStorage.getItem('employeeDataSource')); const a = L.find(e => e.workId === 'H1'); a.nickname = 'Annie'; a.code = 'BC-77'; a.ext = Object.assign({}, a.ext, { team: 'Team 1', set: '1', email: 'old@x.com', position: 'Shuffler' }); a.fullName = 'Ana B.'; L.push({ id: 99, fullName: 'Zura Abashidze', nickname: 'Zuka', workId: 'H9', code: 'BC-9', status: 'Employed', ext: { team: 'Team 2' } }); localStorage.setItem('employeeDataSource', JSON.stringify(L)); });
  await P.evaluate(() => siNowBtn()); await P.waitForTimeout(1500);
  const e2 = await P.evaluate(() => JSON.parse(localStorage.getItem('employeeDataSource') || '[]')), a2 = e2.find(e => e.workId === 'H1');
  ok('the update corrects the name, e-mail and position from Dynamics', a2.fullName === 'Ana Beridze' && a2.ext.email === 'ana@x.com' && a2.ext.position === 'Game Presenter', JSON.stringify(a2));
  ok('screen name, barcode, team and set stay as they are in the tool', a2.nickname === 'Annie' && a2.code === 'BC-77' && a2.ext.team === 'Team 1' && a2.ext.set === '1', JSON.stringify(a2));
  ok('a person who is not in Dynamics is kept, nobody is removed', e2.length === 4 && !!e2.find(e => e.workId === 'H9' && e.nickname === 'Zuka'), JSON.stringify(e2.map(e => e.workId)));
  ok('the message reports 1 updated and 1 kept', /1 updated/.test(await P.evaluate(() => document.getElementById('siMsg').innerText)) && /1 in the tool but not in Dynamics \(kept\)/.test(await P.evaluate(() => document.getElementById('siMsg').innerText)), await P.evaluate(() => document.getElementById('siMsg').innerText));
  ok('the change history records the source as Microsoft Dynamics', await P.evaluate(() => JSON.parse(localStorage.getItem('employeeHistory') || '[]').some(h => h.s === 'D')));
  /* automatic run does nothing when nothing changed */
  await P.evaluate(() => { const c = JSON.parse(localStorage.getItem('empSchedImport')); c.hours = 6; localStorage.setItem('empSchedImport', JSON.stringify(c)); window.__r = siRun(false); }); await P.waitForTimeout(1200);
  ok('an automatic check with no change says so and changes nothing', /No change in Dynamics/.test(await P.evaluate(() => document.getElementById('siMsg').innerText)));
  /* an old Drive setup stays a Drive setup */
  await P.evaluate(() => { localStorage.setItem('empSchedImport', JSON.stringify({ folder: 'abc123', hours: 6 })); const d = document.getElementById('schedImp'); delete d.dataset.f; siInit(); });
  ok('an existing Drive-folder setup is still shown as Drive (it is not switched to Dynamics)', await P.evaluate(() => document.getElementById('siSrc').value === 'drive' && document.getElementById('siDriveBox').style.display !== 'none'));
  /* the Excel/CSV import understands the column names of a Dynamics export */
  const x = await P.evaluate(() => { const r = processSheetMatrix([['Personnel number', 'Worker', 'Primary contact email', 'Employment start date', 'Employment end date', 'Job title'], ['000123', 'Ana Beridze', 'ana@x.com', '2024-03-01', '', 'Shuffler']]); return r.error ? { error: r.error } : { id: r.employees[0].workId, name: r.employees[0].fullName, email: (r.employees[0].ext || {}).email, start: (r.employees[0].ext || {}).startDate, pos: (r.employees[0].ext || {}).position }; });
  ok('an Excel export from Dynamics (Personnel number, Worker, Primary contact email, Employment start date…) is read correctly', x.id === '000123' && x.name === 'Ana Beridze' && x.email === 'ana@x.com' && x.start === '2024-03-01' && x.pos === 'Shuffler', JSON.stringify(x));
  ok('the labels now say "HR ID"', await P.evaluate(() => !/Workday ID/.test(document.body.innerText) && /HR ID/.test(document.documentElement.innerHTML)));
  ok('no page errors', H.errs.length === 0, JSON.stringify(H.errs.slice(0, 3))); await H.close(); D.close();
  console.log('dynamics_import: ' + (fails ? fails + ' FAILED' : 'ALL PASSED')); process.exit(fails ? 1 : 0);
})();
