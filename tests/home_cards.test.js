/* Home is shared by every department: no Logbook descriptions card; the Last backup card (Back up now) is for the admin only. */
const path = require('path'), tool = path.join(__dirname, '..', 'tool', 'PTF-pass-to-floor-Gunda.html');
const gas = require('./fakegas')(path.join(__dirname, '..', 'tool', 'Code.gs')); require('./seed')(gas);
let fails = 0; function ok(n, c, x) { if (!c) fails++; console.log((c ? '  ✅ ' : '  ❌ ') + n + (c ? '' : '  → ' + x)); }
(async () => {
  const H = await require('./harness')(tool, gas);
  const cards = (P) => P.evaluate(async () => { switchView('home'); try { refreshHomeStats(); } catch (e) {} await new Promise(r => setTimeout(r, 400)); return Array.from(document.querySelectorAll('.hs-item')).filter(e => getComputedStyle(e).display !== 'none' && e.offsetParent !== null).map(e => e.querySelector('span').textContent); });
  const M = await H.open({ email: 'mgr@x.com', pw: 'pw-mgr@x.com' }); await M.setViewportSize({ width: 1400, height: 900 }); await M.sync(); await M.waitForTimeout(600);
  const m = await cards(M);
  ok('a manager sees no Logbook descriptions card on Home', !m.includes('Logbook descriptions'), m.join(', '));
  ok('a manager sees no Last backup card', !m.includes('Last backup'), m.join(', '));
  ok('the other Home cards are still there', m.includes('Employees in data source'), m.join(', '));
  const A = await H.open({ admin: true }); await A.setViewportSize({ width: 1400, height: 900 }); await A.sync(); await A.waitForTimeout(1800);
  const a = await cards(A);
  ok('the admin sees no Logbook descriptions card either', !a.includes('Logbook descriptions'), a.join(', '));
  ok('the admin still sees Last backup', a.includes('Last backup'), a.join(', '));
  ok('no page errors', H.errs.length === 0, H.errs.join(' | '));
  await H.close(); console.log('home_cards: ' + (fails ? fails + ' FAILED' : 'ALL PASSED')); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
