const path = require('path'), tool = process.argv[2] || path.join(__dirname, '..', 'tool', 'PTF-pass-to-floor-Gunda.html'), code = process.argv[3] || path.join(__dirname, '..', 'tool', 'Code.gs');
const gas = require('./fakegas')(code); require('./seed')(gas);
let fails = 0; function ok(n, c, x) { if (!c) fails++; console.log((c ? '  ✅ ' : '  ❌ ') + n + (x ? '  → ' + x : '')); }
(async () => {
  const H = await require('./harness')(tool, gas);
  const mgr = await H.open({ email: 'mgr@x.com', pw: 'pw-mgr@x.com' }); await mgr.sync();
  console.log('Deleting from another shared list (department documents)');
  await mgr.evaluate(() => localStorage.setItem('totDeptDocs', JSON.stringify([{ id: 'd1', dept: 'hr', title: 'Policy', url: 'https://x.y/p', cat: 'Policy', ts: 1 }, { id: 'd2', dept: 'hr', title: 'Form', url: 'https://x.y/f', cat: 'Policy', ts: 2 }])));
  await mgr.sync();
  ok('two documents on the server', JSON.parse(gas.data().keys.totDeptDocs.v).length === 2);
  await mgr.evaluate(() => localStorage.setItem('totDeptDocs', JSON.stringify(JSON.parse(localStorage.totDeptDocs).filter(d => d.id !== 'd1'))));
  await mgr.sync(); await mgr.sync();
  ok('deleted document stays deleted (it used to come back)', JSON.parse(gas.data().keys.totDeptDocs.v).map(d => d.id).join() === 'd2', JSON.parse(gas.data().keys.totDeptDocs.v).map(d => d.id).join());
  console.log('Second site (keys stored as s~<site>~name)');
  const d = gas.data(), pol = JSON.parse(d.keys.totAccessPolicy.v); pol.users['lead@x.com'].sites = ['main', 'tbilisi']; d.keys.totAccessPolicy.v = JSON.stringify(pol);
  d.keys['s~tbilisi~totTasks'] = { v: JSON.stringify([{ id: 's1', title: 'Site HR', toRole: 'hr', fromEmail: 'hr@x.com' }, { id: 's2', title: 'Site perf', toRole: 'performance', fromEmail: 'mgr@x.com' }]), t: 5 };
  d.keys['s~tbilisi~totComments'] = { v: JSON.stringify([{ id: 'sc1', kind: 'task', ref: 's1', email: 'hr@x.com', text: 'hr' }, { id: 'sc2', kind: 'task', ref: 's2', email: 'mgr@x.com', text: 'perf' }]), t: 5 };
  gas.setData(d);
  const r = gas.post({ action: 'pull', email: 'lead@x.com', pwHash: 'pw-lead@x.com' });
  ok('site tickets filtered', JSON.parse(r.keys['s~tbilisi~totTasks'].v).map(x => x.id).join() === 's2');
  ok('site comments follow the site\'s tickets', JSON.parse(r.keys['s~tbilisi~totComments'].v).map(x => x.id).join() === 'sc2');
  const ra = gas.post({ action: 'pull', admin: 'ADMKEY' });
  ok('admin pull has no internal deletion list', ra.del === undefined && !!ra.keys.totTasks);
  ok('no page errors', !H.errs.length, H.errs.join(' | '));
  console.log(fails ? fails + ' FAILED' : 'ALL PASSED'); await H.close(); process.exit(fails ? 1 : 0);
})();
