/* v3.25: the top bar shows departments only; every other screen lives in its department's second bar (#spaceSub). Management is a position, not a department. */
const path = require('path'), tool = process.argv[2] || path.join(__dirname, '..', 'tool', 'PTF-pass-to-floor-Gunda.html'), code = process.argv[3] || path.join(__dirname, '..', 'tool', 'Code.gs');
const gas = require('./fakegas')(code); require('./seed')(gas);
let fails = 0; function ok(n, c, x) { if (!c) fails++; console.log((c ? '  ✅ ' : '  ❌ ') + n + (x ? '  → ' + x : '')); }
const DEPT_BTN = { navAcademy: 'academy', navPerformance: 'performance', navSchedule: 'fmd', navAppearance: 'uniforms', navHr: 'hr', navOffice: 'office', navService: 'service' };
const UTIL = ['navHome', 'navTasks', 'bellBtn', 'searchBtn', 'sitePill', 'psPill', 'tdBadge', 'spPill'];   /* utilities and the injected pills */
const GONE = ['navDept', 'navRecruiting', 'navRequests', 'navCoach', 'navEmpdata', 'navIntegrations', 'navPerm'];
(async () => {
  const H = await require('./harness')(tool, gas);
  async function look(who) {
    const P = who === 'admin' ? await H.open({ admin: true }) : await H.open({ email: who + '@x.com', pw: 'pw-' + who + '@x.com' });
    await P.setViewportSize({ width: 1440, height: 900 }); await P.sync(); await P.waitForTimeout(1600);
    const bar = await P.evaluate(() => { const b = document.querySelector('.nav-tabs'); return { ids: Array.from(b.querySelectorAll('button')).filter(x => x.offsetParent !== null).map(x => x.id), text: Array.from(b.querySelectorAll('button')).filter(x => x.offsetParent !== null).map(x => x.textContent).join(' ') }; });
    const spaces = {};
    for (const id of bar.ids.filter(i => DEPT_BTN[i])) {
      await P.evaluate(id => document.getElementById(id).click(), id); await P.waitForTimeout(700);
      spaces[DEPT_BTN[id]] = await P.evaluate(() => { const s = document.getElementById('spaceSub'); return { view: currentView, space: window.spaceOf ? spaceOf() : '', sub: s && s.classList.contains('show') ? Array.from(s.querySelectorAll('button,.ss-label')).map(b => b.textContent.trim().replace(/\s+/g, ' ')) : [] }; });
    }
    await P.evaluate(() => { switchView('home'); }); await P.waitForTimeout(500);
    const hero = await P.evaluate(() => ((document.querySelector('#homeView .home-hero h1') || {}).textContent || '').trim());
    /* every department select on a board: the department board's New ticket dialog and the Tasks New dialog */
    const selects = await P.evaluate(() => { const out = []; try { const d = (window.__dept.DEPTS.filter(x => __dept.sees(x.id))[0] || {}).id; if (d) { DeptOpen(d, 'board'); const b = document.querySelector('#deptView button[data-a="new"]'); if (b) { b.click(); const s = document.getElementById('ntTo'); if (s) out.push.apply(out, Array.from(s.options).map(o => o.textContent)); } } } catch (e) { out.push('ERR ' + e.message); }
      document.querySelectorAll('.tkOv').forEach(o => o.remove());
      try { switchView('tasks'); TasksMount(); const b = document.querySelector('#tasksView button[data-a="new"]'); if (b) { b.click(); const s = document.getElementById('tkTo'); if (s) out.push.apply(out, Array.from(s.options).map(o => o.textContent)); } } catch (e) { out.push('ERR ' + e.message); }
      document.querySelectorAll('.tkOv').forEach(o => o.remove()); switchView('home'); return out; });
    await P.context().close();
    return { bar, spaces, hero, selects };
  }
  const R = {};
  for (const who of ['admin', 'mgr', 'coach', 'lead', 'hr', 'fmd']) {
    console.log('Top bar and department spaces: ' + who);
    const r = R[who] = await look(who), ids = r.bar.ids;
    ok(who + ': only department buttons and utilities in the top bar', ids.every(i => DEPT_BTN[i] || UTIL.indexOf(i) >= 0), ids.join(','));
    ok(who + ': no Departments / Recruiting / Requests / Coach / Employees / Integrations / Permissions tab', !ids.some(i => GONE.indexOf(i) >= 0), ids.filter(i => GONE.indexOf(i) >= 0).join(','));
    const dep = ids.filter(i => DEPT_BTN[i]);
    ok(who + ': has at least one department', dep.length > 0, dep.join(','));
    const home = Object.keys(r.spaces).filter(s => r.spaces[s].view === 'home' || !r.spaces[s].sub.length);
    ok(who + ': every visible department button opens its space (never Home, second bar shown)', !home.length, home.join(','));
    const wrong = Object.keys(r.spaces).filter(s => r.spaces[s].space !== s);
    ok(who + ': the open screen belongs to the clicked space', !wrong.length, wrong.map(s => s + '→' + r.spaces[s].space + ' (' + r.spaces[s].view + ')').join(','));
    const all = [r.bar.text].concat(Object.keys(r.spaces).map(s => r.spaces[s].sub.join(' | ')), r.selects).join(' | ');
    ok(who + ': no "Management" department in the bar, second bars or department selects', !/Management/.test(all.replace(/Service Management/g, '')), (all.replace(/Service Management/g, '').match(/[^|]*Management[^|]*/) || [''])[0]);   /* v3.29: the Service Management department is not the old Management one */
    ok(who + ': department selects found and readable', r.selects.length > 0 && !r.selects.some(s => /^ERR/.test(s)), r.selects.filter(s => /^ERR/.test(s)).join(',') || r.selects.length + ' options');
    ok(who + ': Home hero is not "Management"', !!r.hero && !/Management/.test(r.hero.replace(/Service Management/g, '')), r.hero);
  }
  const sub = (who, sp) => (R[who].spaces[sp] || { sub: [] }).sub.join(' | ');
  console.log('Expected screens inside the spaces');
  ok('manager: sees every department', Object.keys(DEPT_BTN).every(i => R.mgr.bar.ids.indexOf(i) >= 0), R.mgr.bar.ids.join(','));
  ok('admin: sees every department', Object.keys(DEPT_BTN).every(i => R.admin.bar.ids.indexOf(i) >= 0), R.admin.bar.ids.join(','));
  ok('coach: Performance has the Coach board', /Coach board/.test(sub('coach', 'performance')), sub('coach', 'performance'));
  ok('manager: FMD has Employees, Employee requests and Game counts', /Employees/.test(sub('mgr', 'fmd')) && /Employee requests/.test(sub('mgr', 'fmd')) && /Game counts/.test(sub('mgr', 'fmd')), sub('mgr', 'fmd'));
  ok('manager: Uniforms has the Uniforms screen and the board', /Uniforms/.test(sub('mgr', 'uniforms').replace(/^Uniforms \| /, '')) && /Board/.test(sub('mgr', 'uniforms')), sub('mgr', 'uniforms'));
  ok('manager: Office has Building access and IT', /Building access/.test(sub('mgr', 'office')) && /IT/.test(sub('mgr', 'office')), sub('mgr', 'office'));
  ok('HR: HR space has Recruiting and the Board', /Recruiting/.test(sub('hr', 'hr')) && /Board/.test(sub('hr', 'hr')), sub('hr', 'hr'));
  ok('HR: Home hero is HR', /· HR$/.test(R.hr.hero), R.hr.hero);
  ok('coach: no Coach board button in the top bar, but in Performance', R.coach.bar.ids.indexOf('navCoach') < 0 && /Coach board/.test(sub('coach', 'performance')));
  ok('FMD: Game counts in FMD', /Game counts/.test(sub('fmd', 'fmd')), sub('fmd', 'fmd'));
  ok('Game counts only in FMD (not Performance or HR)', !/Game counts/.test(sub('mgr', 'performance') + sub('mgr', 'hr')), sub('mgr', 'performance') + ' / ' + sub('mgr', 'hr'));
  ok('no page errors', !H.errs.length, H.errs.join(' | '));
  console.log(fails ? fails + ' FAILED' : 'ALL PASSED'); await H.close(); process.exit(fails ? 1 : 0);
})();
