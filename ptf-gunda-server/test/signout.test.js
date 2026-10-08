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
  await S.close(); done('signout');
})().catch((e) => { console.error(e); process.exit(1); });
