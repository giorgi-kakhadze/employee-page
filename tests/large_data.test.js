/* v3.39 large data and small UI fixes: with the 1,000-employee demo backup the Coach board, FMD Overview and the month review open quickly (they took 25 s, 4 s and 5 s),
   Escape closes a dialog, and the sync pill stays on screen on laptops. Limits are generous so a slow machine does not fail the test. */
const path = require('path'), tool = process.argv[2] || path.join(__dirname, '..', 'tool', 'PTF-pass-to-floor-Gunda.html'), code = process.argv[3] || path.join(__dirname, '..', 'tool', 'Code.gs');
const gas = require('./fakegas')(code); require('./seed')(gas);
let fails = 0; function ok(name, cond, extra) { if (!cond) fails++; console.log((cond ? '  ✅ ' : '  ❌ ') + name + (extra ? '  → ' + extra : '')); }
const DEMO = path.join(__dirname, '..', 'demo', 'PTF-demo-backup.json');
(async () => {
  const H = await require('./harness')(tool, gas);
  console.log('1. The sync pill and Escape (normal data)');
  const A = await H.open({ admin: true }); await A.sync();
  for (const w of [1100, 1280, 1440]) { await A.setViewportSize({ width: w, height: 900 }); await A.waitForTimeout(500);
    const r = await A.evaluate(() => { const b = document.getElementById('tdBadge').getBoundingClientRect(); return { right: Math.round(b.right), left: Math.round(b.left), vw: innerWidth }; });
    ok('the "synced" pill is fully on screen at ' + w + ' px', r.left >= 0 && r.right <= r.vw, JSON.stringify(r)); }
  await A.setViewportSize({ width: 1440, height: 900 });
  await A.evaluate(() => switchView('tasks')); await A.waitForTimeout(300);
  await A.evaluate(() => { const b = document.querySelector('#tasksView button[data-a="new"]'); if (b) b.click(); }); await A.waitForTimeout(200);
  const open1 = await A.evaluate(() => document.querySelectorAll('.tkOv').length);
  await A.keyboard.press('Escape'); await A.waitForTimeout(150);
  const open2 = await A.evaluate(() => document.querySelectorAll('.tkOv').length);
  ok('Escape closes the New ticket dialog', open1 >= 1 && open2 === open1 - 1, open1 + ' → ' + open2);
  await A.evaluate(() => { document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); });
  ok('Escape with nothing open does nothing harmful', await A.evaluate(() => currentView) === 'tasks');
  await A.context().close();

  console.log('2. Large data: the 1,000-employee demo backup');
  const B = await H.open({ admin: true }); await B.setViewportSize({ width: 1440, height: 900 });
  await B.setInputFiles('#importFileInput', DEMO); await B.waitForSelector('#restoreModal.open', { timeout: 30000 });
  await B.evaluate(() => { HTMLAnchorElement.prototype.click = function () {}; applyRestore('replace'); });
  await B.waitForTimeout(5000); await B.waitForFunction(() => window.spaceItems && spaceItems('performance').length > 3, null, { timeout: 30000 }); await B.waitForTimeout(1500);
  const time = async (f) => B.evaluate(async (f) => { const t0 = performance.now(); new Function(f)(); await new Promise(r => setTimeout(r, 0)); return Math.round(performance.now() - t0); }, f);
  const coach = await time("spaceItems('performance').find(x => x.pid === 'performance.coach_board').go()");
  ok('Coach board opens in under 3 s (was 25 s)', coach < 3000, coach + ' ms');
  ok('and it shows people', (await B.evaluate(() => currentView === 'coach' && document.getElementById('coachView').textContent.length)) > 2000);
  const ov = await time("window.__space = 'fmd'; switchView('spacehome')");
  ok('FMD Overview opens in under 2 s (was 4 s)', ov < 2000, ov + ' ms');
  const bonus = await time("DeptOpen('fmd', 'bonus')");
  ok('Bonuses & month review opens in under 4 s (was 5 s)', bonus < 4000, bonus + ' ms');
  const bt = await B.evaluate(() => document.getElementById('deptView').textContent.replace(/\s+/g, ' '));
  ok('the month review lists employees with figures', /Bonus|bonus/.test(bt) && bt.length > 1000, bt.length + ' characters');
  ok('no page errors', H.errs.length === 0, H.errs.slice(0, 3).join(' | '));
  await H.close();
  console.log('large_data: ' + (fails ? fails + ' FAILED' : 'ALL PASSED'));
  process.exit(fails ? 1 : 0);
})();
