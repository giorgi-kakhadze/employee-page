const path = require('path'), tool = process.argv[2] || path.join(__dirname, '..', 'tool', 'PTF-pass-to-floor-Gunda.html'), code = process.argv[3] || path.join(__dirname, '..', 'tool', 'Code.gs');
const gas = require('./fakegas')(code); require('./seed')(gas);
let fails = 0; function ok(n, c, x) { if (!c) fails++; console.log((c ? '  ✅ ' : '  ❌ ') + n + (x ? '  → ' + x : '')); }
const pol = (who) => JSON.parse(gas.post({ action: 'pull', email: who, pwHash: 'pw-' + who }).keys.totAccessPolicy.v);
const ids = (p) => (p.spaces || []).map(s => s.id).sort().join(',');
const sp = (p, id) => (p.spaces || []).filter(s => s.id === id)[0] || {};
const J = JSON.stringify;
function setPolicy(f) { const d = gas.data(), p = JSON.parse(d.keys.totAccessPolicy.v); f(p); d.keys.totAccessPolicy.v = J(p); gas.setData(d); }
const F = (label, type) => ({ id: label.toLowerCase().replace(/[^a-z0-9]+/g, '-'), label, type });
const SPACES = [
  { id: 'training', name: 'Training', icon: 'T', modules: ['onboarding', 'logbooks'], members: { 'coach@x.com': 'viewer', 'Lead@X.com': 'owner' }, open: false, fields: [F('Mentor', 'text')] },
  { id: 'scheduling', name: 'Scheduling', icon: 'S', modules: ['schedule'], members: { 'fmd@x.com': 'editor' }, open: true, fields: [F('Preferred days off', 'text')] },
  { id: 'hr', name: 'HR & Recruitment', icon: 'H', modules: [], members: { 'hr@x.com': 'owner' }, open: false, fields: [F('HR notes', 'note')] }
];
setPolicy(p => { p.spaces = JSON.parse(J(SPACES)); p.spacesStrict = true; });
(async () => {
  console.log('1. Spaces in the access list (server pull)');
  const c = pol('coach@x.com');
  ok('coach: own space and the open one, not HR', ids(c) === 'scheduling,training', ids(c));
  ok('coach: Training members cut to the coach\'s own entry', J(sp(c, 'training').members) === J({ 'coach@x.com': 'viewer' }), J(sp(c, 'training').members));
  ok('coach: Training keeps its screens, name, icon and profile fields', J(sp(c, 'training').modules) === J(['onboarding', 'logbooks']) && sp(c, 'training').name === 'Training' && sp(c, 'training').icon === 'T' && J(sp(c, 'training').fields) === J(SPACES[0].fields));
  ok('coach: open Scheduling space has fields but no members and no screens', J(sp(c, 'scheduling')) === J({ id: 'scheduling', name: 'Scheduling', icon: 'S', open: true, fields: SPACES[1].fields, members: {} }), J(sp(c, 'scheduling')));
  ok('coach: "Strict" switch received', c.spacesStrict === true && c.spacesOn === true, J({ spacesStrict: c.spacesStrict, spacesOn: c.spacesOn }));
  ok('coach: users list unchanged by spaces', Object.keys(c.users).sort().join() === 'coach@x.com,lead@x.com', Object.keys(c.users).sort().join());
  const l = pol('lead@x.com');
  ok('shift lead: member key stored as Lead@X.com still matches', J(sp(l, 'training').members) === J({ 'lead@x.com': 'owner' }), J(sp(l, 'training').members));
  ok('HR: HR space with own entry, plus the open one', ids(pol('hr@x.com')) === 'hr,scheduling' && J(sp(pol('hr@x.com'), 'hr').members) === J({ 'hr@x.com': 'owner' }), ids(pol('hr@x.com')));
  ok('FMD: Scheduling as a member, with screens', J(sp(pol('fmd@x.com'), 'scheduling').modules) === J(['schedule']) && J(sp(pol('fmd@x.com'), 'scheduling').members) === J({ 'fmd@x.com': 'editor' }));
  const m = pol('mgr@x.com');
  ok('manager in no space: only the open space, and told spaces exist', ids(m) === 'scheduling' && m.spacesOn === true && m.spacesStrict === true, ids(m) + ' ' + J({ spacesOn: m.spacesOn }));
  const a = JSON.parse(gas.post({ action: 'pull', admin: 'ADMKEY' }).keys.totAccessPolicy.v);
  ok('admin pull: every space with every member', J(a.spaces) === J(SPACES) && a.spacesStrict === true && a.spacesOn === undefined, ids(a));
  setPolicy(p => { p.spaces.push({ id: '', name: 'No id' }, null, { id: 'x', name: '' }); });
  ok('entries without an id or a name are not sent', ids(pol('coach@x.com')) === 'scheduling,training', ids(pol('coach@x.com')));
  setPolicy(p => { p.spaces = []; });
  ok('empty space list: no spaces, spacesOn not set', J(pol('coach@x.com').spaces) === '[]' && pol('coach@x.com').spacesOn === undefined);
  setPolicy(p => { delete p.spaces; delete p.spacesStrict; });
  ok('policy without spaces: same shape as v3.24', Object.keys(pol('coach@x.com')).sort().join() === 'depts,roles,upd,users', Object.keys(pol('coach@x.com')).sort().join());
  setPolicy(p => { p.spaces = JSON.parse(J(SPACES)); p.spacesStrict = true; });

  console.log('2. The coach\'s synced device (viewer in Training)');
  const H = await require('./harness')(tool, gas);
  const navShown = (p, v) => p.evaluate(v => { const e = document.querySelector('[onclick*="switchView(\'' + v + '\'"]'); return !!e && e.style.display !== 'none'; }, v);
  const state = (p) => p.evaluate(() => { const b = document.getElementById('spPill'), n = document.getElementById('spBan'); return { exam: totSpaceAllows('exam'), onboarding: totSpaceAllows('onboarding'), schedule: totSpaceAllows('schedule'), role: totSpaceRole(), ro: totSpaceRO(), pill: b.style.display === 'none' ? '(hidden)' : b.textContent, ban: n && n.style.display !== 'none' ? n.textContent : '(hidden)', list: totSpaces.list().map(s => s.id + ':' + (totSpaces.role(s.id) || (s.open ? 'open' : '-'))).sort().join() }; });
  const settle = (p) => p.evaluate(() => { window.__spSig = '?'; }).then(() => p.waitForTimeout(3300));   /* the Spaces script re-reads the policy every 3 s */
  const P = await H.open({ email: 'coach@x.com', pw: 'pw-coach@x.com' }); await P.sync(); await settle(P);
  const pc = await P.local('totAccessPolicy');
  ok('device holds the spaces and "Strict"', ids(pc) === 'scheduling,training' && pc.spacesStrict === true, ids(pc));
  let s = await state(P);
  ok('Training screens allowed (Onboarding), others blocked (Workshop, Schedule)', s.onboarding === true && s.exam === false && s.schedule === false, J(s));
  ok('role is viewer, so view only', s.role === 'viewer' && s.ro === true, s.role + ' ' + s.ro);
  ok('space pill shows Training as viewer', s.pill === 'T Training 👁', s.pill);
  ok('home banner names the space', /Training/.test(s.ban) && /Viewer/.test(s.ban), s.ban);
  ok('menu: the Workshop button is hidden', !(await navShown(P, 'exam')));
  ok('profile tabs: Training as viewer, Scheduling open to view', s.list === 'scheduling:open,training:viewer', s.list);
  await P.sync(); await P.sync();
  ok('coach syncs do not change the server\'s spaces', J(JSON.parse(gas.data().keys.totAccessPolicy.v).spaces) === J(SPACES));

  console.log('3. "Strict" for a person in no space');
  const M = await H.open({ email: 'mgr@x.com', pw: 'pw-mgr@x.com' }); await M.sync(); await settle(M);
  s = await state(M);
  ok('manager in no space: only Home', await navShown(M, 'home') && s.schedule === false && s.onboarding === false && s.exam === false, J(s));
  ok('pill says "No space"', s.pill === '📁 No space', s.pill);
  ok('banner says no screens are open', /not in any space/.test(s.ban), s.ban);
  ok('menu: the Schedule button is hidden', !(await navShown(M, 'schedule')));
  setPolicy(p => { p.spaces.forEach(x => { x.open = false; }); });
  await M.sync(); await settle(M); s = await state(M);
  ok('no space sent at all (none open): still only Home', J((await M.local('totAccessPolicy')).spaces) === '[]' && s.schedule === false && s.onboarding === false, J(s));
  ok('…pill still says "No space"', s.pill === '📁 No space', s.pill);
  setPolicy(p => { p.spacesStrict = false; });
  await M.sync(); await settle(M); s = await state(M);
  ok('"Strict" off: the manager\'s screens open again', s.schedule === true && s.onboarding === true && s.ban === '(hidden)', J(s));
  ok('menu: the Schedule button is back', await navShown(M, 'schedule'));
  setPolicy(p => { p.spaces = []; p.spacesStrict = true; });
  await M.sync(); await settle(M); s = await state(M);
  ok('"Strict" on but no spaces at all: nobody is locked out', s.schedule === true && s.pill === '(hidden)', J(s));

  console.log('4. Admin screen');
  setPolicy(p => { p.spaces = JSON.parse(J(SPACES)); p.spacesStrict = true; });
  const A = await H.open({ admin: true }); await A.sync(); await settle(A);
  const mem = await A.evaluate(() => { document.getElementById('spPill').click(); document.querySelector('#spMenu [data-sp="__manage"]').click(); const t = document.querySelector('.spCard[data-i="0"] [data-f=members]').value; document.querySelector('.spOv').remove(); return t; });
  ok('Manage spaces lists every Training member', /coach@x\.com, viewer/.test(mem) && /lead@x\.com, owner/i.test(mem), J(mem));
  ok('no page errors', !H.errs.length, H.errs.join(' | '));
  console.log(fails ? fails + ' FAILED' : 'ALL PASSED'); await H.close(); process.exit(fails ? 1 : 0);
})();
