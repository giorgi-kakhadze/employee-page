/* v3.26: onboarding templates sent as live tickets. Fingerprints → Building access, Live exam → Performance, Uniforms → Uniforms. */
const path = require('path'), tool = process.argv[2] || path.join(__dirname, '..', 'tool', 'PTF-pass-to-floor-Gunda.html'), code = process.argv[3] || path.join(__dirname, '..', 'tool', 'Code.gs');
const gas = require('./fakegas')(code); require('./seed')(gas);
let fails = 0; function ok(n, c, x) { if (!c) fails++; console.log((c ? '  ✅ ' : '  ❌ ') + n + (x ? '  → ' + x : '')); }
function setPolicy(f) { const d = gas.data(), p = JSON.parse(d.keys.totAccessPolicy.v); f(p); d.keys.totAccessPolicy.v = JSON.stringify(p); gas.setData(d); }
const cms = () => { const k = gas.data().keys.totComments; return k ? JSON.parse(k.v) : []; };
const snapOf = (id) => cms().filter(c => c.ref === id && c.ot === 'S').map(c => c.v)[0];
(async () => {
  const H = await require('./harness')(tool, gas);
  /* the shift lead's position is mapped to Building access, so lead@x.com plays the office access team */
  setPolicy(p => { p.depts = { shift_lead: 'access' }; });
  const d0 = gas.data(); d0.keys.totOnboardingHier = { v: JSON.stringify({ v: 1, trainers: [{ id: 'trainer_a', name: 'Tina Trainer', email: '', archived: false, onboardings: [] }] }), t: Date.now() }; gas.setData(d0);
  const ad = await H.open({ admin: true }); await ad.sync(); await ad.reload(); await ad.waitForTimeout(1200);   /* the onboarding module reads its data at load */

  console.log('1. The trainer creates an onboarding group with trainees');
  const made = await ad.evaluate(async () => {
    const w = (ms) => new Promise(r => setTimeout(r, ms)), q = (s) => document.querySelector(s);
    switchView('onboarding'); await w(300);
    q('#obBrowser [data-t="trainer_a"] [data-x="openT"]').click(); await w(200);
    q('#obBrowser [data-x="newO"]').click(); await w(200);
    q('#sName').value = 'GP October 5'; q('#sTrack').value = 'GP'; q('#sDate').value = '2026-10-05'; q('#sDays').value = '5'; q('#sGo').click(); await w(800);
    const H0 = JSON.parse(localStorage.getItem('totOnboardingHier')), o = H0.trainers[0].onboardings[0];
    return { id: o && o.id, name: o && o.name, hasCfg: !!(o && o.ws && o.ws.cfg) }; });
  ok('group created through the screens', !!made.id && made.hasCfg, JSON.stringify(made));
  /* trainees are added to the stored group and the group is reopened (same as a sync from another trainer's device) */
  const tr = (id, fn, ln, extra) => Object.assign({ vals: {}, x: {}, tpl: {}, employeeId: id, personalId: 'P' + id, firstName: fn, lastName: ln, phone: '555-' + id, email: fn.toLowerCase() + '@mail.ge', team: 'Team A', nickname: fn.slice(0, 3), startDate: '2026-10-05', status: '' }, extra || {});
  await ad.evaluate(async ([oid, trainees]) => {
    const w = (ms) => new Promise(r => setTimeout(r, ms)), q = (s) => document.querySelector(s);
    const H0 = JSON.parse(localStorage.getItem('totOnboardingHier')), o = H0.trainers[0].onboardings.filter(x => x.id === oid)[0];
    o.ws.trainees = trainees; o.ws.tpl = { examDate: '08/10/2026', examTime: '15:00' }; o.updated = Date.now();
    localStorage.setItem('totOnboardingHier', JSON.stringify(H0)); localStorage.removeItem('totOnboardingV2'); location.reload(); }, [made.id, [tr('GEO10001', 'Nino', 'Beridze'), tr('GEO10002', 'Gela', 'Kapanadze', { status: 'Drop Out', dropReason: 'Found another job' }), tr('GEO10003', 'Ana', 'Lomidze')]]).catch(() => {});
  await ad.waitForTimeout(1500);
  await ad.evaluate(async (oid) => { const w = (ms) => new Promise(r => setTimeout(r, ms)), q = (s) => document.querySelector(s);
    switchView('onboarding'); await w(300); q('#obBrowser [data-t="trainer_a"] [data-x="openT"]').click(); await w(200);
    q('#obBrowser [data-o="' + oid + '"] [data-x="openO"]').click(); await w(300);
    Array.from(document.querySelectorAll('#obTabs button')).filter(b => b.dataset.s === 'Templates')[0].click(); await w(300); }, made.id);
  const btns = await ad.evaluate(() => Array.from(document.querySelectorAll('#obTpl button[data-share]')).map(b => b.dataset.share + ':' + b.textContent.trim()));
  ok('three Send buttons: Fingerprints, Uniforms, Live exam', ['fp', 'uni', 'live'].every(k => btns.some(b => b.indexOf(k + ':') === 0)) && btns.length === 3, btns.join(' | '));

  console.log('2. Sending the three templates');
  for (const k of ['fp', 'live', 'uni']) { await ad.evaluate((k) => document.querySelector('#obTpl button[data-share="' + k + '"]').click(), k); await ad.waitForTimeout(200); }
  const sent = await ad.evaluate(() => Array.from(document.querySelectorAll('#obTpl button[data-shopen]')).map(b => b.textContent.trim()));
  ok('each button turns into "✓ Sent to …"', sent.length === 3, sent.join(' | '));
  await ad.sync();
  const tk = (bid) => gas.tasks().filter(t => t.ref === 'onbtpl:' + made.id + ':' + bid)[0] || {};
  const fp = tk('fp'), lv = tk('live'), un = tk('uni');
  ok('Fingerprints ticket → Building access', fp.toRole === 'access' && /^Fingerprints — GP October 5 \(3 trainees\)$/.test(fp.title), fp.toRole + ' / ' + fp.title);
  ok('Live exam ticket → Performance, due on the exam date', lv.toRole === 'performance' && lv.due === '2026-10-08', lv.toRole + ' / ' + lv.due);
  ok('Uniforms ticket → Uniforms', un.toRole === 'appearance', un.toRole);
  ok('exactly 3 new tickets, no duplicates', gas.tasks().filter(t => /^onbtpl:/.test(t.ref || '')).length === 3);
  const s1 = snapOf(fp.id) || {};
  ok('the Fingerprints table travels with the ticket (all trainees, status column)', (s1.rows || []).length === 3 && s1.cols.indexOf('Biostar ID') >= 0 && s1.cols.indexOf('Status') >= 0 && (s1.rows || []).some(r => r.c.indexOf('Drop Out') >= 0), JSON.stringify(s1.cols));
  const sl = snapOf(lv.id) || {};
  ok('the Live exam table shows each person\'s time frame and the exam date / time', sl.cols.indexOf('Time Frame') >= 0 && (sl.rows || []).every(r => r.c[sl.cols.indexOf('Time Frame')] === '15:00 - 18:00') && (sl.meta || []).some(m => m[0] === 'Exam Date' && m[1] === '08/10/2026') && (sl.meta || []).some(m => m[0] === 'Live Exam Time' && m[1] === '15:00'), JSON.stringify(sl.meta));
  const sendAgain = await ad.evaluate(() => { const b = document.querySelector('#obTpl button[data-share]'); return !!b; });
  ok('no second Send button once sent', !sendAgain);

  console.log('3. The office access team works on the ticket');
  const ld = await H.open({ email: 'lead@x.com', pw: 'pw-lead@x.com' }); await ld.sync();
  const view = await ld.evaluate((id) => { TasksApi.open(id); const b = document.querySelector('.kbOv .tkBox'); return { rows: b.querySelectorAll('.otT tr').length, bad: b.querySelectorAll('.otT tr.otBad').length, text: b.textContent, inputs: b.querySelectorAll('.otT input[data-oe]').length }; }, fp.id);
  ok('Building access sees the table in the ticket (3 trainees + header)', view.rows === 4 && /GEO10001/.test(view.text) && /Nino|Beridze/.test(view.text), view.rows + ' rows');
  ok('the drop-out row is marked red with its reason', view.bad === 1 && /Found another job/.test(view.text));
  ok('Biostar ID and Comment cells are editable for them', view.inputs >= 6, view.inputs + ' inputs');
  await ld.evaluate(() => { const b = document.querySelector('.kbOv .tkBox'), set = (sel, v) => { const e = b.querySelector(sel); if (e.type === 'checkbox') e.checked = v; else e.value = v; e.dispatchEvent(new Event('change', { bubbles: true })); };
    set('input[data-od="geo10001"]', true); });
  await ld.evaluate(() => { const b = document.querySelector('.kbOv .tkBox'); const e = b.querySelector('input[data-on="geo10003"]'); e.value = 'Card printer down, tomorrow'; e.dispatchEvent(new Event('change', { bubbles: true })); });
  const bioCol = s1.cols.indexOf('Biostar ID');
  await ld.evaluate((ci) => { const b = document.querySelector('.kbOv .tkBox'); const e = b.querySelector('input[data-oe="geo10001|' + ci + '"]'); e.value = 'BS-777'; e.dispatchEvent(new Event('change', { bubbles: true })); }, bioCol);
  await ld.evaluate((id) => { window.__cm.addC('task', id, 'Fingerprints done for Nino'); }, fp.id);
  await ld.sync();
  const ed = cms().filter(c => c.ref === fp.id && c.ot === 'E');
  ok('their tick, note and correction are saved as separate records (the ticket itself is untouched)', ed.length === 3 && gas.tasks().filter(t => t.id === fp.id)[0].u === fp.u, ed.map(e => e.v.f).join(','));
  ok('their comment is a normal ticket comment', cms().some(c => c.ref === fp.id && !c.ot && c.text === 'Fingerprints done for Nino'));
  const thr = await ld.evaluate((id) => { const d = document.createElement('div'); d.innerHTML = window.__cm.thread('task', id); return d.textContent; }, fp.id);
  ok('table records do not show up as comments', /Fingerprints done for Nino/.test(thr) && !/BS-777|printer/.test(thr), thr.slice(0, 120));

  console.log('4. Back on the trainer\'s device');
  await ad.sync(); await ad.waitForTimeout(4500); await ad.sync();
  const back = await ad.evaluate(() => { const H0 = JSON.parse(localStorage.getItem('totOnboardingHier')), o = H0.trainers[0].onboardings[0], t = o.ws.trainees.filter(x => x.employeeId === 'GEO10001')[0]; return { bio: t && t.tpl && t.tpl.biostar, line: (document.querySelector('#obTpl .tpl-card[data-b] .tpl-note') || {}).textContent, notes: Array.from(document.querySelectorAll('#obTpl .tpl-note')).map(n => n.textContent).join(' | ') }; });
  ok('the Biostar ID corrected by Building access is written back into the onboarding', back.bio === 'BS-777', JSON.stringify(back.bio));
  ok('the template shows the ticket status and how many rows are done', /1\/3 done by the department/.test(back.notes), back.notes.slice(0, 200));
  /* the trainer adds a comment for Ana in the Fingerprints template (same as typing in the cell) */
  await ad.evaluate(() => { const card = Array.from(document.querySelectorAll('#obTpl .tpl-card')).filter(c => /Fingerprints/.test(c.querySelector('h4').textContent))[0]; const head = Array.from(card.querySelectorAll('tr:first-child th')).map(th => th.textContent); const ci = head.indexOf('Comment'), tds = card.querySelectorAll('td[data-c="' + ci + '"]'); const td = tds[2]; td.textContent = 'Late on day 2'; td.dispatchEvent(new FocusEvent('focusout', { bubbles: true })); });
  await ad.waitForTimeout(800); await ad.sync();
  const s2 = snapOf(fp.id) || {}, ana = (s2.rows || []).filter(r => r.k === 'geo10003')[0], nino = (s2.rows || []).filter(r => r.k === 'geo10001')[0];
  ok('the trainer\'s comment reaches the ticket by itself', !!ana && ana.c[s2.cols.indexOf('Comment')] === 'Late on day 2', ana && JSON.stringify(ana.c));
  ok('the ticket table now holds the written-back Biostar ID', !!nino && nino.c[bioCol] === 'BS-777', nino && nino.c[bioCol]);
  await ld.sync();
  const v2 = await ld.evaluate((id) => { document.querySelectorAll('.kbOv').forEach(x => x.remove()); TasksApi.open(id); const b = document.querySelector('.kbOv .tkBox'); const cm = Array.from(b.querySelectorAll('input[data-oe^="geo10003|"]')).map(i => i.value); return { cm: cm, done: b.querySelector('input[data-od="geo10001"]').checked, note: b.querySelector('input[data-on="geo10003"]').value }; }, fp.id);
  ok('Building access sees the trainer\'s update and keeps its own tick and note', v2.cm.indexOf('Late on day 2') >= 0 && v2.done && v2.note === 'Card printer down, tomorrow', JSON.stringify(v2));
  const n1 = await ad.evaluate(() => (window.__cm && document.getElementById('bellBadge') || {}).textContent || '');
  ok('the trainer gets a bell notification for the department\'s changes', +n1 > 0, 'badge ' + n1);

  console.log('5. Privacy');
  const co = gas.post({ action: 'pull', email: 'coach@x.com', pwHash: 'pw-coach@x.com' }), coT = JSON.parse(co.keys.totTasks.v), coC = JSON.parse(co.keys.totComments.v);
  ok('Performance (coach) gets the Live exam ticket and its table', coT.some(t => t.id === lv.id) && coC.some(c => c.ref === lv.id && c.ot === 'S'));
  ok('…but not the Fingerprints table with phones and e-mails', !coT.some(t => t.id === fp.id) && !coC.some(c => c.ref === fp.id));
  const fm = gas.post({ action: 'pull', email: 'fmd@x.com', pwHash: 'pw-fmd@x.com' });
  ok('FMD gets none of the three', !JSON.parse(fm.keys.totComments.v).some(c => /^otS/.test(c.id)));

  ok('no page errors', !H.errs.length, H.errs.join(' | '));
  console.log(fails ? fails + ' FAILED' : 'ALL PASSED'); await H.close(); process.exit(fails ? 1 : 0);
})();
