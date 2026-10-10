/* v3.41 phone app: installable (manifest, icons, service worker) and an optional offline copy of the schedule and rotation that is removed at sign-out. */
const path = require('path'), fs = require('fs'), http = require('http');
const gas = require('./fakegas')(path.join(__dirname, '..', 'tool', 'Code.gs'));
let fails = 0; function ok(n, c, x) { if (!c) fails++; console.log((c ? '  ✅ ' : '  ❌ ') + n + (c ? '' : '  → ' + x)); }
const { chromium } = require(require('child_process').execSync('npm root -g').toString().trim() + '/playwright');
const root = path.join(__dirname, '..'), URL = 'https://script.google.com/macros/s/TEST/exec', now = Date.now(), P = (o) => ({ v: JSON.stringify(o), t: now - 500 });
const iso = (d) => { const x = new Date(Date.now() + d * 864e5); return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0'); };
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.png': 'image/png', '.webmanifest': 'application/manifest+json' };
(async () => {
  /* the page is served over http://127.0.0.1 (a secure context for service workers) with the Apps Script address pointing at the fake server */
  const srv = http.createServer((q, r) => { let f = q.url.split('?')[0]; if (f === '/') f = '/index.html'; const full = path.join(root, f); if (!full.startsWith(root) || !fs.existsSync(full) || fs.statSync(full).isDirectory()) { r.writeHead(404); return r.end(); }
    let b = fs.readFileSync(full); if (f === '/index.html') b = Buffer.from(b.toString().replace(/var SERVER_URL = '[^']*'/, "var SERVER_URL = '" + URL + "'").replace('<script src="https://accounts.google.com/gsi/client" async defer></script>', '')); r.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' }); r.end(b); });
  await new Promise((res) => srv.listen(0, '127.0.0.1', res)); const base = 'http://127.0.0.1:' + srv.address().port;
  gas.setData({ updatedAt: now, keys: { totAccessPolicy: P({ users: {}, roles: {} }), employeeDataSource: P([{ id: 'e1', fullName: 'Test Person', nickname: 'Tess', workId: 'W1', status: 'Employed', email: 'tester@x.com', ext: { email: 'tester@x.com', position: 'Game presenter' } }]),
    totMySchedules: P({ byEmail: { 'tester@x.com': { name: 'Test Person', team: 't1', shift: 'morning', ver: 'v1', vat: now, sx: [{ d: iso(1), s: 'morning', f: 8, t: 16 }], rx: [{ d: iso(1), s: 'morning', f: 8, c: ['3', '3', '4', '4', 'b', 'b', '5', '5'] }], bal: { y: String(new Date().getFullYear()), allow: 28, used: 4 } } }, sent: {} }) } });
  const br = await chromium.launch(), perr = [], ctx = await br.newContext({ viewport: { width: 390, height: 844 } }), E = await ctx.newPage(); let down = false;
  E.on('pageerror', (e) => perr.push(e.message)); E.on('dialog', (d) => d.accept());
  await E.route(URL + '**', async (r) => { if (down) return r.abort(); await r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(gas.post(r.request().postData())) }); });
  await E.addInitScript(() => { window.google = { accounts: { id: { initialize: (c) => { window.__gcb = c.callback; }, disableAutoSelect() {}, renderButton: () => setTimeout(() => window.__gcb({ credential: 'gtok:tester@x.com' }), 30) } } }; });
  await E.goto(base + '/'); await E.waitForTimeout(1200);
  const head = await E.evaluate(() => ({ man: document.querySelector('link[rel=manifest]') && document.querySelector('link[rel=manifest]').href, theme: !!document.querySelector('meta[name=theme-color]'), apple: !!document.querySelector('link[rel=apple-touch-icon]') }));
  ok('the page links a manifest, a theme colour and an app icon', !!head.man && head.theme && head.apple, JSON.stringify(head));
  const mf = await (await ctx.request.get(base + '/manifest.webmanifest')).json();
  ok('the manifest is a standalone app with 192, 512 and maskable icons', mf.display === 'standalone' && mf.icons.some((i) => i.sizes === '192x192') && mf.icons.some((i) => i.sizes === '512x512') && mf.icons.some((i) => i.purpose === 'maskable'), JSON.stringify(mf).slice(0, 200));
  let okIcons = true; for (const i of mf.icons) { const r = await ctx.request.get(base + '/' + i.src); if (r.status() !== 200 || !/image\/png/.test(r.headers()['content-type'] || '')) okIcons = false; } ok('every icon exists', okIcons);
  await E.evaluate(() => navigator.serviceWorker.ready); await E.reload(); await E.waitForTimeout(1200);
  ok('the service worker is registered and controls the page', await E.evaluate(() => !!navigator.serviceWorker.controller));
  let t = await E.evaluate(() => document.body.innerText);
  ok('Home offers "Keep my schedule and rotation on this phone" and the install help', /Keep my schedule and rotation on this phone/.test(t) && /My phone/.test(t) && /Do not switch this on for a phone or computer that other people use/.test(t));
  ok('nothing is saved on the phone until the person agrees', await E.evaluate(() => localStorage.getItem('ptfEmpCache') === null));
  await E.evaluate(() => { const k = document.getElementById('keepChk'); k.checked = true; k.dispatchEvent(new Event('change')); }); await E.waitForTimeout(300);
  const c = await E.evaluate(() => JSON.parse(localStorage.getItem('ptfEmpCache') || 'null'));
  ok('after they agree, the schedule, rotation and vacation days are saved, nothing else', c && c.d.schedule && c.d.rotation && c.d.leave && !c.d.pay && !c.d.evaluations && !c.d.remarks, c && Object.keys(c.d).join());
  /* no connection: the page opens from the service worker and shows the saved copy */
  down = true; await ctx.setOffline(true); await E.reload(); await E.waitForTimeout(1800); t = await E.evaluate(() => document.body.innerText);
  ok('offline: the page still opens and says it shows what was saved on this phone', /You are offline/.test(t) && /saved on this phone/.test(t), t.slice(0, 200));
  await E.evaluate(() => { tab = 'rotation'; show(); }); t = await E.evaluate(() => document.body.innerText);
  ok('offline: the rotation tab shows the tables', /Table 3/.test(t) && /Break/.test(t), t.slice(0, 300));
  await E.evaluate(() => { tab = 'schedule'; show(); }); t = await E.evaluate(() => document.body.innerText); ok('offline: the schedule tab works too', /My schedule/.test(t));
  await ctx.setOffline(false); down = false;
  await E.goto(base + '/'); await E.waitForTimeout(1200); await E.evaluate(() => { document.querySelector('#app button[onclick="signOut()"]').click(); }); await E.waitForTimeout(800);
  ok('signing out removes the saved copy and the choice', await E.evaluate(() => localStorage.getItem('ptfEmpCache') === null && localStorage.getItem('ptfEmpKeep') === null));
  /* without the choice nothing is shown offline */
  await E.evaluate(() => { window.google = undefined; }); down = true; await ctx.setOffline(true); await E.reload(); await E.waitForTimeout(1500); t = await E.evaluate(() => document.body.innerText);
  ok('offline without a saved copy: no personal data is shown', !/Test Person|Table 3/.test(t), t.slice(0, 200));
  ok('no page errors', perr.length === 0, perr.slice(0, 3).join(' | ')); await br.close(); srv.close();
  console.log('pwa: ' + (fails ? fails + ' FAILED' : 'ALL PASSED')); process.exit(fails ? 1 : 0);
})();
