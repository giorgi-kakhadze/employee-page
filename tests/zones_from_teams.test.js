/* v3.41 zones follow the teams: the shufflers' zones are the tables the game presenters deal (Team 1 = zone A, Team 2 = zone B ...). */
const path = require('path'), tool = path.join(__dirname, '..', 'tool', 'PTF-pass-to-floor-Gunda.html'), code = path.join(__dirname, '..', 'tool', 'Code.gs');
const gas = require('./fakegas')(code); require('./seed')(gas);
let fails = 0; function ok(n, c, x) { if (!c) fails++; console.log((c ? '  ✅ ' : '  ❌ ') + n + (c ? '' : '  → ' + x)); }
(async () => {
  const H = await require('./harness')(tool, gas), P = await H.open({ admin: true }); await P.setViewportSize({ width: 1600, height: 1000 }); await P.sync();
  const w = (ms) => P.waitForTimeout(ms), S = async () => { await w(450); return P.evaluate(() => JSON.parse(localStorage.getItem('totSchedule'))); };
  await P.evaluate(() => { switchView('schedule'); const d = new Date(), day = d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2), S = JSON.parse(localStorage.getItem('totSchedule') || '{}'), mk = (t, n, pre) => Array.from({ length: n }, (_, i) => ({ name: pre + (i + 1), g: 'A', sh: 'morning', t }));
    S.teams = [{ id: 't1', name: 'Team 1' }, { id: 't2', name: 'Team 2' }, { id: 't3', name: 'Team 3' }, { id: 't4', name: 'Shufflers' }];
    S.roster = { anchor: day, people: mk('t1', 5, 'A').concat(mk('t2', 5, 'B'), mk('t3', 14, 'C'), mk('t4', 5, 'S')) };
    S.cfg = { len: 8, maxrun: 4, tables: 100, tbl: { morning: { t1: [1, 2, 3, 4], t2: [5, 6, 7, 8], t3: Array.from({ length: 12 }, (_, i) => 9 + i), t4: [] } }, zoneTeams: { t4: { on: 1, slots: 1 } }, zones: {} }; S.days = {}; S.sched = {};
    localStorage.setItem('totSchedule', JSON.stringify(S)); SchedMount(); }); await w(500);
  const day = await P.evaluate(() => { const d = new Date(); return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); });
  await P.evaluate(() => { document.querySelector('#scheduleView [data-sub="setup"]').click(); }); await w(300);
  await P.evaluate(() => { const b = [...document.querySelectorAll('#scheduleView button')].find((x) => /Open Tables/.test(x.textContent)); if (b) b.click(); }); await w(400);
  ok('the Shufflers team offers "Zones from the teams"', await P.evaluate(() => !!document.querySelector('#scheduleView [data-zteams="t4"]')));
  await P.evaluate(() => document.querySelector('#scheduleView [data-zteams="t4"]:not([data-zfit])').click()); await w(400);
  let z = (await S()).cfg.zones.morning.t4;
  ok('one zone per team: A = Team 1 tables 1-4, B = Team 2 tables 5-8, C = Team 3 tables 9-20', z.length === 3 && z[0].t.join() === '1,2,3,4' && z[1].t.join() === '5,6,7,8' && z[2].t.length === 12 && z[2].t[0] === 9 && z[2].t[11] === 20 && z[0].team === 'Team 1', JSON.stringify(z));
  await P.evaluate(() => { const i = document.querySelector('#scheduleView [data-zfm="t4"]'); i.value = '6'; }); await P.evaluate(() => document.querySelector('#scheduleView [data-zteams="t4"]:not([data-zfit])').click()); await w(400);
  z = (await S()).cfg.zones.morning.t4; ok('with "most 6 tables in a zone" Team 3 is split in two zones of 6 (4 zones in all, none crosses a team)', z.length === 4 && z[2].t.length === 6 && z[3].t.length === 6 && z[2].t[0] === 9 && z[3].t[5] === 20, JSON.stringify(z.map((q) => q.t.length)));
  await P.evaluate(() => document.querySelector('#scheduleView [data-zteams="t4"][data-zfit]').click()); await w(400);
  z = (await S()).cfg.zones.morning.t4; ok('"fit to 5 shufflers": not more zones than shufflers, still inside teams', z.length <= 5 && z.length >= 3 && z.every((q) => q.t.length), JSON.stringify(z.map((q) => q.n + ':' + q.t.join('.'))));
  const nz = z.length;
  await P.evaluate(() => { const b = document.querySelector('#scheduleView [data-sub="rot"]'); b && b.click(); }); await w(400);
  await P.evaluate(() => document.querySelector('#scheduleView [data-a="gen"]').click()); await w(1500);
  const sh = (await S()).days[day].shifts.morning, shuf = sh.rows.filter((r) => r.t === 't4'), tb = [];
  let cover = true, onlyTeams = true; for (let q = 0; q < 16; q++) { const have = new Set(shuf.map((r) => r.cells[q])); for (let k = 0; k < nz; k++) if (!have.has('Z:' + z[k].n)) cover = false; }
  ok('every zone has a shuffler in every half hour', cover);
  ok('the shufflers never stand on a table nobody deals: all zone tables are tables of the game presenters\' teams', z.every((q) => q.t.every((n) => n >= 1 && n <= 20)));
  ok('no page errors', H.errs.length === 0, H.errs.slice(0, 3)); await H.close();
  console.log('zones_from_teams: ' + (fails ? fails + ' FAILED' : 'ALL PASSED')); process.exit(fails ? 1 : 0);
})();
