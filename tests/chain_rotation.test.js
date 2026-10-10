/* v3.41 chain rotation: with more people than tables, every table is covered in every half hour; the person back from a break takes table 1, table 1 moves to table 2, ... the last table goes on a break. */
const path = require('path'), tool = path.join(__dirname, '..', 'tool', 'PTF-pass-to-floor-Gunda.html'), code = path.join(__dirname, '..', 'tool', 'Code.gs');
const gas = require('./fakegas')(code); require('./seed')(gas);
let fails = 0; function ok(n, c, x) { if (!c) fails++; console.log((c ? '  ✅ ' : '  ❌ ') + n + (c ? '' : '  → ' + x)); }
(async () => {
  const H = await require('./harness')(tool, gas), P = await H.open({ admin: true }); await P.setViewportSize({ width: 1600, height: 1000 }); await P.sync();
  const run = (n, T) => P.evaluate(async ([n, T]) => {
    switchView('schedule'); const d = new Date(), day = d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
    const S = JSON.parse(localStorage.getItem('totSchedule') || '{}'); S.roster = { anchor: day, people: Array.from({ length: n }, (_, i) => ({ name: 'P' + String(i + 1).padStart(2, '0'), g: 'A', sh: 'morning', t: 't1' })) };
    S.cfg = S.cfg || {}; S.cfg.tt = { t1: [1, T] }; S.cfg.maxrun = 4; S.days = {}; S.sched = {}; delete S.cfg.zones; delete S.cfg.zoneTeams; localStorage.setItem('totSchedule', JSON.stringify(S)); SchedMount();
    await new Promise((r) => setTimeout(r, 500)); document.querySelector('#scheduleView [data-sub="rot"]') && document.querySelector('#scheduleView [data-sub="rot"]').click();
    await new Promise((r) => setTimeout(r, 300)); document.querySelector('#scheduleView [data-a="gen"]').click(); await new Promise((r) => setTimeout(r, 900));
    const o = JSON.parse(localStorage.getItem('totSchedule')), sh = o.days[day].shifts.morning; return sh.rows.map((r) => r.cells); }, [n, T]);
  for (const [n, T] of [[5, 4], [8, 4], [10, 8], [13, 10]]) {
    const R = await run(n, T), S = R[0].length; let covered = true, brkOk = true, chain = true, noDup = true, msg = '';
    for (let q = 0; q < S; q++) { const tb = R.map((c) => c[q]).filter((v) => /^\d+$/.test(v)).map(Number).sort((a, b) => a - b), br = R.filter((c) => c[q] === 'B').length;
      if (tb.join() !== Array.from({ length: T }, (_, i) => i + 1).join()) { covered = false; msg += ' q' + q + ':' + tb.join('.'); } if (br !== n - T) { brkOk = false; msg += ' br' + q + '=' + br; } if (new Set(tb).size !== tb.length) noDup = false;
      if (q + 1 < S) R.forEach((c, i) => { const a = c[q], b = c[q + 1]; if (/^\d+$/.test(a) && !(b === 'B' || +b === +a + 1)) { chain = false; msg += ' P' + i + ' ' + a + '->' + b; } if (a === 'B' && !(b === '1' || (n - T > 1 && /^\d+$|^B$/.test(b)))) { chain = false; msg += ' P' + i + ' B->' + b; } }); }
    const first = R.filter((c) => c[0] === 'B').length;
    ok(n + ' people, ' + T + ' tables: every table is covered in every half hour', covered, msg);
    ok('  exactly ' + (n - T) + ' on a break at a time (not everybody at the start: ' + first + ' of ' + n + ')', brkOk && first === n - T, msg);
    ok('  people move table 1 → 2 → 3 … → break and back to table 1', chain, msg);
    ok('  nobody shares a table', noDup, '');
  }
  ok('no page errors', H.errs.length === 0, H.errs.slice(0, 3)); await H.close();
  console.log('chain_rotation: ' + (fails ? fails + ' FAILED' : 'ALL PASSED')); process.exit(fails ? 1 : 0);
})();
