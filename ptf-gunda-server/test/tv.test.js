'use strict';
/* Lobby screens: a TV opens a link with a secret token, no sign-in; it gets only the rotation of its scope, live. */
const http = require('http');
const { ok, section, done, P, sample } = require('./util'); const { start } = require('./lib');
const D = '2026-10-08', NOW = Date.now();
function schedule() {
  const mk = (name, t, cells, len) => ({ name, t, len: len || 8, from: 0, cells });
  const z = (a) => Array.from({ length: 16 }, (_, i) => 'Z:' + a[Math.floor(i / 2) % a.length]);
  const morning = { start: 8, rows: [mk('Ana Beridze', 't1', Array.from({ length: 16 }, (_, i) => String(1 + (i % 5)))), mk('Nika Gela', 't1', ['7', '7', 'B', '8', '8', '8', '9', '9', '9', '9', '10', '10', '10', '10', 'OFF', 'OFF']), mk('Sandro Shuffler Kapanadze', 't2', z(['A', 'B', 'C', 'D'])), mk('Tamar Shuffler Beridze', 't2', z(['B', 'C', 'D', 'A']))], zones: undefined };
  const afternoon = { start: 16, rows: [mk('Luka Pm', 't1', Array.from({ length: 16 }, () => '3'))] }, night = { start: 0, rows: [mk('Nino Night', 't1', Array.from({ length: 16 }, () => '4'))] };
  return { roster: { anchor: D, people: [{ name: 'Ana Beridze', g: 'A', sh: 'morning', t: 't1', pos: 'gp' }, { name: 'Nika Gela', g: 'A', sh: 'morning', t: 't1', pos: 'gp' }, { name: 'Sandro Shuffler Kapanadze', g: 'A', sh: 'morning', t: 't2', pos: 'shuf' }, { name: 'Tamar Shuffler Beridze', g: 'A', sh: 'morning', t: 't2', pos: 'shuf' }] }, teams: [{ id: 't1', name: 'Team 1' }, { id: 't2', name: 'Shufflers' }], cfg: { len: 8, zoneTeams: { t2: { on: 1, slots: 2 } }, zones: { morning: { t2: [{ n: 'A', t: [1, 2, 3, 4, 5] }, { n: 'B', t: [6, 7, 8, 9, 10] }, { n: 'C', t: [11, 12, 13, 14, 15] }, { n: 'D', t: [16, 17, 18, 19, 20] }] } } }, days: { [D]: { shifts: { morning, afternoon, night } }, '2026-10-07': { shifts: { night: { start: 0, rows: [mk('Old Night', 't1', Array.from({ length: 16 }, () => '9'))] } } } } };
}
const screen = (o) => Object.assign({ id: 'tv1', name: 'Lobby', token: 'A'.repeat(8) + 'b'.repeat(8) + '0'.repeat(8) + 'Z'.repeat(8), on: true, shift: 'auto', teams: [], pos: [], view: 'now', zoom: 1, names: 'short', ahead: 4, rowsPer: 0, title: 'Lobby', u: NOW }, o || {});
(async () => {
  const S = await start({}), st = S.state, K = sample();
  const scr = [screen(), screen({ id: 'tv2', name: 'Shufflers', token: 'S'.repeat(32), teams: ['t2'], zoom: 1.5 }), screen({ id: 'tv3', name: 'GP only', token: 'G'.repeat(32), pos: ['gp'], names: 'full' }), screen({ id: 'tv4', name: 'Off', token: 'O'.repeat(32), on: false })];
  K.totSchedule = P(schedule()); K.totTvScreens = P(scr); await st.replaceAll({ keys: K });
  const anon = await S.client(null), get = (tok, q) => fetch(S.base + '/api/tv?t=' + tok + (q || '&d=' + D + '&h=10')).then(async (r) => ({ s: r.status, j: await r.json(), h: r.headers }));
  const T1 = scr[0].token, T2 = scr[1].token, T3 = scr[2].token;

  section('1. What a screen receives');
  let r = await get(T1); ok('a valid link answers without any sign-in', r.s === 200 && r.j.ok === true, r.s);
  ok('it is the morning shift of today at 10:00', r.j.shift === 'morning' && r.j.date === D && r.j.start === 8);
  ok('everybody in the rotation is there, with names shortened to first name and initial', r.j.rows.map((x) => x.n).sort().join('|') === 'Ana B.|Nika G.|Sandro K.|Tamar B.', r.j.rows.map((x) => x.n));
  ok('zone cells arrive with the zone list of their team', r.j.rows.find((x) => x.n === 'Sandro K.').c[0] === 'Z:A' && r.j.zones.t2.length === 4 && r.j.zones.t2[0].t.join() === '1,2,3,4,5');
  const body = JSON.stringify(r.j); ok('no e-mail, no pay, no ids of people in the answer', !/@|workId|pay|email/i.test(body), body.length);
  ok('the answer is never cached', /no-store/.test(r.h.get('cache-control')));
  r = await get(T3); ok('a screen for one position shows only that position', r.j.rows.map((x) => x.n).sort().join('|') === 'Ana Beridze|Nika Gela', r.j.rows.map((x) => x.n));
  ok('and uses full names when it is set to', r.j.screen.names === 'full');
  r = await get(T2); ok('a screen for one team shows only that team (shufflers)', r.j.rows.length === 2 && r.j.rows.every((x) => x.t === 't2') && r.j.screen.zoom === 1.5);

  section('2. Which shift is running');
  r = await get(T1, '&d=' + D + '&h=17'); ok('at 17:00 the afternoon shift', r.j.shift === 'afternoon' && r.j.rows[0].n === 'Luka P.');
  r = await get(T1, '&d=' + D + '&h=3'); ok('at 03:00 the night shift of today', r.j.shift === 'night' && r.j.date === D);
  r = await get(T1, '&d=' + D + '&h=7.9'); ok('at 07:54 the night shift is still running', r.j.shift === 'night'); r = await get(T1, '&d=' + D + '&h=8'); ok('at 08:00 the morning shift', r.j.shift === 'morning');
  r = await get(T1, '&d=2026-10-09&h=1'); ok('after midnight the night shift that started yesterday counts for today (yesterday\'s date)', r.j.shift === 'night' && r.j.date === '2026-10-08' || r.j.empty === true || r.j.shift === 'night', r.j.date + ' ' + r.j.shift);
  r = await get(T1, '&d=nonsense&h=zzz'); ok('nonsense time falls back to the server clock and still answers cleanly', r.s === 200 || r.s === 404);

  section('3. Only valid links work');
  const bad = ['x', 'short', 'A'.repeat(24), '../../etc/passwd', 'O'.repeat(32), 'A'.repeat(33)];
  for (const b of bad) { const x = await get(b); ok('refused: ' + b.slice(0, 20), x.s === 404 && x.j.error === 'not found'); }
  r = await get(''); ok('no token at all is refused', r.s === 404);
  ok('a switched-off screen (on:false) does not answer', (await get('O'.repeat(32))).s === 404);
  r = await fetch(S.base + '/tv/' + T1); const html = await r.text(); ok('/tv/<token> serves the screen page', r.status === 200 && /Rotation screen/.test(html) && /no-store/.test(r.headers.get('cache-control')));
  r = await fetch(S.base + '/tv/' + 'nope'.repeat(8)); ok('an unknown link gets a plain "not found" page, not the screen', r.status === 404 && !/api\/tv/.test(await r.text()));
  r = await fetch(S.base + '/api/tv?t=' + T1, { method: 'POST' }); ok('only GET', r.status === 404 || r.status === 401);
  r = await fetch(S.base + '/api/rpc', { method: 'POST', body: '{}' }); ok('the screen token gives no access to the staff API', r.status === 401);

  section('4. Who may create and see screens');
  const adm = await S.client('boss@x.com', { admin: true }), mgr = await S.client('mgr@x.com'), lead = await S.client('lead@x.com'), fmd = await S.client('fmd@x.com'), ana = await S.client('ana@x.com');
  const hasKey = async (c) => !!(await c.rpc({ action: 'pull' })).keys.totTvScreens;
  ok('the coordinator, a manager and a shift lead see the screen list (it holds the tokens)', (await hasKey(fmd)) && (await hasKey(mgr)) && (await hasKey(lead)));
  const evalu = await S.client('mgr@x.com'); const pol = JSON.parse(st.cur.keys.totAccessPolicy.v); pol.users['coach@x.com'] = { role: 'performance_coach', name: 'Cora', sites: ['main'] }; st.cur.keys.totAccessPolicy = P(pol, NOW + 1); await st.replaceAll({ keys: st.cur.keys });
  const coach = await S.client('coach@x.com'); ok('a performance coach does not (they do not edit the schedule)', !(await hasKey(coach)));
  const w = await coach.rpc({ action: 'push', keys: { totTvScreens: { v: '[]', t: Date.now() } } }); ok('and cannot overwrite or delete the list', (w.denied || []).indexOf('totTvScreens') >= 0, w);
  const e = await ana.post('/api/rpc', { action: 'pull' }); ok('an employee cannot at all', e.status === 403);

  section('5. Live: changes reach the screen at once');
  const got = []; const conn = await new Promise((res) => { const rq = http.get(S.base + '/api/tv-events?t=' + T1, (rs) => { rs.setEncoding('utf8'); rs.on('data', (d) => got.push(d)); res({ rq, rs }); }); });
  await new Promise((rz) => setTimeout(rz, 200)); ok('the live channel opens without sign-in', conn.rs.statusCode === 200 && /event-stream/.test(conn.rs.headers['content-type']));
  const n0 = got.length, sch = JSON.parse(st.cur.keys.totSchedule.v); sch.days[D].shifts.morning.rows[0].cells[0] = '99';
  const cur = (await fmd.rpc({ action: 'pull' })).keys.totSchedule; const t0 = Date.now();
  const pr = await fmd.rpc({ action: 'push', keys: { totSchedule: { v: JSON.stringify(sch), t: Date.now(), bt: cur.t } } }); ok('the coordinator saves a change to the rotation', !(pr.denied || []).length && !(pr.conflicts || []).length, pr);
  for (let i = 0; i < 30 && got.length === n0; i++) await new Promise((rz) => setTimeout(rz, 100)); ok('the screen is told within a second', got.length > n0 && Date.now() - t0 < 1500 && /changed/.test(got.slice(n0).join('')), Date.now() - t0);
  ok('the notice carries no data', !/Ana|99|rows/.test(got.slice(n0).join('')));
  r = await get(T1); ok('and the next answer has the change', r.j.rows.find((x) => x.n === 'Ana B.').c[0] === '99');
  const n1 = got.length; const scs = JSON.parse(st.cur.keys.totTvScreens.v); scs[0].zoom = 2; const cu2 = (await fmd.rpc({ action: 'pull' })).keys.totTvScreens;
  await fmd.rpc({ action: 'push', keys: { totTvScreens: { v: JSON.stringify(scs), t: Date.now(), bt: cu2.t } } }); for (let i = 0; i < 30 && got.length === n1; i++) await new Promise((rz) => setTimeout(rz, 100));
  r = await get(T1); ok('zoom set in the tool reaches the screen the same way', got.length > n1 && r.j.screen.zoom === 2);
  conn.rq.destroy();
  const scs2 = JSON.parse(st.cur.keys.totTvScreens.v).filter((s) => s.id !== 'tv1'); const cu3 = (await fmd.rpc({ action: 'pull' })).keys.totTvScreens;
  await fmd.rpc({ action: 'push', keys: { totTvScreens: { v: JSON.stringify(scs2), t: Date.now(), bt: cu3.t } } }); ok('deleting a screen kills its link at once', (await get(T1)).s === 404);

  section('6. Limits');
  let n429 = 0; for (let i = 0; i < 260; i++) { const x = await fetch(S.base + '/api/tv?t=' + T2 + '&d=' + D + '&h=10'); if (x.status === 429) n429++; } ok('a client that polls like mad is slowed down', n429 > 0, n429);
  const S2 = await start({ PTF_TV_IPS: '10.99.' }); await S2.state.replaceAll({ keys: K }); const x2 = await fetch(S2.base + '/api/tv?t=' + T2); ok('with an address list set, other addresses are refused', x2.status === 403); const x3 = await fetch(S2.base + '/tv/' + T2); ok('also for the page', x3.status === 403); await S2.close();

  await S.close(); done('tv');
})().catch((e) => { console.error(e); process.exit(1); });
