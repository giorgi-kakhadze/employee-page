/* v3.41 notifications: e-mail reminders for missing confirmations, e-mail to the employee about a decision, the bell for people who run the schedule, updates on the employee page. */
const path = require('path'), fs = require('fs');
const gas = require('./fakegas')(path.join(__dirname, '..', 'tool', 'Code.gs')); require('./seed')(gas);
let fails = 0; function ok(n, c, x) { if (!c) fails++; console.log((c ? '  ✅ ' : '  ❌ ') + n + (c ? '' : '  → ' + x)); }
const now = Date.now(), P = (o) => ({ v: JSON.stringify(o), t: now - 500 });
(async () => {
  const mk = (n, ver) => ({ name: n, team: 't1', shift: 'morning', ver, vat: now - 3600e3, sx: [], rx: [] });
  const d = gas.data(); d.keys = d.keys || {};
  d.keys.totMySchedules = P({ byEmail: { 'a@x.com': mk('Ana Aa', 'v1'), 'b@x.com': mk('Ben Bb', 'v2'), 'c@x.com': mk('Cleo Cc', 'v1') }, sent: {} });
  d.keys.totScheduleAcks = P([{ id: 'a@x.com', email: 'a@x.com', ver: 'v1', ts: now, u: now }, { id: 'b@x.com', email: 'b@x.com', ver: 'v1', ts: now, u: now }]);
  d.keys.totEmpRequests = P([{ id: 'r1', type: 'annual', name: 'Dan Dd', email: 'd@x.com', from: '2026-11-02', to: '2026-11-04', status: 'approved', decisionNote: 'Enjoy', src: 'employee' }, { id: 'r2', type: 'sick', name: 'Eva Ee', email: 'e@x.com', from: '2026-11-02', to: '2026-11-02', status: 'pending', src: 'employee' }]);
  gas.setData(d); const before = gas.mails.length;
  let r = gas.post({ action: 'ackRemind', admin: 'ADMKEY', site: 'main' });
  const sent = gas.mails.slice(before);
  ok('the reminder goes only to people who have not confirmed the current version (Ben changed, Cleo never)', r.ok && r.sent === 2 && sent.map((m) => m.to).sort().join() === 'b@x.com,c@x.com', JSON.stringify(r) + ' ' + sent.map((m) => m.to));
  ok('the text is personal and short', /Hello Ben,/.test(sent.find((m) => m.to === 'b@x.com').body) && /I have seen it/.test(sent[0].body));
  r = gas.post({ action: 'ackRemind', admin: 'ADMKEY', site: 'main' }); ok('a second reminder within 10 minutes is refused', /10 minutes/.test(r.error || ''), JSON.stringify(r));
  const m0 = gas.mails.length; r = gas.post({ action: 'reqMail', admin: 'ADMKEY', id: 'r1', site: 'main' });
  ok('an approved request is e-mailed to the employee with the manager\'s note', r.ok && r.sent === 1 && gas.mails[m0].to === 'd@x.com' && /approved/.test(gas.mails[m0].body) && /Enjoy/.test(gas.mails[m0].body), JSON.stringify(r));
  r = gas.post({ action: 'reqMail', admin: 'ADMKEY', id: 'r1', site: 'main' }); ok('and only once', r.ok && r.sent === 0 && gas.mails.length === m0 + 1);
  r = gas.post({ action: 'reqMail', admin: 'ADMKEY', id: 'r2', site: 'main' }); ok('a request that is still pending is never mailed', r.error === 'nothing to send', JSON.stringify(r));
  r = gas.post({ action: 'ackRemind', site: 'main' }); ok('without being signed in nothing is sent', !!r.error && gas.mails.length === m0 + 1, JSON.stringify(r));
  /* the tool: bell items and the Confirmations tab button */
  const H = await require('./harness')(path.join(__dirname, '..', 'tool', 'PTF-pass-to-floor-Gunda.html'), gas), T = await H.open({ admin: true }); await T.setViewportSize({ width: 1500, height: 900 }); await T.sync(); await T.waitForTimeout(800);
  const bell = await T.evaluate(() => { document.getElementById('bellBtn').click(); return new Promise((res) => setTimeout(() => res(document.querySelector('.tkOv') ? document.querySelector('.tkOv').innerText : ''), 500)); });
  ok('the bell says how many people have not confirmed', /have not confirmed their schedule/.test(bell), bell.slice(0, 300));
  ok('and that employee requests are waiting', /employee request/.test(bell) && /waiting for a decision/.test(bell), bell.slice(0, 300));
  await T.evaluate(() => { const c = [...document.querySelectorAll('.tkOv [data-k]')].find((x) => /not confirmed/.test(x.innerText)); c && c.click(); }); await T.waitForTimeout(700);
  ok('clicking it opens the Confirmations tab', await T.evaluate(() => /Confirmations/.test(document.querySelector('#scheduleView').innerText) && !!document.querySelector('[data-ackmail]')));
  ok('no page errors', H.errs.length === 0, H.errs.slice(0, 3)); await H.close();
  console.log('notify: ' + (fails ? fails + ' FAILED' : 'ALL PASSED')); process.exit(fails ? 1 : 0);
})();
