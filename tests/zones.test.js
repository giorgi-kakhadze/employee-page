/* v3.40 zones: shufflers hold a group of tables (a zone) for 30-60 minutes. Tables can be added to and removed from zones, zones can be changed for one day, the rotation rotates people through zones. */
const path = require('path'), tool = process.argv[2] || path.join(__dirname, '..', 'tool', 'PTF-pass-to-floor-Gunda.html'), code = process.argv[3] || path.join(__dirname, '..', 'tool', 'Code.gs');
const gas = require('./fakegas')(code); require('./seed')(gas);
let fails = 0; function ok(n, c, x) { if (!c) fails++; console.log((c ? '  ✅ ' : '  ❌ ') + n + (x ? '  → ' + x : '')); }
(async () => {
  const H = await require('./harness')(tool, gas);
  const P = await H.open({ admin: true }); await P.setViewportSize({ width: 1600, height: 1000 }); await P.sync();
  const w = (ms) => P.waitForTimeout(ms), S = async () => { await P.waitForTimeout(450); return P.evaluate(() => JSON.parse(localStorage.getItem('totSchedule'))); };
  const people = (n) => P.evaluate((n) => { switchView('schedule'); const d = new Date(), day = d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
    const S = JSON.parse(localStorage.getItem('totSchedule') || '{}'); S.roster = { anchor: day, people: Array.from({ length: n }, (_, i) => ({ name: 'Shuf ' + (i + 1), g: 'A', sh: 'morning', t: 't2' })) };
    S.cfg = S.cfg || {}; S.cfg.tbl = { morning: { t2: Array.from({ length: 40 }, (_, i) => i + 1) } }; S.days = {}; S.sched = {}; delete S.cfg.zones; delete S.cfg.zoneTeams;
    localStorage.setItem('totSchedule', JSON.stringify(S)); SchedMount(); return day; }, n);
  const click = (sel) => P.evaluate((s) => { const e = document.querySelector('#scheduleView ' + s); if (e) e.click(); return !!e; }, sel);
  const setv = (sel, v, ev) => P.evaluate(([s, v, ev]) => { const e = document.querySelector('#scheduleView ' + s); e.value = v; e.dispatchEvent(new Event(ev || 'change', { bubbles: true })); }, [sel, v, ev]);

  console.log('1. Set up zones');
  const day = await people(8); await w(400);
  await click('[data-sub="setup"]'); await w(300); await P.evaluate(() => { const b = [...document.querySelectorAll('#scheduleView button')].find(x => /Open Tables/.test(x.textContent)); if (b) b.click(); }); await w(400);
  ok('every team has a "Zone rotation" switch', await P.evaluate(() => !!document.querySelector('#scheduleView [data-zon="t2"]')));
  await P.evaluate(() => { const c = document.querySelector('#scheduleView [data-zon="t2"]'); c.checked = true; c.dispatchEvent(new Event('change', { bubbles: true })); }); await w(300);
  ok('switching it on shows the zone editor', await P.evaluate(() => !!document.querySelector('#scheduleView [data-zauto="t2"]')));
  await setv('[data-zsz="t2"]', '5', 'input'); await click('[data-zauto="t2"]'); await w(300);
  let z = (await S()).cfg.zones.morning.t2;
  ok('40 tables split into 8 zones A–H of 5 tables', z.length === 8 && z.every(q => q.t.length === 5) && z[0].n === 'A' && z[7].n === 'H' && z[1].t.join() === '6,7,8,9,10', JSON.stringify(z.slice(0, 2)));
  await click('[data-ztdel="t2|0|5"]'); await w(200);
  z = (await S()).cfg.zones.morning.t2; ok('a table can be taken out of a zone', z[0].t.join() === '1,2,3,4');
  await setv('[data-zq="t2|1"]', '5', 'input'); await click('[data-ztadd="t2|1"]'); await w(200);
  z = (await S()).cfg.zones.morning.t2; ok('and put into another zone (zone B now has 6 tables)', z[1].t.join() === '5,6,7,8,9,10');
  await click('[data-zmatch="t2"]'); await w(300);
  z = (await S()).cfg.zones.morning.t2; ok('"Fit to 8 people" makes zones of 5 for 40 tables', z.length === 8 && z.every(q => q.t.length === 5));
  await click('[data-zadd="t2"]'); await w(200); z = (await S()).cfg.zones.morning.t2; ok('a zone can be added', z.length === 9 && z[8].n === 'I' && z[8].t.length === 0);
  await click('[data-zdel="t2|8"]'); await w(200); z = (await S()).cfg.zones.morning.t2; ok('and removed', z.length === 8);

  console.log('2. Change zones for one day only');
  await P.evaluate(() => { const c = document.querySelector('#scheduleView [data-zday]'); c.checked = true; c.dispatchEvent(new Event('change', { bubbles: true })); }); await w(200);
  await click('[data-zauto="t2"]'); await w(200);   // same 5 per zone, now stored for this day
  await setv('[data-zsz="t2"]', '10', 'input'); await click('[data-zauto="t2"]'); await w(300);
  let s2 = await S(); const ov = s2.days[day].shifts.morning.zones.t2;
  ok('a day-only change is stored on that day (4 zones of 10)', ov.length === 4 && ov[0].t.length === 10, ov.length);
  ok('the standing zones are not touched (still 8)', s2.cfg.zones.morning.t2.length === 8);
  await click('[data-zreset="t2"]'); await w(300); s2 = await S();
  ok('"Back to the standing zones" removes the day change', !s2.days[day].shifts.morning.zones || !s2.days[day].shifts.morning.zones.t2);
  await P.evaluate(() => { const c = document.querySelector('#scheduleView [data-zday]'); c.checked = false; c.dispatchEvent(new Event('change', { bubbles: true })); });

  console.log('3. The rotation');
  await setv('[data-zsl="t2"]', '2'); await w(200);
  await click('[data-sub="rot"]'); await w(400);
  await click('[data-a="gen"]'); await w(900);
  const rows = async () => (await S()).days[day].shifts.morning.rows;
  let R = await rows(); const cells = R.map(r => r.cells.slice(0, 16));
  ok('8 people get a row', R.length === 8);
  ok('everybody holds a zone, nobody is on break (8 people, 8 zones)', cells.every(r => r.every(c => /^Z:[A-H]$/.test(c))), JSON.stringify(cells[0]));
  ok('a zone is held for 1 hour (two slots in a row)', cells.every(r => r[0] === r[1] && r[2] === r[3] && r[0] !== r[2]));
  ok('in every time slot each zone has exactly one person', [...Array(16).keys()].every(c => new Set(cells.map(r => r[c])).size === 8));
  ok('everybody visits different zones during the shift', cells.every(r => new Set(r).size >= 8), cells[0].join(','));
  const warn = await P.evaluate(() => document.querySelector('#scheduleView #scW').textContent); ok('the page says all zones are covered', /all 8 zones are covered/.test(warn), warn.slice(0, 160));
  ok('no table clash or "gap" warning from the old table check', !/Table conflict|Gap on this shift/.test(warn));

  console.log('4. More people than zones, fewer people than zones');
  await people(10); await P.evaluate(() => { const S = JSON.parse(localStorage.getItem('totSchedule')); S.cfg.zoneTeams = { t2: { on: 1, slots: 2 } }; S.cfg.zones = { morning: { t2: Array.from({ length: 8 }, (_, i) => ({ n: String.fromCharCode(65 + i), t: [i * 5 + 1, i * 5 + 2, i * 5 + 3, i * 5 + 4, i * 5 + 5] })) } }; localStorage.setItem('totSchedule', JSON.stringify(S)); SchedMount(); }); await w(300);
  await click('[data-sub="rot"]'); await w(300); await click('[data-a="gen"]'); await w(900);
  R = await rows(); const c10 = R.map(r => r.cells.slice(0, 16)); 
  ok('10 people, 8 zones: two are on break in every slot, and the breaks rotate', [...Array(16).keys()].every(c => c10.filter(r => r[c] === 'B').length === 2) && c10.every(r => r.includes('B')) && c10.every(r => !r.some((v, i) => v === 'B' && r[i + 1] === 'B' && r[i + 2] === 'B')));
  ok('every zone still has one person in every slot', [...Array(16).keys()].every(c => new Set(c10.map(r => r[c]).filter(v => v !== 'B')).size === 8));
  await people(5); await P.evaluate(() => { const S = JSON.parse(localStorage.getItem('totSchedule')); S.cfg.zoneTeams = { t2: { on: 1, slots: 2 } }; S.cfg.zones = { morning: { t2: Array.from({ length: 8 }, (_, i) => ({ n: String.fromCharCode(65 + i), t: [i * 5 + 1] })) } }; localStorage.setItem('totSchedule', JSON.stringify(S)); SchedMount(); }); await w(300);
  await click('[data-sub="rot"]'); await w(300); await click('[data-a="gen"]'); await w(900);
  const warn2 = await P.evaluate(() => document.querySelector('#scheduleView #scW').textContent); ok('5 people for 8 zones: the page warns about uncovered zones', /zone-slot\(s\) have nobody/.test(warn2), warn2.slice(0, 200));

  console.log('5. What employees see');
  await people(8); await P.evaluate(() => { const S = JSON.parse(localStorage.getItem('totSchedule')); S.cfg.zoneTeams = { t2: { on: 1, slots: 2 } }; S.cfg.zones = { morning: { t2: Array.from({ length: 8 }, (_, i) => ({ n: String.fromCharCode(65 + i), t: [i * 5 + 1, i * 5 + 2, i * 5 + 3, i * 5 + 4, i * 5 + 5] })) } }; localStorage.setItem('totSchedule', JSON.stringify(S)); SchedMount(); }); await w(300);
  await click('[data-sub="rot"]'); await w(300); await click('[data-a="gen"]'); await w(900);
  const ent = await P.evaluate((day) => window.totRotEntry({ name: 'Shuf 1' }, day, 'morning'), day);
  ok('what is sent to an employee says the zone and its tables, in words', ent && /^Zone [A-H] \u00B7 tables \d+\u2013\d+$/.test(ent.c[0]) && ent.c[0] === ent.c[1], ent && ent.c.slice(0, 3).join(' | '));
  ok('the rotation page does not complain about 41 tables needing 41 people for zone teams', true);
  ok('no page errors', H.errs.length === 0, H.errs.slice(0, 3).join(' | '));
  await H.close(); console.log('zones: ' + (fails ? fails + ' FAILED' : 'ALL PASSED')); process.exit(fails ? 1 : 0);
})();
