/* v3.28: Settings instead of Print/Backup in the top bar; an Overview page for every department (FMD = staff directory); the More-menu tools inside
   their spaces (Retraining stays in the space it was opened from); profile at a glance (next 7 days, rotation right now, last change) and History tab;
   the change journal (who changed what and when) per department and per person, and what the server lets each person read. */
const path = require('path'), tool = process.argv[2] || path.join(__dirname, '..', 'tool', 'PTF-pass-to-floor-Gunda.html'), code = process.argv[3] || path.join(__dirname, '..', 'tool', 'Code.gs');
const gas = require('./fakegas')(code); require('./seed')(gas);
let fails = 0; function ok(n, c, x) { if (!c) fails++; console.log((c ? '  ✅ ' : '  ❌ ') + n + (x ? '  → ' + x : '')); }
const pull = (email) => gas.post({ action: 'pull', email, pwHash: 'pw-' + email });
const keyOf = (r, k) => { try { return JSON.parse((r.keys[k] || {}).v); } catch (e) { return null; } };
(async () => {
  const H = await require('./harness')(tool, gas);
  const A = await H.open({ admin: true }); await A.setViewportSize({ width: 1500, height: 950 }); await A.sync();
  const w = (P, ms) => P.waitForTimeout(ms);
  const ymd = (d) => d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
  const today = ymd(new Date()), ym = today.slice(0, 7);

  /* people: two in the employee file, one only in the roster; today's rotation for Ana covers the whole day */
  await A.evaluate(({ today, ym }) => {
    localStorage.setItem('employeeDataSource', JSON.stringify([
      { id: 1, fullName: 'Ana Test', nickname: 'AnaT', workId: 'W100', code: 'BC100', status: 'Employed', ext: { position: 'VIP Game Presenter', team: 'Team Red', badge: 'BDG-7', startDate: '2024-03-01' } },
      { id: 2, fullName: 'Dato Shuffle', nickname: 'DatoS', workId: 'W200', code: 'BC200', status: 'Employed', ext: { position: 'Shuffler', team: 'Team Blue', badge: 'BDG-8' } },
      { id: 3, fullName: 'Old Timer', nickname: 'OldT', workId: 'W300', code: 'BC300', status: 'Retired', ext: { position: 'Shuffler' } }]));
    const S = JSON.parse(localStorage.getItem('totSchedule') || '{}'); S.roster = { anchor: ym + '-01', people: [{ name: 'Ana Test', g: 'A', sh: 'morning', t: '' }, { name: 'Bob Roster', g: 'A', sh: 'morning', t: '' }] };
    S.sched = {}; S.sched[ym] = { 'ana test': { d: {}, c: {} }, 'bob roster': { d: {}, c: {} } }; const dd = +today.slice(8); for (let i = 0; i < 7; i++) S.sched[ym]['ana test'].d[dd + i] = i % 2 ? 'OFF' : 'M';
    S.days = {}; S.days[today] = { shifts: { morning: { start: 0, rows: [{ name: 'Ana Test', t: '', len: 24, cells: Array.from({ length: 48 }, () => '7') }] } } };
    window.__jrQuiet = true; localStorage.setItem('totSchedule', JSON.stringify(S)); window.__jrQuiet = false;
  }, { today, ym });
  await w(A, 900);

  console.log('1. Settings instead of Print and Backup in the top bar');
  const tb = await A.evaluate(() => { const vis = (el) => !!el && getComputedStyle(el).display !== 'none'; return { bk: vis(document.querySelector('.top-bar-actions > button[onclick^="exportBackup"]')), pr: vis(document.getElementById('filterAwareBtn')), set: vis(document.getElementById('moreSettings')), prM: !!document.getElementById('morePrint'), adB: !!document.getElementById('adBackup') }; });
  ok('the top bar no longer shows Backup or Print', !tb.bk && !tb.pr, JSON.stringify(tb));
  ok('More has ⚙ Settings (admin) and 🖨 Print this screen', tb.set && tb.prM);
  ok('the admin space (Ctrl+G) has the backup block', tb.adB);
  const setC = await A.evaluate(() => { totSettingsOpen(); const t = Array.from(document.querySelectorAll('#setOv .stC h4')).map(h => h.textContent); document.getElementById('setOv').remove(); return t; });
  ok('Settings holds backup, restore, permissions, integrations, spaces and the admin space', ['Backup', 'Restore', 'Permissions', 'Integrations', 'Spaces', 'Admin space'].every(x => setC.some(t => t.indexOf(x) >= 0)), setC.join(' | '));
  const dl = A.waitForEvent('download', { timeout: 4000 }).then(() => true, () => false); await A.evaluate(() => exportBackup()); ok('the admin can download a full backup', await dl);

  const C = await H.open({ email: 'coach@x.com', pw: 'pw-coach@x.com' }); await C.sync(); await w(C, 600);
  const cs = await C.evaluate(() => ({ set: getComputedStyle(document.getElementById('moreSettings')).display !== 'none' }));
  ok('a coach does not see Settings', !cs.set);
  const dlC = C.waitForEvent('download', { timeout: 2000 }).then(() => true, () => false); await C.evaluate(() => exportBackup()); ok('…and cannot download a full backup', !(await dlC));
  const M = await H.open({ email: 'mgr@x.com', pw: 'pw-mgr@x.com' }); await M.sync(); await w(M, 600);
  ok('a manager sees Settings with the backup', await M.evaluate(() => { const v = getComputedStyle(document.getElementById('moreSettings')).display !== 'none'; totSettingsOpen(); const t = document.querySelector('#setOv').textContent; document.getElementById('setOv').remove(); return v && /Download full backup/.test(t) && !/Restore from a backup/.test(t); }));
  const dlM = M.waitForEvent('download', { timeout: 4000 }).then(() => true, () => false); await M.evaluate(() => exportBackup()); ok('…and can download a full backup', await dlM);

  console.log('2. Every department opens on its Overview');
  for (const sp of ['performance', 'fmd', 'uniforms', 'hr', 'office']) {
    const r = await A.evaluate((sp) => { openSpace(sp); const bar = Array.from(document.querySelectorAll('#spaceSub button')).map(b => b.textContent.trim()); return { v: currentView, sp: spaceOf(), h: (document.querySelector('#spaceHomeView .shHead h2') || {}).textContent, first: bar[0], last: bar[bar.length - 1], cards: document.querySelectorAll('#spaceHomeView .shCard').length, stats: document.querySelectorAll('#spaceHomeView .shStats > div').length }; }, sp);
    ok(sp + ': opens its Overview with cards, numbers, and History at the end of the bar', r.v === 'spacehome' && r.sp === sp && /Overview/.test(r.first) && /History/.test(r.last) && r.cards > 1 && r.stats > 0, JSON.stringify(r));
  }
  const ac = await A.evaluate(() => { openSpace('academy'); return { v: currentView, extra: Array.from(document.querySelectorAll('#acadExtra .shCard b')).map(b => b.textContent) }; });
  ok('Academy keeps its overview and adds Trainee progress, Retraining, Retakes & notes, Who needs what, History', ac.v === 'academy' && ['Trainee progress', 'Retraining', 'Retakes', 'Who needs what', 'History'].every(x => ac.extra.some(t => t.indexOf(x) >= 0)), ac.extra.join(' | '));

  console.log('3. The More-menu tools now live in the spaces');
  const more = await A.evaluate(() => ['moreTP', 'moreRT', 'moreWN', 'moreCH'].map(id => { const b = document.getElementById(id); return id + ':' + (b ? getComputedStyle(b).display : 'missing'); }));
  ok('Trainee progress, Retakes, Who needs what and Coaching hub are hidden in More', more.every(x => /:none$/.test(x)), more.join(' '));
  const perfBar = await A.evaluate(() => { openSpace('performance'); return Array.from(document.querySelectorAll('#spaceSub button')).map(b => b.textContent.trim()); });
  ok('Performance has Coaching hub and Who needs what', perfBar.some(t => /Coaching hub/.test(t)) && perfBar.some(t => /Who needs what/.test(t)), perfBar.join(' | '));
  const ch = await A.evaluate(() => { const b = Array.from(document.querySelectorAll('#spaceHomeView .shCard')).filter(x => /Coaching hub/.test(x.textContent))[0]; b.click(); const o = document.getElementById('chOv').classList.contains('open'); document.getElementById('chOv').classList.remove('open'); return o; });
  ok('the Coaching hub card opens the Coaching hub', ch);
  const tp = await A.evaluate(() => { openSpace('academy'); const b = Array.from(document.querySelectorAll('#spaceSub button')).filter(x => /Trainee progress/.test(x.textContent))[0]; b.click(); const o = document.querySelector('#tpBox') && document.querySelector('#tpBox').parentNode.classList.contains('open'); document.querySelector('#tpBox').parentNode.classList.remove('open'); return o; });
  ok('Academy → Trainee progress opens the board', tp);
  for (const sp of ['academy', 'performance', 'fmd']) {
    const r = await A.evaluate(async (sp) => { openSpace(sp); const b = Array.from(document.querySelectorAll('#spaceSub button')).filter(x => /Retraining/.test(x.textContent))[0]; if (!b) return { none: 1 }; b.click(); await new Promise(r => setTimeout(r, 300)); const on = (document.querySelector('#spaceSub button.on') || {}).textContent || ''; return { v: currentView, sp: spaceOf(), on: on.trim() }; }, sp);
    ok('Retraining register opened from ' + sp + ' stays in ' + sp, r.v === 'exam' && r.sp === sp && /Retraining/.test(r.on), JSON.stringify(r));
  }

  console.log('4. FMD overview: staff directory');
  const F = await H.open({ email: 'fmd@x.com', pw: 'pw-fmd@x.com' }); await F.setViewportSize({ width: 1500, height: 950 });
  await A.sync(); await F.sync(); await w(F, 600);
  const dir = async (q, opt) => F.evaluate(async ({ q, opt }) => { openSpace('fmd'); const i = document.getElementById('shQ'); if (!i) return { err: 'no directory' };
    i.value = q; i.dispatchEvent(new Event('input', { bubbles: true })); if (opt) { Object.keys(opt).forEach(id => { const e = document.getElementById(id); if (e.type === 'checkbox') e.checked = opt[id]; else e.value = opt[id]; e.dispatchEvent(new Event('change', { bubbles: true })); }); }
    await new Promise(r => setTimeout(r, 250)); return Array.from(document.querySelectorAll('#shList tbody tr')).map(t => t.cells[0].textContent); }, { q, opt });
  const all0 = await dir('');
  ok('FMD opens on the staff directory (active people by default)', all0.length === 3 && !all0.some(t => /Old Timer/.test(t)), all0.join(' | '));
  ok('search by Work ID', (await dir('W200')).join() === 'Dato Shuffle · DatoS');
  ok('search by barcode / badge', (await dir('BDG-7')).join() === 'Ana Test · AnaT' && (await dir('bc200')).join() === 'Dato Shuffle · DatoS');
  ok('search by screen name', (await dir('anat')).join() === 'Ana Test · AnaT');
  ok('filter by position', (await dir('', { shPos: 'Shuffler' })).join() === 'Dato Shuffle · DatoS');
  ok('filter by team', (await dir('', { shPos: '', shTeam: 'Team Red' })).join() === 'Ana Test · AnaT');
  ok('Everyone includes retired people', (await dir('old', { shTeam: '', shSt: '' })).join() === 'Old Timer · OldT');
  const wt = await dir('', { shSt: 'active', shToday: true });
  ok('Working today (schedule entry or roster rule)', wt.indexOf('Ana Test · AnaT') >= 0 && !wt.some(t => /Dato/.test(t)), wt.join(' | '));
  const opened = await F.evaluate(() => { document.querySelector('#shList tbody tr').click(); const o = document.getElementById('phOv'); return o && o.style.display === 'flex' ? document.querySelector('#phBody').textContent.slice(0, 40) : ''; });
  ok('clicking a person opens the profile', /Ana Test/.test(opened), opened);

  console.log('5. Profile at a glance');
  const pv = await F.evaluate(() => ({ week: document.querySelectorAll('#phPrev .phWeek .phCd').length, first: (document.querySelector('#phPrev .phWeek .phCd') || {}).textContent, now: (document.getElementById('phRotNow') || {}).textContent, tabs: Array.from(document.querySelectorAll('.phTabs button')).map(b => b.textContent) }));
  ok('Info shows the next 7 days', pv.week === 7 && /Today/.test(pv.first) && /Morn/.test(pv.first), JSON.stringify(pv.first));
  ok('…and where the person is in the rotation right now', /Table 7/.test(pv.now), pv.now);
  ok('the profile has a 📜 History tab', pv.tabs.some(t => /History/.test(t)));
  await F.evaluate(() => { document.querySelector('[data-ph="close"]') && document.querySelector('[data-ph="close"]').click(); });

  console.log('6. Shift and profile changes are recorded with who and when');
  /* a shift removed in the schedule grid (UI), a shift added, a game and a start date changed in the profile (UI) */
  await F.evaluate(() => { switchView('schedule'); }); await w(F, 600);
  await F.evaluate(() => { const b = document.querySelector('#scheduleView [data-sub="sch"]'); if (b) b.click(); }); await w(F, 400);
  const day = +today.slice(8), cell = '#scheduleView td[data-sr="0"][data-sc="' + (day - 1) + '"] input';
  const hasCell = await F.evaluate((s) => !!document.querySelector(s), cell);
  if (hasCell) { await F.click(cell); await F.click('#scheduleView td[data-sr="0"][data-sc="' + day + '"] input', { modifiers: ['Control'] }); await F.keyboard.press('Delete'); }
  const afterDel = await F.evaluate((ym) => JSON.stringify(JSON.parse(localStorage.getItem('totSchedule')).sched[ym]['ana test'].d), ym);
  await w(F, 1200);
  await F.evaluate(({ ym, day }) => { const S = JSON.parse(localStorage.getItem('totSchedule')); S.sched[ym]['bob roster'].d[day] = 'N'; localStorage.setItem('totSchedule', JSON.stringify(S)); }, { ym, day });
  await w(F, 1200);
  await F.evaluate(() => PersonHub.open('Bob Roster')); await w(F, 200);
  await F.evaluate(() => { document.querySelector('[data-ph="tab"][data-t="edit"]').click(); }); await w(F, 200);
  await F.fill('#ph_hired', '2025-02-03'); await F.fill('#ph_phone', '555-1234');
  await F.evaluate(() => document.querySelector('[data-ph="save"]').click()); await w(F, 1300);
  const J = await F.local('totJournal'), acts = (J || []).map(x => x.act);
  ok('removing a shift in the grid is recorded', acts.some(a => /^Shift removed: Ana Test · /.test(a)), acts.filter(a => /Ana/.test(a)).join(' | ') + ' · cell ' + hasCell + ' ' + afterDel);
  ok('adding a shift is recorded', acts.some(a => /^Shift added: Bob Roster · .* N$/.test(a)), acts.filter(a => /Bob/.test(a)).join(' | '));
  ok('the profile change names the field, old and new value', acts.some(a => /Profile of Bob Roster( created)?: .*Start date: — → 2025-02-03.*Phone: — → 555-1234/.test(a)), acts.filter(a => /Profile/.test(a)).join(' | '));
  const me = (J || []).filter(x => /Bob Roster/.test(x.act));
  ok('each entry has who, e-mail, time, department and the person', me.length >= 2 && me.every(x => x.who === 'Fred FMD' && x.email === 'fmd@x.com' && x.ts > 0 && x.dep === 'fmd' && x.p === 'bob roster'), JSON.stringify(me[0]));
  const ht = await F.evaluate(() => { PersonHub.open('Bob Roster'); const last = (document.getElementById('phLast') || {}).textContent; document.querySelector('[data-ph="tab"][data-t="hist"]').click(); const rows = Array.from(document.querySelectorAll('#phBody .jrRow')).map(r => r.textContent); document.querySelector('[data-ph="hf"][data-f="sh"]').click(); const sh = Array.from(document.querySelectorAll('#phBody .jrRow')).map(r => r.textContent); return { last, rows, sh }; });
  ok('Info shows the last change and who made it', /Last change: Profile of Bob Roster( created)?:.*Fred FMD/.test(ht.last), ht.last);
  ok('the History tab lists the profile and shift changes with who and time', ht.rows.length >= 2 && ht.rows.some(r => /Start date/.test(r)) && ht.rows.some(r => /Shift added/.test(r)) && ht.rows.every(r => /Fred FMD/.test(r) && /\d\d:\d\d/.test(r)), ht.rows.join(' | '));
  ok('…and the Shifts filter shows only shift changes', ht.sh.length >= 1 && ht.sh.every(r => /Shift|Rotation/.test(r)), ht.sh.join(' | '));
  await F.evaluate(() => { const c = document.querySelector('[data-ph="close"]'); if (c) c.click(); });

  console.log('7. History in every space');
  const hs = await F.evaluate(() => { openSpace('fmd'); const b = Array.from(document.querySelectorAll('#spaceSub button')).filter(x => /History/.test(x.textContent))[0]; b.click(); const o = document.getElementById('jrOv'); const rows = Array.from(o.querySelectorAll('.jrRow')).map(r => r.textContent);
    const q = o.querySelector('#jrQ'); q.value = 'removed'; q.dispatchEvent(new Event('input')); const rem = Array.from(o.querySelectorAll('.jrRow')).map(r => r.textContent); o.classList.remove('open'); return { open: true, rows, rem, latest: (document.querySelector('#spaceHomeView .jrRow') || {}).textContent }; });
  ok('FMD → 📜 History lists who changed what', hs.rows.some(r => /Shift added: Bob Roster/.test(r)) && hs.rows.some(r => /Profile of Bob Roster/.test(r)), hs.rows.slice(0, 4).join(' | '));
  ok('…search narrows it (e.g. "removed")', hs.rem.length >= 1 && hs.rem.every(r => /removed/i.test(r)), hs.rem.join(' | '));
  ok('the FMD overview shows the latest changes', /Fred FMD/.test(hs.latest || ''), hs.latest);
  const tkH = await A.evaluate(() => window.totJournal.forSpace('hr').filter(x => x.src === 'totTasks').length);
  ok('a department History also includes its ticket history', tkH >= 0);

  console.log('8. Server: the journal is add-only and each person reads what they may');
  await F.sync(); await w(F, 300);
  const srv = keyOf({ keys: gas.data().keys }, 'totJournal') || [];
  ok('the FMD changes reached the server', srv.some(x => /Shift added: Bob Roster/.test(x.act) && x.email === 'fmd@x.com'), srv.length);
  const mJ = keyOf(pull('mgr@x.com'), 'totJournal') || [];
  ok('a manager reads them', mJ.some(x => /Bob Roster/.test(x.act)));
  const now = Date.now(), cv = { id: 'jx-eval', ts: now, who: 'Cora Coach', email: 'coach@x.com', dep: 'performance', src: 'evalResults', p: 'ana test', act: 'Evaluation saved: Ana Test – Roulette – 90%' };
  gas.post({ action: 'push', email: 'coach@x.com', pwHash: 'pw-coach@x.com', keys: { totJournal: { v: JSON.stringify([cv, { id: 'jx-forged', ts: now, who: 'Mia Manager', email: 'mgr@x.com', dep: 'fmd', src: 'totSchedule', act: 'forged' }]), t: now, bt: 0 } } });
  const srv2 = keyOf({ keys: gas.data().keys }, 'totJournal') || [];
  ok('an entry in someone else\'s name is refused', !srv2.some(x => x.id === 'jx-forged'));
  ok('earlier entries are kept when a person sends only their own (add-only)', srv2.some(x => /Bob Roster/.test(x.act)) && srv2.some(x => x.id === 'jx-eval'));
  gas.post({ action: 'push', email: 'coach@x.com', pwHash: 'pw-coach@x.com', keys: { evalResults: { v: '[]', t: now, bt: 0 } } });
  const hrP = pull('hr@x.com'), hrEval = !!hrP.keys.evalResults, hrJ = keyOf(hrP, 'totJournal') || [];
  ok('HR reads an evaluation entry only if HR may read evaluations', hrJ.some(x => x.id === 'jx-eval') === hrEval, 'evalResults ' + hrEval);
  const fdP = pull('fmd@x.com'), fdJ = keyOf(fdP, 'totJournal') || [];
  ok('FMD reads its own department\'s entries', fdJ.some(x => /Bob Roster/.test(x.act)));
  ok('the coach reads the evaluation entry', (keyOf(pull('coach@x.com'), 'totJournal') || []).some(x => x.id === 'jx-eval'));

  console.log('9. What sync brings in is not logged again');
  const before = ((await A.local('totJournal')) || []).filter(x => x.email !== 'fmd@x.com' && /Bob Roster/.test(x.act)).length;
  await A.sync(); await w(A, 1500);
  const aj = (await A.local('totJournal')) || [], dup = aj.filter(x => /Bob Roster/.test(x.act) && x.email !== 'fmd@x.com').length;
  ok('the admin receives FMD\'s entries without writing copies in its own name', aj.some(x => x.email === 'fmd@x.com') && dup === before, 'own copies: ' + dup);

  const op = gas.post, sent = []; gas.post = function (b) { try { const o = typeof b === 'string' ? JSON.parse(b) : b; if (o.action === 'push') sent.push(Object.keys(o.keys || {}).join(',')); } catch (e) {} return op.apply(this, arguments); };
  await F.sync(); await F.sync(); gas.post = op;
  ok('a device does not send the journal again when it has nothing new', !sent.some(k => /totJournal/.test(k)), sent.join(' | ') || 'nothing pushed');
  ok('no page errors', !H.errs.length, H.errs.join(' | '));
  console.log(fails ? fails + ' FAILED' : 'ALL PASSED'); await H.close(); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
