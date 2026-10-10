/* v3.39 employee page (index.html): long names and e-mails wrap, a failed Refresh is visible, a half-written request survives refreshes and tab changes,
   an ended shift is not "next", a partial pay object does not break the page, odd request types show "Request", terminated employees are refused. */
const path = require('path'), fs = require('fs');
const gas = require('./fakegas')(path.join(__dirname, '..', 'tool', 'Code.gs'));
let fails = 0; function ok(name, cond, extra) { if (!cond) fails++; console.log((cond ? '  ✅ ' : '  ❌ ') + name + (extra ? '  → ' + extra : '')); }
const { chromium } = (function () { try { return require('playwright'); } catch (e) { return require(require('child_process').execSync('npm root -g').toString().trim() + '/playwright'); } })();
const URL = 'https://script.google.com/macros/s/TEST/exec', tmp = path.join(require('os').tmpdir(), 'emp-page-test2.html');
const now = Date.now(), P = (o) => ({ v: JSON.stringify(o), t: now - 500 }), iso = (d) => { const x = new Date(Date.now() + d * 864e5); return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0'); };
const LONG = 'Averyveryveryveryveryveryveryveryveryveryveryveryverylongnicknamewithoutspaces' + 'x'.repeat(40), LONGMAIL = 'a'.repeat(60) + '@' + 'b'.repeat(60) + '.example.com';
const hh = new Date().getHours();
(async () => {
  fs.writeFileSync(tmp, fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8').replace(/var SERVER_URL = '[^']*'/, "var SERVER_URL = '" + URL + "'").replace('<script src="https://accounts.google.com/gsi/client" async defer></script>', ''));
  const br = await chromium.launch(), perr = [];
  async function page(email, w, setup) {
    const E = await (await br.newContext({ viewport: { width: w || 390, height: 844 } })).newPage(); E.on('pageerror', e => perr.push(email + ': ' + e.message)); E.on('dialog', d => d.accept());
    let mode = 'ok'; E.setMode = (m) => { mode = m; };
    await E.route(URL + '**', async r => { if (mode === 'offline') return r.abort(); await r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(gas.post(r.request().postData())) }); });
    await E.addInitScript((e) => { window.google = { accounts: { id: { initialize: (c) => { window.__gcb = c.callback; }, renderButton: () => setTimeout(() => window.__gcb({ credential: 'gtok:' + e }), 30) } } }; }, email);
    await E.goto('file://' + tmp); await E.waitForTimeout(700); return E;
  }
  const emp = (nick, mail, status) => ({ id: 'e1', fullName: 'Test Person', nickname: nick, workId: 'W1', status: status || 'Employed', email: mail, ext: { email: mail, position: 'Game presenter' } });
  const setData = (o) => { const d = { updatedAt: now, keys: Object.assign({ totAccessPolicy: P({ users: {}, roles: {} }) }, o) }; gas.setData(d); };
  const todayD = iso(0);

  console.log('1. Long names and e-mails, on a phone');
  setData({ employeeDataSource: P([emp(LONG, LONGMAIL)]) });
  const A = await page(LONGMAIL, 360);
  const wide = await A.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth, btn: [...document.querySelectorAll('#app button')].filter(b => /Refresh|Sign out/.test(b.textContent)).map(b => Math.round(b.getBoundingClientRect().right)) }));
  ok('no sideways scrolling and the buttons stay on screen (360 px)', wide.sw <= wide.cw + 1 && wide.btn.every(r => r <= wide.cw), JSON.stringify(wide));
  await A.context().close();

  console.log('2. Next shift, partial pay, odd request type');
  const ymNow = todayD.slice(0, 7);
  setData({
    employeeDataSource: P([emp('Test', 'tester@x.com')]),
    totMySchedules: P({ byEmail: { 'tester@x.com': { sx: [{ d: todayD, s: 'morning', f: 0, t: 0.5 }, { d: iso(1), s: 'afternoon', f: 14, t: 22 }], group: 'A', shift: 'morning' } }, sent: {} }),
    totMyPay: P({ byEmail: { 'tester@x.com': { months: { [ymNow]: { ym: ymNow, cur: 'GEL' } } } } }),
    totEmpRequests: P([{ id: 'er1', workId: 'W1', name: 'Test Person', email: 'tester@x.com', type: 'constructor', from: iso(3), to: iso(3), status: 'pending', created: now, u: now }])
  });
  const B = await page('tester@x.com', 390);
  ok('no page errors with a partial pay object', perr.length === 0, perr.join(' | '));
  const home = await B.evaluate(() => document.getElementById('pg').textContent);
  ok('today\'s shift that ended at 00:30 is not offered as the next shift', hh >= 1 ? !new RegExp('Next shift: Morning').test(home) && /Next shift: Afternoon/.test(home) : true, (home.match(/Next shift: [^.]*/) || [''])[0].slice(0, 40));
  ok('no "undefined" or "NaN" on Home', !/undefined|NaN|\[object/.test(home), (home.match(/.{15}(undefined|NaN).{15}/) || [''])[0]);
  await B.evaluate(() => document.querySelector('nav.main3 [data-t="schedule"]').click()); await B.waitForTimeout(150);
  const sch = await B.evaluate(() => document.getElementById('pg').textContent);
  ok('an odd request type shows "Request", not a function body', /Request/.test(sch) && !/native code/.test(sch));
  const opts = await B.evaluate(() => [...document.querySelectorAll('#rqDay option')].map(o => o.textContent).join('|'));
  ok('the ended shift is not offered for a swap', hh < 1 || !/Morning/.test(opts), opts);

  console.log('3. A half-written request survives refreshes and tab changes');
  await B.selectOption('#rqT', 'dayoff'); await B.fill('#rqF', iso(12)); await B.fill('#rqN', 'Family event, please');
  await B.evaluate(() => load(true)); await B.waitForTimeout(400);
  const kept1 = await B.evaluate(() => ({ n: document.getElementById('rqN').value, f: document.getElementById('rqF').value, t: document.getElementById('rqT').value }));
  ok('a background refresh keeps the note, date and type', kept1.n === 'Family event, please' && kept1.f === iso(12) && kept1.t === 'dayoff', JSON.stringify(kept1));
  await B.evaluate(() => document.querySelector('nav.main3 [data-t="home"]').click()); await B.waitForTimeout(100);
  await B.evaluate(() => document.querySelector('nav.main3 [data-t="schedule"]').click()); await B.waitForTimeout(150);
  const kept2 = await B.evaluate(() => document.getElementById('rqN').value);
  ok('and so does going to another tab and back', kept2 === 'Family event, please', kept2);
  await B.click('#rqGo'); await B.waitForTimeout(500);
  ok('after sending, the form is empty again', await B.evaluate(() => document.getElementById('rqN').value) === '');

  console.log('4. A failed Refresh says so');
  B.setMode('offline'); await B.evaluate(() => { document.querySelector('nav.main3 [data-t="home"]').click(); }); await B.click('text=Refresh'); await B.waitForTimeout(500);
  const toast = await B.evaluate(() => { const t = document.getElementById('toast'); return t && !t.hidden ? t.textContent : ''; });
  ok('a message appears on the page when the server cannot be reached', /Could not reach the server/.test(toast), toast);
  await B.context().close();

  console.log('5. Terminated employee');
  setData({ employeeDataSource: P([emp('Gone', 'gone@x.com', 'Terminated')]) });
  const C = await page('gone@x.com', 390);
  const t = await C.evaluate(() => (document.getElementById('err') || {}).textContent + '|' + (document.getElementById('app').hidden ? 'app hidden' : 'app shown'));
  ok('the page shows a clear message and no data', /no longer active/.test(t) && /app hidden/.test(t), t);
  await C.context().close();

  ok('no page errors', perr.length === 0, perr.slice(0, 3).join(' | '));
  await br.close();
  console.log('employee_page: ' + (fails ? fails + ' FAILED' : 'ALL PASSED'));
  process.exit(fails ? 1 : 0);
})();
