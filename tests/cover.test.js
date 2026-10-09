/* v3.41 absence and cover: somebody leaves, the rest of the rotation is planned again from that half hour; every table stays covered; people who are off can be called in. */
const path = require('path'), tool = path.join(__dirname, '..', 'tool', 'PTF-pass-to-floor-Gunda.html'), code = path.join(__dirname, '..', 'tool', 'Code.gs');
const gas = require('./fakegas')(code); require('./seed')(gas);
let fails = 0; function ok(n, c, x) { if (!c) fails++; console.log((c ? '  ✅ ' : '  ❌ ') + n + (c ? '' : '  → ' + x)); }
(async () => {
  const H = await require('./harness')(tool, gas), P = await H.open({ admin: true }); await P.setViewportSize({ width: 1600, height: 1000 }); await P.sync();
  const w = (ms) => P.waitForTimeout(ms), S = async () => { await w(500); return P.evaluate(() => JSON.parse(localStorage.getItem('totSchedule'))); };
  const day = await P.evaluate(() => { switchView('schedule'); const d = new Date(), day = d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2), S = JSON.parse(localStorage.getItem('totSchedule') || '{}');
    /* Set A works today (anchor = today), set B is off: 6 people of set A on 4 tables (team t1), 3 people of set B are the ones to call in */
    S.teams = [{ id: 't1', name: 'Team 1' }]; S.roster = { anchor: day, people: Array.from({ length: 6 }, (_, i) => ({ name: 'W' + (i + 1), g: 'A', sh: 'morning', t: 't1' })).concat(Array.from({ length: 3 }, (_, i) => ({ name: 'R' + (i + 1), g: 'B', sh: 'morning', t: 't1' }))) };
    S.cfg = { len: 8, maxrun: 4, tables: 100, tt: { t1: [1, 4] } }; S.days = {}; S.sched = {}; localStorage.setItem('totSchedule', JSON.stringify(S)); SchedMount(); return day; });
  await P.evaluate(() => { window.__totNowH = 8; });   /* the planner reads "now" from here in the test: the shift has just started */
  await w(500); await P.evaluate(() => { document.querySelector('#scheduleView [data-sub="rot"]') && document.querySelector('#scheduleView [data-sub="rot"]').click(); }); await w(300);
  await P.evaluate(() => { document.querySelector('#scheduleView [data-a="load"]').click(); }); await w(600);
  await P.evaluate(() => { document.querySelector('#scheduleView [data-a="gen"]').click(); }); await w(1200);
  let sh = (await S()).days[day].shifts.morning; const cov = (sh, q0) => { let bad = 0; for (let q = q0; q < 16; q++) { const t = sh.rows.map((r) => r.cells[q]).filter((v) => /^\d+$/.test(v)).map(Number).sort((a, b) => a - b); if (t.join() !== '1,2,3,4') bad++; } return bad; };
  ok('6 people on 4 tables: every table is covered all shift', sh.rows.length === 6 && cov(sh, 0) === 0, sh.rows.length + ' rows, bad slots ' + cov(sh, 0));
  const before = JSON.stringify(sh.rows.map((r) => r.cells.slice(0, 6)));
  ok('there is an "Absence / cover" button', await P.evaluate(() => !!document.querySelector('#scheduleView [data-a="cv"]')));
  await P.evaluate(() => document.querySelector('#scheduleView [data-a="cv"]').click()); await w(300);
  const who = await P.evaluate(() => { const s = document.querySelector('#cvP'); s.value = '0'; return s.options[1].textContent; });
  await P.evaluate(() => { document.querySelector('#cvA').value = '6'; document.querySelector('#cvB').value = '16'; document.querySelector('#cvW').value = 'sick'; document.querySelector('#scheduleView [data-cvgo]').click(); }); await w(800);
  sh = (await S()).days[day].shifts.morning; const ab = sh.rows.filter((r) => r.abs)[0];
  ok('the person is marked absent from slot 6 to the end and shows OFF there', ab && ab.abs[0].a === 6 && ab.cells.slice(6, 16).every((c) => c === 'OFF'), JSON.stringify(ab && ab.abs));
  ok('slots before the absence did not change', JSON.stringify(sh.rows.map((r) => r.cells.slice(0, 6))) === before);
  ok('5 people on 4 tables after the absence: every table is still covered from slot 6 (one person on a break at a time)', cov(sh, 6) === 0 && sh.rows.filter((r) => !r.abs).every((r) => r.cells.slice(6).some((c) => c === 'B')), 'bad ' + cov(sh, 6));
  /* a second absence leaves 4 people for 4 tables: still covered, nobody on a break; a third leaves a gap and the call-in list appears */
  await P.evaluate(() => { document.querySelector('#cvP').value = '1'; document.querySelector('#cvA').value = '8'; document.querySelector('#cvB').value = '16'; document.querySelector('#scheduleView [data-cvgo]').click(); }); await w(700);
  await P.evaluate(() => { document.querySelector('#cvP').value = '2'; document.querySelector('#cvA').value = '8'; document.querySelector('#cvB').value = '16'; document.querySelector('#scheduleView [data-cvgo]').click(); }); await w(900);
  const gaps = await P.evaluate(() => document.querySelector('#scCv').innerText);
  ok('with too few people the panel says tables have nobody and offers the people who are off today', /have nobody/.test(gaps) && /Call in from/.test(gaps) && /R1/.test(gaps), gaps.slice(0, 300));
  await P.evaluate(() => document.querySelector('#scheduleView [data-cvcall]').click()); await w(900);
  await P.evaluate(() => document.querySelector('#scheduleView [data-cvcall]') && document.querySelector('#scheduleView [data-cvcall]').click()); await w(700);
  sh = (await S()).days[day].shifts.morning; const called = sh.rows.filter((r) => r.called);
  ok('called-in people are added to the shift and the rotation is planned again', called.length >= 1 && cov(sh, 8) <= 2, called.length + ' called, bad ' + cov(sh, 8));
  ok('no page errors', H.errs.length === 0, H.errs.slice(0, 3)); await H.close();
  console.log('cover: ' + (fails ? fails + ' FAILED' : 'ALL PASSED')); process.exit(fails ? 1 : 0);
})();
