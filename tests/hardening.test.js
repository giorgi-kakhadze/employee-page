/* v3.39 hardening: fixes found by the mass test of the server and the employee page.
   Server only (no browser): employee sign-in and requests, record authorship, key names, bad bodies, Community edge cases, mail recipients, secrets. */
const path = require('path'), code = process.argv[3] || path.join(__dirname, '..', 'tool', 'Code.gs');
const gas = require('./fakegas')(code); require('./seed')(gas);
let fails = 0; function ok(name, cond, extra) { if (!cond) fails++; console.log((cond ? '  ✅ ' : '  ❌ ') + name + (extra ? '  → ' + extra : '')); }
const now = Date.now(), P = (o) => ({ v: JSON.stringify(o), t: now - 500 });
const iso = (d) => new Date(Date.now() + d * 864e5).toISOString().slice(0, 10);
const E = (id, name, email, wid, status) => ({ id, fullName: name, nickname: name.split(' ')[0], workId: wid, status: status || 'Employed', email, ext: { email } });
const sched = (days) => ({ byEmail: { 'ana1@x.com': { sx: days, group: 'A', shift: 'morning' } }, sent: {} });
const d = gas.data();
Object.assign(d.keys, {
  employeeDataSource: P([E('e1', 'Ana Beridze', 'ana1@x.com', 'W1'), E('e2', 'Ana Beridze', 'ana3@x.com', 'W3'), E('e3', 'Nika Gela', 'nika@x.com', ''), E('e4', 'Luka Solo', 'luka@x.com', ''), E('e5', 'Gone Person', 'gone@x.com', 'W9', 'Terminated'), E('e6', 'Old Timer', 'old@x.com', 'W8', 'Retired')]),
  totRetrain: P({ sessions: [{ id: 's1', rows: [{ wid: 'W1', name: 'Ana Beridze', date: '2026-10-01', reason: 'RETRAIN-W1', attend: '' }, { name: 'Luka Solo', date: '2026-10-02', reason: 'RETRAIN-LUKA', attend: '' }] }] }),
  totRemarks: P([{ id: 'r1', name: 'Ana Beridze', date: '2026-10-01', kind: 'remark', title: 'NO-ID-REMARK', text: 'x', by: 'Mia' }, { id: 'r2', workId: 'W1', name: 'Ana Beridze', date: '2026-10-02', kind: 'remark', title: 'W1-REMARK', text: 'x', by: 'Mia' }, { id: 'r3', name: 'Nika Gela', date: '2026-10-03', kind: 'remark', title: 'NIKA-REMARK', text: 'x', by: 'Mia' }, { id: 'r4', workId: 'W3', name: 'Ana Beridze', date: '2026-10-04', kind: 'remark', title: 'W3-REMARK', text: 'x', by: 'Mia' }]),
  totMySchedules: P(sched([{ d: iso(2), s: 'morning', f: 8, t: 16 }, { d: iso(3), s: 'afternoon', f: 14, t: 22 }])),
  totIntegrations: P({ flows: { url: 'https://flow.example/secret-trigger' } }),
  totAnnouncements: P([{ id: 'a-all', title: 'Welcome', body: 'x', toRoles: [], fromName: 'Mia Manager', fromEmail: 'mgr@x.com', created: now, u: now }, { id: 'a-lead', title: 'Mine', body: 'x', toRoles: [], fromName: 'Levan Lead', fromEmail: 'lead@x.com', created: now, u: now }]),
  totComments: P([{ id: 'cm-m', kind: 'ann', ref: 'a-all', who: 'Mia Manager', email: 'mgr@x.com', ts: now, text: 'from Mia' }]),
  totChannels: P([{ id: 'ch-ann', kind: 'ch', name: 'News', aud: { all: true }, mode: 'announce', byEmail: 'mgr@x.com' }, { id: 'ch-open', kind: 'ch', name: 'Talk', aud: { all: true }, mode: 'open', byEmail: 'mgr@x.com' }, { id: 'ch-arch', kind: 'ch', name: 'Old', aud: { all: true }, mode: 'open', byEmail: 'mgr@x.com', archived: true }]),
  totMessages: P([{ id: 'm-old1', ch: 'ch-open', kind: 'msg', email: 'mgr@x.com', by: 'Mia', ts: now - 10000, text: 'older message 1' }, { id: 'm-arch', ch: 'ch-arch', kind: 'msg', email: 'lead@x.com', by: 'Levan Lead', ts: now - 9000, text: 'in the archive' }, { id: 'm-ann', ch: 'ch-ann', kind: 'msg', email: 'mgr@x.com', by: 'Mia', ts: now - 8000, text: 'news item', ann: true }])
});
gas.setData(d);
['ana1@x.com', 'ana3@x.com', 'nika@x.com', 'luka@x.com', 'gone@x.com', 'old@x.com'].forEach(e => gas.addUser && 0);
const me = (e) => gas.post({ action: 'me', idToken: 'gtok:' + e });
const rq = (e, o) => gas.post(Object.assign({ action: 'reqNew', idToken: 'gtok:' + e }, o));
const pull = (e) => gas.post({ action: 'pull', email: e, pwHash: 'pw-' + e }).keys || {};
const push = (e, k, a) => gas.post({ action: 'push', email: e, pwHash: 'pw-' + e, keys: { [k]: { v: JSON.stringify(a), t: Date.now() } } });
const srv = (k) => JSON.parse((gas.data().keys[k] || { v: '[]' }).v);

console.log('1. Employees with the same name never see each other\'s records');
const a1 = me('ana1@x.com'), a3 = me('ana3@x.com'), nk = me('nika@x.com'), lk = me('luka@x.com');
const rtOf = (m) => (m.retraining || []).map(x => x.reason).join(), rmOf = (m) => (m.remarks || []).map(x => x.title).sort().join();
ok('Ana (W1) gets her retraining row and her W1 remark only', rtOf(a1) === 'RETRAIN-W1' && rmOf(a1) === 'W1-REMARK', rtOf(a1) + ' / ' + rmOf(a1));
ok('the other Ana (W3) gets none of them, only her own W3 remark', !rtOf(a3) && rmOf(a3) === 'W3-REMARK', rtOf(a3) + ' / ' + rmOf(a3));
ok('a record with no ID and a shared name belongs to nobody', !/NO-ID/.test(rmOf(a1) + rmOf(a3)));
ok('a unique name still matches records without an ID', rmOf(nk) === 'NIKA-REMARK' && rtOf(lk) === 'RETRAIN-LUKA', rmOf(nk) + ' / ' + rtOf(lk));

console.log('2. Terminated and retired employees');
ok('a terminated employee gets no data', !!me('gone@x.com').error && !me('gone@x.com').profile, JSON.stringify(me('gone@x.com')).slice(0, 80));
ok('a retired employee gets no data', !!me('old@x.com').error);
ok('and cannot send a request', !!rq('gone@x.com', { type: 'payq', from: iso(0), note: 'my pay?' }).error);

console.log('3. Requests: validation');
ok('type "constructor" is refused', rq('ana1@x.com', { type: 'constructor', from: iso(2) }).error === 'bad type');
ok('type "toString" is refused', rq('ana1@x.com', { type: 'toString', from: iso(2) }).error === 'bad type');
ok('2027-02-30 is not a date', /valid dates/.test(rq('ana1@x.com', { type: 'annual', from: '2027-02-30', to: '2027-03-01' }).error || ''));
ok('sick leave cannot be booked 300 days ahead', !!rq('ana1@x.com', { type: 'sick', from: iso(300) }).error);
ok('sick leave for today is fine', rq('ana1@x.com', { type: 'sick', from: iso(0), note: 'flu' }).ok === true);
ok('a swap without a colleague is refused', !!rq('ana1@x.com', { type: 'swap', from: iso(2), shift: 'morning', withName: '' }).error);
ok('a pay question without text is refused', !!rq('ana1@x.com', { type: 'payq', from: iso(0), note: '  ' }).error);
ok('two different pay questions on the same day are both accepted', rq('ana1@x.com', { type: 'payq', from: iso(0), note: 'First question' }).ok === true && rq('ana1@x.com', { type: 'payq', from: iso(0), note: 'Second question' }).ok === true);
ok('the same pay question twice is a duplicate', /already sent/.test(rq('ana1@x.com', { type: 'payq', from: iso(0), note: 'First question' }).error || ''));
const sw = rq('ana1@x.com', { type: 'swap', from: iso(2), shift: 'morning', withName: 'Nino K' });
ok('a swap for a working day is accepted', sw.ok === true, sw.error);
ok('a give-away of the same shift is refused while the swap is open', /open swap or give-away/.test(rq('ana1@x.com', { type: 'giveaway', from: iso(2), shift: 'morning' }).error || ''));
ok('a swap with another colleague for a different shift is fine', rq('ana1@x.com', { type: 'swap', from: iso(3), shift: 'afternoon', withName: 'Nino K' }).ok === true);
const txt = 'I <3 you; x<y && y>z 😀'.repeat(1) + 'a'.repeat(497), r2 = rq('ana1@x.com', { type: 'dayoff', from: iso(20), note: txt });
const stored = srv('totEmpRequests').filter(r => r.type === 'dayoff').pop() || {};
ok('a note keeps its text as typed (the pages escape it)', /^I <3 you; x<y && y>z/.test(stored.note || ''), (stored.note || '').slice(0, 30));
ok('a note is cut on whole characters (no broken emoji at the end)', !/[\ud800-\udbff]$/.test(stored.note || '') && Array.from(stored.note || '').length <= 500);

console.log('4. Authorship cannot be rewritten or forged');
const leadAnns = JSON.parse(pull('lead@x.com').totAnnouncements.v);
push('lead@x.com', 'totAnnouncements', leadAnns.map(a => a.id === 'a-all' ? Object.assign({}, a, { title: 'HACKED', fromEmail: 'lead@x.com', fromName: 'Levan Lead' }) : a));
const a0 = srv('totAnnouncements').find(a => a.id === 'a-all');
ok('a shift lead cannot rewrite the manager\'s announcement or take it over', a0.title === 'Welcome' && a0.fromEmail === 'mgr@x.com');
push('lead@x.com', 'totAnnouncements', leadAnns.filter(a => a.id !== 'a-all'));
ok('nor delete it', srv('totAnnouncements').some(a => a.id === 'a-all'));
const leadCm = JSON.parse(pull('lead@x.com').totComments.v);
push('lead@x.com', 'totComments', leadCm.concat([{ id: 'cm-forged', kind: 'ann', ref: 'a-all', who: 'Mia Manager', email: 'mgr@x.com', ts: Date.now(), text: 'forged as Mia' }]));
ok('a comment cannot be written under another e-mail', !srv('totComments').some(c => c.id === 'cm-forged'));
push('lead@x.com', 'totComments', leadCm.map(c => c.id === 'cm-m' ? Object.assign({}, c, { text: 'changed by lead' }) : c));
ok('and a comment of someone else cannot be changed', srv('totComments').find(c => c.id === 'cm-m').text === 'from Mia');
push('lead@x.com', 'totAnnouncements', leadAnns.map(a => a.id === 'a-lead' ? Object.assign({}, a, { title: 'Mine (edited)' }) : a));
ok('an author can still edit their own announcement', srv('totAnnouncements').find(a => a.id === 'a-lead').title === 'Mine (edited)');

console.log('5. Key names and bad bodies never break the server');
let threw = false, r5;
['constructor', '__proto__', 'toString', 'hasOwnProperty', 'valueOf', 's~main~constructor'].forEach(k => { try { r5 = gas.post({ action: 'push', email: 'lead@x.com', pwHash: 'pw-lead@x.com', keys: { [k]: { v: '[]', t: Date.now() } } }); if (!r5 || r5.error) { /* refused is fine */ } } catch (e) { threw = true; } });
ok('no throw for keys named like Object.prototype members', !threw);
try { gas.post({ action: 'push', admin: 'ADMKEY', keys: { constructor: { v: '[]', t: Date.now() }, toString: { v: '[]', t: Date.now() } } }); } catch (e) { threw = true; }
let pulled; try { pulled = gas.post({ action: 'pull', email: 'lead@x.com', pwHash: 'pw-lead@x.com' }); } catch (e) { pulled = null; }
ok('even the admin cannot poison every pull', !threw && pulled && pulled.keys && !('constructor' in (pulled.keys || {}) && Object.prototype.hasOwnProperty.call(pulled.keys, 'constructor')));
const probe = ['{{{', 'null', '', '[]', '5'].map(b => { try { const o = gas.post(b); return !!o && typeof o === 'object'; } catch (e) { return false; } });
ok('a malformed body always gets a JSON answer', probe.every(Boolean), probe.join());

console.log('6. Mail goes only to people in the access list');
const before = gas.mails.length;
push('mgr@x.com', 'totProjects', [{ id: 'p-mail', title: 'Open day', ownerEmail: 'mgr@x.com', ownerName: 'Mia', visibility: 'org', assignees: { people: ['victim@outside.com', 'lead@x.com'], depts: [], teams: [] }, status: 'active', created: Date.now(), u: Date.now(), hist: [{ ts: Date.now(), who: 'Mia', act: 'created' }] }]);
gas.post({ action: 'projNotify', email: 'mgr@x.com', pwHash: 'pw-mgr@x.com', pid: 'p-mail', note: 'Please read' });
const out = gas.mails.slice(before).map(m => m.to);
ok('an address typed into a project is never e-mailed', !out.some(t => /outside\.com/.test(t)), out.join(','));

console.log('7. Community edge cases');
const big = []; for (let i = 0; i < 1500; i++) big.push({ id: 'flood' + i, ch: 'ch-open', kind: 'msg', email: 'lead@x.com', by: 'Levan Lead', ts: Date.now() + 9e12, text: 'flood ' + i });
const cur = JSON.parse(pull('lead@x.com').totMessages.v);
push('lead@x.com', 'totMessages', cur.concat(big));
const after = srv('totMessages'), olds = after.filter(m => m.id === 'm-old1').length;
ok('flooding a channel (future dates, 1,500 messages in one save) does not push older ones out', olds === 1 && after.filter(m => /^flood/.test(m.id)).length <= 60 && after.every(m => m.ts <= Date.now() + 5000), 'old kept: ' + olds + ', newest ts ok: ' + after.every(m => m.ts <= Date.now() + 5000));
const cur2 = JSON.parse(pull('lead@x.com').totMessages.v);
push('lead@x.com', 'totMessages', cur2.concat([{ id: 'm-bypass', ch: 'ch-ann', kind: 'msg', email: 'lead@x.com', by: 'Levan Lead', ts: Date.now(), text: 'bypass', parent: 'no-such-post' }]));
ok('a bogus reply id does not let anyone post in an announcement channel', !srv('totMessages').some(m => m.id === 'm-bypass'));
push('lead@x.com', 'totMessages', cur2.concat([{ id: 'm-reply', ch: 'ch-ann', kind: 'msg', email: 'lead@x.com', by: 'Levan Lead', ts: Date.now(), text: 'a real reply', parent: 'm-ann' }]));
ok('a real reply to a post in that channel is accepted', srv('totMessages').some(m => m.id === 'm-reply'));
push('lead@x.com', 'totMessages', JSON.parse(pull('lead@x.com').totMessages.v).filter(m => m.id !== 'm-arch'));
ok('an archived channel is read only: messages in it cannot be deleted', srv('totMessages').some(m => m.id === 'm-arch'));

console.log('8. Secrets and limits');
ok('integration settings (flow URLs) are not sent to staff', !('totIntegrations' in pull('lead@x.com')) && !('totIntegrations' in pull('mgr@x.com')));
ok('the admin still reads them', !!gas.post({ action: 'pull', admin: 'ADMKEY' }).keys.totIntegrations);
let busy = 0; for (let i = 0; i < 40; i++) { const r = gas.post({ action: 'request', email: 'spam' + i + '@x.com', pwHash: 'h' + i, name: 'S' + i }); if (r && r.error === 'busy') busy++; }
ok('access requests are throttled (30 per 10 minutes)', busy >= 8, busy + ' of 40 refused');

console.log('hardening: ' + (fails ? fails + ' FAILED' : 'ALL PASSED'));
process.exit(fails ? 1 : 0);
