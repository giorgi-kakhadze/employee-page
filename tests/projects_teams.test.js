/* v3.33 Projects, round 2: teams and departments, restricted / shared items, board rights, branching tasks and distribution, item comments,
   approvals (server-computed status), workflow stages with approval gates, file storage with access, progress board. */
const path = require('path'), tool = process.argv[2] || path.join(__dirname, '..', 'tool', 'PTF-pass-to-floor-Gunda.html'), code = process.argv[3] || path.join(__dirname, '..', 'tool', 'Code.gs');
const gas = require('./fakegas')(code); require('./seed')(gas);
let fails = 0; function ok(name, cond, extra) { if (!cond) fails++; console.log((cond ? '  ✅ ' : '  ❌ ') + name + (extra ? '  → ' + extra : '')); }
const ids = (a) => (a || []).map(x => x.id).sort().join(',');
const srv = (k) => { const e = gas.data().keys[k]; return e ? JSON.parse(e.v) : []; };
const push = (who, k, arr) => gas.post({ action: 'push', email: who + '@x.com', pwHash: 'pw-' + who + '@x.com', keys: { [k]: { v: JSON.stringify(arr), t: Date.now(), bt: (gas.data().keys[k] || {}).t } } });
const post = (who, o) => gas.post(Object.assign({ email: who + '@x.com', pwHash: 'pw-' + who + '@x.com' }, o));
(async () => {
  const H = await require('./harness')(tool, gas);
  const P = {}; for (const e of ['lead', 'coach', 'hr', 'fmd', 'mgr']) { P[e] = await H.open({ email: e + '@x.com', pw: 'pw-' + e + '@x.com' }); await P[e].sync(); }
  const d = (n) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);

  console.log('1. Teams and departments');
  push('mgr', 'totTeams', [{ id: 'tmA', name: 'Launch squad', dept: '', lead: 'hr@x.com', members: ['hr@x.com', 'fmd@x.com'] }, { id: 'tmIT', name: 'IT helpers', dept: 'it', members: ['fmd@x.com'] }]);
  ok('a manager saves teams', srv('totTeams').length === 2);
  const r0 = push('lead', 'totTeams', []);
  ok('a shift lead cannot change teams', srv('totTeams').length === 2 && (r0.denied || []).length === 1, JSON.stringify(r0));
  push('mgr', 'totProjects', [
    { id: 'pT', title: 'Team project', ownerEmail: 'mgr@x.com', visibility: 'members', assignees: { teams: ['tmA'] }, hist: [] },
    { id: 'pIT', title: 'IT dept project', ownerEmail: 'mgr@x.com', visibility: 'members', assignees: { depts: ['it'] }, hist: [] },
    { id: 'pW', title: 'Workflow project', ownerEmail: 'mgr@x.com', visibility: 'members', assignees: { people: ['lead@x.com'] }, viewers: { people: ['fmd@x.com'] }, editors: { people: [] }, boardEdit: 'managers',
      stages: [{ name: 'Idea' }, { name: 'Build' }, { name: 'Launch', gate: true }], stage: 1, gateApprovers: { people: ['coach@x.com'] }, hist: [] }]);
  for (const e of ['lead', 'coach', 'hr', 'fmd']) await P[e].sync();
  ok('team members receive the project assigned to their team', (await P.hr.local('totProjects')).some(p => p.id === 'pT') && (await P.fmd.local('totProjects')).some(p => p.id === 'pT'));
  ok('people outside the team do not', !(await P.coach.local('totProjects')).some(p => p.id === 'pT') && !(await P.lead.local('totProjects')).some(p => p.id === 'pT'));
  ok('a team in the IT department makes its members part of IT for projects', (await P.fmd.local('totProjects')).some(p => p.id === 'pIT') && !(await P.hr.local('totProjects')).some(p => p.id === 'pIT'));
  ok('team member can work on it (client level 2)', await P.hr.evaluate(() => Projects.level(JSON.parse(localStorage.totProjects).find(p => p.id === 'pT'))) === 2);

  console.log('2. Restricted and shared items');
  push('mgr', 'totProjItems', [
    { id: 'iPub', pid: 'pW', kind: 'task', title: 'Public task', status: 'todo', byEmail: 'mgr@x.com' },
    { id: 'iSec', pid: 'pW', kind: 'doc', title: 'Salary sheet', status: 'todo', byEmail: 'mgr@x.com', restrict: { people: ['hr@x.com'] } },
    { id: 'iShare', pid: 'pW', kind: 'doc', title: 'Shared spec', status: 'todo', byEmail: 'mgr@x.com', share: { people: ['coach@x.com'], edit: false } }]);
  for (const e of ['lead', 'coach', 'hr', 'fmd']) await P[e].sync();
  ok('a restricted item is not sent to others on the project', ids(await P.lead.local('totProjItems')) === 'iPub,iShare', ids(await P.lead.local('totProjItems')));
  ok('…but to the person it is restricted to (even outside the project, read only)', (await P.hr.local('totProjItems')).some(i => i.id === 'iSec'));
  ok('a shared item reaches someone outside the project, without the project', (await P.coach.local('totProjItems')).some(i => i.id === 'iShare') && !(await P.coach.local('totProjItems')).some(i => i.id === 'iPub') && !(await P.coach.local('totProjects')).some(p => p.id === 'pW'));
  push('lead', 'totProjItems', srv('totProjItems').filter(i => i.id !== 'iSec').map(i => i.id === 'iPub' ? Object.assign({}, i, { status: 'doing', restrict: { people: ['lead@x.com'] } }) : i));
  const ip = srv('totProjItems').find(i => i.id === 'iPub');
  ok('a worker edits the item but cannot restrict an item someone else created', ip.status === 'doing' && !ip.restrict, JSON.stringify(ip.restrict));
  push('coach', 'totProjItems', srv('totProjItems').map(i => i.id === 'iShare' ? Object.assign({}, i, { title: 'HACK' }) : i));
  ok('read-only sharing: the outsider cannot change it', srv('totProjItems').find(i => i.id === 'iShare').title === 'Shared spec');
  ok('no page errors so far', H.errs.length === 0, H.errs.join(' | '));

  console.log('3. Board rights');
  push('lead', 'totProjBoard', [{ id: 'bL', pid: 'pW', t: 'note', text: 'lead note' }]);
  ok('"only managers draw": a worker cannot add a shape', !srv('totProjBoard').some(s => s.id === 'bL'));
  push('mgr', 'totProjects', srv('totProjects').map(p => p.id === 'pW' ? Object.assign({}, p, { boardEdit: 'all' }) : p));
  push('fmd', 'totProjBoard', [{ id: 'bF', pid: 'pW', t: 'note', text: 'viewer note' }]);
  ok('"everyone draws": a viewer can add a shape', srv('totProjBoard').some(s => s.id === 'bF'));

  console.log('4. Approvals (status worked out by the server)');
  push('lead', 'totProjItems', srv('totProjItems').filter(i => i.id !== 'iSec').concat([{ id: 'ap1', pid: 'pW', kind: 'approval', ref: 'iPub', title: 'Approve the public task', approvers: ['coach@x.com', 'hr@x.com'], rule: 'all', decisions: { 'coach@x.com': { d: 'approved' } }, status: 'approved', byEmail: 'lead@x.com', by: 'Levan Lead' }]));
  let ap = srv('totProjItems').find(i => i.id === 'ap1');
  ok('a new approval starts without decisions, whatever the sender claims', ap && ap.status === 'pending' && !Object.keys(ap.decisions).length, JSON.stringify(ap && ap.decisions));
  await P.coach.sync();
  ok('the approver (outside the project) receives the approval request', (await P.coach.local('totProjItems')).some(i => i.id === 'ap1'));
  ok('…and sees it in My work and the bell', await P.coach.evaluate(async () => { Projects.go('home'); await new Promise(r => setTimeout(r, 80)); const t = document.getElementById('projectsView').textContent; const b = (window.__notifExtra || []).reduce((a, f) => a.concat(f() || []), []).map(i => i.text).join('|'); return /Waiting for my approval/.test(t) && /asks for your approval/.test(b); }));
  push('coach', 'totProjItems', [Object.assign({}, ap, { decisions: { 'coach@x.com': { d: 'approved', note: 'ok', ts: Date.now() }, 'hr@x.com': { d: 'approved', ts: Date.now() } }, status: 'approved', title: 'HACK' })]);
  ap = srv('totProjItems').find(i => i.id === 'ap1');
  ok('an approver records only their own decision (not someone else\'s, not the title)', ap.decisions['coach@x.com'].d === 'approved' && !ap.decisions['hr@x.com'] && ap.title === 'Approve the public task' && ap.status === 'pending', JSON.stringify(ap));
  await P.hr.sync();
  await P.hr.evaluate(async () => { Projects.go('home'); await new Promise(r => setTimeout(r, 80)); document.querySelector('#projectsView [data-pj="dec"][data-v="approved"]').click(); await new Promise(r => setTimeout(r, 50)); document.querySelector('.pjOv [data-ok]').click(); });
  await P.hr.sync();
  ap = srv('totProjItems').find(i => i.id === 'ap1');
  ok('the second approver approves in the tool → approved', ap.status === 'approved' && ap.decisions['hr@x.com'].d === 'approved', ap.status);
  push('lead', 'totProjItems', srv('totProjItems').map(i => i.id === 'ap1' ? Object.assign({}, i, { decisions: {}, status: 'pending' }) : i));
  ok('the requester cannot wipe the decisions', srv('totProjItems').find(i => i.id === 'ap1').status === 'approved');
  push('lead', 'totProjItems', srv('totProjItems').concat([{ id: 'ap9', pid: 'pW', kind: 'approval', title: 'Budget', approvers: ['mgr@x.com', 'hr@x.com'], rule: 'all', byEmail: 'lead@x.com' }]));
  push('hr', 'totProjItems', [Object.assign({}, srv('totProjItems').find(i => i.id === 'ap9'), { decisions: { 'hr@x.com': { d: 'approved' } } })]);
  push('lead', 'totProjItems', srv('totProjItems').map(i => i.id === 'ap9' ? Object.assign({}, i, { approvers: ['hr@x.com'], rule: 'any' }) : i));
  ok('someone who only works on the project cannot change the approvers or the rule to get it through', srv('totProjItems').find(i => i.id === 'ap9').status === 'pending' && srv('totProjItems').find(i => i.id === 'ap9').approvers.length === 2);
  push('mgr', 'totProjItems', srv('totProjItems').concat([{ id: 'apSelf', pid: 'pW', kind: 'approval', ref: 'stage:2', title: 'self-approve', approvers: ['mgr@x.com'], rule: 'all', byEmail: 'mgr@x.com' }]));
  await P.mgr.sync(); await P.mgr.evaluate(() => { const a = JSON.parse(localStorage.totProjItems); const x = a.find(i => i.id === 'apSelf'); x.decisions = { 'mgr@x.com': { d: 'approved', ts: Date.now() } }; localStorage.setItem('totProjItems', JSON.stringify(a)); }); await P.mgr.sync();
  push('mgr', 'totProjects', srv('totProjects').map(p => p.id === 'pW' ? Object.assign({}, p, { stage: 2 }) : p));
  ok('a gate cannot be passed with an approval that leaves out the gate approver', srv('totProjects').find(p => p.id === 'pW').stage === 1 && srv('totProjItems').find(i => i.id === 'apSelf').status === 'approved');

  console.log('5. Workflow stages with an approval gate');
  push('mgr', 'totProjects', srv('totProjects').map(p => p.id === 'pW' ? Object.assign({}, p, { stage: 2 }) : p)); /* (also checked above) */
  ok('a manager cannot enter the "Launch" stage without its approval', (srv('totProjects').find(p => p.id === 'pW').stage || 0) === 1);
  push('lead', 'totProjects', srv('totProjects').filter(p => p.id === 'pW').map(p => Object.assign({}, p, { stage: 0 })));
  ok('a worker cannot move the stage at all', srv('totProjects').find(p => p.id === 'pW').stage === 1);
  push('mgr', 'totProjItems', srv('totProjItems').concat([{ id: 'apG', pid: 'pW', kind: 'approval', ref: 'stage:2', title: 'Enter Launch', approvers: ['coach@x.com'], rule: 'all', byEmail: 'mgr@x.com' }]));
  await P.coach.sync(); await P.coach.evaluate(() => { const a = JSON.parse(localStorage.totProjItems); const x = a.find(i => i.id === 'apG'); x.decisions = { 'coach@x.com': { d: 'approved', note: 'go', who: 'Cora Coach', ts: Date.now() } }; localStorage.setItem('totProjItems', JSON.stringify(a)); }); await P.coach.sync();
  ok('the gate approval is approved', srv('totProjItems').find(i => i.id === 'apG').status === 'approved');
  await P.mgr.sync();
  const stp = await P.mgr.evaluate(async () => { Projects.open('pW', 'overview'); await new Promise(r => setTimeout(r, 80)); const b = document.querySelector('#projectsView [data-pj="stage"][data-v="2"]'); if (!b) return 'no button'; b.click(); return 'ok'; });
  await P.mgr.sync();
  ok('after the approval the manager moves to "Launch"', stp === 'ok' && srv('totProjects').find(p => p.id === 'pW').stage === 2, stp);

  console.log('6. Branching tasks and distribution');
  await P.lead.sync();
  const br = await P.lead.evaluate(async () => { const w = (ms) => new Promise(r => setTimeout(r, ms));
    Projects.open('pW', 'items'); await w(80); itemOpen = null;
    document.querySelector('#projectsView .pjItem[data-id="iPub"]').click(); await w(60);
    document.querySelector('.pjOv [data-a="sub"]').click(); await w(60);
    document.getElementById('piT').value = 'Prepare tables'; document.querySelector('.pjOv [data-ok]').click(); await w(60);
    const sub = JSON.parse(localStorage.totProjItems).find(i => i.title === 'Prepare tables');
    document.querySelector('#projectsView .pjItem[data-id="iPub"]').click(); await w(60);
    document.querySelector('.pjOv [data-a="dist"]').click(); await w(60);
    ['lead@x.com', 'coach@x.com'].forEach(e => { const c = document.querySelector('.pjOv [data-e="' + e + '"]'); if (c) c.checked = true; });
    document.querySelector('.pjOv [data-ok]').click(); await w(80);
    const all = JSON.parse(localStorage.totProjItems), kids = all.filter(i => i.parentItem === 'iPub');
    Projects.open('pW', 'map'); await w(80);
    return { sub: sub && sub.parentItem, kids: kids.map(i => i.assigneeEmail).sort().join(','), badge: /3 sub-tasks/.test(document.getElementById('projectsView').textContent), nested: document.querySelectorAll('#projectsView .pjBr .pjBr').length }; });
  ok('a sub-task hangs under its task', br.sub === 'iPub');
  ok('distribute creates one sub-task per picked person', /coach@x.com/.test(br.kids) && /lead@x.com/.test(br.kids), br.kids);
  ok('the work map shows the branches and "0/3 sub-tasks"', br.badge && br.nested >= 3, JSON.stringify(br));
  await P.lead.sync(); await P.coach.sync();
  ok('the person given a sub-task receives it (even outside the project)', (await P.coach.local('totProjItems')).some(i => i.parentItem === 'iPub' && i.assigneeEmail === 'coach@x.com'));

  console.log('7. Comments and deadlines');
  await P.lead.evaluate(() => { const c = JSON.parse(localStorage.totComments || '[]'); c.push({ id: 'pc1', kind: 'pitem', ref: 'iPub', who: 'Levan Lead', email: 'lead@x.com', ts: Date.now(), text: 'Table list attached' }, { id: 'pc2', kind: 'pitem', ref: 'iSec', who: 'Levan Lead', email: 'lead@x.com', ts: Date.now(), text: 'sneaky' }); localStorage.setItem('totComments', JSON.stringify(c));
    const a = JSON.parse(localStorage.totProjItems); a.push({ id: 'iSoon', pid: 'pW', kind: 'task', title: 'Order chairs', status: 'todo', due: new Date(Date.now() + 86400000).toISOString().slice(0, 10), assigneeEmail: 'lead@x.com', assigneeName: 'Levan Lead', byEmail: 'lead@x.com' }); localStorage.setItem('totProjItems', JSON.stringify(a)); });
  await P.lead.sync(); await P.fmd.sync(); await P.hr.sync();
  ok('a comment on an item reaches the people who see the item', (await P.fmd.local('totComments')).some(c => c.id === 'pc1'));
  ok('a comment on a restricted item does not reach people who cannot see it', !(await P.fmd.local('totComments')).some(c => c.id === 'pc2'));
  ok('deadline in the next 2 days: in the bell', (await P.lead.evaluate(() => (window.__notifExtra || []).reduce((a, f) => a.concat(f() || []), []).map(i => i.text))).some(t => /Deadline .*Order chairs/.test(t)));

  console.log('8. Files with access');
  const bytes = Buffer.alloc(2000000, 7); bytes.write('HELLO FILE', 0);
  const CH = 1572864, n = Math.ceil(bytes.length / CH); let fid = '';
  for (let i = 0; i < n; i++) { const r = post('lead', { action: 'pjFileUp', site: 'main', pid: 'pW', up: 'u1', i, n, size: bytes.length, name: 'plan.pdf', mime: 'application/pdf', data: bytes.subarray(i * CH, (i + 1) * CH).toString('base64') }); if (r.fileId) fid = r.fileId; if (r.error) { ok('upload chunk ' + i, false, r.error); break; } }
  ok('someone who works on the project uploads a 2 MB file in pieces', !!fid && gas.driveFiles[fid] && gas.driveFiles[fid].bytes.length === bytes.length && /^pjfile-pW-plan\.pdf$/.test(gas.driveFiles[fid].name), fid);
  ok('a viewer cannot upload', !!post('fmd', { action: 'pjFileUp', site: 'main', pid: 'pW', up: 'u2', i: 0, n: 1, size: 10, name: 'x', data: 'eA==' }).error);
  push('lead', 'totProjItems', srv('totProjItems').filter(i => i.id !== 'iSec').concat([{ id: 'fPub', pid: 'pW', kind: 'file', title: 'plan.pdf', fileName: 'plan.pdf', fileId: fid, size: bytes.length, byEmail: 'lead@x.com' }, { id: 'fSec', pid: 'pW', kind: 'file', title: 'plan copy', fileName: 'plan.pdf', fileId: fid, size: bytes.length, byEmail: 'lead@x.com', restrict: { people: ['lead@x.com'] } }]));
  const get = (who, id) => { let out = [], i = 0, nn = 1; while (i < nn) { const r = post(who, { action: 'pjFileGet', site: 'main', id, i }); if (r.error) return r.error; nn = r.n; out.push(Buffer.from(r.data, 'base64')); i++; } return Buffer.concat(out); };
  const g1 = get('fmd', 'fPub');
  ok('a viewer of the project downloads it (all pieces, same bytes)', Buffer.isBuffer(g1) && g1.equals(bytes), typeof g1 === 'string' ? g1 : g1.length);
  ok('a restricted file: refused to others on the project', get('fmd', 'fSec') === 'not allowed');
  ok('…allowed to the person it is restricted to', Buffer.isBuffer(get('lead', 'fSec')));
  ok('someone outside the project is refused', get('hr', 'fPub') === 'not allowed');
  push('mgr', 'totProjItems', srv('totProjItems').concat([{ id: 'fFake', pid: 'pT', kind: 'file', title: 'steal', fileId: fid, byEmail: 'mgr@x.com' }]));
  ok('a file of another project cannot be pulled through a copied file id', get('hr', 'fFake') === 'not allowed');
  await P.fmd.sync();
  const ui = await P.fmd.evaluate(async () => { Projects.open('pW', 'files'); await new Promise(r => setTimeout(r, 80)); const b = document.querySelector('#projectsView [data-pj="dl"][data-id="fPub"]'); if (!b) return 'no button'; b.click(); for (let k = 0; k < 40 && !window.__pjLastDl; k++) await new Promise(r => setTimeout(r, 100)); return window.__pjLastDl; });
  ok('download button in the tool', ui && ui.size === bytes.length, JSON.stringify(ui));
  await P.lead.sync();
  await P.lead.evaluate(() => Projects.open('pW', 'files'));
  await P.lead.setInputFiles('#pjUpF', { name: 'notes.txt', mimeType: 'text/plain', buffer: Buffer.from('meeting notes') });
  await P.lead.waitForTimeout(800);
  ok('upload from the Files tab creates a file item', (await P.lead.local('totProjItems')).some(i => i.kind === 'file' && i.fileName === 'notes.txt' && i.fileId));

  console.log('9. Progress and teams pages, digest');
  await P.mgr.sync();
  const pg = await P.mgr.evaluate(async () => { const w = (ms) => new Promise(r => setTimeout(r, ms)), v = document.getElementById('projectsView'), o = {};
    Projects.go('progress'); await w(80); o.proj = v.querySelectorAll('tbody tr').length; o.stage = /Launch/.test(v.textContent);
    v.querySelector('[data-pj="pseg"][data-v="teams"]').click(); await w(60); o.teams = /Launch squad/.test(v.textContent) && /IT helpers/.test(v.textContent) && v.querySelectorAll('.pjLoad > div').length >= 2;
    v.querySelector('[data-pj="pseg"][data-v="depts"]').click(); await w(60); o.depts = v.querySelectorAll('.pjDept').length;
    Projects.go('teams'); await w(60); o.tpage = /Launch squad/.test(v.textContent) && !!v.querySelector('[data-pj="tnew"]');
    v.querySelector('[data-pj="tnew"]').click(); await w(50); document.getElementById('tmN').value = 'Night crew'; document.getElementById('tmD').value = 'fmd'; const c = document.querySelector('.pjOv [data-e="lead@x.com"]'); if (c) c.checked = true; document.querySelector('.pjOv [data-ok]').click(); await w(50);
    o.created = JSON.parse(localStorage.totTeams).some(t => t.name === 'Night crew' && t.dept === 'fmd' && t.members.includes('lead@x.com'));
    return o; });
  ok('progress per project (table with stage)', pg.proj >= 3 && pg.stage, JSON.stringify(pg));
  ok('progress per team with workload per person', pg.teams);
  ok('progress per department', pg.depts >= 1);
  ok('teams page: managers create a team and put people in it', pg.tpage && pg.created);
  await P.mgr.sync();
  ok('the new team is saved on the server', srv('totTeams').some(t => t.name === 'Night crew'));
  ok('a shift lead sees the teams page without the edit buttons', await P.lead.evaluate(async () => { Projects.go('teams'); await new Promise(r => setTimeout(r, 60)); return !document.querySelector('#projectsView [data-pj="tnew"]'); }));
  gas.mails.length = 0; delete gas.props.LAST_PDIG;
  push('mgr', 'totProjects', srv('totProjects').map(p => p.id === 'pT' ? Object.assign({}, p, { hist: [{ ts: Date.now(), who: 'Mia Manager', email: 'mgr@x.com', act: 'edited' }] }) : p));
  const to = gas.mails.map(m => m.to);
  ok('daily digest goes to team members of an assigned team', to.includes('hr@x.com') && to.includes('fmd@x.com'), to.join(','));
  const lm = gas.mails.find(m => m.to === 'lead@x.com');
  ok('digest lists deadlines in the next 2 days', lm && /Due soon .*Order chairs/.test(lm.body), lm && lm.body.slice(0, 400));

  ok('no page errors', H.errs.length === 0, H.errs.slice(0, 3).join(' | '));
  await H.close();
  console.log('projects_teams: ' + (fails ? fails + ' FAILED' : 'ALL PASSED'));
  process.exit(fails ? 1 : 0);
})();
