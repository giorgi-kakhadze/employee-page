/* Audit: local dates in Georgia (UTC+4). At 01:30 on 1 November local time it is still 31 October in UTC; the tool must count by the local day and month. */
process.env.TZ = 'Asia/Tbilisi';
const path = require('path'), tool = path.join(__dirname, '..', 'tool', 'PTF-pass-to-floor-Gunda.html'), code = path.join(__dirname, '..', 'tool', 'Code.gs');
const gas = require('./fakegas')(code); require('./seed')(gas);
let fails = 0; function ok(n, c, x) { if (!c) fails++; console.log((c ? '  ✅ ' : '  ❌ ') + n + (c ? '' : '  → ' + x)); }
(async () => {
  const H = await require('./harness')(tool, gas), P = await H.open({ admin: true }); await P.setViewportSize({ width: 1500, height: 950 });
  await P.clock.setFixedTime(new Date('2026-10-31T21:30:00Z'));   /* 01:30 on 1 Nov in Tbilisi */
  await P.sync();
  const now = await P.evaluate(() => { const d = new Date(); return { local: d.getDate() + '/' + (d.getMonth() + 1), utc: d.toISOString().slice(0, 10) }; });
  ok('setup: the browser is in Tbilisi time (local 1/11, UTC still 2026-10-31)', now.local === '1/11' && now.utc === '2026-10-31', JSON.stringify(now));
  await P.evaluate(() => {
    /* an evaluation made 30 minutes ago (local 1 Nov 01:00 = UTC 31 Oct 21:00) and one from October */
    localStorage.setItem('evalResults', JSON.stringify([{ id: 1, uid: 'u1', name: 'Ana', total: 90, ts: new Date('2026-10-31T21:00:00Z').getTime() }, { id: 2, uid: 'u2', name: 'Bo', total: 70, ts: new Date('2026-10-15T10:00:00Z').getTime() }]));
  });
  await P.evaluate(() => document.getElementById('navPerformance').click()); await P.waitForTimeout(600); await P.evaluate(() => { const b = Array.from(document.querySelectorAll('#spaceSub button')).find(x => /Overview/.test(x.innerText)); if (b) b.click(); }); await P.waitForTimeout(800);
  const txt = await P.evaluate(() => document.body.innerText);
  const m = /Evaluations this month\s*(\d+)|(\d+)\s*Evaluations this month/.exec(txt);
  ok('"Evaluations this month" counts the evaluation made at 01:00 on 1 November (local), not the October one', m && (m[1] || m[2]) === '1', m ? m[0] : txt.slice(0, 400));
  ok('no page errors', H.errs.length === 0, JSON.stringify(H.errs.slice(0, 3))); await H.close();
  console.log('audit_timezone: ' + (fails ? fails + ' FAILED' : 'ALL PASSED')); process.exit(fails ? 1 : 0);
})();
