/* Audit: a shared computer. A manager used the tool (their data is in this browser), their sign-in ran out, and somebody else signs in on the same browser.
   The second person must not see the first person's data, and a person with no position must see Home only. */
const path = require('path'), tool = path.join(__dirname, '..', 'tool', 'PTF-pass-to-floor-Gunda.html'), code = path.join(__dirname, '..', 'tool', 'Code.gs');
const gas = require('./fakegas')(code); require('./seed')(gas);
let fails = 0; function ok(n, c, x) { if (!c) fails++; console.log((c ? '  ✅ ' : '  ❌ ') + n + (c ? '' : '  → ' + x)); }
(async () => {
  const D = gas.data(), now = Date.now(); D.keys.totBonusCfg = { v: JSON.stringify({ programs: [{ name: 'SECRET-BONUS-PLAN' }] }), t: now }; D.keys.totRemarks = { v: JSON.stringify([{ id: 'r1', name: 'Ana', text: 'SECRET-REMARK' }]), t: now };
  D.keys.employeeDataSource = { v: JSON.stringify([{ id: 1, fullName: 'Ana Beridze', workId: 'W1', ext: { phone: '555-SECRET' } }]), t: now }; gas.setData(D); gas.addUser('newbie@x.com', 'pw-newbie@x.com', 'Nora New');
  const H = await require('./harness')(tool, gas), P = await H.open({ email: 'mgr@x.com', pw: 'pw-mgr@x.com' }); await P.setViewportSize({ width: 1400, height: 900 }); await P.sync(); await P.waitForTimeout(800);
  const had = await P.evaluate(() => ['totBonusCfg', 'totRemarks', 'employeeDataSource'].filter(k => (localStorage.getItem(k) || '').indexOf('SECRET') >= 0));
  ok('setup: the manager has restricted data in this browser', had.length >= 2, JSON.stringify(had));
  /* the manager's sign-in runs out; the next person signs in through the sign-in screen on the same browser */
  for (let i = 0; i < 4 && !(await P.evaluate(() => !!document.getElementById('gateOv'))); i++) { await P.waitForTimeout(1500); await P.evaluate(() => { const a = JSON.parse(localStorage.getItem('totAuth')); a.t = Date.now() - 8 * 864e5; localStorage.setItem('totAuth', JSON.stringify(a)); }); await P.reload(); await P.waitForSelector('#gateOv', { timeout: 5000 }).catch(() => {}); }
  ok('the sign-in screen is shown', await P.evaluate(() => !!document.getElementById('gateOv')));
  const ph = await P.evaluate(() => sha256sync('tot-user-v1|nora@x.com|Correct-Horse-9')); gas.addUser('nora@x.com', ph, 'Nora New');
  await P.evaluate(() => { window.name = '__noinit'; });
  await P.fill('#gMail', 'nora@x.com'); await P.fill('#gPw', 'Correct-Horse-9'); await P.evaluate(() => document.getElementById('gGo').click()); await P.waitForTimeout(2500); try { await P.sync(); } catch (e) {} await P.waitForTimeout(1200);
  const who = await P.evaluate(() => (JSON.parse(localStorage.getItem('totAuth') || '{}') || {}).email);
  ok('the new person is signed in', who === 'nora@x.com', who);
  const left = await P.evaluate(() => Object.keys(localStorage).filter(k => (localStorage.getItem(k) || '').indexOf('SECRET') >= 0));
  ok('nothing of the manager\'s restricted data is left in the browser', left.length === 0, JSON.stringify(left));
  const bar = await P.evaluate(() => Array.from(document.querySelectorAll('.nav-tabs button')).filter(b => b.offsetParent !== null && /nav[A-Z]/.test(b.id)).map(b => b.id));
  ok('a person with no position sees Home only (no department spaces)', bar.every(id => /navHome/.test(id)), JSON.stringify(bar));
  ok('Home explains that the account has no position yet', await P.evaluate(() => { const n = document.getElementById('noRoleNote'); return n && n.offsetParent !== null && /no position yet/.test(n.innerText); }));
  ok('a direct switch to another screen is refused', await P.evaluate(() => { try { switchView('schedule'); } catch (e) {} return currentView === 'home'; }));
  ok('no page errors', H.errs.length === 0, JSON.stringify(H.errs.slice(0, 3))); await H.close();
  console.log('audit_account_switch: ' + (fails ? fails + ' FAILED' : 'ALL PASSED')); process.exit(fails ? 1 : 0);
})();
