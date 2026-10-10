/* v3.42 payroll export: pay lines / summary / day timesheet, pay codes, separators, checks before export, export log, month close. */
const path = require('path'), fs = require('fs'), tool = path.join(__dirname, '..', 'tool', 'PTF-pass-to-floor-Gunda.html'), code = path.join(__dirname, '..', 'tool', 'Code.gs');
const gas = require('./fakegas')(code); require('./seed')(gas);
let fails = 0; function ok(n, c, x) { if (!c) fails++; console.log((c ? '  ✅ ' : '  ❌ ') + n + (c ? '' : '  → ' + x)); }
const p2 = (n) => ('0' + n).slice(-2), now = new Date(), prev = new Date(now.getFullYear(), now.getMonth() - 1, 1), ym = prev.getFullYear() + '-' + p2(prev.getMonth() + 1);
(async () => {
  const H = await require('./harness')(tool, gas), P = await H.open({ admin: true }); await P.setViewportSize({ width: 1600, height: 1000 }); await P.sync();
  const w = (ms) => P.waitForTimeout(ms);
  await P.evaluate(({ ym }) => {
    localStorage.setItem('employeeDataSource', JSON.stringify([{ id: 1, fullName: 'Ana Beridze', workId: 'W1000', status: 'Employed', ext: {} }]));
    const S = JSON.parse(localStorage.getItem('totSchedule') || '{}');
    S.roster = { anchor: ym + '-01', people: [{ name: 'Ana Beridze', g: 'A', sh: 'morning', t: '', pos: 'vip' }, { name: 'Dato Lomidze', g: 'A', sh: 'morning', t: '', pos: 'shuf' }] };
    S.sched = {}; S.sched[ym] = { 'ana beridze': { d: { 1: 'M', 2: 'M', 3: 'N', 7: 'VAC' }, c: {} }, 'dato lomidze': { d: { 1: 'M' }, c: {} } };
    S.pay = { unit: 'shift', day: 0, night: 0, hol: 2, mult: {}, raises: [], bonus: [{ id: 'b1', name: 'Ana Beridze', date: ym + '-05', amount: 25.5, note: 'Spot bonus' }], vacPct: 100, pos: [{ id: 'vip', name: 'VIP Game Presenter', day: 10, night: 14 }, { id: 'shuf', name: 'Shuffler', day: 7, night: 9 }] };
    S.holidays = []; localStorage.setItem('totSchedule', JSON.stringify(S));
    switchView('schedule'); SchedMount();
  }, { ym });
  await w(500); await P.evaluate(() => document.querySelector('#scheduleView [data-sub="pay"]').click()); await w(400);
  await P.evaluate((ym) => { const m = document.querySelector('#payM'); m.value = ym; m.dispatchEvent(new Event('change', { bubbles: true })); }, ym); await w(400);
  const txt = () => P.evaluate(() => document.querySelector('#scheduleView').innerText);
  let t = await txt();
  ok('payroll export panel exists with checks', /Payroll export/.test(t) && /no employee ID/.test(t), t.slice(0, 200));
  const get = async (setup) => { await P.evaluate(setup); await w(300); const [d] = await Promise.all([P.waitForEvent('download'), P.evaluate(() => document.querySelector('[data-pa="pxgo"]').click())]); const f = '/tmp/px-' + Date.now(); await d.saveAs(f); return { name: d.suggestedFilename(), body: fs.readFileSync(f) }; };
  const setv = (id, v) => `(()=>{const e=document.querySelector('#${id}');e.value='${v}';e.dispatchEvent(new Event('change',{bubbles:true}));})()`;
  let r = await get(`${setv('pxFmt', 'lines')}`);
  let csv = r.body.toString('utf8');
  ok('lines file name and BOM', r.name === 'payroll-' + ym + '-lines.csv' && csv.charCodeAt(0) === 0xFEFF, r.name);
  ok('Ana: 2 day shifts x10 = 20, night 14, vacation 10, bonus 25.5, with ID W1000', /W1000,Ana Beridze,VIP Game Presenter,,DAY,Day shift,2,day,10,1,20\r?\n/.test(csv) && /NIGHT,Night shift,1,day,14,1,14\r?\n/.test(csv) && /VAC,Vacation,1,day,10,1,10\r?\n/.test(csv) && /BONUS,Spot bonus,1,item,25.5,1,25.5\r?\n/.test(csv), csv);
  ok('Dato has an empty ID column and 7', /,Dato Lomidze,Shuffler,,DAY,Day shift,1,day,7,1,7$/m.test(csv), csv);
  /* codes, separator, decimals */
  await P.evaluate(() => { const e = document.querySelector('[data-pxc="day"]'); e.value = 'REG'; e.dispatchEvent(new Event('change', { bubbles: true })); }); await w(300);
  r = await get(`${setv('pxDelim', ';')};${setv('pxDec', ',')}`); csv = r.body.toString('utf8');
  ok('custom pay code, semicolon separator and decimal comma', /;REG;Day shift;2;day;10;1;20/.test(csv), csv);
  /* summary + days + xlsx */
  r = await get(`${setv('pxFmt', 'summary')}`); csv = r.body.toString('utf8');
  ok('summary: one row per person with total 69,5 for Ana', /Ana Beridze;VIP Game Presenter;;2;1;0;/.test(csv) && /;69,5\r?\n/.test(csv), csv);
  r = await get(`${setv('pxFmt', 'days')}`); csv = r.body.toString('utf8');
  ok('days timesheet has one row per day', csv.split('\r\n').length === 1 + 5, csv);
  r = await get(`${setv('pxFmt', 'book')}`);
  ok('workbook is a real .xlsx (zip) named .xlsx', r.name === 'payroll-' + ym + '-book.xlsx' && r.body.slice(0, 2).toString() === 'PK', r.name);
  await w(700); const S = await P.evaluate(() => JSON.parse(localStorage.getItem('totSchedule')));
  const aud = await P.evaluate(() => JSON.parse(localStorage.getItem('auditLog') || '[]').some(a => /Exported payroll/.test(a.act)));
  ok('export log has 5 entries and the audit log recorded it', (S.pay.exports || []).length === 5 && S.pay.exports[0].people === 2 && S.pay.exports[0].total === 69.5 + 7 && aud, JSON.stringify(S.pay.exports && S.pay.exports[0]));
  /* month close and change detection */
  await P.evaluate(() => document.querySelector('[data-pa="pxclose"]').click()); await w(300);
  t = await txt(); ok('month shows as paid', /Paid/.test(t));
  await P.evaluate(({ ym }) => { const S = JSON.parse(localStorage.getItem('totSchedule')); S.sched[ym]['dato lomidze'].d[2] = 'M'; localStorage.setItem('totSchedule', JSON.stringify(S)); SchedMount(); }, { ym }); await w(500);
  await P.evaluate(() => document.querySelector('#scheduleView [data-sub="pay"]').click()); await w(400);
  await P.evaluate((ym) => { const m = document.querySelector('#payM'); m.value = ym; m.dispatchEvent(new Event('change', { bubbles: true })); }, ym); await w(400);
  t = await txt(); ok('a change after closing is flagged', /Something changed after closing/.test(t), t.slice(0, 400));
  if (process.env.SHOT) await P.screenshot({ path: process.env.SHOT });
  ok('no page errors', H.errs.length === 0, H.errs.slice(0, 3)); await H.close();
  console.log('payroll_export: ' + (fails ? fails + ' FAILED' : 'ALL PASSED')); process.exit(fails ? 1 : 0);
})();
