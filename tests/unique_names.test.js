/* v3.30 One nickname = one person, one full name = one person (repeats get a number), in Onboarding (typing, paste, import) and in the employee file;
   only the admin can switch either rule off (admin space, Settings); the server refuses the rule from anyone else. */
const path = require('path'), tool = process.argv[2] || path.join(__dirname, '..', 'tool', 'PTF-pass-to-floor-Gunda.html'), code = process.argv[3] || path.join(__dirname, '..', 'tool', 'Code.gs');
const gas = require('./fakegas')(code); require('./seed')(gas);
let fails = 0; function ok(n, c, x) { if (!c) fails++; console.log((c ? '  ✅ ' : '  ❌ ') + n + (x ? '  → ' + x : '')); }
const T = (pid, fn, ln, nick) => ({ vals: {}, x: {}, tpl: {}, personalId: pid, firstName: fn, lastName: ln, nickname: nick || '', startDate: '2026-10-05' });
(async () => {
  const H = await require('./harness')(tool, gas);
  const d0 = gas.data(); d0.keys.totOnboardingHier = { v: JSON.stringify({ v: 1, trainers: [{ id: 'trainer_a', name: 'Tina Trainer', email: '', archived: false, onboardings: [] }] }), t: Date.now() };
  d0.keys.employeeDataSource = { v: JSON.stringify([{ id: 1, fullName: 'Georgi Kakadze', nickname: 'James', workId: 'W1', code: 'W1', status: 'Employed', ext: { position: 'Shuffler' } }, { id: 2, fullName: 'Mari Test', nickname: 'Mari', workId: 'W2', code: 'W2', status: 'Employed', ext: { position: 'Shuffler' } }]), t: Date.now() };
  gas.setData(d0);
  const A = await H.open({ admin: true }); await A.setViewportSize({ width: 1500, height: 950 }); await A.sync(); await A.reload(); await A.waitForTimeout(1200);
  const w = (ms) => A.waitForTimeout(ms);
  /* an older group (Nino Beridze, "Nina") and the group we work in, both created through the screens */
  const mk = (name) => A.evaluate(async (name) => { const w = (ms) => new Promise(r => setTimeout(r, ms)), q = (s) => document.querySelector(s);
    switchView('onboarding'); await w(300); q('#obBrowser [data-t="trainer_a"] [data-x="openT"]').click(); await w(200); q('#obBrowser [data-x="newO"]').click(); await w(200);
    q('#sName').value = name; q('#sTrack').value = 'GP'; q('#sDate').value = '2026-10-05'; q('#sDays').value = '5'; q('#sGo').click(); await w(800);
    const H0 = JSON.parse(localStorage.getItem('totOnboardingHier')); return H0.trainers[0].onboardings.filter(o => o.name === name)[0].id; }, name);
  const g1 = await mk('GP September'), g2 = await mk('GP October');
  await A.evaluate(async ([g1, g2, t1, t2]) => { const H0 = JSON.parse(localStorage.getItem('totOnboardingHier')); H0.trainers[0].onboardings.forEach(o => { if (o.id === g1) o.ws.trainees = t1; if (o.id === g2) o.ws.trainees = t2; o.updated = Date.now(); });
    localStorage.setItem('totOnboardingHier', JSON.stringify(H0)); localStorage.removeItem('totOnboardingV2'); location.reload(); }, [g1, g2, [T('P1', 'Nino', 'Beridze', 'Nina')], [T('P10', 'Ana', 'Lomidze'), T('P11', 'Luka', 'Gelashvili')]]);
  await w(1500);
  const openG = () => A.evaluate(async (g2) => { const w = (ms) => new Promise(r => setTimeout(r, ms)), q = (s) => document.querySelector(s);
    switchView('onboarding'); await w(300); const t = q('#obBrowser [data-t="trainer_a"] [data-x="openT"]'); if (t) { t.click(); await w(200); } const o = q('#obBrowser [data-o="' + g2 + '"] [data-x="openO"]'); if (o) { o.click(); await w(400); }
    const b = Array.from(document.querySelectorAll('#obTabs button')).filter(b => b.dataset.s === 'Information')[0]; if (b) { b.click(); await w(200); } }, g2);
  await openG();
  const col = (label) => A.evaluate((label) => { const h = Array.from(document.querySelectorAll('#obGrid tr:first-child td')).filter(td => td.textContent.trim() === label)[0]; return h ? +h.getAttribute('data-c') : -1; }, label);
  const cN = await col('Nickname'), cF = await col('First Name'), cL = await col('Last Name');
  const type = async (r, c, v) => { await A.click('#obGrid td[data-r="' + r + '"][data-c="' + c + '"]'); await A.keyboard.press('Delete'); await w(100); await A.click('#obGrid td[data-r="' + r + '"][data-c="' + c + '"]'); await A.keyboard.type(v); await A.keyboard.press('Enter'); await w(400); };
  const tr = () => A.evaluate((g2) => { const H0 = JSON.parse(localStorage.getItem('totOnboardingHier')); return H0.trainers[0].onboardings.filter(o => o.id === g2)[0].ws.trainees.map(t => [t.firstName, t.lastName, t.nickname || ''].join('|')); }, g2);
  const said = () => A.evaluate(() => (document.getElementById('obUqMsg') || {}).textContent || '');
  ok('the Information sheet has Nickname, First Name and Last Name columns', cN >= 0 && cF >= 0 && cL >= 0, [cN, cF, cL].join());

  console.log('1. Nicknames: one nickname, one person');
  await type(1, cN, 'James');
  ok('"James" (Georgi Kakadze in the employee list) is not saved', (await tr())[0] === 'Ana|Lomidze|' && /Not saved\. The nickname "James" is already used by Georgi Kakadze \(employee list \(Employed\)\)/.test(await said()), (await tr())[0] + ' · ' + await said());
  await type(1, cN, 'nina');
  ok('"nina" (Nino Beridze in another group, any capitalisation) is not saved', (await tr())[0] === 'Ana|Lomidze|' && /Nino Beridze \(onboarding "GP September"\)/.test(await said()), await said());
  await type(1, cN, 'Annie');
  ok('a free nickname is saved', (await tr())[0] === 'Ana|Lomidze|Annie');
  await type(2, cN, 'Annie');
  ok('the same nickname twice in one group is not saved', (await tr())[1] === 'Luka|Gelashvili|' && /this group, row 1/.test(await said()), await said());
  await type(1, cN, 'Annie');
  ok('a person keeps their own nickname when it is typed again', (await tr())[0] === 'Ana|Lomidze|Annie');

  console.log('2. Full names: repeats get a number');
  await type(2, cF, 'Georgi');
  ok('first name changed (Georgi Gelashvili is free)', (await tr())[1] === 'Georgi|Gelashvili|');
  await type(2, cL, 'Kakadze');
  ok('"Georgi Kakadze" exists in the employee list: saved as "Georgi Kakadze 1" (after the trainer agrees)', (await tr())[1] === 'Georgi|Kakadze 1|' && /Saved as "Georgi Kakadze 1"/.test(await said()), (await tr())[1] + ' · ' + await said());
  const paste = (txt) => A.evaluate((txt) => { const dt = new DataTransfer(); dt.setData('text/plain', txt); document.getElementById('obPaste').dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true })); }, txt);
  await paste('Personal ID\tLast Name\tFirst Name\tNickname\nP20\tKakadze\tGeorgi\tJames\nP1\tBeridze\tNino\tNina\nP21\tLomidze\tAna\tZed'); await w(800);
  const t3 = await tr();
  ok('an imported third Georgi Kakadze becomes "Georgi Kakadze 2" and the taken nickname is left empty', t3.indexOf('Georgi|Kakadze 2|') >= 0, t3.join(' ; '));
  ok('the same person moving from another group (same Personal ID) keeps name and nickname', t3.indexOf('Nino|Beridze|Nina') >= 0, t3.join(' ; '));
  ok('a second Ana Lomidze in this group becomes "Ana Lomidze 1"', t3.indexOf('Ana|Lomidze 1|Zed') >= 0, t3.join(' ; '));
  ok('the import says what it changed', /numbered: .*Georgi Kakadze → Georgi Kakadze 2/.test(await said()) && /"James" \(Georgi Kakadze 2\)/.test(await said()), await said());

  console.log('3. The employee file (profile edit)');
  const pe = await A.evaluate(async () => { const w = (ms) => new Promise(r => setTimeout(r, ms)); PersonHub.open('Mari Test'); document.querySelector('[data-ph="tab"][data-t="edit"]').click(); await w(150);
    document.getElementById('ph_nickname').value = 'James'; document.querySelector('[data-ph="save"]').click(); await w(300);
    const e = JSON.parse(localStorage.getItem('employeeDataSource')).filter(x => x.workId === 'W2')[0]; const t = Array.from(document.querySelectorAll('.tot-toast,.shell-toast,#toast,[class*="toast"]')).map(x => x.textContent).join(' | '); document.querySelector('[data-ph="close"]').click(); return { nick: e.nickname, t }; });
  ok('a nickname already used by someone else is not saved in the employee file', pe.nick === 'Mari', JSON.stringify(pe).slice(0, 200));

  console.log('4. Only the admin switches the rules off');
  const blk = await A.evaluate(() => { const b = document.getElementById('uqAdmin'); return b ? Array.from(b.querySelectorAll('label')).map(l => l.textContent.trim() + ':' + l.querySelector('input').checked) : null; });
  ok('the admin space has both switches, on by default', blk && blk.join() === 'One nickname per person:true,One full name per person (repeats get a number):true', JSON.stringify(blk));
  const st = await A.evaluate(async () => { totSettingsOpen(); await new Promise(r => setTimeout(r, 50)); document.querySelector('#moreSettings') && 0; const has = !!document.querySelector('#setOv'); document.getElementById('setOv') && document.getElementById('setOv').remove(); return has; });
  const st2 = await A.evaluate(async () => { document.getElementById('moreSettings').click(); await new Promise(r => setTimeout(r, 80)); const has = !!document.querySelector('#setOv #uqSet'); document.getElementById('setOv') && document.getElementById('setOv').remove(); return has; });
  ok('…and Settings has them too', st && st2);
  await A.evaluate(() => { const i = document.querySelector('#uqAdmin input[data-uq="nick"]'); i.checked = false; i.dispatchEvent(new Event('change', { bubbles: true })); });
  ok('the admin switches unique nicknames off', (await A.local('totUniqRules') || {}).nick === false && (await A.local('totUniqRules')).name === true);
  await openG(); 
  await type(2, cN, 'James');
  ok('with the rule off, "James" can be used again', (await tr())[1] === 'Georgi|Kakadze 1|James', (await tr())[1]);
  const rep = await A.evaluate(() => { totUniq.showReport(); const t = document.getElementById('uqRep').textContent; document.getElementById('uqRep').remove(); return t; });
  ok('"Find duplicates" lists James (2 people) and Ana Lomidze is not a duplicate', /James · 2 people/.test(rep) && !/Ana Lomidze ·/.test(rep), rep.slice(0, 200));
  await A.sync();
  const M = await H.open({ email: 'mgr@x.com', pw: 'pw-mgr@x.com' }); await M.sync(); await M.waitForTimeout(500);
  const mr = await M.evaluate(() => ({ r: totUniq.rules(), set: totUniq.setRules({ nick: true }), after: totUniq.rules().nick }));
  ok('a manager receives the rule but cannot change it', mr.r.nick === false && mr.set === false && mr.after === false, JSON.stringify(mr));
  const before = gas.data().keys.totUniqRules.v;
  const res = gas.post({ action: 'push', email: 'mgr@x.com', pwHash: 'pw-mgr@x.com', keys: { totUniqRules: { v: JSON.stringify({ nick: true, name: true }), t: Date.now(), bt: gas.data().keys.totUniqRules.t } } });
  ok('the server refuses the rule from anyone but the admin', gas.data().keys.totUniqRules.v === before && (res.denied || []).indexOf('totUniqRules') >= 0, JSON.stringify(res.denied));
  await A.evaluate(() => { const i = document.querySelector('#uqAdmin input[data-uq="name"]'); i.checked = false; i.dispatchEvent(new Event('change', { bubbles: true })); });
  await openG();
  await type(1, cL, 'Kakadze'); await type(1, cF, 'Georgi');
  ok('with the name rule off too, another plain "Georgi Kakadze" is saved', (await tr())[0] === 'Georgi|Kakadze|Annie', (await tr())[0]);

  ok('no page errors', !H.errs.length, H.errs.join(' | '));
  console.log(fails ? fails + ' FAILED' : 'ALL PASSED'); await H.close(); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
