/* v3.42 absence and cover must plan exactly like Generate: "auto from staff", teams that share one pool of tables, and Generate must keep absences. */
const path = require('path'), tool = path.join(__dirname, '..', 'tool', 'PTF-pass-to-floor-Gunda.html'), code = path.join(__dirname, '..', 'tool', 'Code.gs');
const gas = require('./fakegas')(code); require('./seed')(gas);
let fails = 0; function ok(n, c, x) { if (!c) fails++; console.log((c ? '  ✅ ' : '  ❌ ') + n + (c ? '' : '  → ' + x)); }
(async () => {
  const H = await require('./harness')(tool, gas), P = await H.open({ admin: true }); await P.setViewportSize({ width: 1600, height: 1000 }); await P.sync();
  const w = (ms) => P.waitForTimeout(ms);
  const setup = async (cfg) => { const day = await P.evaluate((cfg) => { switchView('schedule'); const d = new Date(), day = d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2), S = JSON.parse(localStorage.getItem('totSchedule') || '{}');
      S.teams = [{ id: 't1', name: 'Team 1' }, { id: 't2', name: 'Team 2' }]; S.roster = { anchor: day, people: ['W1', 'W2', 'W3', 'W4'].map(n => ({ name: n, g: 'A', sh: 'morning', t: 't1' })).concat(['X1', 'X2', 'X3'].map(n => ({ name: n, g: 'A', sh: 'morning', t: 't2' }))) };
      S.cfg = cfg; S.days = {}; S.sched = {}; localStorage.setItem('totSchedule', JSON.stringify(S)); SchedMount(); window.__totNowH = 8; return day; }, cfg); await w(500);
    await P.evaluate(() => document.querySelector('#scheduleView [data-sub="rot"]').click()); await w(300);
    await P.evaluate(() => document.querySelector('#scheduleView [data-a="load"]').click()); await w(500); await P.evaluate(() => document.querySelector('#scheduleView [data-a="gen"]').click()); await w(1000); return day; };
  const rows = (day) => P.evaluate((day) => JSON.parse(localStorage.getItem('totSchedule')).days[day].shifts.morning.rows, day);
  const stat = (R) => { let hi = 0, n = 0, conflicts = 0; for (let c = 0; c < 16; c++) { const seen = {}; R.forEach(r => { const v = (r.cells || [])[c]; if (/^\d+$/.test(v)) { hi = Math.max(hi, +v); n++; if (seen[v]) conflicts++; seen[v] = 1; } }); } return { hi, n, conflicts }; };
  const mark = async (day, name, a) => { await P.evaluate(() => { if (!document.querySelector('#cvP')) document.querySelector('#scheduleView [data-a="cv"]').click(); }); await w(300); const i = (await rows(day)).findIndex(r => r.name === name); await P.evaluate(({ i, a }) => { document.querySelector('#cvP').value = String(i); document.querySelector('#cvA').value = String(a); document.querySelector('#cvB').value = '16'; document.querySelector('#cvW').value = 'sick'; document.querySelector('#scheduleView [data-cvgo]').click(); }, { i, a }); await w(800); };

  console.log('1. "auto from staff" on, 100 tables, two teams without table ranges');
  let day = await setup({ len: 8, maxrun: 4, tables: 100, auto: true }); let R = await rows(day), before = stat(R);
  ok('generated rotation uses only a few tables (5 for 7 people)', before.hi === 5 && before.n === 80, JSON.stringify(before));
  ok('the gap check counts only those tables: "All 5 tables are covered" (not 100)', await P.evaluate(() => /All 5 tables are covered/.test((document.querySelector('#scW') || {}).innerText || '')), await P.evaluate(() => (document.querySelector('#scW') || {}).innerText.slice(0, 120)));
  await mark(day, 'X1', 4); R = await rows(day); let after = stat(R);
  ok('after marking X1 absent the rest still uses tables 1–5 only (no table 96)', after.hi <= 5 && after.conflicts === 0, JSON.stringify(after));
  ok('every one of the 5 tables is still covered in every half hour (6 people left)', after.n === 80, JSON.stringify(after));
  ok('X1 is off from slot 4 and marked absent', R.find(r => r.name === 'X1').abs.length === 1 && R.find(r => r.name === 'X1').cells.slice(4).every(c => c === 'OFF'));
  console.log('2. Generate whole shift after an absence keeps the absence');
  await P.evaluate(() => document.querySelector('#scheduleView [data-a="gen"]').click()); await w(1000); R = await rows(day); after = stat(R); const x1 = R.find(r => r.name === 'X1');
  ok('X1 stays absent and off after generating again', x1.abs && x1.abs.length === 1 && x1.cells.slice(4).every(c => c === 'OFF'), JSON.stringify(x1.cells));
  ok('the rest is still planned on tables 1–5 without clashes', after.hi <= 5 && after.conflicts === 0 && after.n === 80, JSON.stringify(after));

  console.log('3. Two teams share the pool of tables (no ranges, auto off): no table is given to two people');
  day = await setup({ len: 8, maxrun: 4, tables: 6 }); R = await rows(day); before = stat(R);
  ok('generated: 6 tables, no clashes', before.hi === 6 && before.conflicts === 0, JSON.stringify(before));
  await mark(day, 'W2', 6); R = await rows(day); after = stat(R);
  ok('after an absence in team 1 there are still no clashes with team 2', after.conflicts === 0 && after.hi <= 6, JSON.stringify(after));
  await mark(day, 'X2', 8); R = await rows(day); after = stat(R);
  ok('and after another one in team 2', after.conflicts === 0 && after.hi <= 6, JSON.stringify(after));
  ok('no page errors', H.errs.length === 0, H.errs.slice(0, 3)); await H.close();
  console.log('cover_auto: ' + (fails ? fails + ' FAILED' : 'ALL PASSED')); process.exit(fails ? 1 : 0);
})();
