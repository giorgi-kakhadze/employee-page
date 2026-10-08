/* Employee page: zone rotation (shufflers) and table rotation (presenters) on a phone. Uses the page's own ?demo mode. */
const { chromium } = require(require('child_process').execSync('npm root -g').toString().trim() + '/playwright');
let fails = 0; const ok = (n, c, x) => { console.log((c ? '  ✅ ' : '  ❌ ') + n + (c ? '' : '  → ' + x)); if (!c) fails++; };
(async () => {
  const br = await chromium.launch(), perr = [];
  for (const f of ['index.html?demo', 'demo/employee-demo.html']) {
    const p = await br.newPage({ viewport: { width: 360, height: 780 } }); p.on('pageerror', (e) => perr.push(e.message));
    await p.goto('file://' + __dirname + '/../' + f); await p.waitForTimeout(500);
    for (const k of ['shuffler', 'presenter']) {
      await p.evaluate((k) => { D = demoData(k); tab = 'rotation'; show(); }, k);
      const r = await p.evaluate(() => ({ zb: [...document.querySelectorAll('.zb:not(.tb)')].length, chips: document.querySelectorAll('.tn').length, tb: document.querySelectorAll('.zb.tb').length, w: document.documentElement.scrollWidth }));
      if (k === 'shuffler') ok(f + ': shuffler sees zones with their table numbers', r.zb > 0 && r.chips >= r.zb * 5 && r.tb === 0, JSON.stringify(r));
      else ok(f + ': presenter sees tables', r.tb > 0 && r.zb === 0, JSON.stringify(r));
      ok(f + ' ' + k + ': no sideways scrolling on a phone', r.w <= 360, r.w);
    }
    const t = await p.evaluate(() => { var s = rotKind('Zone C · tables 11, 12, 13'); return JSON.stringify(s); });
    ok(f + ': zone text is parsed', t === '{"k":"zone","z":"C","t":["11","12","13"]}', t);
  }
  ok('no page errors', perr.length === 0, perr.join(' | '));
  await br.close(); console.log('employee_zone_view: ' + (fails ? fails + ' FAILED' : 'ALL PASSED')); process.exit(fails ? 1 : 0);
})();
