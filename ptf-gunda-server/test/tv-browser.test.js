'use strict';
/* The lobby screen page in a real browser: what is drawn, zones, zoom, live update, offline message. */
const { ok, section, done, P, sample } = require('./util'); const { start } = require('./lib');
const { chromium } = (function () { try { return require('playwright'); } catch (e) { return require(require('child_process').execSync('npm root -g').toString().trim() + '/playwright'); } })();
(async () => {
  const D = '2026-10-08', NOW = Date.now();
  const mk = (name, t, cells) => ({ name, t, len: 8, from: 0, cells });
  const z = (a) => Array.from({ length: 16 }, (_, i) => 'Z:' + a[Math.floor(i / 2) % a.length]);
  const sch = { roster: { anchor: D, people: [] }, teams: [{ id: 't1', name: 'Team 1' }, { id: 't2', name: 'Shufflers' }], cfg: { len: 8, zoneTeams: { t2: { on: 1 } }, zones: { morning: { t2: [{ n: 'A', t: [1, 2, 3, 4, 5] }, { n: 'B', t: [6, 7, 8, 9, 10] }] } } },
    days: { [D]: { shifts: { morning: { start: 8, rows: [mk('Ana Beridze', 't1', Array.from({ length: 16 }, (_, i) => String(1 + Math.floor(i / 2)))), mk('Nika Gela', 't1', ['B', 'B', '4', '4', '4', '4', '4', '4', '4', '4', 'OFF', 'OFF', 'OFF', 'OFF', 'OFF', 'OFF']), mk('Sandro Kapanadze', 't2', z(['A', 'B'])), mk('Tamar Beridze', 't2', z(['B', 'A']))] } } } } };
  const tok = 'T'.repeat(32), scr = { id: 'tv1', name: 'Lobby', token: tok, on: true, shift: 'auto', teams: [], pos: [], view: 'now', zoom: 1, names: 'short', ahead: 4, rowsPer: 0, title: 'Floor rotation', u: NOW };
  const S = await start({}), K = sample(); K.totSchedule = P(sch); K.totTvScreens = P([scr]); await S.state.replaceAll({ keys: K });
  const br = await chromium.launch();
  async function open(h, path) { const ctx = await br.newContext({ viewport: { width: 1920, height: 1080 } }), pg = await ctx.newPage(); pg.errs = []; pg.on('pageerror', (e) => pg.errs.push(e.message)); pg.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) pg.errs.push(m.text()); });
    await pg.addInitScript(([d, h]) => { const T0 = new Date(d + 'T00:00:00').getTime() + h * 36e5, R = Date.now(), RD = Date; class FD extends RD { constructor(...a) { if (a.length) super(...a); else super(T0 + (RD.now() - R)); } static now() { return T0 + (RD.now() - R); } } window.Date = FD; }, [D, h]);
    await pg.goto(S.base + (path || '/tv/' + tok)); await pg.waitForTimeout(1500); return pg; }
  const txt = (pg) => pg.evaluate(() => document.body.innerText);

  section('1. What is drawn at 10:05');
  const A = await open(10.08); let t = await txt(A);
  ok('the title, the shift and the clock', /Floor rotation/.test(t) && /Morning shift/.test(t) && /10:0\d/.test(t), t.slice(0, 120).replace(/\n/g, ' | '));
  ok('all four people, shortened', ['Ana B.', 'Nika G.', 'Sandro K.', 'Tamar B.'].every((n) => t.includes(n)));
  ok('the current time slot is marked NOW', /NOW 10:00/.test(t));
  ok('tables show as numbers; shufflers show zones with their tables', /Zone A/.test(t) && /tables 1–5/.test(t) && /Zone B/.test(t) && /tables 6–10/.test(t));
  ok('team names are shown when there is more than one team', /Team 1/.test(t) && /Shufflers/.test(t));
  ok('"Now" view shows only the next hours (4): no 14:00 column', !/14:00/.test(t) && /13:30/.test(t), (t.match(/\d\d:\d\d/g) || []).join(' '));
  ok('no page errors', A.errs.length === 0, A.errs);
  const sp = await A.evaluate(() => [...document.querySelectorAll('td.c.zn')].map((c) => c.colSpan)); ok('a zone held for an hour is one wide cell (two slots joined)', sp.length && sp.every((n) => n >= 2), sp.join());
  await A.screenshot({ path: '/tmp/tv-now.png' });

  section('2. Changes made in the tool appear by themselves');
  const nz = JSON.parse(S.state.cur.keys.totTvScreens.v); nz[0].view = 'full'; nz[0].zoom = 1.6; nz[0].title = 'Whole shift'; await S.state.mutate((cur) => { cur.keys.totTvScreens = { v: JSON.stringify(nz), t: Date.now() + 5 }; });
  await A.waitForTimeout(2500); t = await txt(A);
  ok('the title changed with no reload', /Whole shift/.test(t));
  ok('the view changed to the whole shift (08:00 to 15:00 hour columns)', /08:00/.test(t) && /15:00/.test(t));
  ok('the zoom changed (CSS variable)', (await A.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--z'))).trim() === '1.6');
  await A.screenshot({ path: '/tmp/tv-full.png' });
  const s2 = JSON.parse(S.state.cur.keys.totSchedule.v); s2.days[D].shifts.morning.rows[0].cells[4] = '77'; await S.state.mutate((cur) => { cur.keys.totSchedule = { v: JSON.stringify(s2), t: Date.now() + 9 }; });
  await A.waitForTimeout(2500); ok('a rotation change appears (table 77)', /77/.test(await txt(A)));

  section('3. Scopes, bad links and being offline');
  const sc = JSON.parse(S.state.cur.keys.totTvScreens.v); sc.push(Object.assign({}, sc[0], { id: 'tv2', token: 'U'.repeat(32), teams: ['t2'], view: 'now', zoom: 1, title: 'Shufflers' })); await S.state.mutate((cur) => { cur.keys.totTvScreens = { v: JSON.stringify(sc), t: Date.now() + 20 }; });
  const B = await open(10.08, '/tv/' + 'U'.repeat(32)); t = await txt(B); ok('a team screen shows only that team', /Sandro K\./.test(t) && !/Ana B\./.test(t) && !/Zone ?undefined/.test(t));
  const C = await open(10.08, '/tv/' + 'x'.repeat(32)); ok('a wrong link says so in plain words', /not found|not valid/i.test(await txt(C)));
  await A.context().setOffline(true); await A.waitForTimeout(1500); await A.evaluate(() => window.dispatchEvent(new Event('online')));
  await A.context().setOffline(false); await A.waitForTimeout(500);
  ok('no page errors anywhere', B.errs.length === 0 && C.errs.length === 0 && A.errs.length === 0, [A.errs, B.errs, C.errs]);
  await br.close(); await S.close(); done('tv-browser');
})().catch((e) => { console.error(e); process.exit(1); });
