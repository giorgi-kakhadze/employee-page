/* v3.41 confirmations: the tool puts a version on what it sends to each person; the employee page asks them to confirm it; the tool shows who has not confirmed. */
const path = require('path'), fs = require('fs');
const gas = require('./fakegas')(path.join(__dirname, '..', 'tool', 'Code.gs'));
let fails = 0; function ok(n, c, x) { if (!c) fails++; console.log((c ? '  ✅ ' : '  ❌ ') + n + (c ? '' : '  → ' + x)); }
const { chromium } = require(require('child_process').execSync('npm root -g').toString().trim() + '/playwright');
const URL = 'https://script.google.com/macros/s/TEST/exec', tmp = path.join(require('os').tmpdir(), 'ack-page-test.html'), now = Date.now(), P = (o) => ({ v: JSON.stringify(o), t: now - 500 });
const iso = (d) => { const x = new Date(Date.now() + d * 864e5); return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0'); };
(async () => {
  fs.writeFileSync(tmp, fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8').replace(/var SERVER_URL = '[^']*'/, "var SERVER_URL = '" + URL + "'").replace('<script src="https://accounts.google.com/gsi/client" async defer></script>', ''));
  const br = await chromium.launch(), perr = [];
  const emp = (mail) => ({ id: 'e1', fullName: 'Test Person', nickname: 'Tess', workId: 'W1', status: 'Employed', email: mail, ext: { email: mail, position: 'Game presenter' } });
  const blob = (ver) => P({ byEmail: { 'tester@x.com': { name: 'Test Person', team: 't1', shift: 'morning', ver, vat: now - 3600e3, sx: [{ d: iso(1), s: 'morning', f: 8, t: 16 }], rx: [] }, 'other@x.com': { name: 'Other Person', team: 't1', shift: 'morning', ver: 'zz1', vat: now - 7200e3, sx: [{ d: iso(1), s: 'morning', f: 8, t: 16 }], rx: [] } }, sent: {} });
  gas.setData({ updatedAt: now, keys: { totAccessPolicy: P({ users: {}, roles: {} }), employeeDataSource: P([emp('tester@x.com')]), totMySchedules: blob('v1'), totEmpRequests: P([{ id: 'er9', workId: 'W1', name: 'Test Person', email: 'tester@x.com', type: 'annual', from: iso(10), to: iso(12), status: 'approved', created: now, u: now, decidedAt: now - 3600e3, decisionNote: 'Enjoy your time off' }]) } });
  const open = async () => { const E = await (await br.newContext({ viewport: { width: 390, height: 844 } })).newPage(); E.on('pageerror', (e) => perr.push(e.message)); E.on('dialog', (d) => d.accept());
    await E.route(URL + '**', async (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(gas.post(r.request().postData())) }));
    await E.addInitScript(() => { window.google = { accounts: { id: { initialize: (c) => { window.__gcb = c.callback; }, renderButton: () => setTimeout(() => window.__gcb({ credential: 'gtok:tester@x.com' }), 30) } } }; }); await E.goto('file://' + tmp); await E.waitForTimeout(900); return E; };
  let E = await open(); let t = await E.evaluate(() => document.body.innerText);
  ok('the employee sees "Your schedule or rotation was updated" with a confirm button', /schedule or rotation was updated/.test(t) && !!(await E.$('#ackBtn')), t.slice(0, 200));
  ok('a request decided in the last days shows under "Updates for you" on Home', /Updates for you/.test(t) && /approved/.test(t) && /Enjoy your time off/.test(t), t.slice(0, 400));
  await E.click('#ackBtn'); await E.waitForTimeout(900); t = await E.evaluate(() => document.body.innerText);
  ok('after tapping it the banner turns into "You confirmed …"', /You confirmed your schedule/.test(t) && !(await E.$('#ackBtn')), t.slice(0, 200));
  const acks = JSON.parse(gas.data().keys.totScheduleAcks.v);
  ok('one confirmation record is stored for the person, with the version they confirmed', acks.length === 1 && acks[0].id === 'tester@x.com' && acks[0].ver === 'v1' && acks[0].name === 'Test Person', JSON.stringify(acks));
  await E.context().close();
  E = await open(); t = await E.evaluate(() => document.body.innerText); ok('after a reload it stays confirmed', /You confirmed/.test(t) && !(await E.$('#ackBtn')));
  await E.context().close();
  const d = gas.data(); d.keys.totMySchedules = blob('v2'); gas.setData(d);
  E = await open(); t = await E.evaluate(() => document.body.innerText); ok('when the schedule changes (new version) they are asked again', !!(await E.$('#ackBtn')), t.slice(0, 160));
  const stale = gas.post(JSON.stringify({ action: 'ack', idToken: 'gtok:tester@x.com', ver: 'v1' })); ok('confirming an old version is refused (they must read the new one)', /changed again/.test(stale.error || ''), JSON.stringify(stale));
  await E.context().close();
  /* the tool's side: the confirmations tab */
  const H = await require('./harness')(path.join(__dirname, '..', 'tool', 'PTF-pass-to-floor-Gunda.html'), gas), T = await H.open({ admin: true }); await T.setViewportSize({ width: 1500, height: 900 }); await T.sync();
  await T.evaluate(() => { switchView('schedule'); }); await T.waitForTimeout(500);
  await T.evaluate(() => { document.querySelector('#scheduleView [data-sub="ack"]').click(); }); await T.waitForTimeout(500);
  const tt = await T.evaluate(() => document.querySelector('#scheduleView').innerText);
  ok('the Confirmations tab lists who confirmed and who did not', /Confirmations/.test(tt) && /Test Person/.test(tt) && /Other Person/.test(tt) && /Not yet|Changed after confirming/.test(tt), tt.slice(0, 500));
  ok('Test Person is shown as changed after confirming (v1 confirmed, v2 sent), Other Person as not yet', /Changed after confirming/.test(tt) && /Not yet/.test(tt));
  ok('no page errors', perr.length === 0 && H.errs.length === 0, perr.concat(H.errs).slice(0, 3).join(' | ')); await H.close(); await br.close();
  console.log('ack: ' + (fails ? fails + ' FAILED' : 'ALL PASSED')); process.exit(fails ? 1 : 0);
})();
