'use strict';
/* Sign out on a shared computer: the tool and the employee page end the session; the next person signs in with their own account. */
const { ok, section, done, sample } = require('./util'); const { start } = require('./lib');
(async () => {
  const S = await start({}); await S.state.replaceAll({ keys: sample() }); const ana = await S.client('ana@x.com'), mgr = await S.client('mgr@x.com');
  section('1. Both pages offer Sign out and it leads to the server logout');
  let r = await mgr.get('/tool'), t = await r.text();
  ok('the tool has a Sign out button and menu entry', /id="signOutBtn"/.test(t) && /totSignOut\(\)/.test(t));
  ok('the tool signs out through the server (no browser storage involved)', /location\.href="\/auth\/logout"/.test(t) && /__ptfDirty/.test(t));
  r = await ana.get('/employee'); t = await r.text(); ok('the employee page signs out through the server', /\/auth\/logout/.test(t) && /Sign out/.test(t));
  section('2. After signing out the session is dead');
  r = await ana.get('/api/session'); ok('signed in before', r.status === 200, r.status);
  r = await ana.get('/auth/logout'); ok('logout answers with a redirect', r.status === 302 || r.status === 200, r.status);
  const c = r.headers.get('set-cookie') || ''; ok('the session cookie is cleared', /Max-Age=0|Expires=Thu, 01 Jan 1970/i.test(c), c.slice(0, 120));
  section('3. Confirmations (I have seen my schedule): the employee API accepts "ack" and only for the version that was sent');
  const sk = sample(), now = Date.now(), mail = Object.keys(JSON.parse(sk.totAccessPolicy.v).users)[0];
  const emp = JSON.parse(sk.employeeDataSource.v)[0] || {}, em = String((emp.ext && emp.ext.email) || emp.email || 'ana@x.com').toLowerCase();
  const K = Object.assign({}, sk, { totMySchedules: { v: JSON.stringify({ byEmail: { [em]: { name: emp.fullName || 'Ana', ver: 'v7', vat: now, sx: [{ d: '2026-10-12', s: 'morning', f: 8, t: 16 }], rx: [] } }, sent: {} }), t: now } });
  await S.state.replaceAll({ keys: K }); const who = await S.client(em);
  let j = await who.emp({ action: 'me' }); ok('the employee page data carries the published version', j.pub && j.pub.ver === 'v7' && j.pub.ack === '', JSON.stringify(j.pub));
  j = await who.emp({ action: 'ack', ver: 'v6' }); ok('an old version is refused', /changed again/.test(j.error || ''), JSON.stringify(j));
  j = await who.emp({ action: 'ack', ver: 'v7' }); ok('the right version is accepted', j.ok && j.pub.ack === 'v7', JSON.stringify(j));
  j = await who.emp({ action: 'me' }); ok('and is remembered', j.pub && j.pub.ack === 'v7' && j.pub.ackAt > 0, JSON.stringify(j.pub));
  const acks = JSON.parse(S.state.cur.keys.totScheduleAcks.v); ok('one record for the person in totScheduleAcks', acks.length === 1 && acks[0].id === em, JSON.stringify(acks));
  await S.close(); done('signout');
})().catch((e) => { console.error(e); process.exit(1); });
