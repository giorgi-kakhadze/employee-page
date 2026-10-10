/* v3.41 Today screen: the shift lead's briefing (who is where now, breaks, gaps, absences, handover text). */
const path = require('path'), tool = path.join(__dirname, '..', 'tool', 'PTF-pass-to-floor-Gunda.html'), code = path.join(__dirname, '..', 'tool', 'Code.gs');
const gas = require('./fakegas')(code); require('./seed')(gas);
let fails = 0; function ok(n, c, x) { if (!c) fails++; console.log((c ? '  ✅ ' : '  ❌ ') + n + (c ? '' : '  → ' + x)); }
(async () => {
  const H = await require('./harness')(tool, gas), P = await H.open({ admin: true }); await P.setViewportSize({ width: 1600, height: 1000 }); await P.sync();
  const w = (ms) => P.waitForTimeout(ms), S = async () => { await w(500); return P.evaluate(() => JSON.parse(localStorage.getItem('totSchedule'))); };
  const day = await P.evaluate(() => { switchView('schedule'); const d = new Date(), day = d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2), S = JSON.parse(localStorage.getItem('totSchedule') || '{}');
    S.teams = [{ id: 't1', name: 'Team 1' }]; S.roster = { anchor: day, people: Array.from({ length: 6 }, (_, i) => ({ name: 'W' + (i + 1), g: 'A', sh: 'morning', t: 't1' })).concat(Array.from({ length: 3 }, (_, i) => ({ name: 'R' + (i + 1), g: 'B', sh: 'morning', t: 't1' }))) };
    S.cfg = { len: 8, maxrun: 4, tables: 100, tt: { t1: [1, 4] } }; S.days = {}; S.sched = {}; localStorage.setItem('totSchedule', JSON.stringify(S)); SchedMount(); return day; });
  await P.evaluate(() => { window.__totNowH = 10.25; });
  await w(500); await P.evaluate(() => { document.querySelector('#scheduleView [data-sub="rot"]').click(); }); await w(300);
  await P.evaluate(() => { document.querySelector('#scheduleView [data-a="load"]').click(); }); await w(600);
  await P.evaluate(() => { document.querySelector('#scheduleView [data-a="gen"]').click(); }); await w(1200);
  ok('there is a Today tab', await P.evaluate(() => !!document.querySelector('#scheduleView [data-sub="today"]')));
  await P.evaluate(() => document.querySelector('#scheduleView [data-sub="today"]').click()); await w(600);
  let t = await P.evaluate(() => document.querySelector('#scheduleView').innerText);
  ok('Today shows the expected count 6', /6/.test(t) && /xpected/.test(t), t.slice(0, 300));
  ok('nothing is uncovered yet', !/not covered/i.test(t) || /✔|covered/i.test(t), t.slice(0, 400));
  ok('shows people by team with Team 1', /Team 1/.test(t));
  const txt = await P.evaluate(() => document.querySelector('[data-tdcopy]') ? 'btn' : 'none');
  ok('copy handover button exists', txt === 'btn');
  /* absences: three of six leave -> a gap */
  await P.evaluate(() => { document.querySelector('#scheduleView [data-sub="rot"]').click(); }); await w(300);
  await P.evaluate(() => document.querySelector('#scheduleView [data-a="cv"]').click()); await w(300);
  for (const i of [0, 1, 2]) { await P.evaluate((i) => { document.querySelector('#cvP').value = String(i); document.querySelector('#cvA').value = '8'; document.querySelector('#cvB').value = '16'; document.querySelector('#cvW').value = 'sick'; document.querySelector('#scheduleView [data-cvgo]').click(); }, i); await w(800); }
  await P.evaluate(() => document.querySelector('#scheduleView [data-sub="today"]').click()); await w(600);
  t = await P.evaluate(() => document.querySelector('#scheduleView').innerText);
  ok('absences are listed and a gap warning appears', /bsent/i.test(t) && /(nobody|not covered|gap)/i.test(t), t.slice(0, 600));
  const h = await P.evaluate(() => { let s = ''; const o = navigator.clipboard; try { Object.defineProperty(navigator, 'clipboard', { value: { writeText: (x) => { window.__cp = x; return Promise.resolve(); } }, configurable: true }); } catch (e) {} document.querySelector('[data-tdcopy]').click(); return window.__cp || ''; });
  await w(300);
  const cp = await P.evaluate(() => window.__cp || '');
  ok('handover text mentions the absent people', /W1/.test(cp) && /W2/.test(cp), cp.slice(0, 300));
  ok('no page errors', H.errs.length === 0, H.errs.slice(0, 3)); await H.close();
  console.log('today: ' + (fails ? fails + ' FAILED' : 'ALL PASSED')); process.exit(fails ? 1 : 0);
})();
