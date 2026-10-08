/* v3.34 look & feel: the admin space on a laptop (side menu, one section at a time, search) and on a phone (one column), the header pills,
   the motion switch, the version, and Giorgi knowing the whole tool. */
const path = require('path'), tool = process.argv[2] || path.join(__dirname, '..', 'tool', 'PTF-pass-to-floor-Gunda.html'), code = process.argv[3] || path.join(__dirname, '..', 'tool', 'Code.gs');
const gas = require('./fakegas')(code); require('./seed')(gas);
let fails = 0; function ok(name, cond, extra) { if (!cond) fails++; console.log((cond ? '  ✅ ' : '  ❌ ') + name + (extra ? '  → ' + extra : '')); }
(async () => {
  const H = await require('./harness')(tool, gas);
  console.log('1. Admin space on a laptop');
  const A = await H.open({ admin: true }); await A.setViewportSize({ width: 1440, height: 900 }); await A.sync(); await A.waitForTimeout(500);
  await A.evaluate(() => { document.dispatchEvent(new KeyboardEvent('keydown', { key: 'g', ctrlKey: true, bubbles: true })); }); await A.waitForTimeout(500);
  const L = await A.evaluate(async () => { const w = (ms) => new Promise(r => setTimeout(r, ms)), o = [...document.querySelectorAll('.adOv')].find(x => x.querySelector('#adClose')), box = o.querySelector('.adBox'), r = {};
    r.wide = o.classList.contains('adWide'); r.boxW = Math.round(box.getBoundingClientRect().width); r.nav = [...o.querySelectorAll('.adNi')].map(b => b.textContent.trim());
    r.visible = [...box.children].filter(c => getComputedStyle(c).display !== 'none' && !c.classList.contains('adHdr')).length;
    const b = [...o.querySelectorAll('.adNi')].find(x => /Access management/.test(x.textContent)); b.click(); await w(100);
    r.detailOpen = [...box.children].some(c => c.tagName === 'DETAILS' && c.classList.contains('adOn') && c.open && /Access management/.test(c.textContent));
    const q = o.querySelector('.adNav input'); q.value = 'drive'; q.dispatchEvent(new Event('input', { bubbles: true })); await w(100);
    r.found = [...o.querySelectorAll('.adNi')].filter(x => x.style.display !== 'none').map(x => x.textContent.trim());
    o.querySelector('.adCl').click(); await w(100); r.closed = !o.classList.contains('open'); return r; });
  ok('opens as a wide window with a side menu', L.wide && L.boxW > 800, JSON.stringify({ wide: L.wide, w: L.boxW }));
  ok('the menu lists every section (passwords, Drive sync, access, backup…)', L.nav.length >= 12 && L.nav.some(t => /Drive sync/.test(t)) && L.nav.some(t => /Backup/.test(t)) && L.nav.some(t => /Name & admin password/.test(t)), L.nav.join(' | '));
  ok('one section at a time', L.visible <= 8, L.visible);
  ok('a section opens fully (Access management)', L.detailOpen);
  ok('search finds a section by its content', L.found.length >= 1 && L.found.some(t => /Drive/.test(t)), L.found.join(' | '));
  ok('Close in the menu closes the admin space', L.closed);
  ok('the version is up to date', await A.evaluate(() => window.TOT_VERSION) === '3.40');
  ok('site and person pills sit in the action row', await A.evaluate(() => document.getElementById('psPill').parentNode.classList.contains('top-bar-actions')));
  ok('no part of the top bar runs off the screen', await A.evaluate(() => [...document.querySelectorAll('.nav-tabs > *, .top-bar-actions > *')].filter(e => getComputedStyle(e).display !== 'none').every(e => e.getBoundingClientRect().right <= window.innerWidth + 1)));

  console.log('2. Admin space on a phone');
  await A.setViewportSize({ width: 390, height: 844 });
  await A.evaluate(() => { document.dispatchEvent(new KeyboardEvent('keydown', { key: 'g', ctrlKey: true, bubbles: true })); }); await A.waitForTimeout(500);
  const S = await A.evaluate(() => { const o = [...document.querySelectorAll('.adOv')].find(x => x.querySelector('#adClose')), box = o.querySelector('.adBox'); return { wide: o.classList.contains('adWide'), nav: getComputedStyle(o.querySelector('.adNav')).display, all: [...box.children].filter(c => getComputedStyle(c).display !== 'none').length, fits: box.getBoundingClientRect().right <= window.innerWidth }; });
  ok('one column with every section, no side menu', !S.wide && S.nav === 'none' && S.all >= 15 && S.fits, JSON.stringify(S));

  console.log('3. Motion and Giorgi');
  const P = await H.open({ email: 'mgr@x.com', pw: 'pw-mgr@x.com' }); await P.sync();
  const M = await P.evaluate(async () => { const w = (ms) => new Promise(r => setTimeout(r, ms)), c = document.getElementById('uiMotion'), r = {}; r.box = !!c; c.checked = true; c.onchange(); r.still = document.documentElement.classList.contains('ui-still'); c.checked = false; c.onchange(); r.back = !document.documentElement.classList.contains('ui-still');
    openGiorgiChat(); await w(200); const ask = async (q) => { giorgiChat.ask(q); await w(1700); const rows = [...document.querySelectorAll('#giorgiChat .gc-row')]; return rows[rows.length - 1].textContent; };
    r.appr = await ask('how does the approval flow work'); r.team = await ask('how do I create a team'); r.sched = await ask('how does the rotation work'); r.what = await ask('what can I do with this tool');
    const b = [...document.querySelectorAll('#giorgiChat button')].find(x => /Open /.test(x.textContent)); return r; });
  ok('"Reduce animations" switch in More turns motion off and on', M.box && M.still && M.back);
  ok('Giorgi explains approvals', /Ask for approval/.test(M.appr), M.appr.slice(0, 80));
  ok('Giorgi explains teams', /Teams & departments/.test(M.team), M.team.slice(0, 80));
  ok('Giorgi explains the rotation', /rotation/i.test(M.sched) && /FMD/.test(M.sched), M.sched.slice(0, 80));
  ok('Giorgi describes the whole tool (departments and Projects)', /Service/.test(M.what) && /Projects/.test(M.what), M.what.slice(0, 80));
  await P.evaluate(async () => { giorgiChat.ask('what is projects'); await new Promise(r => setTimeout(r, 1700)); const b = [...document.querySelectorAll('#giorgiChat button')].find(x => /Open Projects/.test(x.textContent)); if (b) b.click(); await new Promise(r => setTimeout(r, 500)); });
  ok('Giorgi\'s "Open Projects" button opens Projects', await P.evaluate(() => currentView) === 'projects');

  ok('no page errors', H.errs.length === 0, H.errs.slice(0, 3).join(' | '));
  await H.close();
  console.log('ui_polish: ' + (fails ? fails + ' FAILED' : 'ALL PASSED'));
  process.exit(fails ? 1 : 0);
})();
