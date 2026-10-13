/* v3.38 💬 Community: channels (only managers and the admin create them) and direct / group chats for staff.
   Checks the screens on real devices and the server rules: who reads what, who may create, post, edit, remove, and that direct chats stay private. */
const path = require('path'), tool = process.argv[2] || path.join(__dirname, '..', 'tool', 'PTF-pass-to-floor-Gunda.html'), code = process.argv[3] || path.join(__dirname, '..', 'tool', 'Code.gs');
const gas = require('./fakegas')(code); require('./seed')(gas);
let fails = 0; function ok(name, cond, extra) { if (!cond) fails++; console.log((cond ? '  ✅ ' : '  ❌ ') + name + (extra ? '  → ' + extra : '')); }
gas.addUser('sen@x.com', 'pw-sen@x.com', 'Sandro Senior');
(function () { const d = gas.data(), p = JSON.parse(d.keys.totAccessPolicy.v); p.users['sen@x.com'] = { role: 'senior', name: 'Sandro Senior', sites: ['main'] }; d.keys.totAccessPolicy = { v: JSON.stringify(p), t: Date.now() }; gas.setData(d); })();
const pull = (email) => gas.post({ action: 'pull', email, pwHash: 'pw-' + email }).keys || {};
const arrOf = (k, e) => { const x = pull(e)[k]; return x ? JSON.parse(x.v) : []; };
const srv = (k) => JSON.parse((gas.data().keys[k] || { v: '[]' }).v);
const push = (email, k, a) => gas.post({ action: 'push', email, pwHash: 'pw-' + email, keys: { [k]: { v: JSON.stringify(a), t: Date.now() } } });
(async () => {
  const H = await require('./harness')(tool, gas);
  const open = async (who) => { const P = await H.open({ email: who + '@x.com', pw: 'pw-' + who + '@x.com' }); await P.setViewportSize({ width: 1440, height: 900 }); await P.sync(); await P.waitForTimeout(600); return P; };
  const W = (P, ms) => P.waitForTimeout(ms || 300);

  console.log('1. A manager creates channels');
  const M = await open('mgr');
  ok('the top bar has 💬 Community', await M.evaluate(() => getComputedStyle(document.getElementById('navCommunity')).display !== 'none'));
  await M.click('#navCommunity'); await W(M, 500);
  ok('it opens on Channels, with "+ New channel" for a manager', await M.evaluate(() => currentView === 'community' && !!document.querySelector('#communityView [data-a="newch"]')));
  const sub = await M.evaluate(() => spaceItems('community').map(x => x.pid)); ok('second bar: Channels and Chats', sub.join(',') === 'community.channels,community.chats', sub.join(','));
  await M.click('#communityView [data-a="newch"]'); await W(M);
  await M.fill('#cfN', 'Shift leads'); await M.check('input[name=cfA][value=some]'); await M.check('.cfDp[value=performance]'); await M.click('#cfS'); await W(M);
  await M.click('#communityView [data-a="newch"]'); await W(M);
  await M.fill('#cfN', 'All staff'); await M.selectOption('#cfM', 'announce'); await M.click('#cfS'); await W(M);
  await M.fill('#cmTx', 'Welcome everyone! Please read the new break rules.'); await M.check('#cmAnn'); await M.click('#communityView [data-a="send"]'); await W(M);
  await M.sync(); await M.sync();
  const ch = srv('totChannels'), sl = ch.find(c => c.name === 'Shift leads'), as = ch.find(c => c.name === 'All staff');
  ok('both channels are on the server with their audience and mode', !!sl && !!as && sl.aud.depts.join() === 'performance' && as.aud.all && as.mode === 'announce', JSON.stringify(ch.map(c => c.name)));
  ok('the announcement is saved', srv('totMessages').some(m => m.ch === as.id && m.ann && /break rules/.test(m.text)));

  console.log('2. Seniors and others cannot create channels');
  const S = await open('sen'); await S.click('#navCommunity'); await W(S, 500);
  ok('a senior has no "+ New channel"', await S.evaluate(() => !document.querySelector('#communityView [data-a="newch"]')));
  push('sen@x.com', 'totChannels', srv('totChannels').concat([{ id: 'ch-forged', kind: 'ch', name: 'Seniors only', aud: { all: true }, byEmail: 'sen@x.com' }]));
  ok('server: a channel made by a senior is refused', !srv('totChannels').some(c => c.id === 'ch-forged'));
  push('lead@x.com', 'totChannels', arrOf('totChannels', 'lead@x.com').map(c => c.id === sl.id ? Object.assign({}, c, { name: 'Hacked', aud: { all: true } }) : c));
  ok('server: a non-manager cannot rename or open up a channel', srv('totChannels').find(c => c.id === sl.id).name === 'Shift leads');
  await S.context().close();

  console.log('3. Who reads which channel');
  ok('shift lead (Performance) gets Shift leads and All staff', (a => a.includes('Shift leads') && a.includes('All staff'))(arrOf('totChannels', 'lead@x.com').map(c => c.name)));
  ok('HR gets All staff but not Shift leads, nor its messages', (a => a.includes('All staff') && !a.includes('Shift leads'))(arrOf('totChannels', 'hr@x.com').map(c => c.name)) && !arrOf('totMessages', 'hr@x.com').some(m => m.ch === sl.id));

  console.log('4. A shift lead posts, replies and reacts; announcement channel is managers-only for new posts');
  const L = await open('lead'); await L.click('#navCommunity'); await W(L, 500);
  ok('the shift lead sees no "+ New channel"', await L.evaluate(() => !document.querySelector('#communityView [data-a="newch"]')));
  await L.click('#communityView .cmIt:has-text("All staff")'); await W(L);
  const ann = await L.evaluate(() => ({ composer: !!document.getElementById('cmTx'), note: (document.querySelector('.cmCp') || {}).textContent || '', post: !!document.querySelector('.cmMsg.ann') }));
  ok('All staff: the announcement shows, and only managers start posts there', ann.post && !ann.composer && /Only managers/.test(ann.note), JSON.stringify(ann));
  const aid = srv('totMessages').find(m => m.ch === as.id && m.ann).id;
  await L.hover('.cmMsg.ann'); await L.click('.cmMsg.ann [data-a="thread"]'); await W(L); await L.fill('#cmRep', 'Thanks, read it ✅'); await L.press('#cmRep', 'Enter'); await W(L);
  await L.hover('.cmMsg.ann .who'); await L.click('.cmMsg.ann > .cmAct [data-e="👍"]'); await W(L);
  await L.click('#communityView .cmIt:has-text("Shift leads")'); await W(L);
  await L.fill('#cmTx', '@Mia can we swap the Friday briefing?'); await L.press('#cmTx', 'Enter'); await W(L);
  await L.sync(); await L.sync();
  const ms = srv('totMessages');
  ok('server: reply in the thread, reaction and post are saved under his e-mail', ms.some(m => m.parent === aid && m.email === 'lead@x.com') && ms.some(m => m.kind === 'react' && m.ref === aid && m.email === 'lead@x.com') && ms.some(m => m.ch === sl.id && /swap the Friday/.test(m.text) && m.email === 'lead@x.com'));
  push('lead@x.com', 'totMessages', arrOf('totMessages', 'lead@x.com').concat([{ id: 'm-forged', ch: as.id, kind: 'msg', email: 'lead@x.com', by: 'Levan Lead', ts: Date.now(), text: 'top-level in announcements' }, { id: 'm-fake', ch: sl.id, kind: 'msg', email: 'mgr@x.com', by: 'Mia Manager', ts: Date.now(), text: 'pretending to be Mia' }]));
  ok('server: no top-level post in an announcement channel, no message under someone else\'s name', !srv('totMessages').some(m => m.id === 'm-forged' || m.id === 'm-fake'));
  push('lead@x.com', 'totMessages', arrOf('totMessages', 'lead@x.com').map(m => m.id === aid ? Object.assign({}, m, { text: 'changed by lead' }) : m));
  ok('server: nobody edits someone else\'s message', /break rules/.test(srv('totMessages').find(m => m.id === aid).text));

  console.log('5. Direct chat: private to its members');
  await L.click('#spaceSub button:has-text("Chats")'); await W(L);
  await L.click('#communityView [data-a="newdm"]'); await W(L);
  await L.fill('.tkOv .cmPq', 'hana'); await L.check('.tkOv .cmPick input[value="hr@x.com"]'); await L.click('#dfS'); await W(L);
  await L.fill('#cmTx', 'Hi Hana, private question about my contract'); await L.press('#cmTx', 'Enter'); await W(L);
  await L.sync(); await L.sync();
  const dm = srv('totChannels').find(c => c.kind === 'dm');
  ok('the chat exists with exactly the two of them', !!dm && dm.members.slice().sort().join() === 'hr@x.com,lead@x.com', JSON.stringify(dm && dm.members));
  ok('server: the manager does not receive the chat or its messages', !arrOf('totChannels', 'mgr@x.com').some(c => c.kind === 'dm') && !arrOf('totMessages', 'mgr@x.com').some(m => /contract/.test(m.text)));
  ok('server: the coach does not receive it either', !arrOf('totMessages', 'coach@x.com').some(m => /contract/.test(m.text)));
  push('coach@x.com', 'totChannels', arrOf('totChannels', 'coach@x.com').concat([Object.assign({}, dm, { members: ['coach@x.com', 'lead@x.com'] })]));
  ok('server: nobody can add themselves to someone else\'s chat', srv('totChannels').find(c => c.id === dm.id).members.indexOf('coach@x.com') < 0);
  const Hr = await open('hr'); await Hr.waitForTimeout(1600);
  const bell = await Hr.evaluate(() => { document.getElementById('bellBtn').click(); const t = [...document.querySelectorAll('.tkOv .tkCard')].map(c => c.textContent).join(' | '); return t; });
  ok('HR gets the chat in the bell', /Levan Lead: Hi Hana/.test(bell), bell.slice(0, 120));
  await Hr.evaluate(() => { const c = [...document.querySelectorAll('.tkOv .tkCard')].find(x => /Hi Hana/.test(x.textContent)); c.click(); }); await W(Hr, 600);
  const hs = await Hr.evaluate(() => ({ view: currentView, st: Community.state(), txt: document.querySelector('#cmList').textContent }));
  ok('clicking it opens the chat', hs.view === 'community' && hs.st.tab === 'chats' && /private question/.test(hs.txt), JSON.stringify(hs.st));
  await Hr.fill('#cmTx', 'Sure, come by at 3'); await Hr.press('#cmTx', 'Enter'); await W(Hr); await Hr.sync(); await Hr.sync();
  await L.sync(); await L.waitForTimeout(1800);
  ok('the answer reaches the shift lead (chat on screen updates)', await L.evaluate(() => /come by at 3/.test(document.querySelector('#cmList').textContent)));

  console.log('6. Manager moderation, unread counts and mentions');
  await M.sync(); await M.waitForTimeout(1800);
  const mb = await M.evaluate(() => { document.getElementById('bellBtn').click(); const t = [...document.querySelectorAll('.tkOv .tkCard')].map(c => c.textContent).join(' | '); document.querySelectorAll('.tkOv').forEach(o => o.remove()); return { t, n: Community.unread() }; });
  ok('the manager is told about the @mention and the reply count shows unread', /mentioned you/.test(mb.t) && mb.n >= 1, mb.t.slice(0, 120) + ' / ' + mb.n);
  await M.evaluate(() => Community.open(Community && JSON.parse(localStorage.getItem('totChannels')).find(c => c.name === 'Shift leads').id)); await W(M, 500);
  await M.hover('.cmMsg:has-text("swap the Friday")'); await M.click('.cmMsg:has-text("swap the Friday") [data-a="remove"]'); await W(M); await M.sync(); await M.sync();
  ok('server: a manager removes a message in a channel', !!srv('totMessages').find(m => /swap/.test(m.text || '') === false && m.email === 'lead@x.com' && m.ch === sl.id && m.del));
  await M.click('[data-a="editch"]'); await W(M); await M.check('#cfX'); await M.click('#cfS'); await W(M); await M.sync(); await M.sync();
  ok('server: the channel is archived', !!srv('totChannels').find(c => c.id === sl.id).archived);
  push('lead@x.com', 'totMessages', arrOf('totMessages', 'lead@x.com').concat([{ id: 'm-late', ch: sl.id, kind: 'msg', email: 'lead@x.com', by: 'Levan Lead', ts: Date.now(), text: 'after archive' }]));
  ok('server: nobody writes in an archived channel', !srv('totMessages').some(m => m.id === 'm-late'));

  console.log('7. Access management covers Community');
  const d = gas.data(), p = JSON.parse(d.keys.totAccessPolicy.v); p.access = { roles: {}, users: { 'hr@x.com': { 'community.chats': 'none' }, 'coach@x.com': { '@community': 'none' } } }; d.keys.totAccessPolicy = { v: JSON.stringify(p), t: Date.now() + 5000 }; gas.setData(d);
  await Hr.sync(); await Hr.waitForTimeout(1700);
  const hsub = await Hr.evaluate(() => spaceItems('community').map(x => x.pid));
  ok('Chats hidden for one person: only Channels left', hsub.join(',') === 'community.channels', hsub.join(','));
  ok('Community hidden: the server sends no channels or messages', !pull('coach@x.com').totChannels && !pull('coach@x.com').totMessages);
  ok('the employee page has no Community', !/totChannels|Community/.test(require('fs').readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8')));
  ok('the version is up to date', await M.evaluate(() => window.TOT_VERSION) === '3.40');

  ok('no page errors', H.errs.length === 0, H.errs.slice(0, 3).join(' | '));
  await H.close();
  console.log('community: ' + (fails ? fails + ' FAILED' : 'ALL PASSED'));
  process.exit(fails ? 1 : 0);
})();
