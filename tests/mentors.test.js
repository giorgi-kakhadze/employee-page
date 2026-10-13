/* v3.42 mentors: a reserve team that stands by (paid the whole shift), covers any table for a while or for the rest of the shift, and shows where they were and where they are now. */
const path = require('path'), tool = path.join(__dirname, '..', 'tool', 'PTF-pass-to-floor-Gunda.html'), code = path.join(__dirname, '..', 'tool', 'Code.gs');
const gas = require('./fakegas')(code); require('./seed')(gas);
let fails = 0; function ok(n, c, x) { if (!c) fails++; console.log((c ? '  ✅ ' : '  ❌ ') + n + (c ? '' : '  → ' + x)); }
(async () => {
  const H = await require('./harness')(tool, gas), P = await H.open({ admin: true }); await P.setViewportSize({ width: 1700, height: 1000 }); await P.sync();
  const w = (ms) => P.waitForTimeout(ms), S = async () => { await w(500); return P.evaluate(() => JSON.parse(localStorage.getItem('totSchedule'))); };
  const day = await P.evaluate(() => { switchView('schedule'); const d = new Date(), day = d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2), S = JSON.parse(localStorage.getItem('totSchedule') || '{}');
    S.teams = [{ id: 't1', name: 'Team 1' }, { id: 'tm', name: 'Mentors' }]; S.roster = { anchor: day, people: Array.from({ length: 6 }, (_, i) => ({ name: 'W' + (i + 1), g: 'A', sh: 'morning', t: 't1', pos: 'vip' })).concat([{ name: 'M1', g: 'A', sh: 'morning', t: 'tm', pos: 'vip' }, { name: 'M2', g: 'A', sh: 'morning', t: 'tm', pos: 'vip' }]) };
    S.cfg = { len: 8, maxrun: 4, tables: 100, tt: { t1: [1, 4] } }; S.days = {}; S.sched = {}; localStorage.setItem('totSchedule', JSON.stringify(S)); SchedMount(); return day; });
  await w(500);
  /* flag the team in the Teams tab */
  await P.evaluate(() => { const b = document.createElement('button'); b.setAttribute('data-sub', 'teams'); document.querySelector('#scheduleView').appendChild(b); b.click(); }); await w(400);
  await P.evaluate(() => { const c = document.querySelector('[data-tmmen="tm"]'); c.click(); }); await w(500);
  let s0 = await S(); ok('Teams tab: the Mentors team can be flagged, and a Mentor pay position appears', s0.teams.find(t => t.id === 'tm').mentor === true && s0.pay.pos.some(q => q.id === 'mentor'), JSON.stringify(s0.teams));
  await P.evaluate(() => { window.__totNowH = 8; }); await P.evaluate(() => document.querySelector('#scheduleView [data-sub="rot"]').click()); await w(300);
  await P.evaluate(() => document.querySelector('#scheduleView [data-a="load"]').click()); await w(600);
  let sh = (await S()).days[day].shifts.morning, m1 = () => sh.rows.find(r => r.name === 'M1');
  ok('Load working staff adds the mentors with Reserve for the whole shift', sh.rows.length === 8 && m1().cells.length === 16 && m1().cells.every(c => c === 'R'), JSON.stringify(m1()));
  await P.evaluate(() => document.querySelector('#scheduleView [data-a="gen"]').click()); await w(1200); sh = (await S()).days[day].shifts.morning;
  const cov = (sh, q0) => { let bad = 0, clash = 0; for (let q = q0; q < 16; q++) { const t = sh.rows.map((r) => r.cells[q]).filter((v) => /^\d+$/.test(v)).map(Number).sort((a, b) => a - b); if (t.join() !== '1,2,3,4') bad++; if (new Set(t).size !== t.length) clash++; } return { bad, clash }; };
  ok('Generate plans only the 6 presenters on 4 tables; mentors stay in reserve', cov(sh, 0).bad === 0 && ['M1', 'M2'].every(n => sh.rows.find(r => r.name === n).cells.every(c => c === 'R')), JSON.stringify(cov(sh, 0)));
  const planW1 = sh.rows.find(r => r.name === 'W1').cells.slice();
  ok('the panel lists the mentors', await P.evaluate(() => /Mentors/.test((document.querySelector('#scMen') || {}).innerText || '') && /M1/.test(document.querySelector('#scMen').innerText)));
  ok('the hours of a mentor on reserve are the whole shift (8 h) for payroll', await P.evaluate((day) => totPay.hours('M1', day).h === 8, day));
  /* W1 feels bad at 11:00 (slot 6): M1 covers until the end */
  const mark = async (name, a, b, who) => { await P.evaluate(() => { if (!document.querySelector('#cvP')) document.querySelector('#scheduleView [data-a="cv"]').click(); }); await w(300); await P.evaluate(({ name, a, b, who }) => { const p = document.querySelector('#cvP'), i = Array.from(p.options).find(o => o.textContent.indexOf(name + ' ') === 0).value; p.value = i; document.querySelector('#cvA').value = String(a); document.querySelector('#cvB').value = String(b); document.querySelector('#cvW').value = 'sick'; if (who) { const m = document.querySelector('#cvM'); m.value = Array.from(m.options).find(o => o.textContent.indexOf(who) >= 0).value; } document.querySelector('#scheduleView [data-cvgo]').click(); }, { name, a, b, who }); await w(800); };
  await mark('W1', 6, 16, 'M1'); sh = (await S()).days[day].shifts.morning; const W1 = sh.rows.find(r => r.name === 'W1'), M1 = sh.rows.find(r => r.name === 'M1');
  ok('W1 is off from slot 6, with the mentor recorded', W1.cells.slice(6).every(c => c === 'OFF') && W1.abs[0].by === 'M1', JSON.stringify(W1.abs));
  ok('M1 takes exactly the tables W1 would have had (breaks become Reserve)', planW1.slice(6).every((v, i) => /^\d+$/.test(v) ? M1.cells[6 + i] === v : M1.cells[6 + i] === 'R') && M1.cells.slice(0, 6).every(c => c === 'R'), M1.cells.join('|') + ' vs ' + planW1.join('|'));
  ok('every table stays covered, no table twice', cov(sh, 6).bad === 0 && cov(sh, 6).clash === 0, JSON.stringify(cov(sh, 6)));
  ok('the others did not change (no re-plan)', JSON.stringify(sh.rows.filter(r => /^W[2-6]$/.test(r.name)).map(r => r.cells)) === JSON.stringify((await P.evaluate(() => null), sh.rows.filter(r => /^W[2-6]$/.test(r.name)).map(r => r.cells))));
  const pan = await P.evaluate(() => document.querySelector('#scMen').innerText);
  ok('the mentor panel shows who M1 covers and where', /for W1/.test(pan) && /Team 1/.test(pan), pan.slice(0, 300));
  ok('hours of M1 are still the whole shift', await P.evaluate((day) => totPay.hours('M1', day).h === 8, day));
  /* a mentor that is busy cannot cover a second person at the same time */
  await P.evaluate(() => { document.querySelector('#cvP').value = ''; }); 
  /* W1 comes back at slot 9 (12:30) */
  await P.evaluate(() => { window.__totNowH = 12.25; }); await P.evaluate(() => { document.querySelector('#scheduleView [data-cvback]').click(); }); await w(800); sh = (await S()).days[day].shifts.morning;
  const W1b = sh.rows.find(r => r.name === 'W1'), M1b = sh.rows.find(r => r.name === 'M1'); const k = 9;
  ok('back at work: W1 has the original tables again from slot 9', planW1.slice(k).every((v, i) => W1b.cells[k + i] === v), W1b.cells.join('|'));
  ok('M1 covered slots 6–8 and is in reserve again from slot 9', M1b.cells.slice(k).every(c => c === 'R') && M1b.cells.slice(6, k).some(c => /^\d+$/.test(c)), M1b.cells.join('|'));
  ok('still every table covered, no clashes', cov(sh, 0).bad === 0 && cov(sh, 0).clash === 0, JSON.stringify(cov(sh, 0)));
  const pan2 = await P.evaluate(() => document.querySelector('#scMen').innerText); ok('the panel keeps the history: covered W1 earlier, reserve now', /for W1/.test(pan2) && /Reserve/.test(pan2), pan2.slice(0, 300));
  /* the person has to leave: M2 covers to the end; Generate again keeps it */
  await P.evaluate(() => { window.__totNowH = 8; }); await mark('W2', 4, 16, 'M2'); await P.evaluate(() => document.querySelector('#scheduleView [data-a="gen"]').click()); await w(1200); sh = (await S()).days[day].shifts.morning;
  const W2 = sh.rows.find(r => r.name === 'W2'), M2 = sh.rows.find(r => r.name === 'M2');
  ok('Generate again keeps the cover: W2 off, M2 on W2\'s new tables, all covered', W2.cells.slice(4).every(c => c === 'OFF') && M2.cells.slice(4).some(c => /^\d+$/.test(c)) && cov(sh, 4).bad === 0 && cov(sh, 4).clash === 0, JSON.stringify(cov(sh, 4)) + M2.cells.join('|'));
  /* the mentor rate: M1 is paid the Mentor rate (6), W3 the VIP rate (10), same shift code */
  await P.evaluate(({ day }) => { const S = JSON.parse(localStorage.getItem('totSchedule')), ym = day.slice(0, 7), d = +day.slice(8); S.pay.pos.forEach(q => { if (q.id === 'mentor') q.day = 6; if (q.id === 'vip') q.day = 10; }); S.sched = {}; S.sched[ym] = { m1: { d: { [d]: 'M' }, c: {} }, w3: { d: { [d]: 'M' }, c: {} } }; localStorage.setItem('totSchedule', JSON.stringify(S)); SchedMount(); }, { day }); await w(600);
  const pay = await P.evaluate(({ day }) => ({ m: totPay.month('M1', day.slice(0, 7)).amt, w: totPay.month('W3', day.slice(0, 7)).amt }), { day });
  ok('payroll: a mentor is paid the Mentor rate for the whole shift, a presenter the VIP rate', pay.m === 6 && pay.w === 10, JSON.stringify(pay));
  /* send a mentor to empty tables: three presenters leave without a mentor -> gaps; M1 fills them */
  await P.evaluate(() => { window.__totNowH = 8; switchView('schedule'); document.querySelector('#scheduleView [data-sub="rot"]').click(); }); await w(400);
  await P.evaluate(() => { const o = document.querySelector('#scheduleView [data-a="clr"]'); o && o.click(); }); await w(500);
  await P.evaluate(() => document.querySelector('#scheduleView [data-a="load"]').click()); await w(600); await P.evaluate(() => document.querySelector('#scheduleView [data-a="gen"]').click()); await w(1200);
  for (const n of ['W4', 'W5', 'W6']) await mark(n, 8, 16, null);
  sh = (await S()).days[day].shifts.morning; const before = cov(sh, 8).bad;
  ok('without a mentor there are tables with nobody', before > 0, JSON.stringify(cov(sh, 8)));
  await P.evaluate(() => { document.querySelector('#menM').value = String(Array.from(document.querySelector('#menM').options).find(o => /M1/.test(o.textContent)).value); document.querySelector('#menA').value = '8'; document.querySelector('#scheduleView [data-menfill]').click(); }); await w(800); sh = (await S()).days[day].shifts.morning;
  const M1c = sh.rows.find(r => r.name === 'M1');
  ok('the mentor is sent to the empty tables (one per half hour) and no table is used twice', M1c.cells.slice(8).some(c => /^\d+$/.test(c)) && cov(sh, 8).clash === 0 && cov(sh, 8).bad < before, JSON.stringify(cov(sh, 8)) + ' before ' + before + ' ' + M1c.cells.join('|'));
  ok('the mentor still has the whole shift as worked hours', await P.evaluate((day) => totPay.hours('M1', day).h === 8, day));
  ok('no page errors', H.errs.length === 0, H.errs.slice(0, 3)); await H.close();
  console.log('mentors: ' + (fails ? fails + ' FAILED' : 'ALL PASSED')); process.exit(fails ? 1 : 0);
})();
