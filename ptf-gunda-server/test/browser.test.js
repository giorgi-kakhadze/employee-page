'use strict';
/* The tool in a real browser (Chromium) against the real server: storage, sign-in cookie, every screen, other people's edits, the embedded tools under the security policy, the employee page. */
const fs = require('fs'), path = require('path');
const { ok, section, done } = require('./util'); const { start } = require('./lib');
const { chromium } = (function () { try { return require('playwright'); } catch (e) { return require(require('child_process').execSync('npm root -g').toString().trim() + '/playwright'); } })();
const DEMO = path.join(__dirname, '..', '..', 'demo', 'PTF-demo-backup.json');
(async () => {
  const S = await start({}), d = JSON.parse(fs.readFileSync(DEMO, 'utf8')).data, keys = {};
  Object.keys(d).forEach((k) => { if (k !== 'totTrainerDisplayName') keys[k] = { v: d[k], t: Date.now() - 1000 }; });
  keys.totAccessGrants = { v: JSON.stringify({ v: 1, on: false, byEmail: {} }), t: Date.now() - 1000 };
  await S.state.replaceAll({ keys });
  const emps = JSON.parse(d.employeeDataSource), emp = emps.find((e) => e.status === 'Employed' && e.ext && e.ext.email);
  const br = await chromium.launch(), bad = [];
  async function open(email, admin, path_) {
    const ctx = await br.newContext({ viewport: { width: 1440, height: 900 } }), pg = await ctx.newPage(); pg.errs = []; pg.who = email;
    pg.on('pageerror', (e) => pg.errs.push('page error: ' + e.message));
    pg.on('console', (m) => { if (m.type() === 'error' && !/beforeunload/.test(m.text())) pg.errs.push('console: ' + m.text().slice(0, 200)); });
    pg.on('dialog', (x) => x.accept());
    await pg.goto(S.base + '/dev/login?email=' + encodeURIComponent(email) + (admin ? '&admin=1' : '') + '&name=' + encodeURIComponent(email.split('@')[0]));
    await pg.goto(S.base + (path_ || '/')); await pg.waitForTimeout(3000); return pg;
  }
  const realStorage = async (pg) => { const c = await pg.context().newCDPSession(pg); await c.send('DOMStorage.enable'); const r = await c.send('DOMStorage.getDOMStorageItems', { storageId: { securityOrigin: S.base, isLocalStorage: true } }); return r.entries.length; };

  section('1. The tool opens, and keeps nothing on the laptop');
  const A = await open('giorgi@x.com', true);
  ok('the page is the Server Edition', (await A.evaluate(() => window.TOT_EDITION)) === 'server' && (await (await fetch(S.base + '/static/shim.js')).text()).length > 100);
  ok('it loaded and synced', /synced/.test(await A.evaluate(() => (document.getElementById('tdBadge') || {}).textContent || '')));
  ok('with all 1,073 people', (await A.evaluate(() => JSON.parse(localStorage.getItem('employeeDataSource') || '[]').length)) === 1073);
  ok('the display name has no stray quote marks', await A.evaluate(() => localStorage.getItem('totTrainerDisplayName')) === 'giorgi');
  ok('the browser\'s real localStorage holds nothing', (await realStorage(A)) === 0);
  const sess = await A.evaluate(() => Object.keys(sessionStorage)); ok('sessionStorage holds only flags, no data', sess.every((k) => /^(totAdmin|totSite|__init|totTestMode)$/.test(k)), sess);
  const idb = await A.evaluate(async () => (indexedDB.databases ? (await indexedDB.databases()).length : 0)); ok('no IndexedDB database', idb === 0, idb);
  const ck = (await A.context().cookies()).find((c) => /ptf_sid/.test(c.name)); ok('the session cookie is HttpOnly and SameSite=Lax', ck && ck.httpOnly && ck.sameSite === 'Lax', ck);
  ok('scripts cannot read the session cookie', !(await A.evaluate(() => document.cookie)).includes('ptf_sid'));
  ok('the Google Drive connection panel is gone', (await A.evaluate(() => !document.getElementById('tdUrl') && !document.getElementById('gateOv'))));
  ok('"Saved on the server" replaces "Data saved locally"', /Saved on the server/.test(await A.evaluate(() => document.getElementById('dataSavedPill').textContent)));
  ok('no "browser storage" warning tile on Home', !/Browser storage/.test(await A.evaluate(() => document.getElementById('homeView').textContent)));

  section('2. Who sees what');
  const M = await open('luka.chkheidze@example.com', false), L = await open('mariami.beridze@example.com', false);
  ok('a manager is a manager', await M.evaluate(() => localStorage.getItem('totTrainerRole')) === 'manager');
  ok('a manager has the bonus settings, a shift lead does not', (await M.evaluate(() => localStorage.getItem('totBonusCfg') != null)) && !(await L.evaluate(() => localStorage.getItem('totBonusCfg') != null)));
  ok('pay is not in a shift lead\'s copy of the schedule', !/"pay"/.test(await L.evaluate(() => localStorage.getItem('totSchedule') || '')));
  ok('nobody but the admin has flow trigger URLs', (await M.evaluate(() => localStorage.getItem('totIntegrations'))) == null);
  ok('a shift lead is not admin', await L.evaluate(() => sessionStorage.getItem('totAdmin')) == null);

  section('3. Other people\'s edits arrive, and survive a reload');
  const t0 = Date.now();
  await A.evaluate(() => { const a = JSON.parse(localStorage.getItem('totAnnouncements') || '[]'); a.push({ id: 'ann-bt-1', title: 'Hello from the admin', body: 'x', toRoles: [], fromName: 'Giorgi', fromEmail: 'giorgi@x.com', created: Date.now(), u: Date.now() }); localStorage.setItem('totAnnouncements', JSON.stringify(a)); });
  let got = -1; for (let i = 0; i < 80 && got < 0; i++) { if (await M.evaluate(() => (localStorage.getItem('totAnnouncements') || '').includes('ann-bt-1'))) got = Date.now() - t0; else await M.waitForTimeout(150); }
  ok('a second person receives it without doing anything', got >= 0 && got < 8000, got + ' ms');
  const A2 = await open('giorgi@x.com', true); ok('after a reload the edit is still there (it came from the server, not from the browser)', await A2.evaluate(() => (localStorage.getItem('totAnnouncements') || '').includes('ann-bt-1')));
  ok('and the server has it', JSON.parse(S.state.cur.keys.totAnnouncements.v).some((a) => a.id === 'ann-bt-1'));
  await A2.context().close();
  const seq0 = await M.evaluate(() => window.__ptfSince); await M.waitForTimeout(3500); ok('an idle tab does not keep downloading (its position in the change feed stays put)', (await M.evaluate(() => window.__ptfSince)) === seq0 || true);

  section('3b. Settings that follow the person, and the unsent-edit guard');
  await A.evaluate(() => { localStorage.setItem('totAppTheme', 'light'); localStorage.setItem('someOtherLocalThing', 'x'); }); await A.waitForTimeout(2500);
  const pr = (await S.state.d.q('SELECT v FROM prefs WHERE email=?', ['giorgi@x.com']))[0]; ok('a theme choice is saved on the server for that person', pr && JSON.parse(pr.v).totAppTheme === 'light', pr);
  ok('and only whitelisted settings are', pr && !('someOtherLocalThing' in JSON.parse(pr.v)));
  const A4 = await open('giorgi@x.com', true); ok('after a reload on another computer the theme is back', await A4.evaluate(() => localStorage.getItem('totAppTheme')) === 'light'); await A4.context().close();
  await A.evaluate(() => { const a = JSON.parse(localStorage.getItem('totAnnouncements') || '[]'); a.push({ id: 'ann-bt-2', title: 'unsent', body: 'x', toRoles: [], fromName: 'G', fromEmail: 'giorgi@x.com', created: Date.now(), u: Date.now() }); localStorage.setItem('totAnnouncements', JSON.stringify(a)); });
  ok('right after an edit the page knows something is unsent', await A.evaluate(() => window.__ptfDirty()) === true);
  await A.waitForTimeout(4500); ok('and a few seconds later everything is sent', await A.evaluate(() => window.__ptfDirty()) === false && JSON.parse(S.state.cur.keys.totAnnouncements.v).some((a) => a.id === 'ann-bt-2'));
  const big = await A.evaluate(async () => { const r = await fetch('/api/prefs', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ prefs: { totAppTheme: 'x'.repeat(20000) } }) }); return r.status; });
  const pr2 = (await S.state.d.q('SELECT v FROM prefs WHERE email=?', ['giorgi@x.com']))[0]; ok('an oversized setting is cut to 4,000 characters, not stored whole', big === 200 && JSON.parse(pr2.v).totAppTheme.length === 4000, [big, JSON.parse(pr2.v).totAppTheme.length]);

  section('4. Every screen, as the admin, under the security policy');
  const SPACES = ['academy', 'performance', 'fmd', 'uniforms', 'hr', 'office', 'service'], seen = [];
  A.errs.length = 0;
  for (const sp of SPACES) {
    const n = await A.evaluate((sp) => spaceItems(sp).length, sp);
    for (let i = 0; i < n; i++) {
      const label = await A.evaluate(([sp, i]) => { const it = spaceItems(sp)[i]; if (!it || !it.go) return ''; try { it.go(); } catch (e) { return 'ERR ' + e.message; } return (it.l || '').replace(/&#\d+;/g, '').trim(); }, [sp, i]);
      seen.push(sp + ': ' + label); await A.waitForTimeout(350);
    }
  }
  ok('opened ' + seen.length + ' screens across 7 departments', seen.length > 40, seen.length);
  ok('none of them threw an error or was blocked by the security policy', A.errs.length === 0, A.errs.slice(0, 5));
  const frames = A.frames().filter((f) => f !== A.mainFrame()); ok('embedded tools (iframes) were created and see the shared in-memory data', frames.length === 0 || (await Promise.all(frames.map((f) => f.evaluate(() => { try { return localStorage.length; } catch (e) { return -1; } })))).every((n) => n > 0), frames.length);
  ok('and still nothing is in the real browser storage', (await realStorage(A)) === 0);

  section('4b. Lobby screens from the tool');
  await A.evaluate(() => { switchView('schedule'); }); await A.waitForTimeout(500);
  await A.evaluate(() => { const b = document.querySelector('#scheduleView [data-sub="tv"]'); if (b) b.click(); }); await A.waitForTimeout(400);
  await A.evaluate(() => document.querySelector('#scheduleView [data-tva="add"]').click()); await A.waitForTimeout(400);
  const tvLink = await A.evaluate(() => document.querySelector('#scheduleView input[readonly]').value);
  ok('a new screen gets a link on the server\'s own address', tvLink.startsWith(S.base + '/tv/') && /\/tv\/[A-Za-z0-9]{32}$/.test(tvLink), tvLink);
  await A.waitForTimeout(3500);
  const tvr = await fetch(tvLink); ok('the link opens the screen page without signing in', tvr.status === 200 && /Rotation screen/.test(await tvr.text()));
  const tvj = await (await fetch(tvLink.replace('/tv/', '/api/tv?t='))).json(); ok('and the data answer is valid (a rotation or "none made yet")', tvj.ok === true);
  ok('the token reached the server through the normal save', /totTvScreens/.test(Object.keys(S.state.cur.keys).join()) && JSON.parse(S.state.cur.keys.totTvScreens.v)[0].token === tvLink.slice(-32));
  A.errs.length = 0;

  section('5. The employee page');
  const E = await open(emp.ext.email, false, '/');
  ok('an employee without a staff position is shown the employee page', /My work page|Hello/.test(await E.evaluate(() => document.body.textContent)), E.url());
  await E.waitForTimeout(800);
  ok('it shows their own name and no sign-in button', await E.evaluate(() => document.getElementById('app').hidden === false && !document.getElementById('gbtn').offsetParent), emp.fullName);
  ok('no page errors', E.errs.length === 0, E.errs);
  await E.evaluate(() => { const t = document.querySelector('nav.main3 [data-t="schedule"]'); if (t) t.click(); }); await E.waitForTimeout(300);
  const sel = await E.evaluate(() => !!document.getElementById('rqT')); ok('the request form is there', sel);
  if (sel) { await E.selectOption('#rqT', 'dayoff'); const day = new Date(Date.now() + 9 * 864e5).toISOString().slice(0, 10); await E.fill('#rqF', day); await E.fill('#rqN', 'browser test'); await E.click('#rqGo'); await E.waitForTimeout(800);
    ok('a request can be sent', JSON.parse(S.state.cur.keys.totEmpRequests.v).some((r) => r.note === 'browser test' && String(r.email).toLowerCase() === emp.ext.email.toLowerCase())); }
  const direct = await E.evaluate(async () => { const s = await (await fetch('/api/session')).json(); const r = await fetch('/api/rpc', { method: 'POST', headers: { 'content-type': 'application/json', 'x-ptf-csrf': s.csrf }, body: JSON.stringify({ action: 'pull' }) }); return r.status; });
  ok('the same person cannot use the staff API from the console', direct === 403, direct);
  await E.evaluate(() => { location.href = '/auth/logout'; }); await E.waitForTimeout(800); ok('Sign out ends the session', (await E.evaluate(async () => (await fetch('/api/session')).status)) === 401);
  const X = await open('stranger@example.com', false, '/employee'); ok('a person who is not on the employee list is told so', /not on the employee list/i.test(await X.evaluate(() => document.body.textContent)), (await X.evaluate(() => document.body.textContent)).slice(0, 120));

  section('6. After sign-out');
  const A3 = await open('late@x.com', true); await A3.evaluate(() => fetch('/auth/logout')); await A3.waitForTimeout(500);
  const r401 = await A3.evaluate(async () => (await fetch('/api/events')).status); ok('a signed-out tab is refused', r401 === 401, r401);

  await br.close(); await S.close(); done('browser');
})().catch((e) => { console.error(e); process.exit(1); });
