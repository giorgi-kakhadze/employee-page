/* Backup and Clear history of a space (the floating bar at the bottom left, and the Employee Data buttons) are for the admin only. */
const path = require('path'), tool = path.join(__dirname, '..', 'tool', 'PTF-pass-to-floor-Gunda.html');
const gas = require('./fakegas')(path.join(__dirname, '..', 'tool', 'Code.gs')); require('./seed')(gas);
let fails = 0; function ok(n, c, x) { if (!c) fails++; console.log((c ? '  ✅ ' : '  ❌ ') + n + (c ? '' : '  → ' + x)); }
(async () => {
  const H = await require('./harness')(tool, gas);
  const vis = (P, sel) => P.evaluate((sel) => { const e = document.querySelector(sel); return !!(e && e.offsetParent !== null); }, sel);
  const state = (P) => P.evaluate(async () => { const w = (ms) => new Promise(r => setTimeout(r, ms)); const out = {};
    for (const v of ['onboarding', 'exam', 'logbooks']) { try { switchView(v); } catch (e) {} await w(500); const b = document.getElementById('spaceBar'); out[v] = !!(b && getComputedStyle(b).display !== 'none'); }
    return out; });
  /* admin */
  const A = await H.open({ admin: true }); await A.setViewportSize({ width: 1400, height: 900 }); await A.sync(); await A.waitForTimeout(800);
  const sa = await state(A);
  ok('the admin sees Backup / Clear history in Onboarding, Workshop and Logbooks', sa.onboarding && sa.exam && sa.logbooks, JSON.stringify(sa));
  const dlA = await A.evaluate(() => { let n = 0; const o = URL.createObjectURL; URL.createObjectURL = function (b) { n++; return o.call(URL, b); }; downloadSpaceBackup('onboarding'); URL.createObjectURL = o; return n; });
  ok('the admin can download a space backup', dlA > 0, dlA);
  await A.evaluate(() => switchView('home')); await A.waitForTimeout(300);
  /* a staff member (manager: sees every department) */
  const M = await H.open({ email: 'mgr@x.com', pw: 'pw-mgr@x.com' }); await M.setViewportSize({ width: 1400, height: 900 }); await M.sync(); await M.waitForTimeout(800);
  const sm = await state(M);
  ok('a manager does not see the bar in any space', !sm.onboarding && !sm.exam && !sm.logbooks, JSON.stringify(sm));
  await M.evaluate(() => switchView('home')); await M.waitForTimeout(300);
  ok('a manager does not see "Backup employee data"', !(await vis(M, '[onclick="downloadSpaceBackup(\'employees\')"]')));
  const r = await M.evaluate(() => { localStorage.setItem('logbookSettings', '{"keep":1}'); let n = 0; const o = URL.createObjectURL; URL.createObjectURL = function (b) { n++; return o.call(URL, b); };
    downloadSpaceBackup('onboarding'); openSpaceClear('logbooks'); const modal = document.getElementById('spaceClearModal').classList.contains('open'); window._spaceClearId = 'logbooks'; confirmSpaceClear(); URL.createObjectURL = o;
    return { dl: n, modal, kept: localStorage.getItem('logbookSettings') }; });
  ok('calling backup / clear from the console does nothing for staff (no file, no dialog, data kept)', r.dl === 0 && !r.modal && r.kept === '{"keep":1}', JSON.stringify(r));
  /* admin viewing as somebody else */
  await A.evaluate(() => { sessionStorage.setItem('totViewAs', JSON.stringify({ role: 'shift_lead' })); }); await A.waitForTimeout(1700);
  const sv = await A.evaluate(() => document.body.classList.contains('totAdmData'));
  ok('while the admin uses "View as", the buttons are hidden too', !sv, sv);
  ok('no page errors', H.errs.length === 0, H.errs.join(' | '));
  await H.close(); console.log('space_backup_admin: ' + (fails ? fails + ' FAILED' : 'ALL PASSED')); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
