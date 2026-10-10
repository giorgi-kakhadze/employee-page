/* v3.29 Service Management department: the space and its pages (Overview, Incidents, Jira import, Reports, Board, History), the Jira CSV import
   (column guessing, employee matching, re-import updates by key and keeps the local note, undo), logging an incident by hand, reports, the 360 view,
   and the server rules (service managers write, performance coaches only read, HR receives nothing). */
const path = require('path'), tool = process.argv[2] || path.join(__dirname, '..', 'tool', 'PTF-pass-to-floor-Gunda.html'), code = process.argv[3] || path.join(__dirname, '..', 'tool', 'Code.gs');
const gas = require('./fakegas')(code); require('./seed')(gas);
let fails = 0; function ok(n, c, x) { if (!c) fails++; console.log((c ? '  ✅ ' : '  ❌ ') + n + (x ? '  → ' + x : '')); }
const pull = (email) => gas.post({ action: 'pull', email, pwHash: 'pw-' + email });
const keyOf = (r, k) => { try { return JSON.parse((r.keys[k] || {}).v); } catch (e) { return null; } };
/* a service manager joins */
gas.addUser('svc@x.com', 'pw-svc@x.com', 'Sandro Service');
(function () { const d = gas.data(), p = JSON.parse(d.keys.totAccessPolicy.v); p.users['svc@x.com'] = { role: 'service_manager', name: 'Sandro Service', sites: ['main'] }; d.keys.totAccessPolicy = { v: JSON.stringify(p), t: Date.now() }; gas.setData(d); })();
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'], now = new Date();
const jd = (d, t) => ('0' + d.getDate()).slice(-2) + '/' + MON[d.getMonth()] + '/' + String(d.getFullYear()).slice(2) + ' ' + t;
const iso = (d) => d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
const today = iso(now);
const HEAD = 'Issue key,Summary,Status,Priority,Created,Reporter,Custom field (Game presenter),Custom field (Game),Custom field (Table),Labels,Custom field (Mistake type),Description';
const csv1 = [HEAD,
  'SM-1,"Burned two cards, game resumed",In Progress,High,' + jd(now, '2:15 PM') + ',Sandro Service,ANAT,Blackjack,BJ 3,gp,Procedural mistake,"Burned two cards instead of one."',
  'SM-2,Wrong payout,Open,Medium,' + jd(now, '9:05 AM') + ',Sandro Service,Dato Shuffle,Roulette,RL 1,gp,Wrong result / payout,Paid 35 instead of 17',
  'SM-3,Late to the table,Done,Low,' + jd(now, '11:40 PM') + ',Sandro Service,Ghost Person,Baccarat,BC 2,gp,Behaviour,',
  'SM-4,Bad date row,Open,Low,someday,Sandro Service,ANAT,Blackjack,BJ 3,gp,Procedural mistake,',
  'SM-1,"Burned two cards, game resumed",In Progress,High,' + jd(now, '2:15 PM') + ',Sandro Service,ANAT,Blackjack,BJ 3,gp,Procedural mistake,dup'].join('\n');
(async () => {
  const H = await require('./harness')(tool, gas);
  const A = await H.open({ admin: true }); await A.setViewportSize({ width: 1500, height: 950 }); await A.sync();
  await A.evaluate(() => localStorage.setItem('employeeDataSource', JSON.stringify([
    { id: 1, fullName: 'Ana Test', nickname: 'AnaT', workId: 'W100', code: 'BC100', status: 'Employed', ext: { position: 'VIP Game Presenter' } },
    { id: 2, fullName: 'Dato Shuffle', nickname: 'DatoS', workId: 'W200', code: 'BC200', status: 'Employed', ext: { position: 'Shuffler' } }])));
  await A.sync();

  console.log('1. The Service Management department');
  const S = await H.open({ email: 'svc@x.com', pw: 'pw-svc@x.com' }); await S.setViewportSize({ width: 1500, height: 950 }); await S.sync(); await S.waitForTimeout(1600);
  await S.evaluate(() => switchView('home')); await S.waitForTimeout(400);
  const nav = await S.evaluate(() => ({ btn: getComputedStyle(document.getElementById('navService')).display !== 'none', others: ['navPerformance', 'navHr', 'navOffice'].filter(id => { const b = document.getElementById(id); return b && getComputedStyle(b).display !== 'none'; }), hero: (document.querySelector('#homeView .home-hero h1') || {}).textContent, qa: Array.from(document.querySelectorAll('#qaRow button')).map(b => b.textContent) }));
  ok('a service manager sees the 🚨 Service button (and not the other departments)', nav.btn && !nav.others.length, JSON.stringify(nav.others));
  ok('Home greets them as Service Management with its shortcuts', /Service Management/.test(nav.hero || '') && ['Incidents', 'Jira import', 'Service reports'].every(x => nav.qa.some(t => t.indexOf(x) >= 0)), nav.hero + ' | ' + nav.qa.join(', '));
  const sp = await S.evaluate(() => { openSpace('service'); return { v: currentView, sp: spaceOf(), bar: Array.from(document.querySelectorAll('#spaceSub button')).map(b => b.textContent.trim()), h: (document.querySelector('#spaceHomeView .shHead h2') || {}).textContent, stats: Array.from(document.querySelectorAll('#spaceHomeView .shStats small')).map(x => x.textContent) }; });
  ok('Service opens on its Overview', sp.v === 'spacehome' && sp.sp === 'service' && /Service Management/.test(sp.h), JSON.stringify(sp.h));
  ok('the second bar: Overview · Incidents · Jira import · Reports · Board · Dashboard · Documents · Work types · History', ['Overview', 'Incidents', 'Jira import', 'Reports', 'Board', 'Dashboard', 'Documents', 'Work types', 'History'].every((x, i) => sp.bar[i] && sp.bar[i].indexOf(x) >= 0), sp.bar.join(' | '));
  ok('the Overview shows the incident numbers', ['Incidents this month', 'Open incidents', 'With 3+ this month', 'Last Jira import'].every(x => sp.stats.indexOf(x) >= 0), sp.stats.join(' | '));

  console.log('2. Jira import');
  const dates = await S.evaluate(() => ['07/Oct/26 2:15 PM', '2026-10-07 14:15', '07.10.2026 09:30', 'Oct 7, 2026 11:05 PM', '31/02/2026', '12/Oct/26 12:05 AM'].map(v => JSON.stringify(__incDate(v))));
  ok('Jira date formats are understood', dates.join(' ') === '{"date":"2026-10-07","time":"14:15"} {"date":"2026-10-07","time":"14:15"} {"date":"2026-10-07","time":"09:30"} {"date":"2026-10-07","time":"23:05"} null {"date":"2026-10-12","time":"00:05"}', dates.join(' '));
  await S.evaluate(() => DeptOpen('service', 'jira')); await S.waitForTimeout(300);
  await S.setInputFiles('#incFile', [{ name: 'jira-export.csv', mimeType: 'text/csv', buffer: Buffer.from(csv1) }]); await S.waitForTimeout(400);
  const map = await S.evaluate(() => { const o = {}; document.querySelectorAll('[id^="incM_"]').forEach(s => { o[s.id.slice(5)] = s.options[s.selectedIndex].text; }); return o; });
  ok('the columns are guessed from the Jira headers', map.key === 'Issue key' && map.date === 'Created' && map.name === 'Custom field (Game presenter)' && map.type === 'Custom field (Mistake type)' && map.severity === 'Priority' && map.game === 'Custom field (Game)' && map.table === 'Custom field (Table)' && map.reporter === 'Reporter', JSON.stringify(map));
  await S.evaluate(() => document.querySelector('#dwBody [data-a="check"]').click()); await S.waitForTimeout(300);
  const chk = await S.evaluate(() => ({ t: Array.from(document.querySelectorAll('#dwBody .dbT')).map(x => x.textContent), body: document.getElementById('dwBody').textContent }));
  ok('Check: 5 rows, 3 new, 1 not imported (bad date), 1 repeated key', chk.t.join('|') === '5Rows|3New|0Updated in Jira|0Unchanged|1Not imported' && /someday/.test(chk.body) && /1 row\(s\) repeat a key/.test(chk.body), chk.t.join('|'));
  ok('…and lists the presenter who is not in the employee list', /Ghost Person \(1\)/.test(chk.body));
  await S.evaluate(() => document.querySelector('#dwBody [data-a="go"]').click()); await S.waitForTimeout(1200);
  let inc = await S.local('totIncidents');
  const a1 = (inc || []).filter(x => x.key === 'SM-1')[0] || {};
  ok('3 incidents imported', (inc || []).length === 3, (inc || []).map(x => x.key).join());
  ok('the screen name ANAT is matched to Ana Test (W100); priority becomes severity; the time is kept', a1.name === 'Ana Test' && a1.empId === 'W100' && a1.m === 1 && a1.severity === 'High' && a1.date === today && a1.time === '14:15' && a1.type === 'Procedural mistake' && a1.src === 'jira', JSON.stringify(a1));
  ok('an unknown presenter is imported as written and marked', (inc.filter(x => x.key === 'SM-3')[0] || {}).m === 0);
  const hist = await S.local('totIncImports');
  ok('the import is in the history', hist && hist.length === 1 && hist[0].added === 3 && hist[0].errors === 1 && hist[0].unmatched === 1, JSON.stringify(hist && hist[0] && { a: hist[0].added, e: hist[0].errors }));
  const jr = ((await S.local('totJournal')) || []).filter(x => x.src === 'totIncidents');
  ok('the journal has ONE line for the import, in the Service Management department', jr.length === 1 && /^Jira import "jira-export.csv": 3 new/.test(jr[0].act) && jr[0].dep === 'service', jr.map(x => x.act).join(' | '));

  console.log('3. Incidents: edit, re-import, undo, log by hand');
  await S.evaluate(() => DeptOpen('service', 'inc')); await S.waitForTimeout(300);
  const rows = await S.evaluate(() => Array.from(document.querySelectorAll('#dwBody tbody tr')).map(t => t.cells[0].textContent));
  ok('Incidents lists them newest first', rows.join() === 'SM-3,SM-1,SM-2', rows.join());
  const q = await S.evaluate(async () => { const i = document.getElementById('incQ'); i.value = 'w100'; i.dispatchEvent(new Event('input', { bubbles: true })); await new Promise(r => setTimeout(r, 400)); return Array.from(document.querySelectorAll('#dwBody tbody tr')).map(t => t.cells[0].textContent); });
  ok('search by Work ID', q.join() === 'SM-1', q.join());
  await S.evaluate(() => document.querySelector('#dwBody tbody tr').click()); await S.waitForTimeout(200);
  await S.fill('#incE_note', 'Talked to Ana, retraining booked'); await S.evaluate(() => document.querySelector('.tkOv [data-a="save"]').click()); await S.waitForTimeout(900);
  const csv2 = csv1.split('\n').slice(0, 3).join('\n').replace('In Progress,High', 'Done,High') + '\nSM-5,Shuffled too early,Open,Low,' + jd(now, '3:00 PM') + ',Sandro Service,Dato Shuffle,Roulette,RL 1,gp,Procedural mistake,';
  await S.evaluate(() => DeptOpen('service', 'jira')); await S.waitForTimeout(200);
  await S.evaluate(() => { const b = document.querySelector('#dwBody [data-v="import"]'); if (b) b.click(); }); await S.waitForTimeout(200);
  await S.setInputFiles('#incFile', [{ name: 'jira-week2.csv', mimeType: 'text/csv', buffer: Buffer.from(csv2) }]); await S.waitForTimeout(300);
  await S.evaluate(() => document.querySelector('#dwBody [data-a="check"]').click()); await S.waitForTimeout(200);
  const chk2 = await S.evaluate(() => Array.from(document.querySelectorAll('#dwBody .dbT')).map(x => x.textContent).join('|'));
  ok('re-import: 1 new, 1 updated in Jira, 1 unchanged', chk2 === '3Rows|1New|1Updated in Jira|1Unchanged|0Not imported', chk2);
  await S.evaluate(() => document.querySelector('#dwBody [data-a="go"]').click()); await S.waitForTimeout(900);
  inc = await S.local('totIncidents'); const a2 = inc.filter(x => x.key === 'SM-1')[0];
  ok('the Jira status is updated and the note written in the tool stays', inc.length === 4 && a2.status === 'Done' && a2.note === 'Talked to Ana, retraining booked', JSON.stringify({ n: inc.length, st: a2.status, note: a2.note }));
  await S.evaluate(() => document.querySelector('#dwBody [data-a="undo"]').click()); await S.waitForTimeout(900);
  inc = await S.local('totIncidents'); const a3 = inc.filter(x => x.key === 'SM-1')[0];
  ok('undo removes SM-5 and puts SM-1 back as it was (note kept)', inc.length === 3 && !inc.some(x => x.key === 'SM-5') && a3.status === 'In Progress' && a3.note === 'Talked to Ana, retraining booked', JSON.stringify({ n: inc.length, st: a3.status }));
  await S.evaluate(() => DeptOpen('service', 'inc')); await S.waitForTimeout(200);
  await S.evaluate(() => document.querySelector('#dwBody [data-a="new"]').click()); await S.waitForTimeout(200);
  await S.fill('#incE_name', 'DatoS'); await S.fill('#incE_type', 'Card / ball handling'); await S.fill('#incE_severity', 'medium'); await S.fill('#incE_summary', 'Dropped the ball'); await S.fill('#incE_game', 'Roulette');
  await S.evaluate(() => document.querySelector('.tkOv [data-a="save"]').click()); await S.waitForTimeout(900);
  inc = await S.local('totIncidents'); const man = inc.filter(x => x.src === 'tool')[0] || {};
  ok('an incident logged by hand gets a LOCAL key, is matched to Dato Shuffle (W200) and is saved', inc.length === 4 && /^LOCAL-/.test(man.key) && man.empId === 'W200' && man.name === 'Dato Shuffle' && man.severity === 'Medium' && man.date === today, JSON.stringify(man));
  const jr2 = ((await S.local('totJournal')) || []).filter(x => x.src === 'totIncidents').map(x => x.act);
  ok('the journal records the edit and the hand-logged incident', jr2.some(a => /Incident SM-1 · Ana Test .*note edited/.test(a)) && jr2.some(a => /^Incident logged: LOCAL-.* · Dato Shuffle · Card \/ ball handling/.test(a)) && jr2.some(a => /undone/.test(a)), jr2.join(' | '));

  console.log('4. Reports');
  const rp = await S.evaluate(() => { DeptOpen('service', 'rep'); return { k: Array.from(document.querySelectorAll('#dwBody .dbT')).map(x => x.textContent), top: (document.querySelector('#dwBody .incTbl tbody tr') || {}).textContent || '', h: Array.from(document.querySelectorAll('#dwBody .dbH')).map(x => x.textContent.replace('⬇ CSV', '').trim()) }; });
  ok('this month: 4 incidents, 3 presenters, 1 high or critical', rp.k.slice(0, 2).join('|') === '4Incidents|3Game presenters involved' && rp.k.indexOf('1High or critical') >= 0, rp.k.join('|'));
  ok('the sections: presenters, type, game, shift, severity, table, reporter, week, status', ['Game presenters with the most incidents', 'By mistake type', 'By game', 'By shift', 'By severity', 'By table', 'Reported by', 'Per week (Monday)', 'Status'].every(x => rp.h.indexOf(x) >= 0), rp.h.join(' | '));
  ok('Dato Shuffle tops the list (2 incidents)', /^Dato Shuffle.*W2002/.test(rp.top), rp.top);
  const dl = S.waitForEvent('download', { timeout: 4000 }).then(d => d.suggestedFilename(), () => ''); await S.evaluate(() => document.querySelector('#dwBody [data-a="all"]').click());
  ok('the full report downloads as CSV', /^service-report-.*\.csv$/.test(await dl));
  const ov = await S.evaluate(() => { openSpace('service'); return Array.from(document.querySelectorAll('#spaceHomeView .shStats > div')).map(x => x.textContent); });
  ok('the Overview counts 4 incidents this month and 3 open', ov.indexOf('Incidents this month4') >= 0 && ov.indexOf('Open incidents3') >= 0, ov.join(' | '));
  const hs = await S.evaluate(() => { totJournal.open('service'); const r = Array.from(document.querySelectorAll('#jrOv .jrRow')).map(x => x.textContent); document.getElementById('jrOv').classList.remove('open'); return r; });
  ok('Service → 📜 History lists the imports and edits', hs.some(r => /Jira import/.test(r)) && hs.some(r => /Incident logged/.test(r)) && hs.every(r => /Sandro Service/.test(r)), hs.slice(0, 3).join(' | '));

  console.log('5. Server: who receives and who may change incidents');
  await S.sync(); await S.waitForTimeout(300);
  const srv = keyOf({ keys: gas.data().keys }, 'totIncidents') || [];
  ok('the incidents reached the server', srv.length === 4, srv.length);
  const cP = pull('coach@x.com'), hP = pull('hr@x.com'), lP = pull('lead@x.com');
  ok('a performance coach receives them (to coach)', (keyOf(cP, 'totIncidents') || []).length === 4);
  ok('HR and shift leads do not', !hP.keys.totIncidents && !lP.keys.totIncidents && !hP.keys.totIncImports);
  const r = gas.post({ action: 'push', email: 'coach@x.com', pwHash: 'pw-coach@x.com', keys: { totIncidents: { v: '[]', t: Date.now(), bt: gas.data().keys.totIncidents.t } } });
  ok('a coach cannot change or delete incidents', (keyOf({ keys: gas.data().keys }, 'totIncidents') || []).length === 4 && (r.denied || []).indexOf('totIncidents') >= 0, JSON.stringify(r.denied));
  ok('the journal entries reach the managers', (keyOf(pull('mgr@x.com'), 'totJournal') || []).some(x => x.src === 'totIncidents'));
  (function () { const d = gas.data(), p = JSON.parse(d.keys.totAccessPolicy.v); p.depts = { hr_recruiter: 'service' }; d.keys.totAccessPolicy = { v: JSON.stringify(p), t: Date.now() }; gas.setData(d); })();
  ok('a position the admin maps to Service Management receives them', (keyOf(pull('hr@x.com'), 'totIncidents') || []).length === 4);
  (function () { const d = gas.data(), p = JSON.parse(d.keys.totAccessPolicy.v); p.depts = {}; d.keys.totAccessPolicy = { v: JSON.stringify(p), t: Date.now() }; gas.setData(d); })();

  console.log('6. Other screens');
  const C = await H.open({ email: 'coach@x.com', pw: 'pw-coach@x.com' }); await C.sync(); await C.waitForTimeout(1500);
  ok('the coach has no Service button (Performance is their department)', await C.evaluate(() => getComputedStyle(document.getElementById('navService')).display === 'none'));
  await A.sync(); await A.waitForTimeout(400);
  const s360 = await A.evaluate(() => { PersonHub.open('Ana Test'); document.querySelector('[data-ph="tab"][data-t="360"]').click(); const t = document.getElementById('phBody').textContent; document.querySelector('[data-ph="close"]').click(); return t; });
  ok('the person 360 view shows their service incidents', /Service incidents \(from Jira\)Incidents1 · last/.test(s360) && /SM-1Procedural mistake · Blackjack · High/.test(s360), (s360.match(/Service incidents[^]{0,120}/) || [''])[0]);
  const cInfo = await C.evaluate(async () => { await new Promise(r => setTimeout(r, 10)); PersonHub.open('Ana Test'); const t = document.getElementById('phBody').textContent; const row = document.querySelector('#phBody [data-inc]'); if (row) row.click(); const m = document.querySelector('.tkOv'); const r = { t, modal: m ? m.textContent.slice(0, 40) : '', ro: m ? !m.querySelector('[data-a="save"]') && !!m.querySelector('#incE_key[disabled]') : false }; if (m) m.remove(); document.querySelector('[data-ph="close"]').click(); return r; });
  ok('a coach sees the incidents in the person\'s profile (Info tab) and opens one read-only', /Service incidents \(1\)/.test(cInfo.t) && /SM-1/.test(cInfo.modal) && cInfo.ro, JSON.stringify({ m: cInfo.modal, ro: cInfo.ro }));
  const tk = await A.evaluate(() => Array.from(document.querySelectorAll('select')).some(s => Array.from(s.options).some(o => o.value === 'service')) || __dept.DEPTS.some(d => d.id === 'service' && d.label === 'Service Management'));
  ok('Service Management is a department for tickets and work types', tk);

  ok('no page errors', !H.errs.length, H.errs.join(' | '));
  console.log(fails ? fails + ' FAILED' : 'ALL PASSED'); await H.close(); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
