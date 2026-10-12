/* v3.42 audit improvement: shift handover log on the Today screen. The outgoing lead saves a note (with the shift summary); the next shift's lead marks it read.
   The Apps Script keeps the note owned by its writer, lets others add only their own "read", and never lets staff delete a handover. */
const path = require('path'), tool = path.join(__dirname, '..', 'tool', 'PTF-pass-to-floor-Gunda.html');
const gas = require('./fakegas')(path.join(__dirname, '..', 'tool', 'Code.gs')); require('./seed')(gas);
let fails = 0; function ok(n, c, x) { if (!c) fails++; console.log((c ? '  ✅ ' : '  ❌ ') + n + (c ? '' : '  → ' + x)); }
const hos = () => { const e = gas.data().keys.totHandover; return e ? JSON.parse(e.v) : []; };
const push = (who, arr) => gas.post({ action: 'push', email: who, pwHash: 'pw-' + who, keys: { totHandover: { v: JSON.stringify(arr), t: Date.now() + 50, bt: (gas.data().keys.totHandover || {}).t } } });
(async () => {
  const H = await require('./harness')(tool, gas);
  const open = async (who) => { const P = await H.open({ email: who + '@x.com', pw: 'pw-' + who + '@x.com' }); await P.setViewportSize({ width: 1400, height: 950 }); await P.sync(); await P.waitForTimeout(400);
    await P.evaluate(() => { window.__totNowH = 10; switchView('schedule'); }); await P.waitForTimeout(500); await P.evaluate(() => document.querySelector('#scheduleView [data-sub="today"]').click()); await P.waitForTimeout(500); return P; };
  const shiftBtn = (P, k) => P.evaluate((k) => document.querySelector('#scheduleView [data-sh="' + k + '"]').click(), k);
  const box = (P) => P.evaluate(() => (document.getElementById('hoBox') || {}).innerText || '');
  const lead = await open('lead'); await shiftBtn(lead, 'morning'); await lead.waitForTimeout(300);
  ok('Today shows the two handover boxes even without a rotation', /From the previous shift/.test(await box(lead)) && /Handover to the next shift/.test(await box(lead)), await box(lead));
  await lead.fill('#hoNote', 'Table 7 card shoe jammed; IT ticket open.'); await shiftBtn(lead, 'morning'); await lead.waitForTimeout(300);
  ok('an unsaved note survives a redraw of the screen', (await lead.inputValue('#hoNote')) === 'Table 7 card shoe jammed; IT ticket open.', await lead.inputValue('#hoNote'));
  await lead.click('[data-hosave]'); await lead.waitForTimeout(300); await lead.sync(); await lead.waitForTimeout(300);
  let a = hos(); ok('the handover is stored on the server, owned by the writer', a.length === 1 && a[0].byEmail === 'lead@x.com' && /Table 7/.test(a[0].note) && /^ho\|\d{4}-\d\d-\d\d\|morning$/.test(a[0].id), JSON.stringify(a));
  /* the next shift */
  const mgr = await open('mgr'); await shiftBtn(mgr, 'afternoon'); await mgr.waitForTimeout(300);
  let b = await box(mgr); ok('the afternoon shift sees the morning note under "From the previous shift" with "I have read it"', /Table 7 card shoe jammed/.test(b) && !!(await mgr.$('[data-hoack]')), b);
  /* forgery attempts before the read */
  push('mgr@x.com', [Object.assign({}, a[0], { note: 'changed by somebody else' })]); ok('somebody else cannot change the note', /Table 7/.test(hos()[0].note), JSON.stringify(hos()));
  push('mgr@x.com', hos().concat([{ id: 'ho|2030-01-01|night', date: '2030-01-01', shift: 'night', note: 'x', by: 'Levan Lead', byEmail: 'lead@x.com', ts: Date.now() }])); ok('nobody can save a handover in another person\'s name', hos().length === 1, JSON.stringify(hos()));
  push('mgr@x.com', [Object.assign({}, a[0], { ackEmail: 'coach@x.com', ackBy: 'Cora Coach' })]); ok('nobody can mark it read for somebody else', !hos()[0].ackEmail, JSON.stringify(hos()));
  push('lead@x.com', [Object.assign({}, a[0], { ackEmail: 'lead@x.com', ackBy: 'Levan Lead' })]); ok('the writer cannot mark their own handover read', !hos()[0].ackEmail, JSON.stringify(hos()));
  push('lead@x.com', []); ok('a handover cannot be deleted by staff', hos().length === 1, JSON.stringify(hos()));
  await mgr.click('[data-hoack]'); await mgr.waitForTimeout(300); await mgr.sync(); await mgr.waitForTimeout(300);
  a = hos(); ok('"I have read it" is stored in the reader\'s own name', a[0].ackEmail === 'mgr@x.com' && a[0].ackTs > 0, JSON.stringify(a));
  push('lead@x.com', [Object.assign({}, a[0], { note: 'rewritten after it was read' })]); ok('after it was read, even the writer cannot change it', /Table 7/.test(hos()[0].note), JSON.stringify(hos()));
  await lead.sync(); await lead.waitForTimeout(300); await shiftBtn(lead, 'morning'); await lead.waitForTimeout(300); b = await box(lead);
  ok('the writer sees "read by Mia Manager" and no edit box any more', /read by Mia Manager/.test(b) && !(await lead.$('#hoNote')), b);
  ok('no page errors', H.errs.length === 0, H.errs.join(' | '));
  await H.close(); console.log('handover: ' + (fails ? fails + ' FAILED' : 'ALL PASSED')); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
