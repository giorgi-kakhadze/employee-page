/* v3.32 Projects: per-project access on the server, breakdown into sub-projects, items, board, notifications, e-mail updates, data explorer and pages. */
const path = require('path'), tool = process.argv[2] || path.join(__dirname, '..', 'tool', 'PTF-pass-to-floor-Gunda.html'), code = process.argv[3] || path.join(__dirname, '..', 'tool', 'Code.gs');
const gas = require('./fakegas')(code); require('./seed')(gas);
let fails = 0; function ok(name, cond, extra) { if (!cond) fails++; console.log((cond ? '  ✅ ' : '  ❌ ') + name + (extra ? '  → ' + extra : '')); }
const ids = (a) => (a || []).map(x => x.id).sort().join(',');
const srv = (k) => { const e = gas.data().keys[k]; return e ? JSON.parse(e.v) : []; };
const push = (who, k, arr) => gas.post({ action: 'push', email: who + '@x.com', pwHash: 'pw-' + who + '@x.com', keys: { [k]: { v: JSON.stringify(arr), t: Date.now(), bt: (gas.data().keys[k] || {}).t } } });
(async () => {
  const H = await require('./harness')(tool, gas);
  const P = {}; for (const e of ['lead', 'coach', 'hr', 'fmd', 'mgr']) { P[e] = await H.open({ email: e + '@x.com', pw: 'pw-' + e + '@x.com' }); await P[e].sync(); }
  const now = Date.now(), d = (n) => new Date(now + n * 86400000).toISOString().slice(0, 10);

  console.log('1. Creating projects and who receives them');
  await P.mgr.evaluate(([d0, d1, d2]) => {
    const h = (a) => [{ ts: Date.now(), who: 'Mia Manager', email: 'mgr@x.com', act: a }];
    localStorage.setItem('totProjects', JSON.stringify([
      { id: 'pMain', title: 'Floor relaunch', status: 'active', ownerEmail: 'mgr@x.com', ownerName: 'Mia Manager', byEmail: 'mgr@x.com', visibility: 'members', assignees: { depts: ['performance'], people: ['hr@x.com'] }, editors: { depts: [], people: [] }, viewers: { depts: [], people: ['fmd@x.com'] }, start: d0, due: d2, fields: { Budget: '4000', Client: 'Ops' }, tags: ['2026'], hist: h('created the project') },
      { id: 'pMgrPriv', title: 'Manager private plan', status: 'planned', ownerEmail: 'mgr@x.com', ownerName: 'Mia Manager', visibility: 'members', assignees: { depts: [], people: [] }, hist: h('created the project') },
      { id: 'pOrg', title: 'Open to everyone', status: 'active', ownerEmail: 'mgr@x.com', visibility: 'org', hist: h('created the project') }]));
    localStorage.setItem('totProjItems', JSON.stringify([
      { id: 'iSpec', pid: 'pMain', kind: 'task', title: 'Write specs', status: 'waiting', waitingFor: 'specs from Product', waitSince: Date.now() - 3 * 86400000, start: d0, due: d1, assigneeEmail: 'hr@x.com', assigneeName: 'Hana HR', hist: h('added (Waiting)') },
      { id: 'iBuild', pid: 'pMain', kind: 'task', title: 'Build floor plan', status: 'todo', deps: ['iSpec'], start: d1, due: d2, assigneeEmail: 'fmd@x.com', assigneeName: 'Fiona FMD', hist: h('added (To do)') },
      { id: 'iPriv', pid: 'pMgrPriv', kind: 'task', title: 'Secret step', status: 'todo', hist: h('added') }]));
  }, [d(-2), d(3), d(10)]);
  await P.mgr.sync();
  ok('server stored the 3 projects and 3 items', srv('totProjects').length === 3 && srv('totProjItems').length === 3, ids(srv('totProjects')));
  for (const e of ['lead', 'coach', 'hr', 'fmd']) await P[e].sync();
  ok('lead (Performance, assigned department) receives the main + open project, not the private one', ids(await P.lead.local('totProjects')) === 'pMain,pOrg', ids(await P.lead.local('totProjects')));
  ok('hr (assigned person) receives the main + open project', ids(await P.hr.local('totProjects')) === 'pMain,pOrg');
  ok('fmd (viewer) receives the main + open project', ids(await P.fmd.local('totProjects')) === 'pMain,pOrg');
  ok('nobody but the manager receives the private project item', !(await P.lead.local('totProjItems')).some(i => i.id === 'iPriv') && !(await P.fmd.local('totProjItems')).some(i => i.id === 'iPriv'));
  ok('lead receives the main project items', ids(await P.lead.local('totProjItems')) === 'iBuild,iSpec');
  ok('client access levels match: lead works, fmd reads, mgr manages', await P.lead.evaluate(() => Projects.level(JSON.parse(localStorage.totProjects).find(p => p.id === 'pMain'))) === 2 && await P.fmd.evaluate(() => Projects.level(JSON.parse(localStorage.totProjects).find(p => p.id === 'pMain'))) === 1 && await P.mgr.evaluate(() => Projects.level(JSON.parse(localStorage.totProjects).find(p => p.id === 'pMain'))) === 3);

  console.log('2. Breaking the project down');
  await P.lead.evaluate(() => { const a = JSON.parse(localStorage.totProjects); a.push({ id: 'pPerf', parent: 'pMain', title: 'Performance part: coaching plan', status: 'active', ownerEmail: 'lead@x.com', ownerName: 'Levan Lead', byEmail: 'lead@x.com', visibility: 'inherit', assignees: { depts: ['performance'], people: [] }, hist: [{ ts: Date.now(), who: 'Levan Lead', email: 'lead@x.com', act: 'created the sub-project' }] }); localStorage.setItem('totProjects', JSON.stringify(a));
    const it = JSON.parse(localStorage.totProjItems); it.push({ id: 'iCoach', pid: 'pPerf', kind: 'task', title: 'Coach 12 dealers', status: 'help', help: 'need 2 more coaches from Academy', assigneeEmail: 'coach@x.com', assigneeName: 'Cora Coach', hist: [{ ts: Date.now(), who: 'Levan Lead', email: 'lead@x.com', act: 'added (Needs help)' }] }); localStorage.setItem('totProjItems', JSON.stringify(it)); });
  await P.lead.sync(); await P.lead.sync();
  ok('lead (works on the main project) can add his own sub-project', srv('totProjects').some(p => p.id === 'pPerf' && p.parent === 'pMain'));
  ok('…and an item in it', srv('totProjItems').some(i => i.id === 'iCoach'));
  await P.fmd.sync(); await P.mgr.sync(); await P.hr.sync();
  ok('fmd (viewer of the main project) sees the sub-project ("same as parent")', (await P.fmd.local('totProjects')).some(p => p.id === 'pPerf'));
  ok('the manager of the main project manages the sub-project too', await P.mgr.evaluate(() => Projects.level(JSON.parse(localStorage.totProjects).find(p => p.id === 'pPerf'))) === 3);
  ok('progress of the main project counts the sub-project items', await P.mgr.evaluate(() => { Projects.open('pMain'); return /0\/3 items done/.test(document.getElementById('projectsView').textContent); }));

  console.log('3. What the server refuses');
  let r = push('fmd', 'totProjects', srv('totProjects').filter(p => p.id !== 'pMgrPriv').map(p => p.id === 'pMain' ? Object.assign({}, p, { title: 'HACKED by viewer' }) : p));
  ok('a viewer cannot change the project', srv('totProjects').find(p => p.id === 'pMain').title === 'Floor relaunch', JSON.stringify(r));
  push('fmd', 'totProjItems', srv('totProjItems').filter(i => i.pid !== 'pMgrPriv').concat([{ id: 'iForge', pid: 'pMain', title: 'viewer item', status: 'todo' }]));
  ok('a viewer cannot add an item', !srv('totProjItems').some(i => i.id === 'iForge'));
  push('fmd', 'totProjItems', srv('totProjItems').filter(i => i.pid !== 'pMgrPriv').map(i => i.id === 'iBuild' ? Object.assign({}, i, { status: 'doing', pid: 'pOrg' }) : i));
  ok('…but may update the item assigned to them (and it cannot move to another project)', srv('totProjItems').find(i => i.id === 'iBuild').status === 'doing' && srv('totProjItems').find(i => i.id === 'iBuild').pid === 'pMain');
  push('lead', 'totProjects', srv('totProjects').filter(p => p.id !== 'pMgrPriv').map(p => p.id === 'pMain' ? Object.assign({}, p, { status: 'blocked', viewers: { depts: ['hr', 'it'], people: [] }, ownerEmail: 'lead@x.com' }) : p));
  const pm = srv('totProjects').find(p => p.id === 'pMain');
  ok('an assigned person can change the status…', pm.status === 'blocked');
  ok('…but not the access settings or the owner', pm.ownerEmail === 'mgr@x.com' && pm.viewers.people[0] === 'fmd@x.com' && !pm.viewers.depts.length);
  push('lead', 'totProjects', srv('totProjects').filter(p => p.id !== 'pMgrPriv' && p.id !== 'pMain'));
  ok('an assigned person cannot delete the project', srv('totProjects').some(p => p.id === 'pMain'));
  push('hr', 'totProjects', srv('totProjects').filter(p => p.id !== 'pMgrPriv').concat([{ id: 'pForged', title: 'Pretend it is the manager\'s', ownerEmail: 'mgr@x.com', visibility: 'org' }, { id: 'pHr', title: 'HR onboarding revamp', ownerEmail: 'hr@x.com', visibility: 'members', assignees: { depts: [], people: [] } }]));
  ok('a new project must be owned by whoever creates it', !srv('totProjects').some(p => p.id === 'pForged') && srv('totProjects').some(p => p.id === 'pHr'));
  push('hr', 'totProjects', srv('totProjects').filter(p => p.id !== 'pMgrPriv').concat([{ id: 'pSubPriv', parent: 'pMgrPriv', title: 'sneak in', ownerEmail: 'hr@x.com' }]));
  ok('no sub-project under a project you cannot work on', !srv('totProjects').some(p => p.id === 'pSubPriv'));
  push('mgr', 'totProjects', srv('totProjects').map(p => p.id === 'pMain' ? Object.assign({}, p, { status: 'active', editors: { depts: [], people: ['coach@x.com'] } }) : p));
  ok('the owner changes access (adds a manager)', srv('totProjects').find(p => p.id === 'pMain').editors.people[0] === 'coach@x.com');
  push('coach', 'totProjects', srv('totProjects').filter(p => p.id !== 'pMgrPriv' && p.id !== 'pHr').map(p => p.id === 'pMain' ? Object.assign({}, p, { viewers: { depts: ['it'], people: ['fmd@x.com'] } }) : p));
  ok('a manager (not the owner) may change access too', (srv('totProjects').find(p => p.id === 'pMain').viewers.depts || [])[0] === 'it');
  ok('hr\'s own project stays private', !(await (async () => { await P.lead.sync(); return P.lead.local('totProjects'); })()).some(p => p.id === 'pHr'));

  console.log('4. Board and discussion');
  await P.coach.sync();
  await P.coach.evaluate(() => { const b = JSON.parse(localStorage.totProjBoard || '[]'); b.push({ id: 'bs1', pid: 'pMain', t: 'note', x: 0, y: 0, w: 170, h: 120, text: 'Idea: split by shift', color: '#fde68a' }, { id: 'bs2', pid: 'pMain', t: 'card', ref: { kind: 'item', id: 'iSpec' }, x: 220, y: 0, w: 210, h: 84 }, { id: 'bs3', pid: 'pMain', t: 'line', from: 'bs1', to: 'bs2' }); localStorage.setItem('totProjBoard', JSON.stringify(b)); });
  await P.coach.sync();
  ok('board shapes saved by someone who works on the project', ids(srv('totProjBoard')) === 'bs1,bs2,bs3');
  push('fmd', 'totProjBoard', srv('totProjBoard').concat([{ id: 'bsF', pid: 'pMain', t: 'note', text: 'viewer scribble' }]));
  ok('a viewer cannot draw on the board', !srv('totProjBoard').some(s => s.id === 'bsF'));
  await P.fmd.sync(); await P.fmd.evaluate(() => { const c = JSON.parse(localStorage.totComments || '[]'); c.push({ id: 'cmP', kind: 'proj', ref: 'pMain', who: 'Fiona FMD', email: 'fmd@x.com', ts: Date.now(), text: 'When does the floor plan start?' }); localStorage.setItem('totComments', JSON.stringify(c)); }); await P.fmd.sync();
  await P.lead.sync(); await P.hr.sync();
  ok('a viewer can post in the discussion; people on the project read it', (await P.lead.local('totComments')).some(c => c.id === 'cmP'));
  ok('people outside the project do not get project comments', !(await P.hr.evaluate(() => JSON.parse(localStorage.totComments || '[]').some(c => c.kind === 'proj' && c.ref === 'pHr'))));

  console.log('5. Notifications');
  const bell = (p) => p.evaluate(() => (window.__notifExtra || []).reduce((a, f) => a.concat(f() || []), []).map(i => i.text));
  const lb = await bell(P.lead), hb = await bell(P.hr), fb = await bell(P.fmd);
  ok('lead\'s bell: news from the project he works on', lb.some(t => /Mia Manager/.test(t) && /Floor relaunch/.test(t)), lb.slice(0, 3).join(' | '));
  ok('lead\'s bell: the discussion message', lb.some(t => /When does the floor plan start/.test(t)));
  ok('lead\'s bell: no news of his own changes', !lb.some(t => /^🗂 Levan Lead/.test(t)));
  ok('hr\'s bell: the item assigned to her', hb.some(t => /Write specs/.test(t)));
  ok('fmd (viewer) only hears about the item assigned to them', fb.length > 0 && fb.every(t => /Build floor plan/.test(t)), fb.join(' | '));
  ok('the bell panel has a Projects filter', await P.lead.evaluate(() => { document.getElementById('bellBtn').click(); const h = document.querySelector('.tkOv').textContent; document.querySelector('.tkOv').remove(); return /Projects/.test(h); }));

  console.log('6. E-mail updates');
  gas.mails.length = 0; delete gas.props.LAST_PDIG;
  push('mgr', 'totProjects', srv('totProjects').map(p => p.id === 'pMain' ? Object.assign({}, p, { desc: 'Relaunch of the main floor', hist: (p.hist || []).concat([{ ts: Date.now(), who: 'Mia Manager', email: 'mgr@x.com', act: 'edited the project' }]) }) : p));
  const to = gas.mails.map(m => m.to).sort();
  ok('daily digest sent once on the first save of the day', gas.props.LAST_PDIG && gas.mails.length > 0, to.join(','));
  ok('…to the people involved: owner, managers, assigned person, assigned department members, item assignees', ['coach@x.com', 'hr@x.com', 'lead@x.com', 'mgr@x.com', 'fmd@x.com'].every(e => to.includes(e)), to.join(','));
  const lm = gas.mails.find(m => m.to === 'lead@x.com');
  ok('digest lists waiting (specs), help needed and changes', lm && /Waiting for specs from Product/.test(lm.body) && /Needs help/.test(lm.body) && /edited the project/.test(lm.body), lm && lm.body.slice(0, 300));
  const n0 = gas.mails.length; push('mgr', 'totProjects', srv('totProjects'));
  ok('…and not again the same day', gas.mails.length === n0);
  gas.mails.length = 0;
  r = gas.post({ action: 'projNotify', email: 'lead@x.com', pwHash: 'pw-lead@x.com', pid: 'pMain', note: 'Specs are late, please help', days: 7 });
  ok('on demand: someone who works on it sends an update', r.ok && r.sent > 0 && !gas.mails.some(m => m.to === 'lead@x.com') && gas.mails.every(m => /Specs are late/.test(m.body)), JSON.stringify(r));
  r = gas.post({ action: 'projNotify', email: 'lead@x.com', pwHash: 'pw-lead@x.com', pid: 'pMain', note: 'again' });
  ok('…at most once a minute per project', !!r.error, JSON.stringify(r));
  r = gas.post({ action: 'projNotify', email: 'fmd@x.com', pwHash: 'pw-fmd@x.com', pid: 'pPerf', note: 'x' });
  ok('a viewer cannot send updates', r.error === 'not allowed', JSON.stringify(r));
  r = gas.post({ action: 'projNotify', email: 'hr@x.com', pwHash: 'pw-hr@x.com', pid: 'pMgrPriv', note: 'x' });
  ok('nobody can send about a project they cannot see', !!r.error && !r.sent);

  console.log('7. Pages');
  await P.mgr.sync(); await P.lead.sync();
  const pg = await P.lead.evaluate(async () => {
    const w = (ms) => new Promise(r => setTimeout(r, ms)), v = document.getElementById('projectsView'), o = {};
    document.getElementById('navProjects').click(); await w(150);
    o.nav = getComputedStyle(document.getElementById('navProjects')).display !== 'none'; o.home = /My work/.test(v.textContent) && /Needs attention/.test(v.textContent) && /Coach 12 dealers/.test(v.textContent);
    o.sub = [...document.querySelectorAll('#spaceSub button')].map(b => b.textContent.trim()).join('|');
    Projects.go('list'); await w(80); o.list = v.querySelectorAll('tbody tr').length;
    Projects.go('explore'); await w(80); o.colls = [...v.querySelectorAll('[data-pj="coll"]')].map(b => b.textContent.trim().split(' ').slice(1, 2).join('')).join(',');
    v.querySelector('[data-pj="coll"][data-v="items"]').click(); await w(50);
    v.querySelector('[data-pj="fadd"]').click(); await w(50);
    let s = v.querySelector('[data-pj-f="f"]'); s.value = 'status'; s.dispatchEvent(new Event('change', { bubbles: true })); await w(50);
    s = v.querySelector('[data-pj-f="op"]'); s.value = 'is'; s.dispatchEvent(new Event('change', { bubbles: true })); await w(50);
    const iv = v.querySelector('[data-pj-f="v"]'); iv.value = 'Needs help'; iv.dispatchEvent(new Event('input', { bubbles: true })); await w(450);
    o.filtered = [...v.querySelectorAll('tbody tr')].map(t => t.textContent).join('|');
    v.querySelector('[data-pj="fadd"]').click(); await w(50);
    s = v.querySelectorAll('[data-pj-f="f"]')[1]; s.value = 'fields.Budget'; s.dispatchEvent(new Event('change', { bubbles: true })); await w(50);
    o.ownField = [...v.querySelectorAll('[data-pj-f="f"]')[1].options].some(x => x.value === 'fields.Budget') || true;
    v.querySelector('[data-pj="fclr"]').click(); await w(50);
    v.querySelector('[data-pj="coll"][data-v="projects"]').click(); await w(50);
    v.querySelector('[data-pj="fadd"]').click(); await w(50);
    s = v.querySelector('[data-pj-f="f"]'); o.budgetField = [...s.options].some(x => x.value === 'fields.Budget'); s.value = 'fields.Budget'; s.dispatchEvent(new Event('change', { bubbles: true })); await w(50);
    s = v.querySelector('[data-pj-f="op"]'); s.value = 'gt'; s.dispatchEvent(new Event('change', { bubbles: true })); await w(50);
    const bv = v.querySelector('[data-pj-f="v"]'); bv.value = '1000'; bv.dispatchEvent(new Event('input', { bubbles: true })); await w(450);
    o.budget = [...v.querySelectorAll('tbody tr')].map(t => t.textContent.slice(0, 20)).join('|');
    Projects.open('pMain', 'map'); await w(80); o.map = /Performance part: coaching plan/.test(v.textContent) && /Blocked by: Write specs/.test(v.textContent) && /specs from Product/.test(v.textContent);
    Projects.open('pMain', 'timeline'); await w(80); o.tlRows = v.querySelectorAll('.pjTlL').length; o.tlArrows = v.querySelectorAll('path[marker-end]').length; o.tlWait = /days spent waiting/.test(v.textContent) && /🙋/.test(v.querySelector('svg').textContent);
    Projects.open('pMain', 'board'); await w(150); o.board = v.querySelectorAll('.pjBW [data-sid]').length;
    v.querySelector('[data-bt="note"]').click(); const sv = v.querySelector('.pjBSvg'), rc = sv.getBoundingClientRect();
    sv.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: rc.left + 300, clientY: rc.top + 300, pointerId: 1 })); await w(80);
    const ta = document.getElementById('pjBtx'); if (ta) { ta.value = 'Sticky from test'; document.querySelector('.pjOv [data-ok]').click(); } await w(50);
    o.board2 = JSON.parse(localStorage.totProjBoard).filter(s => s.pid === 'pMain').length; o.sticky = JSON.parse(localStorage.totProjBoard).some(s => s.text === 'Sticky from test');
    Projects.open('pMain', 'items'); await w(80); o.kanban = v.querySelectorAll('.pjCol').length;
    Projects.open('pMain', 'access'); await w(50); o.access = /Managers/.test(v.textContent) && /Viewers/.test(v.textContent);
    Projects.open('pMain', 'overview'); await w(50); o.edit = !!v.querySelector('[data-pj="pedit"]'); o.sendBtn = !!v.querySelector('[data-pj="send"]');
    Projects.go('updates'); await w(50); o.updates = /Your digest/.test(v.textContent) && /Floor relaunch/.test(v.textContent);
    return o; });
  ok('Projects button in the top bar and a My work page', pg.nav && pg.home, JSON.stringify({ nav: pg.nav, home: pg.home }));
  ok('Projects menu: My work, All projects, Data explorer, Updates', /My work\|.*All projects\|.*Data explorer\|.*Updates/.test(pg.sub), pg.sub);
  ok('All projects lists only what lead may open (main, sub, open)', pg.list === 3, pg.list);
  ok('Data explorer offers projects, items, tickets, announcements…', /Projects/.test(pg.colls) && /Tickets/.test(pg.colls), pg.colls);
  ok('filter items by status = Needs help', /Coach 12 dealers/.test(pg.filtered) && !/Write specs/.test(pg.filtered), pg.filtered);
  ok('own fields are filterable (Budget > 1000)', pg.budgetField && /Floor relaunch/.test(pg.budget) && !/Open to everyone/.test(pg.budget), pg.budget);
  ok('work map: sub-project, dependency and waiting reason', pg.map);
  ok('timeline tree: rows, dependency arrows, waiting / help markers', pg.tlRows >= 6 && pg.tlArrows >= 1 && pg.tlWait, JSON.stringify([pg.tlRows, pg.tlArrows, pg.tlWait]));
  ok('board shows the shared shapes; lead adds a sticky note', pg.board === 3 && pg.board2 === 4 && pg.sticky, JSON.stringify([pg.board, pg.board2]));
  ok('items board has the 7 status columns', pg.kanban === 7);
  ok('access tab explains roles; lead cannot edit, can send updates', pg.access && !pg.edit && pg.sendBtn);
  ok('Updates page shows lead\'s digest', pg.updates);
  await P.lead.sync();
  ok('lead\'s sticky note reached the server', srv('totProjBoard').some(s => s.text === 'Sticky from test'));

  console.log('8. Creating through the form');
  const cf = await P.hr.evaluate(async () => {
    const w = (ms) => new Promise(r => setTimeout(r, ms)); Projects.go('home'); await w(80);
    document.querySelector('#projectsView [data-pj="new"]').click(); await w(50);
    document.getElementById('pjT').value = 'Hiring wave Q4'; document.querySelector('#pjAs [data-d="fmd"]').checked = true; document.getElementById('pjFl').value = 'Budget: 900';
    document.querySelector('.pjOv [data-ok]').click(); await w(80);
    const p = JSON.parse(localStorage.totProjects).find(x => x.title === 'Hiring wave Q4');
    document.querySelector('#projectsView [data-pj="iadd"]').click(); await w(50);
    document.getElementById('piT').value = 'Post the job ads'; document.getElementById('piS').value = 'blocked'; document.getElementById('piS').onchange(); document.getElementById('piBl').value = 'waiting for budget approval';
    document.querySelector('.pjOv [data-ok]').click(); await w(50);
    const it = JSON.parse(localStorage.totProjItems).find(x => x.title === 'Post the job ads');
    return { p, it }; });
  ok('form creates a project owned by hr, assigned to FMD, with an own field', cf.p && cf.p.ownerEmail === 'hr@x.com' && cf.p.assignees.depts[0] === 'fmd' && cf.p.fields.Budget === '900');
  ok('item form keeps the blocker reason and history', cf.it && cf.it.status === 'blocked' && cf.it.blocker === 'waiting for budget approval' && /Blocked/.test(cf.it.hist[0].act));
  await P.hr.sync(); await P.fmd.sync();
  ok('FMD (assigned department) receives it', (await P.fmd.local('totProjects')).some(p => p.title === 'Hiring wave Q4'));
  ok('Performance does not', !(await (async () => { await P.lead.sync(); return P.lead.local('totProjects'); })()).some(p => p.title === 'Hiring wave Q4'));

  console.log('9. Deleting a project');
  push('lead', 'totProjects', srv('totProjects').filter(p => p.id !== 'pPerf' && p.id !== 'pMgrPriv' && p.id !== 'pHr' && p.title !== 'Hiring wave Q4'));
  ok('the owner of a sub-project deletes it', !srv('totProjects').some(p => p.id === 'pPerf') && srv('totProjects').some(p => p.id === 'pMain'));
  push('mgr', 'totProjItems', srv('totProjItems'));
  ok('its items are removed on the server with it', !srv('totProjItems').some(i => i.id === 'iCoach') && srv('totProjItems').some(i => i.id === 'iSpec'));
  ok('no page errors', H.errs.length === 0, H.errs.slice(0, 3).join(' | '));
  await H.close();
  console.log('projects: ' + (fails ? fails + ' FAILED' : 'ALL PASSED'));
  process.exit(fails ? 1 : 0);
})();
