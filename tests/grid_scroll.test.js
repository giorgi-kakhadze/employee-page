/* v3.42 schedule grid: "Show everyone" (all rows built) and "Load as you scroll" (only rows on screen), switched in Settings. */
const path = require('path'), tool = path.join(__dirname, '..', 'tool', 'PTF-pass-to-floor-Gunda.html'), code = path.join(__dirname, '..', 'tool', 'Code.gs');
const gas = require('./fakegas')(code); require('./seed')(gas);
let fails = 0; function ok(n, c, x) { if (!c) fails++; console.log((c ? '  ✅ ' : '  ❌ ') + n + (c ? '' : '  → ' + x)); }
(async () => {
  const H = await require('./harness')(tool, gas), P = await H.open({ admin: true }); await P.setViewportSize({ width: 1600, height: 1000 }); await P.sync();
  const w = (ms) => P.waitForTimeout(ms);
  await P.evaluate(() => { switchView('schedule'); const d = new Date(), day = d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-01', S = JSON.parse(localStorage.getItem('totSchedule') || '{}');
    S.teams = [{ id: 't1', name: 'Team 1' }, { id: 't2', name: 'Team 2' }, { id: 't3', name: 'Team 3' }]; S.roster = { anchor: day, people: Array.from({ length: 1000 }, (_, i) => ({ name: 'P' + ('000' + i).slice(-4), g: i % 2 ? 'A' : 'B', sh: 'morning', t: 't' + (1 + i % 3) })) };
    S.sched = {}; S.days = {}; S.cfg = { len: 8, maxrun: 4, tables: 100 }; delete S.gridMode; localStorage.setItem('totSchedule', JSON.stringify(S)); SchedMount(); });
  await w(500);
  const openGrid = async () => { await P.evaluate(() => document.querySelector('#scheduleView [data-sub="sch"]').click()); await w(700); };
  const stats = () => P.evaluate(() => { const v = document.querySelector('#scheduleView'), rows = v.querySelectorAll('td.n').length, wr = v.querySelector('.wrap'); return { rows, cells: v.querySelectorAll('input[data-sc]').length, hint: v.innerText.match(/\d+ people shown[^·]*/)[0], scrollH: wr.scrollHeight, first: v.querySelector('td.n span').textContent }; });
  await openGrid(); let a = await stats();
  ok('"Show everyone" (default): 400 rows are built and the hint says 400 of 1000', a.rows === 400 && /400 people shown of 1000/.test(a.hint), JSON.stringify(a));
  /* switch in Settings */
  await P.evaluate(() => { totSettingsOpen(); }); await w(300);
  const txt = await P.evaluate(() => document.querySelector('#setOv').innerText);
  ok('Settings has a Schedule grid card with both choices', /Schedule grid/.test(txt) && /Show everyone/.test(txt) && /Load as you scroll/.test(txt), txt.slice(0, 300));
  await P.evaluate(() => document.querySelector('#setOv [data-k="gm-scroll"]').click()); await w(500);
  const S1 = await P.evaluate(() => JSON.parse(localStorage.getItem('totSchedule')));
  ok('the choice is saved in the schedule data', S1.gridMode === 'scroll', S1.gridMode);
  await openGrid(); a = await stats();
  ok('scroll mode: all 1000 people are listed, but only a few rows are built', /1000 people shown/.test(a.hint) && a.rows > 20 && a.rows < 90 && a.cells < 90 * 31, JSON.stringify(a));
  /* scrolling brings other rows in */
  await P.evaluate(() => { window.scrollTo(0, 20000); document.querySelector('#scheduleView .wrap').scrollTop = 20000; }); await w(500);
  let b = await stats(); ok('after scrolling down, other people are built and the total height is unchanged', b.first !== a.first && b.rows < 90 && Math.abs(b.scrollH - a.scrollH) < 80, JSON.stringify(b) + ' vs ' + a.scrollH);
  await P.evaluate(() => { const wr = document.querySelector('#scheduleView .wrap'); wr.scrollTop = wr.scrollHeight; window.scrollTo(0, 1e6); }); await w(500);
  b = await stats(); ok('the very last person is reachable', await P.evaluate(() => /P0998/.test(document.querySelector('#scheduleView .wrap').innerText)), JSON.stringify(b));
  /* editing and selecting in the middle */
  await P.evaluate(() => { window.scrollTo(0, 15000); document.querySelector('#scheduleView .wrap').scrollTop = 15000; }); await w(500);
  const r = await P.evaluate(() => { const i = document.querySelectorAll('#scheduleView input[data-sc]')[40]; return { r: +i.getAttribute('data-sr'), c: +i.getAttribute('data-sc') }; });
  await P.evaluate((r) => { const i = document.querySelector('#scheduleView input[data-sr="' + r.r + '"][data-sc="' + r.c + '"]'); i.focus(); i.value = 'N'; i.dispatchEvent(new Event('input', { bubbles: true })); i.dispatchEvent(new Event('change', { bubbles: true })); }, r); await w(700);
  const S2 = await P.evaluate(() => JSON.parse(localStorage.getItem('totSchedule'))), who = await P.evaluate((r) => document.querySelector('#scheduleView td.n[data-pr="' + r.r + '"] span').textContent, r);
  ok('typing a shift in a scrolled-in row saves for the right person and day', Object.keys(S2.sched).some(m => ((S2.sched[m][who.toLowerCase()] || {}).d || {})[r.c + 1] === 'N'), who + ' day ' + (r.c + 1));
  /* arrow keys */
  await P.evaluate((r) => { const i = document.querySelector('#scheduleView input[data-sr="' + r.r + '"][data-sc="' + r.c + '"]'); i.focus(); }, r); await P.keyboard.press('ArrowDown'); await w(200);
  ok('ArrowDown moves to the next person', await P.evaluate((r) => { const a = document.activeElement; return a && a.getAttribute('data-sr') === String(r.r + 1); }, r));
  /* selecting a whole person and "Only selected people" */
  await P.click('#scheduleView td.n[data-pr="' + (r.r + 1) + '"] span'); await w(300);
  ok('clicking a name selects that person\'s month', await P.evaluate((r) => document.querySelectorAll('#scheduleView td.sel').length >= 28, r));
  await P.evaluate(() => document.querySelector('#scheduleView [data-sa="sonly"]').click()); await w(500);
  const o = await stats(); ok('"Only selected people" shows just that person', /1 people shown|1 person/.test(o.hint) || o.rows === 1, JSON.stringify(o));
  await P.evaluate(() => document.querySelector('#scheduleView [data-sa="sall"]').click()); await w(500);
  /* back to everyone */
  await P.evaluate(() => { totSettingsOpen(); }); await w(300); await P.evaluate(() => document.querySelector('#setOv [data-k="gm-all"]').click()); await w(500);
  await openGrid(); a = await stats(); ok('switching back restores "Show everyone" (400 rows)', a.rows === 400, JSON.stringify(a));
  ok('no page errors', H.errs.length === 0, H.errs.slice(0, 3)); await H.close();
  console.log('grid_scroll: ' + (fails ? fails + ' FAILED' : 'ALL PASSED')); process.exit(fails ? 1 : 0);
})();
