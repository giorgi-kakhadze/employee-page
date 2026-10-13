/* Sign out on a shared computer: saves, then removes the person's data and sign-in from the browser; connection to the team + theme stay; the admin key never stays. */
const path = require('path'), root = path.join(__dirname, '..');
const gas = require('./fakegas')(path.join(root, 'tool', 'Code.gs')); require('./seed')(gas);
let fails = 0; const ok = (n, c, x) => { console.log((c ? '  ✅ ' : '  ❌ ') + n + (c ? '' : '  → ' + x)); if (!c) fails++; };
(async () => {
  const H = await require('./harness')(path.join(root, 'tool', 'PTF-pass-to-floor-Gunda.html'), gas), P = await H.open({ admin: true }); await P.sync();
  ok('there is a Sign out button in the top bar and in the More menu', await P.evaluate(() => !!document.getElementById('signOutBtn') && /Sign out/.test(document.getElementById('moreMenu').innerText)));
  await P.evaluate(() => { localStorage.setItem('totTrainerEmail', 'a@x.com'); localStorage.setItem('totAuth', '{"email":"a@x.com","pwHash":"h","t":1}'); localStorage.setItem('evalResults', '[{"id":1}]'); localStorage.setItem('totAppTheme', 'dark'); const c = JSON.parse(localStorage.getItem('totSyncCfg') || '{}'); c.key = 'SECRETKEY'; c.url = c.url || 'https://script.google.com/macros/s/TEST/exec'; localStorage.setItem('totSyncCfg', JSON.stringify(c)); });
  const e0 = H.errs.length; await P.evaluate(() => { window.__totTest = true; });
  await P.evaluate(() => totSignOut()); await P.waitForTimeout(4600);
  const r = await P.evaluate(() => ({ ev: localStorage.getItem('evalResults'), au: localStorage.getItem('totAuth'), em: localStorage.getItem('totTrainerEmail'), th: localStorage.getItem('totAppTheme'), cfg: JSON.parse(localStorage.getItem('totSyncCfg') || '{}'), adm: sessionStorage.getItem('totAdmin'), out: window.__totOut }));
  ok('sync is stopped while signing out', r.out === true, r.out);
  ok('the person\'s data is gone', r.ev == null, r.ev);
  ok('the sign-in is gone (the next person must sign in)', r.au == null && r.em == null, JSON.stringify(r));
  ok('the connection to the team stays, without the admin key', !!r.cfg.url && r.cfg.key === undefined, JSON.stringify(r.cfg));
  ok('theme choice stays', r.th === 'dark', r.th);
  ok('the admin session is ended', r.adm == null, r.adm);
  ok('no page errors up to the moment of signing out (after it the page is reloaded)', e0 === 0, H.errs.slice(0, 3));
  await H.close(); console.log('signout: ' + (fails ? fails + ' FAILED' : 'ALL PASSED')); process.exit(fails ? 1 : 0);
})();
