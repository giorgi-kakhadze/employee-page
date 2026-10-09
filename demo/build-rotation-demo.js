/* Builds demo/PTF-demo-backup-with-rotation.json: the demo company's backup plus a REAL rotation for a whole week, for every shift (morning, afternoon, night),
   for game presenters (tables, half an hour each) and shufflers (zones of tables, one hour each; smaller zones on the days with more staff).
   It drives the tool itself (the same Generate button people press), so the file is exactly what the tool produces.   node demo/build-rotation-demo.js */
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..'), tool = path.join(root, 'tool', 'PTF-pass-to-floor-Gunda.html'), code = path.join(root, 'tool', 'Code.gs'), DEMO = process.env.IN ? path.resolve(process.env.IN) : path.join(__dirname, 'PTF-demo-backup.json'), OUT = process.env.OUT ? path.resolve(process.env.OUT) : path.join(__dirname, 'PTF-demo-backup-with-rotation.json');
const gas = require(path.join(root, 'tests', 'fakegas'))(code); require(path.join(root, 'tests', 'seed'))(gas);
const DAYS = (process.env.DAYS || '2026-10-05,2026-10-06,2026-10-07,2026-10-08,2026-10-09,2026-10-10,2026-10-11').split(','), SHIFTS = ['morning', 'afternoon', 'night'];
(async () => {
  const H = await require(path.join(root, 'tests', 'harness'))(tool, gas);
  const P = await H.open({ admin: true }); await P.setViewportSize({ width: 1600, height: 1000 }); await P.sync();
  const w = (ms) => P.waitForTimeout(ms);
  await P.setInputFiles('#importFileInput', DEMO); await P.waitForSelector('#restoreModal.open', { timeout: 30000 });
  await P.evaluate(() => { HTMLAnchorElement.prototype.click = function () {}; applyRestore('replace'); }); await w(6000);
  /* teams, tables and zones */
  const info = await P.evaluate(([SHIFTS, NUMTEAMS, VIP]) => {
    const S = JSON.parse(localStorage.getItem('totSchedule')), NT = NUMTEAMS, T = 'ABCDEFGH'.slice(0, NT).split('');
    S.teams = T.map((x, i) => ({ id: 't' + x.toLowerCase(), name: NT <= 4 ? 'Team ' + (i + 1) : 'Team ' + x })).concat(VIP ? [{ id: 'tv', name: 'VIP' }] : [], [{ id: 'sh', name: 'Shufflers' }]);
    /* only game presenters (VIP, premium, regular, beginner) and shufflers are in this rotation; pit supervisors are left out */
    S.roster.people = S.roster.people.filter((p) => p.pos !== 'pit');
    /* the monthly grid follows the 3 days on / 3 days off sets of the roster, so every day has exactly one set per shift */
    const anchor = Date.UTC(2026, 9, 1), ymList = ['2026-09', '2026-10', '2026-11']; S.sched = {};
    ymList.forEach((ym) => { const dim = new Date(+ym.slice(0, 4), +ym.slice(5, 7), 0).getDate(), m = {}; S.roster.people.forEach((p) => { const d = {}; for (let i = 1; i <= dim; i++) { const c = ((Math.floor((Date.UTC(+ym.slice(0, 4), +ym.slice(5, 7) - 1, i) - anchor) / 864e5) % 6) + 6) % 6, work = p.g === 'B' ? c >= 3 : c < 3; d[i] = work ? { morning: 'M', afternoon: 'A', night: 'N' }[p.sh] : 'OFF'; } m[p.name.toLowerCase()] = { d, c: {} }; }); S.sched[ym] = m; });
    const rr = {}; S.roster.people.slice().sort((a, b) => a.name.localeCompare(b.name)).forEach((p) => { if (p.pos === 'shuf') { p.t = 'sh'; return; } if (VIP && p.pos === 'vip') { p.t = 'tv'; return; } const k = p.sh + '|' + p.g; rr[k] = (rr[k] || 0); p.t = 't' + 'abcdefgh'[rr[k] % NT]; rr[k]++; });   /* presenters are shared evenly over the teams in every shift and set */
    const cnt = {}; S.roster.people.forEach((p) => { if (p.pos === 'shuf') { const k = p.sh + p.g; cnt[k] = (cnt[k] || 0) + 1; } });
    S.cfg = { len: 8, tables: 400, maxrun: 4, auto: false, tbl: {}, zoneTeams: { sh: { on: 1, slots: 2 } }, zones: {} };
    SHIFTS.forEach((sk) => { S.cfg.tbl[sk] = {}; let next = 1; S.teams.forEach((t) => { if (t.id === 'sh') return;
        /* tables = what the people of the bigger set can keep covered with a break after every 4 tables (people x 4/5) */
        const c = { A: 0, B: 0 }; S.roster.people.forEach((p) => { if (p.t === t.id && p.sh === sk) c[p.g]++; }); const n = Math.max(4, Math.floor(Math.max(c.A, c.B) * 0.8)); S.cfg.tbl[sk][t.id] = Array.from({ length: n }, (_, j) => next + j); next += n; });
      S.cfg.tbl[sk].sh = []; });   /* the shufflers have no tables of their own: their zones are the tables of the teams (made below) */
    S.days = {}; localStorage.setItem('totSchedule', JSON.stringify(S)); SchedMount(); return cnt;
  }, [SHIFTS, +process.env.TEAMS || 8, !!process.env.VIP]);
  console.log('shufflers by shift and set', JSON.stringify(info));
  /* zones follow the teams: each team's tables become zone(s); zone size is chosen so that there is one shuffler more than zones (one on a break at a time) */
  const zinfo = await P.evaluate(([SHIFTS, cnt]) => { const o = {}; SHIFTS.forEach((sk) => { const N = Math.min(cnt[sk + 'A'], cnt[sk + 'B']); o[sk] = window.totZonesFromTeams(sk, 'sh', 0, Math.max(1, N - 1)).map((z) => z.n + ':' + z.team + ':' + z.t.join('.')); }); return o; }, [SHIFTS, info]);
  console.log('zones', JSON.stringify(zinfo.morning)); await w(600);
  const setDay = (d) => P.evaluate((d) => { const i = document.querySelector('#scheduleView #scD'); i.value = d; i.dispatchEvent(new Event('change', { bubbles: true })); }, d);
  const setShift = (s) => P.evaluate((s) => document.querySelector('#scheduleView [data-sh="' + s + '"]').click(), s);
  const gen = async () => { await P.evaluate(() => document.querySelector('#scheduleView [data-a="gen"]').click()); await w(1500); };
  await P.evaluate(() => { const b = document.querySelector('#scheduleView [data-sub="rot"]'); if (b) b.click(); }); await w(500);
  for (const d of DAYS) for (const sk of SHIFTS) {
    await setDay(d); await w(300); await setShift(sk); await w(300); await gen();
    /* more people than zones that day: smaller zones for that day only ("Fit to N people") */
    await w(800);
    const fix = null;   /* the zones follow the teams and are the same every day */
    if (fix && fix.day) { await P.evaluate(() => SchedMount()); await w(500); await P.evaluate(() => { const b = document.querySelector('#scheduleView [data-sub="rot"]'); if (b) b.click(); }); await w(400); await setDay(d); await w(300); await setShift(sk); await w(300); await gen(); await w(600); }
    console.log(d, sk, JSON.stringify(fix));
  }
  await w(1500);
  const text = await P.evaluate(() => new Promise((res) => { const orig = URL.createObjectURL; URL.createObjectURL = (b) => { b.text().then(res); return orig.call(URL, b); }; exportBackup('rotation-demo'); }));
  const j = JSON.parse(text); j._meta.note = 'Demo company with a one-week rotation for every shift: game presenters on tables, shufflers on zones.';
  fs.writeFileSync(OUT, JSON.stringify(j));
  const S = JSON.parse(j.data.totSchedule), sum = {}; Object.keys(S.days).forEach((d) => Object.keys(S.days[d].shifts).forEach((k) => { const rows = S.days[d].shifts[k].rows; sum[d + ' ' + k] = rows.length + ' people (' + rows.filter((r) => r.t === 'sh').length + ' shufflers)'; }));
  console.log(JSON.stringify(sum, null, 1)); console.log('written', OUT, Math.round(fs.statSync(OUT).size / 1024) + ' KB', 'page errors:', H.errs.length, H.errs.slice(0, 3));
  await H.close(); process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
