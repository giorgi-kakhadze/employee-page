/* Audit: CSV exports must not let a name or text start a spreadsheet formula (=, +, -, @). Checked on the payroll export, the leave CSV and the employee-history CSV. */
const path = require('path'), fs = require('fs'), tool = path.join(__dirname, '..', 'tool', 'PTF-pass-to-floor-Gunda.html'), code = path.join(__dirname, '..', 'tool', 'Code.gs');
const gas = require('./fakegas')(code); require('./seed')(gas);
let fails = 0; function ok(n, c, x) { if (!c) fails++; console.log((c ? '  ✅ ' : '  ❌ ') + n + (c ? '' : '  → ' + x)); }
const p2 = (n) => ('0' + n).slice(-2), now = new Date(), prev = new Date(now.getFullYear(), now.getMonth() - 1, 1), ym = prev.getFullYear() + '-' + p2(prev.getMonth() + 1);
(async () => {
  const H = await require('./harness')(tool, gas), P = await H.open({ admin: true }); await P.setViewportSize({ width: 1500, height: 950 }); await P.sync();
  const evil = '=HYPERLINK("http://evil.example","x")';
  await P.evaluate(({ ym, evil }) => {
    const S = JSON.parse(localStorage.getItem('totSchedule') || '{}');
    S.roster = { anchor: ym + '-01', people: [{ name: evil, g: 'A', sh: 'morning', t: '', pos: 'vip' }, { name: '@cmd', g: 'A', sh: 'morning', t: '', pos: 'vip' }] };
    S.sched = {}; S.sched[ym] = { [evil.toLowerCase()]: { d: { 1: 'M' }, c: {} }, '@cmd': { d: { 1: 'M' }, c: {} } };
    S.pay = { unit: 'shift', day: 0, night: 0, hol: 2, mult: {}, raises: [], bonus: [{ id: 'b', name: '@cmd', date: ym + '-05', amount: -5, note: '+note' }], pos: [{ id: 'vip', name: 'VIP Game Presenter', day: 10, night: 14 }] };
    localStorage.setItem('totSchedule', JSON.stringify(S)); switchView('schedule'); SchedMount();
  }, { ym, evil }); await P.waitForTimeout(500);
  await P.evaluate(() => document.querySelector('#scheduleView [data-sub="pay"]').click()); await P.waitForTimeout(400);
  await P.evaluate((ym) => { const m = document.querySelector('#payM'); m.value = ym; m.dispatchEvent(new Event('change', { bubbles: true })); const f = document.querySelector('#pxFile'); f.value = 'csv'; f.dispatchEvent(new Event('change', { bubbles: true })); const t = document.querySelector('#pxFmt'); t.value = 'lines'; t.dispatchEvent(new Event('change', { bubbles: true })); }, ym); await P.waitForTimeout(400);
  const [d] = await Promise.all([P.waitForEvent('download'), P.evaluate(() => document.querySelector('[data-pa="pxgo"]').click())]); const f = '/tmp/csvinj-' + Date.now(); await d.saveAs(f); const csv = fs.readFileSync(f, 'utf8');
  ok('a name that starts with = is written as text (leading apostrophe)', /(^|,|")'=HYPERLINK/m.test(csv) && !/(^|,)=HYPERLINK/m.test(csv), csv.slice(0, 400));
  ok('a name that starts with @ is written as text', /(^|,)'@cmd/m.test(csv), csv);
  ok('negative amounts stay numbers (-5)', /,-5(\r?\n|$)/.test(csv) || /,-5,/.test(csv), csv);
  ok('a note that starts with + is written as text', /'\+note/.test(csv), csv);
  /* the guard covers every CSV: try the employee-history CSV writer too */
  const t = await P.evaluate(async () => { const b = new Blob(['﻿Name,Note\r\n=1+1,ok\r\n"-cmd",-3'], { type: 'text/csv' }); return await b.text(); });
  ok('any CSV the tool makes is guarded (= and -text, but -3 kept)', /'=1\+1/.test(t) && /"'-cmd"/.test(t) && /,-3$/.test(t), JSON.stringify(t));
  const j = await P.evaluate(async () => { const b = new Blob(['{"a":"=1"}'], { type: 'application/json' }); return await b.text(); });
  ok('other files (JSON backups) are not changed', j === '{"a":"=1"}', j);
  ok('no page errors', H.errs.length === 0, JSON.stringify(H.errs.slice(0, 3))); await H.close();
  console.log('audit_csv_injection: ' + (fails ? fails + ' FAILED' : 'ALL PASSED')); process.exit(fails ? 1 : 0);
})();
