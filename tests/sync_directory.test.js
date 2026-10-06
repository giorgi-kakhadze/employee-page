const path = require('path'), tool = process.argv[2] || path.join(__dirname, '..', 'tool', 'PTF-pass-to-floor-Gunda.html'), code = process.argv[3] || path.join(__dirname, '..', 'tool', 'Code.gs');
const gas = require('./fakegas')(code), seeded = require('./seed')(gas);
let fails = 0; function ok(n, c, x) { if (!c) fails++; console.log((c ? '  ✅ ' : '  ❌ ') + n + (x ? '  → ' + x : '')); }
const pol = (who) => JSON.parse(gas.post({ action: 'pull', email: who, pwHash: 'pw-' + who }).keys.totAccessPolicy.v);
const emails = (p) => Object.keys(p.users).sort().join(',');
const onlyNameRole = (p, me) => Object.keys(p.users).filter(e => e !== me).every(e => Object.keys(p.users[e]).sort().join() === 'name,role');
function setPolicy(f) { const d = gas.data(), p = JSON.parse(d.keys.totAccessPolicy.v); f(p); d.keys.totAccessPolicy.v = JSON.stringify(p); gas.setData(d); }
(async () => {
  console.log('1. Colleague directory in the access list (server pull)');
  const c = pol('coach@x.com');
  ok('coach: own department only (coach + shift lead), no HR, FMD or manager', emails(c) === 'coach@x.com,lead@x.com', emails(c));
  ok('coach: shift lead entry is name and position only', JSON.stringify(c.users['lead@x.com']) === JSON.stringify({ name: 'Levan Lead', role: 'shift_lead' }), JSON.stringify(c.users['lead@x.com']));
  ok('coach: own entry unchanged (sites kept)', JSON.stringify(c.users['coach@x.com']) === JSON.stringify(seeded['coach@x.com']), JSON.stringify(c.users['coach@x.com']));
  ok('coach: same top-level shape as before', Object.keys(c).sort().join() === 'depts,roles,upd,users', Object.keys(c).sort().join());
  ok('shift lead: sees the coach', emails(pol('lead@x.com')) === 'coach@x.com,lead@x.com', emails(pol('lead@x.com')));
  ok('HR: nobody else in HR, so only own entry', emails(pol('hr@x.com')) === 'hr@x.com', emails(pol('hr@x.com')));
  const m = pol('mgr@x.com');
  ok('manager: everyone', emails(m) === Object.keys(seeded).sort().join(), emails(m));
  ok('manager: other people are name and position only', onlyNameRole(m, 'mgr@x.com'));
  ok('manager: own entry unchanged', JSON.stringify(m.users['mgr@x.com']) === JSON.stringify(seeded['mgr@x.com']));
  gas.addUser('new@x.com', 'pw-new@x.com', 'Nia New');
  ok('approved account with no position yet: empty list', emails(pol('new@x.com')) === '', emails(pol('new@x.com')));

  console.log('2. Department mapping from Admin → Space access by role (policy.depts)');
  setPolicy(p => { p.depts = { hr_recruiter: 'performance' }; });
  ok('HR position moved to Performance: coach now sees Hana HR', emails(pol('coach@x.com')) === 'coach@x.com,hr@x.com,lead@x.com', emails(pol('coach@x.com')));
  setPolicy(p => { p.depts = { scheduling_coordinator: 'management' }; });
  ok('scheduling coordinator moved to Management: sees everyone', emails(pol('fmd@x.com')) === Object.keys(seeded).sort().join(), emails(pol('fmd@x.com')));
  setPolicy(p => { p.depts = {}; p.users['sen@x.com'] = { role: 'senior', name: 'Sandro Senior', sites: ['main'] }; });
  gas.addUser('sen@x.com', 'pw-sen@x.com', 'Sandro Senior');
  ok('senior: sees everyone', emails(pol('sen@x.com')) === Object.keys(seeded).concat('sen@x.com').sort().join(), emails(pol('sen@x.com')));
  ok('coach: back to own department after the mapping is removed', emails(pol('coach@x.com')) === 'coach@x.com,lead@x.com', emails(pol('coach@x.com')));

  console.log('3. "Assign to…" on the coach\'s synced device');
  const H = await require('./harness')(tool, gas);
  const P = await H.open({ email: 'coach@x.com', pw: 'pw-coach@x.com' }); await P.sync();
  const opts = (sel) => P.evaluate(s => Array.from(document.querySelectorAll(s + ' option')).map(o => o.textContent).filter(t => !/^(Anyone|Any |Unassigned|Assign to|↩)/.test(t)).sort().join(','), sel);
  ok('device holds the directory', emails(await P.local('totAccessPolicy')) === 'coach@x.com,lead@x.com');
  await P.evaluate(() => { TasksApi.open('t-perf'); }); await P.waitForTimeout(300);
  ok('Tasks: ticket window lists both Performance people', (await opts('#kdAs')) === 'Cora Coach,Levan Lead', await opts('#kdAs'));
  await P.evaluate(() => { document.querySelectorAll('.tkOv').forEach(o => o.remove()); DeptOpen('performance', 'board'); }); await P.waitForTimeout(300);
  ok('Department board: assignee filter lists the shift lead', /Levan Lead/.test(await opts('#dwFa')), await opts('#dwFa'));
  await P.evaluate(() => document.querySelector('button[data-a="new"]').click()); await P.waitForTimeout(300);
  ok('New ticket: "Assign to a person" lists both Performance people', (await opts('#ntPe')) === 'Cora Coach,Levan Lead', await opts('#ntPe'));
  await P.evaluate(() => { const s = document.getElementById('ntTo'); s.value = 'hr'; s.dispatchEvent(new Event('change')); });
  ok('New ticket to HR: no HR names on this device', (await opts('#ntPe')) === '', await opts('#ntPe'));

  console.log('4. Must-read counts use the directory only where it is complete');
  setPolicy(p => { p.users['acad@x.com'] = { role: 'training_coordinator', name: 'Ada Academy', sites: ['main'] }; p.users['acad2@x.com'] = { role: 'training_coordinator', name: 'Aki Academy', sites: ['main'] }; });
  gas.addUser('acad@x.com', 'pw-acad@x.com', 'Ada Academy'); gas.addUser('acad2@x.com', 'pw-acad2@x.com', 'Aki Academy');
  const d = gas.data(), now = Date.now(), A = (id, title, toRoles) => ({ id, title, body: 'x', toRoles, important: true, fromName: 'Ada Academy', fromEmail: 'acad@x.com', fromRole: 'training_coordinator', created: now, u: now });
  d.keys.totAnnouncements = { v: JSON.stringify(JSON.parse(d.keys.totAnnouncements.v).concat([A('a-must', 'Must read: all staff', []), A('a-must-ac', 'Must read: Academy', ['academy'])])), t: now };
  d.keys.totComments = { v: JSON.stringify(JSON.parse(d.keys.totComments.v).concat(['a-must', 'a-must-ac'].map(r => ({ id: 'ack-' + r, kind: 'ack', ref: r, who: 'Aki Academy', email: 'acad2@x.com', ts: now, text: '' })))), t: now };
  gas.setData(d);
  const receipt = (p, id) => p.evaluate(id => { TasksOpen('news'); const c = document.querySelector('[data-aid="' + id + '"]'); const r = c && Array.from(c.querySelectorAll('.tkM')).filter(x => /Acknowledged/.test(x.textContent))[0]; return r ? r.textContent.trim() : '(none)'; }, id);
  const dashRow = (p, title) => p.evaluate(t => { switchView('home'); const b = document.querySelector('#dashCard [data-t="team"]'); if (b) b.click(); const r = Array.from(document.querySelectorAll('#dashCard .dbRow')).filter(x => x.textContent.indexOf(t) === 0)[0]; return r ? r.querySelector('small').textContent.trim() : '(none)'; }, title);
  const ac = await H.open({ email: 'acad@x.com', pw: 'pw-acad@x.com' }); await ac.sync();
  ok('training coordinator posting to everyone: no total (the device does not know everyone)', (await receipt(ac, 'a-must')) === '✔ Acknowledged 1', await receipt(ac, 'a-must'));
  ok('…and to Academy only: full total from the directory', (await receipt(ac, 'a-must-ac')) === '✔ Acknowledged 1 / 1 · everyone has read it', await receipt(ac, 'a-must-ac'));
  ok('Team dashboard: everyone announcement has no total', (await dashRow(ac, 'Must read: all staff')) === '1 read', await dashRow(ac, 'Must read: all staff'));
  ok('Team dashboard: Academy announcement has a total', (await dashRow(ac, 'Must read: Academy')) === '1 / 1 read', await dashRow(ac, 'Must read: Academy'));
  const mg = await H.open({ email: 'mgr@x.com', pw: 'pw-mgr@x.com' }); await mg.sync();
  ok('manager: total counts everyone except the poster', /^✔ Acknowledged 1 \/ 7 · waiting: /.test(await receipt(mg, 'a-must')), await receipt(mg, 'a-must'));
  ok('no page errors', !H.errs.length, H.errs.join(' | '));
  console.log(fails ? fails + ' FAILED' : 'ALL PASSED'); await H.close(); process.exit(fails ? 1 : 0);
})();
