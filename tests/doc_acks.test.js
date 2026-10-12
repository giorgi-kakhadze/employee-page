/* v3.42 audit improvement: department documents can ask staff to "read and confirm" a version. Staff confirm their own reading; managers see who has not;
   a new version asks again; the Apps Script refuses a confirmation written for somebody else. */
const path = require('path'), tool = path.join(__dirname, '..', 'tool', 'PTF-pass-to-floor-Gunda.html');
const gas = require('./fakegas')(path.join(__dirname, '..', 'tool', 'Code.gs')), users = require('./seed')(gas);
let fails = 0; function ok(n, c, x) { if (!c) fails++; console.log((c ? '  ✅ ' : '  ❌ ') + n + (c ? '' : '  → ' + x)); }
const now = Date.now(), d0 = gas.data();
users['hr2@x.com'] = { role: 'hr_recruiter', name: 'Hugo HR', sites: ['main'] }; gas.addUser('hr2@x.com', 'pw-hr2@x.com', 'Hugo HR');
d0.keys.totAccessPolicy = { v: JSON.stringify({ users, roles: {}, depts: {} }), t: now - 900 };
d0.keys.totDeptDocs = { v: JSON.stringify([{ id: 'dc1', dept: 'hr', title: 'Leave policy', url: 'https://example.com/leave', cat: 'Policy', vis: 'dept', owner: 'Hana HR', by: 'Hana HR', ts: now - 5000, u: now - 5000, ver: '2', ack: true }]), t: now - 900 };
gas.setData(d0);
const acks = () => { const e = gas.data().keys.totDocAcks; return e ? JSON.parse(e.v) : []; };
(async () => {
  const H = await require('./harness')(tool, gas);
  const open = async (who) => { const P = await H.open({ email: who + '@x.com', pw: 'pw-' + who + '@x.com' }); await P.setViewportSize({ width: 1300, height: 900 }); await P.sync(); await P.waitForTimeout(500); return P; };
  const docs = (P) => P.evaluate(() => { document.querySelectorAll('.tkOv').forEach(x => x.remove()); DeptOpen('hr', 'docs'); const b = document.getElementById('dwBody') || document.getElementById('deptView'); return { t: b.innerText, k: !!b.querySelector('[data-k="dc1"]'), w: !!b.querySelector('[data-w="dc1"]') }; });
  let hr = await open('hr'), v = await docs(hr);
  ok('a staff member of the department sees "I have read version 2"', v.k && /confirm required/.test(v.t), v.t.slice(0, 300));
  await hr.click('[data-k="dc1"]'); await hr.waitForTimeout(300); await hr.sync(); await hr.waitForTimeout(300);
  v = await docs(hr); ok('after confirming, the button turns into "You confirmed version 2"', !v.k && /You confirmed version 2/.test(v.t), v.t.slice(0, 300));
  let a = acks(); ok('the server stores exactly one confirmation, for hr@x.com, version 2', a.length === 1 && a[0].email === 'hr@x.com' && a[0].ver === '2' && a[0].doc === 'dc1', JSON.stringify(a));
  /* forgery: hr writes a confirmation for hr2 and tries to delete nothing else */
  const forged = a.concat([{ id: 'daX', doc: 'dc1', ver: '2', email: 'hr2@x.com', name: 'Hugo HR', ts: now }]);
  const r = gas.post({ action: 'push', email: 'hr@x.com', pwHash: 'pw-hr@x.com', keys: { totDocAcks: { v: JSON.stringify(forged), t: Date.now() + 10, bt: gas.data().keys.totDocAcks.t } } });
  a = acks(); ok('the Apps Script drops a confirmation written for somebody else', !!r.ok && a.length === 1 && !a.some(x => x.email === 'hr2@x.com'), JSON.stringify(r) + ' ' + JSON.stringify(a));
  /* deleting another person's confirmation is not possible either */
  const h2 = await open('hr2'); await docs(h2); await h2.click('[data-k="dc1"]'); await h2.waitForTimeout(300); await h2.sync(); await h2.waitForTimeout(300);
  ok('a second person confirms on their own device', acks().length === 2, JSON.stringify(acks()));
  gas.post({ action: 'push', email: 'hr@x.com', pwHash: 'pw-hr@x.com', keys: { totDocAcks: { v: '[]', t: Date.now() + 20, bt: gas.data().keys.totDocAcks.t } } });
  ok('wiping the list from one account keeps the other person\'s confirmation', acks().some(x => x.email === 'hr2@x.com') && !acks().some(x => x.email === 'hr@x.com'), JSON.stringify(acks()));
  /* manager view */
  const mg = await open('mgr'); v = await docs(mg);
  ok('the manager sees "1 of 2 confirmed version 2" and a "Who has not?" button', /1 of 2 confirmed version 2/.test(v.t) && v.w, v.t.slice(0, 400));
  await mg.click('[data-w="dc1"]'); await mg.waitForTimeout(200); const who = await mg.evaluate(() => (document.querySelector('.tkOv') || {}).innerText || '');
  ok('"Who has not?" lists Hana (her confirmation was wiped) and not Hugo', /hr@x\.com/.test(who) && !/hr2@x\.com/.test(who), who);
  /* new version asks again */
  const dd = gas.data(), D = JSON.parse(dd.keys.totDeptDocs.v); D[0].ver = '3'; D[0].u = Date.now(); dd.keys.totDeptDocs = { v: JSON.stringify(D), t: Date.now() }; gas.setData(dd);
  await h2.sync(); await h2.waitForTimeout(300); v = await docs(h2);
  ok('when the owner publishes version 3, the person is asked again', v.k && /I have read version 3/.test(v.t), v.t.slice(0, 300));
  ok('no page errors', H.errs.length === 0, H.errs.join(' | '));
  await H.close(); console.log('doc_acks: ' + (fails ? fails + ' FAILED' : 'ALL PASSED')); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
