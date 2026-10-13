/* v3.27: FMD schedule and rotation grids: breaks count as working hours; select many cells (drag, Ctrl+click, whole person), Delete clears them;
   drag selected shifts to another day or person (one onto another swaps); show only selected people. */
const path = require('path'), tool = process.argv[2] || path.join(__dirname, '..', 'tool', 'PTF-pass-to-floor-Gunda.html'), code = process.argv[3] || path.join(__dirname, '..', 'tool', 'Code.gs');
const gas = require('./fakegas')(code); require('./seed')(gas);
let fails = 0; function ok(n, c, x) { if (!c) fails++; console.log((c ? '  ✅ ' : '  ❌ ') + n + (x ? '  → ' + x : '')); }
(async () => {
  const H = await require('./harness')(tool, gas);
  const P = await H.open({ admin: true }); await P.setViewportSize({ width: 1600, height: 1000 }); await P.sync();
  const w = (ms) => P.waitForTimeout(ms);
  /* seed three people, a month of shifts and one rotation day */
  const seeded = await P.evaluate(() => { switchView('schedule'); const d = new Date(), ym = d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2), day = ym + '-' + ('0' + d.getDate()).slice(-2);
    const S = JSON.parse(localStorage.getItem('totSchedule') || '{}'); S.roster = S.roster || {}; S.roster.anchor = S.roster.anchor || ym + '-01';
    S.roster.people = [{ name: 'Ana Test', g: 'A', sh: 'morning', t: '' }, { name: 'Bob Test', g: 'A', sh: 'morning', t: '' }, { name: 'Cara Test', g: 'B', sh: 'morning', t: '' }];
    S.sched = S.sched || {}; S.sched[ym] = { 'ana test': { d: { 1: 'M', 2: 'M', 3: 'M', 4: 'A', 5: 'A' }, c: { 3: 'Swap asked' } }, 'bob test': { d: { 1: 'OFF', 2: 'N', 3: 'N' }, c: {} }, 'cara test': { d: { 8: 'N' }, c: {} } };
    S.days = S.days || {}; S.days[day] = { shifts: { morning: { start: 8, rows: [{ name: 'Ana Test', t: '', cells: ['1', '2', 'B', '3', '4', '', '', '', '', '', '', '', '', '', '', ''] }, { name: 'Bob Test', t: '', cells: ['2', 'B', '3', '4', '', '', '', '', '', '', '', '', '', '', '', ''] }, { name: 'Cara Test', t: '', cells: ['3', '4', 'B', 'OFF', '', '', '', '', '', '', '', '', '', '', '', ''] }] } } };
    localStorage.setItem('totSchedule', JSON.stringify(S)); SchedMount(); return { ym, day }; });
  await w(400);
  const sched = () => P.evaluate((ym) => { const S = JSON.parse(localStorage.getItem('totSchedule')); return S.sched[ym]; }, seeded.ym);
  const box = async (sel) => { const b = await P.locator(sel).first().boundingBox(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; };
  const sc = (r, c) => '#scheduleView td[data-sr="' + r + '"][data-sc="' + c + '"] input';
  const drag = async (a, b) => { const p = await box(a), q = await box(b); await P.mouse.move(p.x, p.y); await P.mouse.down(); await P.mouse.move((p.x + q.x) / 2, (p.y + q.y) / 2, { steps: 4 }); await P.mouse.move(q.x, q.y, { steps: 4 }); await P.mouse.up(); await w(300); };

  console.log('1. Rotation: breaks count as working time');
  await P.evaluate(() => { const b = document.querySelector('#scheduleView [data-sub="rot"]'); if (b) b.click(); }); await w(400);
  const hrs = await P.evaluate(() => Array.from(document.querySelectorAll('#scheduleView td[data-hr]')).map(t => t.textContent.trim()));
  ok('Ana: 4 tables + 1 break = 5 half-hours = 2.5 h (the break is counted)', hrs[0] === '2.5', hrs.join(' | '));
  ok('Cara: 2 tables + 1 break, OFF not counted = 1.5 h', hrs[2] === '1.5', hrs.join(' | '));
  const sumTxt = await P.evaluate(() => { const d = document.querySelector('#scheduleView #scM'); d.open = true; d.dispatchEvent(new Event('toggle')); return (document.querySelector('#scheduleView #scMB') || d).textContent; });
  ok('the month summary says breaks count as working time', /breaks count as working time/.test(sumTxt) && !/breaks, OFF not counted/.test(sumTxt), sumTxt.slice(0, 160));

  console.log('2. Rotation: select, delete and move slots (Layout editor)');
  await P.evaluate(() => document.querySelector('#scheduleView [data-a="lay"]').click()); await w(400);
  const rc = (r, c) => '#scheduleView td[data-r="' + r + '"][data-c="' + c + '"] input';
  const rcells = () => P.evaluate(() => { const S = JSON.parse(localStorage.getItem('totSchedule')), d = new Date(), day = d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); return S.days[day].shifts.morning.rows.map(x => x.cells.slice(0, 6).join(',')); });
  await P.click(rc(1, 2)); await P.click(rc(1, 3), { modifiers: ['Control'] }); await P.click(rc(2, 0), { modifiers: ['Control'] });
  const rsel = await P.evaluate(() => document.querySelectorAll('#scheduleView td[data-r].sel').length);
  ok('Ctrl+click picks scattered slots', rsel === 3, rsel);
  await P.keyboard.press('Delete'); await w(600);
  let rv = await rcells();
  ok('Delete clears all three', rv[1] === '2,B,,,,' && rv[2].indexOf(',4,B,OFF') === 0, rv.join(' | '));
  await P.click('#scheduleView td[data-hr="2"]'); await w(100);
  const rowSel = await P.evaluate(() => document.querySelectorAll('#scheduleView td[data-r="2"].sel').length);
  ok('clicking a person\'s hours selects their whole shift', rowSel >= 4, rowSel);
  await P.keyboard.press('Delete'); await w(600); rv = await rcells();
  ok('…and Delete clears it', rv[2] === ',,,,,', rv[2]);
  await P.click(rc(0, 0)); await drag(rc(0, 0), rc(2, 1)); await w(600); rv = await rcells();
  ok('drag a table slot to another person and time', rv[0].indexOf(',2,B') === 0 && rv[2] === ',1,,,,', rv.join(' | '));
  await P.click(rc(0, 3)); await drag(rc(0, 3), rc(1, 0)); await w(600); rv = await rcells();
  ok('dropping one slot on another swaps them (table 3 ↔ table 2)', rv[0] === ',2,B,2,4,' && rv[1] === '3,B,,,,', rv.join(' | '));

  console.log('3. Schedule: select many days, Delete');
  await P.evaluate(() => document.querySelector('#scheduleView [data-sub="sch"]').click()); await w(400);
  await P.click(sc(0, 3)); await P.click(sc(0, 4), { modifiers: ['Control'] }); await P.click(sc(1, 1), { modifiers: ['Control'] });
  ok('Ctrl+click picks single days across people', await P.evaluate(() => document.querySelectorAll('#scheduleView td[data-sr].sel').length) === 3);
  await P.keyboard.press('Delete'); await w(600);
  let m = await sched();
  ok('Delete clears all of them', !m['ana test'].d[4] && !m['ana test'].d[5] && !m['bob test'].d[2] && m['ana test'].d[3] === 'M', JSON.stringify([m['ana test'].d, m['bob test'].d]));
  await P.click('#scheduleView td[data-pr="1"]'); await w(100);
  const all = await P.evaluate(() => document.querySelectorAll('#scheduleView td[data-sr="1"].sel').length), dim = await P.evaluate(() => document.querySelectorAll('#scheduleView td[data-sr="1"]').length);
  ok('clicking a name selects the whole month for that person', all === dim && dim >= 28, all + '/' + dim);
  await P.keyboard.press('Delete'); await w(600); m = await sched();
  ok('…and Delete clears Bob\'s month', Object.keys(m['bob test'].d).length === 0, JSON.stringify(m['bob test'].d));

  console.log('4. Schedule: drag shifts');
  await P.click(sc(0, 2)); await drag(sc(0, 2), sc(0, 7)); m = await sched();
  ok('drag a shift 5 days later on the same person (comment moves with it)', !m['ana test'].d[3] && m['ana test'].d[8] === 'M' && m['ana test'].c[8] === 'Swap asked' && !m['ana test'].c[3], JSON.stringify(m['ana test']));
  await P.click(sc(0, 7)); await drag(sc(0, 7), sc(1, 7)); m = await sched();
  ok('drag a shift to another person', !m['ana test'].d[8] && m['bob test'].d[8] === 'M', JSON.stringify([m['ana test'].d, m['bob test'].d]));
  await P.click(sc(0, 0)); await drag(sc(0, 0), sc(2, 7)); m = await sched();
  ok('dropping one shift on another swaps them', m['ana test'].d[1] === 'N' && m['cara test'].d[8] === 'M', JSON.stringify([m['ana test'].d, m['cara test'].d]));
  await P.click(sc(0, 0)); await P.click(sc(0, 1), { modifiers: ['Shift'] }); await drag(sc(0, 0), sc(0, 20)); m = await sched();
  ok('drag a selected block of two days', !m['ana test'].d[1] && !m['ana test'].d[2] && m['ana test'].d[21] === 'N' && m['ana test'].d[22] === 'M', JSON.stringify(m['ana test'].d));

  console.log('5. Only selected people');
  await P.click('#scheduleView td[data-pr="0"]'); await P.click('#scheduleView td[data-pr="2"]', { modifiers: ['Control'] });
  await P.evaluate(() => document.querySelector('#scheduleView [data-sa="sonly"]').click()); await w(300);
  const names = await P.evaluate(() => Array.from(document.querySelectorAll('#scheduleView td[data-pr] span')).map(s => s.textContent));
  ok('only the two picked people are shown', names.join() === 'Ana Test,Cara Test', names.join());
  await P.evaluate(() => document.querySelector('#scheduleView [data-sa="sall"]').click()); await w(300);
  ok('Show everyone brings everyone back', await P.evaluate(() => document.querySelectorAll('#scheduleView td[data-pr]').length) === 3);

  ok('no page errors', !H.errs.length, H.errs.join(' | '));
  console.log(fails ? fails + ' FAILED' : 'ALL PASSED'); await H.close(); process.exit(fails ? 1 : 0);
})();
