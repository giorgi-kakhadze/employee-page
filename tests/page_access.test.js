/* v3.36 Access to spaces and pages: per position and per person, every space, page and department board can be Hidden, View only or Edit.
   The admin sets it in Admin → 🔐 Access to spaces and pages; the tool hides what is hidden, locks what is view only, and the server enforces both. */
const path = require('path'), tool = process.argv[2] || path.join(__dirname, '..', 'tool', 'PTF-pass-to-floor-Gunda.html'), code = process.argv[3] || path.join(__dirname, '..', 'tool', 'Code.gs');
const gas = require('./fakegas')(code); require('./seed')(gas);
let fails = 0; function ok(name, cond, extra) { if (!cond) fails++; console.log((cond ? '  ✅ ' : '  ❌ ') + name + (extra ? '  → ' + extra : '')); }
const now = Date.now(), J = (o) => ({ v: JSON.stringify(o), t: now });
/* extra people and data: a training coordinator (the "junior" of the request), and some data that belongs to single pages */
gas.addUser('tc@x.com', 'pw-tc@x.com', 'Tina Trainer');
(function () { const d = gas.data(), p = JSON.parse(d.keys.totAccessPolicy.v); p.users['tc@x.com'] = { role: 'training_coordinator', name: 'Tina Trainer', sites: ['main'] }; d.keys.totAccessPolicy = J(p);
  Object.assign(d.keys, { totSchedule: J({ week: 'w1', rows: [] }), totIncidents: J([{ id: 'i1', title: 'Spill at table 4' }]), totRecruitment: J({ cands: [{ id: 'r1', name: 'Nino' }] }), totProjects: J([{ id: 'p1', title: 'Open day', visibility: 'org', ownerEmail: 'mgr@x.com' }]) });
  gas.setData(d); })();
const pull = (email) => gas.post({ action: 'pull', email, pwHash: 'pw-' + email }).keys || {};
const push = (email, keys) => gas.post({ action: 'push', email, pwHash: 'pw-' + email, keys });
const TOP = { navAcademy: 'academy', navPerformance: 'performance', navSchedule: 'fmd', navAppearance: 'uniforms', navHr: 'hr', navOffice: 'office', navService: 'service', navProjects: 'projects' };
(async () => {
  const H = await require('./harness')(tool, gas);
  async function top(P) { await P.waitForTimeout(1700); return P.evaluate((T) => Object.keys(T).filter(id => { const b = document.getElementById(id); return b && getComputedStyle(b).display !== 'none'; }).map(id => T[id]), TOP); }
  async function sub(P, sp) { return P.evaluate((sp) => spaceItems(sp).filter(x => x.go).map(x => x.pid), sp); }

  console.log('1. The admin sets access in Admin → Access to spaces and pages');
  const A = await H.open({ admin: true }); await A.setViewportSize({ width: 1440, height: 900 }); await A.sync();
  await A.evaluate(() => { localStorage.setItem('customSpaces', JSON.stringify([{ id: 'sNew', title: 'Safety rules', text: 'Wear shoes', roles: [] }])); });
  await A.evaluate(() => { document.dispatchEvent(new KeyboardEvent('keydown', { key: 'g', ctrlKey: true, bubbles: true })); }); await A.waitForTimeout(500);
  const U = await A.evaluate(async () => { const w = (ms) => new Promise(r => setTimeout(r, ms)), r = {}, o = [...document.querySelectorAll('.adOv')].find(x => x.querySelector('#adClose'));
    const nb = [...o.querySelectorAll('.adNi')].find(b => /Access management/.test(b.textContent)); r.inMenu = !!nb; if (nb) nb.click(); await w(300);
    r.oldGone = ![...o.querySelectorAll('.adNi')].some(b => /Detailed access by role|Access to spaces and pages/.test(b.textContent));
    const mg = document.getElementById('accMgr'), dc = mg.querySelector('#dcTab'); r.modes = [...mg.querySelectorAll('.accMode')].map(b => b.textContent);
    mg.querySelector('.accMode[data-m="role"]').click(); await w(150); r.roleTable = dc && dc.offsetParent !== null && mg.querySelectorAll('#dcTab input[type=checkbox]').length > 20;
    mg.querySelector('.accMode[data-m="pages"]').click(); await w(150);
    const d = document.getElementById('accSec'); r.notEmpty = d.offsetParent !== null && d.querySelectorAll('select.accL').length > 20 && dc.offsetParent === null;
    const set = (k, v) => { const s = d.querySelector('select.accL[data-k="' + k + '"]'); if (!s) return false; s.value = v; return true; };
    const who = (v) => { const s = d.querySelector('#accWho'); s.value = v; s.dispatchEvent(new Event('change', { bubbles: true })); };
    who('r:training_coordinator'); await w(50);
    r.spaces = [...d.querySelectorAll('.accSp')].map(x => x.getAttribute('data-sp'));
    r.pages = [...d.querySelectorAll('select.accL')].map(x => x.getAttribute('data-k'));
    /* the junior trainer: only Home and Academy, and inside Academy no Workshop */
    r.s1 = set('*', 'none') && set('@academy', 'def') && set('academy.workshop', 'none');
    d.querySelector('#accSave').click(); await w(100); r.msg1 = d.querySelector('#accMsg').textContent;
    /* the senior shift lead: Academy and HR to look at, Performance, Service Management and Uniforms to work in */
    who('r:shift_lead'); await w(50);
    r.s2 = set('@academy', 'view') && set('@performance', 'edit') && set('@service', 'edit') && set('@uniforms', 'edit') && set('@hr', 'view');
    d.querySelector('#accSave').click(); await w(100);
    /* one person: Cora sees only the FMD schedule, view only; Fred's own FMD board is hidden but he may look at HR's */
    who('u:coach@x.com'); await w(50); r.s3 = set('*', 'none') && set('fmd.schedule', 'view'); d.querySelector('#accSave').click(); await w(100);
    who('u:fmd@x.com'); await w(50); r.s4 = set('dw.hr.board', 'view') && set('dw.fmd.board', 'none'); d.querySelector('#accSave').click(); await w(100);
    r.pol = JSON.parse(localStorage.getItem('totAccessPolicy')).access; return r; });
  ok('one Access management section in the admin menu (the two old sections are inside it)', U.inMenu && U.oldGone, U.modes.join(' | '));
  ok('Access by role: the tool-part ticks per position', U.roleTable);
  ok('Access by spaces and pages: opens with a position chosen and its list shown (never empty)', U.notEmpty);
  ok('it lists every space, also custom spaces', ['academy', 'performance', 'fmd', 'uniforms', 'hr', 'office', 'service', 'projects', 'custom'].every(s => U.spaces.indexOf(s) >= 0), U.spaces.join(','));
  ok('it lists pages, department tabs and the custom space one by one', ['academy.workshop', 'academy.onboarding', 'fmd.employee_requests', 'performance.results', 'dw.fmd.board', 'dw.service.inc', 'dw.hr.life', 'dw.access.board', 'dw.it.board', 'projects.all_projects', 'custom.sNew'].every(k => U.pages.indexOf(k) >= 0), U.pages.length + ' rows');
  ok('positions and people can be set', U.s1 && U.s2 && U.s3 && U.s4 && /Saved/.test(U.msg1));
  ok('saved in the access policy', U.pol.roles.training_coordinator['*'] === 'none' && U.pol.roles.training_coordinator['@academy'] === 'def' && U.pol.roles.shift_lead['@service'] === 'edit' && U.pol.users['coach@x.com']['fmd.schedule'] === 'view', JSON.stringify(U.pol).slice(0, 160));
  const sel = '#accSec .accSp[data-sp="hr"] > summary select.accL', o0 = await A.evaluate(() => document.querySelector('#accSec .accSp[data-sp="hr"]').open);
  await A.click(sel); await A.keyboard.press('Escape'); await A.selectOption(sel, 'view');
  ok('choosing a space level with the mouse does not fold or unfold the space', await A.evaluate((o0) => document.querySelector('#accSec .accSp[data-sp="hr"]').open === o0 && document.querySelector('#accSec .accSp[data-sp="hr"] > summary select').value === 'view', o0));
  ok('the admin-only Setup tab is not listed', U.pages.every(k => !/\.setup$/.test(k)));
  await A.sync();
  ok('the server has it', !!JSON.parse(gas.data().keys.totAccessPolicy.v).access.users['fmd@x.com']);

  console.log('2. Junior trainer: only Home and Academy, no Workshop');
  const T = await H.open({ email: 'tc@x.com', pw: 'pw-tc@x.com' }); await T.setViewportSize({ width: 1440, height: 900 }); await T.sync();
  const tTop = await top(T); ok('top bar: only Academy (Projects and every other space hidden)', tTop.join(',') === 'academy', tTop.join(','));
  const tSub = await sub(T, 'academy'); ok('Academy keeps its pages, without Workshop', tSub.indexOf('academy.onboarding') >= 0 && tSub.indexOf('academy.workshop') < 0, tSub.join(','));
  const tOpen = await T.evaluate(() => { switchView('home'); switchView('exam'); const a = currentView; switchView('schedule'); const b = currentView; switchView('onboarding'); return [a, b, currentView]; });
  ok('Workshop and FMD screens cannot be opened; Onboarding can', tOpen[0] === 'home' && tOpen[1] === 'home' && tOpen[2] === 'onboarding', tOpen.join(','));
  ok('the custom space is hidden for them (all spaces hidden)', await T.evaluate(() => { document.getElementById('moreMenu') && document.body.click(); return !document.querySelector('#moreMenu .csItem'); }));
  const tk = pull('tc@x.com'); ok('server: no schedule, incidents, recruiting or projects data', !tk.totSchedule && !tk.totIncidents && !tk.totRecruitment && !tk.totProjects, Object.keys(tk).join(','));
  await T.context().close();

  console.log('3. Senior shift lead: Academy and HR view only; Performance, Service Management and Uniforms editing');
  const L = await H.open({ email: 'lead@x.com', pw: 'pw-lead@x.com' }); await L.setViewportSize({ width: 1440, height: 900 }); await L.sync();
  const lTop = await top(L); ok('top bar shows Academy, Performance, Service Management, Uniforms and HR', ['academy', 'performance', 'service', 'uniforms', 'hr'].every(s => lTop.indexOf(s) >= 0), lTop.join(','));
  const lSv = await sub(L, 'service'); ok('Service Management board and Incidents are open to them', lSv.indexOf('dw.service.board') >= 0 && lSv.indexOf('dw.service.inc') >= 0, lSv.join(','));
  const lHr = await sub(L, 'hr'); ok('HR: Recruiting is open (view only)', lHr.indexOf('hr.recruiting') >= 0, lHr.join(','));
  const ro = await L.evaluate(async () => { const w = (ms) => new Promise(r => setTimeout(r, ms)); switchView('onboarding'); await w(900); const r = { view: currentView, ro: totAcc.ro(), sro: totSpaceRO(), rib: document.getElementById('accRo').classList.contains('on') };
    const before = localStorage.getItem('totOnboardingHier'); localStorage.setItem('totOnboardingHier', JSON.stringify({ trainers: [{ name: 'hack' }] })); r.blocked = localStorage.getItem('totOnboardingHier') === before;
    switchView('home'); window.__space = 'performance'; DeptOpen('performance', 'board'); await w(900); r.perfRo = totAcc.ro(); localStorage.setItem('zzTest', '1'); r.other = localStorage.getItem('zzTest') === '1'; return r; });
  ok('Academy page opens as View only with the ribbon', ro.view === 'onboarding' && ro.ro && ro.sro && ro.rib, JSON.stringify(ro));
  ok('changes to Academy data are not saved there', ro.blocked);
  ok('in Performance (Edit) the page is not view only', !ro.perfRo && ro.other);
  const lk = pull('lead@x.com'); ok('server: incidents and recruiting are sent (opened by the admin)', !!lk.totIncidents && !!lk.totRecruitment, Object.keys(lk).join(','));
  const lp = push('lead@x.com', { totIncidents: { v: JSON.stringify([{ id: 'i1', title: 'Spill at table 4 (cleaned)' }]), t: Date.now() }, totRecruitment: { v: JSON.stringify({ cands: [] }), t: Date.now() } });
  ok('server: may change incidents (Edit), not recruiting (View only)', lp.denied.indexOf('totRecruitment') >= 0 && lp.denied.indexOf('totIncidents') < 0, JSON.stringify(lp.denied));
  ok('server: recruiting data is untouched', /Nino/.test(gas.data().keys.totRecruitment.v));
  await L.context().close();

  console.log('4. One person: Cora sees only the FMD schedule, view only');
  const C = await H.open({ email: 'coach@x.com', pw: 'pw-coach@x.com' }); await C.setViewportSize({ width: 1440, height: 900 }); await C.sync();
  const cTop = await top(C); ok('top bar: only FMD (her position\'s Performance is hidden for her)', cTop.join(',') === 'fmd', cTop.join(','));
  const cSub = await sub(C, 'fmd'); ok('FMD shows only the Schedule', cSub.join(',') === 'fmd.schedule', cSub.join(','));
  const cp = push('coach@x.com', { totSchedule: { v: JSON.stringify({ week: 'hack' }), t: Date.now() } });
  ok('server: schedule cannot be changed (View only)', cp.denied.indexOf('totSchedule') >= 0);
  ok('server: data of hidden pages is not sent (evaluation results, incidents)', (k => !k.totIncidents && !k.evalResults)(pull('coach@x.com')));
  await C.context().close();

  console.log('5. Boards: Fred may look at HR\'s board; his own FMD board is hidden');
  const fk = JSON.parse(pull('fmd@x.com').totTasks.v).map(t => t.id);
  ok('HR tickets are sent to him, his own board\'s tickets are not', fk.indexOf('t-hr-term') >= 0 && fk.indexOf('t-fmd') < 0, fk.join(','));
  const all = JSON.parse(gas.data().keys.totTasks.v), mod = all.filter(t => fk.indexOf(t.id) >= 0).map(t => t.id === 't-hr-term' ? Object.assign({}, t, { title: 'changed by FMD' }) : t);
  push('fmd@x.com', { totTasks: { v: JSON.stringify(mod), t: Date.now() } });
  ok('server: he cannot change an HR ticket (View only board)', JSON.parse(gas.data().keys.totTasks.v).find(t => t.id === 't-hr-term').title !== 'changed by FMD');
  const F = await H.open({ email: 'fmd@x.com', pw: 'pw-fmd@x.com' }); await F.setViewportSize({ width: 1440, height: 900 }); await F.sync();
  const fTop = await top(F), fHr = await sub(F, 'hr'), fF = await sub(F, 'fmd');
  ok('the HR space appears for him with the board only', fTop.indexOf('hr') >= 0 && fHr.indexOf('dw.hr.board') >= 0 && fHr.indexOf('dw.hr.cand') < 0 && fHr.indexOf('dw.hr.docs') < 0, fHr.join(','));
  ok('his FMD space keeps the schedule but no board', fF.indexOf('fmd.schedule') >= 0 && fF.indexOf('dw.fmd.board') < 0, fF.join(','));
  await F.context().close();

  console.log('6. Nothing set = as before');
  const M = await H.open({ email: 'mgr@x.com', pw: 'pw-mgr@x.com' }); await M.setViewportSize({ width: 1440, height: 900 }); await M.sync();
  const mTop = await top(M); ok('the manager still sees every space', ['academy', 'performance', 'fmd', 'uniforms', 'hr', 'office', 'service', 'projects'].every(s => mTop.indexOf(s) >= 0), mTop.join(','));
  ok('the version is up to date', await M.evaluate(() => window.TOT_VERSION) === '3.39');
  const gi = await M.evaluate(async () => { openGiorgiChat(); await new Promise(r => setTimeout(r, 200)); giorgiChat.ask('how do I hide a space or give view only access'); await new Promise(r => setTimeout(r, 1700)); const rows = [...document.querySelectorAll('#giorgiChat .gc-row')]; return rows[rows.length - 1].textContent; });
  ok('Giorgi explains where to set access', /Access management/.test(gi) && /spaces and pages/.test(gi), gi.slice(0, 80));
  await M.context().close();

  console.log('7. The admin always sees everything; a person can be cleared');
  const aTop = await top(A); ok('admin: every space', aTop.length === 8, aTop.join(','));
  const cl = await A.evaluate(async () => { totAcc.adminDraw('u:coach@x.com'); const d = document.getElementById('accSec'); d.querySelector('#accClear').click(); await new Promise(r => setTimeout(r, 100)); return JSON.parse(localStorage.getItem('totAccessPolicy')).access.users['coach@x.com']; });
  ok('Clear all settings removes the person\'s settings', cl === undefined);

  ok('no page errors', H.errs.length === 0, H.errs.slice(0, 3).join(' | '));
  await H.close();
  console.log('page_access: ' + (fails ? fails + ' FAILED' : 'ALL PASSED'));
  process.exit(fails ? 1 : 0);
})();
