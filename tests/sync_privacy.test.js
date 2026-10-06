const path = require('path'), tool = process.argv[2] || path.join(__dirname, '..', 'tool', 'PTF-pass-to-floor-Gunda.html'), code = process.argv[3] || path.join(__dirname, '..', 'tool', 'Code.gs');
const gas = require('./fakegas')(code); require('./seed')(gas);
let fails = 0; function ok(name, cond, extra) { if (!cond) fails++; console.log((cond ? '  ✅ ' : '  ❌ ') + name + (extra ? '  → ' + extra : '')); }
const ids = (a) => (a || []).map(x => x.id).sort().join(',');
(async () => {
  const H = await require('./harness')(tool, gas);
  const P = {}; for (const e of ['lead', 'coach', 'hr', 'fmd', 'mgr']) { P[e] = await H.open({ email: e + '@x.com', pw: 'pw-' + e + '@x.com' }); await P[e].sync(); }
  P.admin = await H.open({ admin: true }); await P.admin.sync();

  console.log('1. What each person receives');
  const want = { lead: 't-lead-to-it,t-perf', coach: 't-assigned-coach,t-lead-to-it,t-perf', hr: 't-acc-term,t-hr-term', fmd: 't-fmd,t-legacy-role',
    mgr: 't-acc-term,t-assigned-coach,t-fmd,t-hr-term,t-lead-to-it,t-legacy-role,t-perf', admin: 't-acc-term,t-assigned-coach,t-fmd,t-hr-term,t-lead-to-it,t-legacy-role,t-perf' };
  for (const e of Object.keys(want)) ok(e + ' tickets', ids(await P[e].local('totTasks')) === want[e], ids(await P[e].local('totTasks')));
  ok('lead comments: only the one on a ticket he sees', ids(await P.lead.local('totComments')) === 'cm2', ids(await P.lead.local('totComments')));
  ok('hr comments: HR note + HR announcement comment', ids(await P.hr.local('totComments')) === 'cm1,cm3', ids(await P.hr.local('totComments')));
  ok('lead announcements: not the HR-only memo', ids(await P.lead.local('totAnnouncements')) === 'a-all');
  ok('hr announcements: both', ids(await P.hr.local('totAnnouncements')) === 'a-all,a-hr');
  ok('lead cases: none', ids(await P.lead.local('totCases')) === '', ids(await P.lead.local('totCases')));
  ok('hr cases: c1', ids(await P.hr.local('totCases')) === 'c1');
  ok('lead audit log: own entry only', ids(await P.lead.local('auditLog')) === 'au2', ids(await P.lead.local('auditLog')));
  ok('admin audit log: everything', ids(await P.admin.local('auditLog')) === 'au1,au2');

  console.log('2. Writes from a person who sees only part of the list');
  await P.lead.evaluate(() => { TasksApi.create({ title: 'New printer', toRole: 'it' }); window.__cm.addC('task', 't-perf', 'Please hurry'); });
  await P.lead.sync();
  const srv = gas.tasks();
  ok('server keeps all 7 old tickets + the new one', srv.length === 8, srv.length);
  ok('new ticket stored with lead as sender', srv.some(t => t.title === 'New printer' && t.fromEmail === 'lead@x.com'));
  ok('lead comment stored', JSON.parse(gas.data().keys.totComments.v).some(c => c.text === 'Please hurry'));
  ok('lead audit entries added, others kept', (() => { const a = JSON.parse(gas.data().keys.auditLog.v); return a.some(x => x.id === 'au1') && a.length > 2 && a.filter(x => x.email !== 'lead@x.com' && x.email !== 'hr@x.com').length === 0; })());

  console.log('3. Deleting');
  await P.coach.evaluate(() => { const a = JSON.parse(localStorage.totTasks); a.find(t => t.id === 't-assigned-coach').status = 'doing'; localStorage.setItem('totTasks', JSON.stringify(a)); });   // coach has local changes and still holds t-lead-to-it
  await P.lead.evaluate(() => { localStorage.setItem('totTasks', JSON.stringify(JSON.parse(localStorage.totTasks).filter(t => t.id !== 't-lead-to-it'))); });
  await P.lead.sync(); await P.lead.sync();
  ok('lead deletes his own ticket: gone on the server', !gas.tasks().some(t => t.id === 't-lead-to-it'));
  ok('…and stays gone on his device', !(await P.lead.local('totTasks')).some(t => t.id === 't-lead-to-it'));
  await P.coach.sync(); await P.coach.sync();
  ok('coach (stale copy + local edits) does not bring it back', !gas.tasks().some(t => t.id === 't-lead-to-it'));
  ok('coach edit saved', gas.tasks().find(t => t.id === 't-assigned-coach').status === 'doing');
  ok('coach device dropped the deleted ticket', !(await P.coach.local('totTasks')).some(t => t.id === 't-lead-to-it'));
  await P.fmd.evaluate(() => { localStorage.setItem('totTasks', JSON.stringify(JSON.parse(localStorage.totTasks).filter(t => t.id !== 't-legacy-role'))); });
  await P.fmd.sync(); await P.fmd.sync();
  ok('fmd cannot delete a ticket someone else sent: kept on server', gas.tasks().some(t => t.id === 't-legacy-role'));
  ok('…and it comes back on the fmd device', (await P.fmd.local('totTasks')).some(t => t.id === 't-legacy-role'));
  await P.admin.sync(); await P.admin.evaluate(() => { localStorage.setItem('totTasks', JSON.stringify(JSON.parse(localStorage.totTasks).filter(t => t.id !== 't-fmd'))); }); await P.admin.sync(); await P.admin.sync();
  ok('admin deletes a ticket: gone', !gas.tasks().some(t => t.id === 't-fmd'));
  await P.fmd.evaluate(() => { const a = JSON.parse(localStorage.totTasks); a.forEach(t => t.u = Date.now()); localStorage.setItem('totTasks', JSON.stringify(a)); }); await P.fmd.sync(); await P.fmd.sync();
  ok('fmd (still had it, with local changes) does not bring it back', !gas.tasks().some(t => t.id === 't-fmd'));

  console.log('4. Attempts to change what you cannot see');
  const tv = gas.data().keys.totTasks.t;
  const leadNow = await P.lead.local('totTasks'); await P.lead.sync();
  const forged = (await P.lead.local('totTasks')).concat([{ id: 't-hr-term', title: 'HACKED', toRole: 'performance', fromEmail: 'lead@x.com' }, { id: 't-new-forge', title: 'Forged for HR', toRole: 'hr', fromEmail: 'hr@x.com', fromRole: 'hr_recruiter' }]);
  const tvNow = gas.data().keys.totTasks.t;
  const r = gas.post({ action: 'push', email: 'lead@x.com', pwHash: 'pw-lead@x.com', keys: { totTasks: { v: JSON.stringify(forged), t: Date.now(), bt: tvNow } } });
  ok('push accepted without error', r.ok, JSON.stringify(r));
  ok('hidden HR ticket unchanged', gas.tasks().find(t => t.id === 't-hr-term').title === 'Termination: Ana — process');
  ok('new ticket that lead could not see (forged sender) rejected', !gas.tasks().some(t => t.id === 't-new-forge'));
  ok('lead\'s own tickets untouched by that push', gas.tasks().some(t => t.id === 't-perf') && gas.tasks().some(t => t.title === 'New printer'));
  const r2 = gas.post({ action: 'push', email: 'lead@x.com', pwHash: 'pw-lead@x.com', keys: { totTasks: { v: '[]', t: Date.now(), bt: gas.data().keys.totTasks.t } } });
  ok('lead sends an empty list: only HIS tickets are deleted, everyone else\'s stay', gas.tasks().length === 4 && !gas.tasks().some(t => t.fromEmail === 'lead@x.com'), ids(gas.tasks()));
  const a0 = JSON.parse(gas.data().keys.auditLog.v).length;
  gas.post({ action: 'push', email: 'lead@x.com', pwHash: 'pw-lead@x.com', keys: { auditLog: { v: JSON.stringify([{ id: 'fake', ts: 1, who: 'Hana HR', email: 'hr@x.com', act: 'Approved salary' }, { id: 'mine2', ts: 2, who: 'Levan Lead', act: 'did a thing' }]), t: Date.now(), bt: 0 } } });
  const al = JSON.parse(gas.data().keys.auditLog.v);
  ok('audit entry forged in another person\'s name rejected', !al.some(x => x.id === 'fake'));
  ok('own audit entry without e-mail accepted and stamped', al.some(x => x.id === 'mine2' && x.email === 'lead@x.com') && al.length === a0 + 1);

  console.log('5. Two people at once, and the screens');
  await P.mgr.sync();
  await P.coach.sync();
  await P.coach.evaluate(() => { const a = JSON.parse(localStorage.totTasks); a.find(t => t.id === 't-assigned-coach').status = 'waiting'; localStorage.setItem('totTasks', JSON.stringify(a)); });
  await P.mgr.evaluate(() => { const a = JSON.parse(localStorage.totTasks); a.find(t => t.id === 't-acc-term').status = 'done'; localStorage.setItem('totTasks', JSON.stringify(a)); });
  await Promise.all([P.coach.sync(), P.mgr.sync()]); await P.coach.sync(); await P.mgr.sync();
  ok('both edits kept', gas.tasks().find(t => t.id === 't-assigned-coach').status === 'waiting' && gas.tasks().find(t => t.id === 't-acc-term').status === 'done');
  ok('manager no longer sees lead\'s deleted tickets', !(await P.mgr.local('totTasks')).some(t => t.title === 'New printer'));
  await P.hr.sync();
  const prog = await P.hr.evaluate(() => { const c = TasksApi.casesAll()[0]; return c ? JSON.stringify(TasksApi.caseProg(c)) : 'no case'; });
  ok('HR sees case progress across departments (2 tasks, 1 done)', /"n":2,"done":1/.test(prog), prog);
  for (const e of ['lead', 'hr']) { await P[e].evaluate(() => { try { switchView('tasks'); TasksMount(); DeptOpen(); } catch (x) { console.error(x.message); } }); await P[e].waitForTimeout(300); }
  ok('no page errors', !H.errs.length, H.errs.join(' | '));
  console.log(fails ? fails + ' FAILED' : 'ALL PASSED'); await H.close(); process.exit(fails ? 1 : 0);
})();
