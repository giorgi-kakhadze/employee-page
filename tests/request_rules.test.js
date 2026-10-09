/* v3.41 requests from the employee page: rules check, balance, block mode with override, and the approval changes the schedule. */
const path = require('path'), tool = path.join(__dirname, '..', 'tool', 'PTF-pass-to-floor-Gunda.html'), code = path.join(__dirname, '..', 'tool', 'Code.gs');
const gas = require('./fakegas')(code); require('./seed')(gas);
let fails = 0; function ok(n, c, x) { if (!c) fails++; console.log((c ? '  ✅ ' : '  ❌ ') + n + (c ? '' : '  → ' + x)); }
(async () => {
  const H = await require('./harness')(tool, gas), P = await H.open({ admin: true }); await P.setViewportSize({ width: 1600, height: 1000 }); await P.sync();
  const w = (ms) => P.waitForTimeout(ms);
  const D = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); };
  const t0 = D(0), mk = (id, type, who, from, to, extra) => Object.assign({ id, type, name: who, workId: 'E' + id, email: who.toLowerCase().replace(' ', '.') + '@x.com', from, to, with: '', shift: '', note: '', status: 'pending', created: Date.now(), u: Date.now(), src: 'employee', hist: [] }, extra || {});
  /* Set A works today (3 days), Set B is off. Ana (A, morning), Ben (A, night), Cleo (B, afternoon), Dan (B, morning) */
  await P.evaluate(([t0, reqs]) => { switchView('schedule'); const S = JSON.parse(localStorage.getItem('totSchedule') || '{}');
    S.teams = [{ id: 't1', name: 'Team 1' }]; S.roster = { anchor: t0, people: [{ name: 'Ana Aa', g: 'A', sh: 'morning', t: 't1' }, { name: 'Ben Bb', g: 'A', sh: 'night', t: 't1' }, { name: 'Cleo Cc', g: 'B', sh: 'afternoon', t: 't1' }, { name: 'Dan Dd', g: 'B', sh: 'morning', t: 't1' }] };
    S.leaveDays = 5; S.labour = { rest: 12, consec: 3, week: 0, mode: 'warn' }; S.cfg = { len: 8, tables: 100 }; S.days = {}; S.sched = {}; localStorage.setItem('totSchedule', JSON.stringify(S)); localStorage.setItem('totEmpRequests', JSON.stringify(reqs)); SchedMount(); window.prompt = () => 'Manager decision';
  }, [t0, [
    mk('1', 'annual', 'Ana Aa', D(12), D(14)),                   // 3 working days of set A (cycle days 12-14), within the 5 day allowance
    mk('2', 'annual', 'Dan Dd', D(20), D(40)),                   // far over the 5 day allowance
    mk('3', 'giveaway', 'Ana Aa', t0, t0, { with: 'Ben Bb', shift: 'morning' }),   // Ben already works today
    mk('4', 'giveaway', 'Ana Aa', t0, t0, { with: 'Cleo Cc', shift: 'morning' }),  // Cleo (afternoon, set B) is off today -> morning shift would follow... rest rules
    mk('5', 'sick', 'Dan Dd', t0, t0), mk('6', 'dayoff', 'Ana Aa', D(1), D(1)) ]]);
  await w(500); await P.evaluate(() => switchView('requests')); await w(800);
  const txt = () => P.evaluate(() => document.querySelector('#requestsView').innerText);
  let t = await txt();
  ok('every pending request shows a "Rules check"', (t.match(/Rules check/g) || []).length >= 5, (t.match(/Rules check/g) || []).length);
  ok('the vacation balance is shown (3 days needed of 5, 2 left)', /3 working day[^\n]*2 of 5 left/.test(t) || /needed, 2 of 5 left/.test(t), t.slice(0, 600));
  ok('too many vacation days are flagged against the balance', /already used in [0-9]{4}, this request needs/.test(t) || /this request needs/.test(t));
  ok('a give-away to somebody who already works that day cannot be approved', /already works or is on leave/.test(t));
  const act = (id, a) => P.evaluate(([id, a]) => { const b = document.querySelector('[data-rq="' + a + '"][data-id="' + id + '"]'); if (b) b.click(); return !!b; }, [id, a]);
  /* approve the good vacation: the schedule gets VAC on those days, the card says so */
  await act('1', 'ok'); await w(900);
  let S = await P.evaluate(() => JSON.parse(localStorage.getItem('totSchedule')));
  const ana = S.sched[Object.keys(S.sched)[0]]; const vac = Object.values(S.sched).flatMap((m) => Object.values(m['ana aa'] ? m['ana aa'].d : {})).filter((v) => v === 'VAC').length;
  ok('approving annual leave marks the days VAC in the schedule (3 days)', vac === 3, vac);
  const rq = await P.evaluate(() => JSON.parse(localStorage.getItem('totEmpRequests')));
  ok('the request records that the schedule was updated', rq.find((r) => r.id === '1').applied === true && rq.find((r) => r.id === '1').status === 'approved');
  /* sick leave -> SICK */
  await act('5', 'ok'); await w(700);
  S = await P.evaluate(() => JSON.parse(localStorage.getItem('totSchedule'))); const sick = Object.values(S.sched).flatMap((m) => Object.values(m['dan dd'] ? m['dan dd'].d : {})).filter((v) => v === 'SICK').length;
  ok('sick leave marks the day SICK', sick === 1, sick);
  /* over the balance, warn mode: needs a confirm (the harness accepts) and still works; block mode: needs the typed reason and records it */
  await P.evaluate(() => { const S = JSON.parse(localStorage.getItem('totSchedule')); S.labour.mode = 'block'; localStorage.setItem('totSchedule', JSON.stringify(S)); SchedMount(); }); await w(500);
  await P.evaluate(() => switchView('requests')); await w(600);
  t = await txt(); ok('block mode: the balance problem is shown as a broken rule (✖)', /✖ Vacation balance/.test(t), t.slice(0, 400));
  await P.evaluate(() => { window.prompt = () => ''; }); await act('2', 'ok'); await w(500);
  let rq2 = await P.evaluate(() => JSON.parse(localStorage.getItem('totEmpRequests'))); ok('without a reason the request stays pending', rq2.find((r) => r.id === '2').status === 'pending');
  await P.evaluate(() => { window.prompt = () => 'Approved by the director'; }); await act('2', 'ok'); await w(900);
  rq2 = await P.evaluate(() => JSON.parse(localStorage.getItem('totEmpRequests'))); const r2 = rq2.find((r) => r.id === '2');
  ok('with a typed reason it is approved and the override is recorded', r2.status === 'approved' && r2.override && /director/.test(r2.override.why), JSON.stringify(r2.override));
  /* the employee page gets the balance */
  const bal = await P.evaluate(() => { const o = window.totSchedApi.balance('Ana Aa', new Date().getFullYear() + ''); return o; });
  ok('the balance counts the approved vacation (3 of 5 used)', bal.used === 3 && bal.allow === 5, JSON.stringify(bal));
  ok('no page errors', H.errs.length === 0, H.errs.slice(0, 3)); await H.close();
  console.log('request_rules: ' + (fails ? fails + ' FAILED' : 'ALL PASSED')); process.exit(fails ? 1 : 0);
})();
