/* v3.25: work type rules. A ticket of a work type created on a department board also creates linked tickets on other boards, grouped in one case. */
const path = require('path'), tool = process.argv[2] || path.join(__dirname, '..', 'tool', 'PTF-pass-to-floor-Gunda.html'), code = process.argv[3] || path.join(__dirname, '..', 'tool', 'Code.gs');
const gas = require('./fakegas')(code); require('./seed')(gas);
let fails = 0; function ok(n, c, x) { if (!c) fails++; console.log((c ? '  ✅ ' : '  ❌ ') + n + (x ? '  → ' + x : '')); }
function setPolicy(f) { const d = gas.data(), p = JSON.parse(d.keys.totAccessPolicy.v); f(p); d.keys.totAccessPolicy.v = JSON.stringify(p); gas.setData(d); }
const pull = (who) => gas.post({ action: 'pull', email: who, pwHash: 'pw-' + who });
const keyOf = (r, k) => { try { return JSON.parse(r.keys[k].v); } catch (e) { return null; } };
const cases = () => { const k = gas.data().keys.totCases; return k ? JSON.parse(k.v) : []; };
(async () => {
  const H = await require('./harness')(tool, gas);
  /* opens dept's board, fills the New ticket dialog and creates the ticket; returns the preview line and the toast-free result */
  const create = (P, dept, o) => P.evaluate(([dept, o]) => {
    document.querySelectorAll('.tkOv').forEach(x => x.remove()); DeptOpen(dept, 'board');
    document.querySelector('#deptView button[data-a="new"]').click();
    const $ = (i) => document.getElementById(i), wt = $('ntWt'), opts = Array.from(wt.options).map(x => x.textContent);
    if (o.to) { $('ntTo').value = o.to; $('ntTo').dispatchEvent(new Event('change')); }
    const v = Array.from(wt.options).filter(x => x.textContent === o.type)[0]; wt.value = v ? v.value : ''; wt.dispatchEvent(new Event('change'));
    const prev = $('ntWp').textContent; $('ntTi').value = o.title; $('ntRe').value = o.rel || ''; $('ntGo').click();
    return { opts, prev, found: !!v || !o.type }; }, [dept, o]);

  console.log('1. HR creates a Termination ticket on the HR board');
  const hr = await H.open({ email: 'hr@x.com', pw: 'pw-hr@x.com' }); await hr.sync();
  const n0 = gas.tasks().length;
  const r1 = await create(hr, 'hr', { type: 'Termination', title: 'Termination of Nino', rel: 'Nino Test' });
  ok('HR board offers the built-in work types', ['General (just this ticket)', 'Termination', 'Onboarding', 'Transfer'].every(t => r1.opts.indexOf(t) >= 0), r1.opts.join(', '));
  ok('preview names the linked Uniforms and Building access tickets', /Also creates:/.test(r1.prev) && /Uniforms — Collect the uniform/.test(r1.prev) && /Building access — Remove/.test(r1.prev), r1.prev);
  await hr.sync();
  const src = gas.tasks().filter(t => t.title === 'Termination of Nino')[0] || {}, cid = src.caseId, linked = gas.tasks().filter(t => cid && t.caseId === cid);
  const by = (d) => linked.filter(t => t.toRole === d);
  ok('server holds the HR ticket with a case id, work type and source board', !!cid && src.toRole === 'hr' && src.wt === 'termination' && src.src === 'hr', JSON.stringify({ toRole: src.toRole, caseId: src.caseId, wt: src.wt, src: src.src }));
  ok('exactly one HR ticket in the case (the new ticket fills the HR step)', by('hr').length === 1, by('hr').length);
  ok('linked Uniforms ticket (appearance), same case', by('appearance').length === 1 && /Collect the uniform.* — Nino Test$/.test(by('appearance')[0].title), by('appearance').map(t => t.title).join());
  ok('linked Building access ticket (access), same case', by('access').length === 1 && /Remove building/.test(by('access')[0].title), by('access').map(t => t.title).join());
  ok('linked tickets carry the case title, the source reference and a due date', linked.filter(t => t.id !== src.id).every(t => t.caseTitle === 'Termination: Nino Test' && /^wt:/.test(t.ref) && t.ref.indexOf(src.id) === 3 && !!t.due && t.wt === 'termination'), linked.map(t => t.ref + '/' + t.due).join(' '));
  ok('server ticket count: 1 + the default follow-up steps (Uniforms, Building access, FMD, IT)', gas.tasks().length === n0 + 5 && linked.length === 5, (gas.tasks().length - n0) + ' new, ' + linked.map(t => t.toRole).join(','));
  const cs = cases().filter(c => c.id === cid)[0];
  ok('case record on the server', !!cs && cs.kind === 'termination' && cs.title === 'Termination: Nino Test' && cs.empName === 'Nino Test' && cs.src === src.id && cs.byEmail === 'hr@x.com', JSON.stringify(cs));

  console.log('2. A General ticket is just one ticket');
  const n1 = gas.tasks().length, c1 = cases().length;
  const r2 = await create(hr, 'hr', { type: 'General (just this ticket)', title: 'Plain HR ticket' }); await hr.sync();
  ok('General: exactly one new ticket and no case', gas.tasks().length === n1 + 1 && cases().length === c1, (gas.tasks().length - n1) + ' tickets, ' + (cases().length - c1) + ' cases');
  const plain = gas.tasks().filter(t => t.title === 'Plain HR ticket')[0] || {};
  ok('General ticket has no case id or work type', !plain.caseId && !plain.wt, JSON.stringify({ caseId: plain.caseId, wt: plain.wt }));
  ok('General preview is empty', !r2.prev, r2.prev);

  console.log('3. Who receives the linked tickets and the case');
  let cp = pull('coach@x.com');
  ok('coach (Performance) does not get the Uniforms ticket or the case', !keyOf(cp, 'totTasks').some(t => t.caseId === cid) && !(keyOf(cp, 'totCases') || []).some(c => c.id === cid));
  setPolicy(p => { p.depts = { performance_coach: 'appearance' }; });
  cp = pull('coach@x.com');
  const ct = keyOf(cp, 'totTasks').filter(t => t.caseId === cid);
  ok('coach position mapped to Uniforms: receives the linked Uniforms ticket only', ct.length === 1 && ct[0].toRole === 'appearance', ct.map(t => t.toRole).join());
  ok('…and the case record (title of the case)', (keyOf(cp, 'totCases') || []).some(c => c.id === cid && c.title === 'Termination: Nino Test'), (keyOf(cp, 'totCases') || []).map(c => c.id).join());
  ok('…but not the other cases', !(keyOf(cp, 'totCases') || []).some(c => c.id === 'c1'));
  const fp = pull('fmd@x.com');
  ok('FMD receives its own linked ticket and the case', keyOf(fp, 'totTasks').some(t => t.caseId === cid && t.toRole === 'fmd') && (keyOf(fp, 'totCases') || []).some(c => c.id === cid));
  const co = await H.open({ email: 'coach@x.com', pw: 'pw-coach@x.com' }); await co.sync();
  const onBoard = await co.evaluate(() => { DeptOpen('appearance', 'board'); return document.getElementById('deptView').textContent; });
  ok('on the mapped device the ticket is on the Uniforms board', /Collect the uniform/.test(onBoard));
  setPolicy(p => { p.depts = {}; });

  console.log('4. Only the admin writes the rules');
  const tpl = JSON.stringify({ types: [{ id: 'wt_evil', label: 'Evil', dept: 'hr', steps: [{ d: 'it', t: 'x', days: 1 }] }] });
  const pr = gas.post({ action: 'push', email: 'hr@x.com', pwHash: 'pw-hr@x.com', keys: { totProcessTpl: { v: tpl, t: Date.now(), bt: 0 } } });
  ok('non-admin push of totProcessTpl is denied', (pr.denied || []).indexOf('totProcessTpl') >= 0 && !gas.data().keys.totProcessTpl, JSON.stringify(pr.denied));
  const ro = await hr.evaluate(() => { DeptOpen('hr', 'wt'); const b = document.getElementById('dwBody'); return { edit: !!b.querySelector('[data-e],[data-a="addt"]'), text: b.textContent }; });
  ok('HR sees the work types read-only', !ro.edit && /Only the admin can change work types/.test(ro.text) && /Termination/.test(ro.text));

  console.log('5. The admin adds a custom work type on the FMD board');
  const ad = await H.open({ admin: true }); await ad.sync();
  const added = await ad.evaluate(() => {
    DeptOpen('fmd', 'wt'); const b = () => document.getElementById('dwBody');
    b().querySelector('#wtNew').value = 'Shift swap'; b().querySelector('[data-a="addt"]').click();
    b().querySelector('[data-a="add"]').click(); b().querySelector('[data-a="add"]').click(); b().querySelector('[data-a="add"]').click();
    const set = (i, d, t, days) => { b().querySelector('[data-f="d"][data-i="' + i + '"]').value = d; b().querySelector('[data-f="t"][data-i="' + i + '"]').value = t; b().querySelector('[data-f="days"][data-i="' + i + '"]').value = days; };
    set(0, 'fmd', 'Update the schedule', 1); set(1, 'appearance', 'Swap the uniform size', 2); set(2, 'it', 'Move the login', 0);
    b().querySelector('[data-a="save"]').click();
    return { msg: (b().querySelector('#wtMsg') || {}).textContent, types: (JSON.parse(localStorage.getItem('totProcessTpl') || '{}').types || []) }; });
  const ty = added.types.filter(t => t.label === 'Shift swap')[0];
  ok('custom type saved with its three steps', !!ty && ty.dept === 'fmd' && ty.steps.map(s => s.d).join() === 'fmd,appearance,it', added.msg + ' ' + JSON.stringify(added.types));
  await ad.sync();
  const st = gas.data().keys.totProcessTpl, sv = st ? JSON.parse(st.v) : {};
  ok('admin push reached the server', (sv.types || []).some(t => t.label === 'Shift swap'));
  const fm = await H.open({ email: 'fmd@x.com', pw: 'pw-fmd@x.com' }); await fm.sync();
  const n2 = gas.tasks().length;
  const r5 = await create(fm, 'fmd', { type: 'Shift swap', title: 'Swap for Lasha', rel: 'Lasha Test' });
  ok('FMD device received the rule (offered in New ticket)', r5.found && r5.opts.indexOf('Shift swap') >= 0, r5.opts.join(', '));
  ok('preview lists Uniforms and IT, not FMD itself', /Uniforms — Swap the uniform size \(2 days\)/.test(r5.prev) && /IT — Move the login \(today\)/.test(r5.prev) && !/FMD —/.test(r5.prev), r5.prev);
  await fm.sync();
  const s5 = gas.tasks().filter(t => t.title === 'Swap for Lasha')[0] || {}, l5 = gas.tasks().filter(t => s5.caseId && t.caseId === s5.caseId);
  ok('fans out as configured: FMD ticket + Uniforms + IT', gas.tasks().length === n2 + 3 && l5.map(t => t.toRole).sort().join() === 'appearance,fmd,it', l5.map(t => t.toRole + ': ' + t.title).join(' | '));
  ok('custom case record on the server', cases().some(c => c.id === s5.caseId && c.kind === ty.id && c.title === 'Shift swap: Lasha Test'));
  ok('FMD ticket is the source (no second FMD ticket)', l5.filter(t => t.toRole === 'fmd').length === 1 && s5.wt === ty.id);

  console.log('6. Game counts reach the scheduling coordinator');
  const gc = [{ id: 'g1', game: 'Roulette', period: '2026-09', count: 120, u: Date.now() }];
  await ad.evaluate(gc => localStorage.setItem('totGameCounts', JSON.stringify(gc)), gc); await ad.sync();
  ok('game counts on the server', !!gas.data().keys.totGameCounts);
  ok('server sends game counts to the FMD position', !!keyOf(pull('fmd@x.com'), 'totGameCounts'), Object.keys(pull('fmd@x.com').keys).filter(k => /Game/.test(k)).join());
  await fm.sync();
  ok('FMD device holds the game counts', JSON.stringify(await fm.local('totGameCounts')) === JSON.stringify(gc), JSON.stringify(await fm.local('totGameCounts')));
  ok('shift lead still does not receive game counts', !pull('lead@x.com').keys.totGameCounts);

  console.log('7. Review fixes');
  const n7 = gas.tasks().length;
  const r7 = await create(hr, 'hr', { type: 'Termination', title: 'Termination of Gela', rel: 'Gela Test', to: 'it' }); await hr.sync();
  const s7 = gas.tasks().filter(t => t.title === 'Termination of Gela')[0] || {}, l7 = gas.tasks().filter(t => s7.caseId && t.caseId === s7.caseId);
  ok('work type sent to another department: that department gets one ticket, and the HR step is still created', l7.filter(t => t.toRole === 'it').length === 1 && l7.filter(t => t.toRole === 'hr').length === 1 && gas.tasks().length === n7 + 5, l7.map(t => t.toRole).join(','));
  ok('…and the preview no longer lists IT', !/IT —/.test(r7.prev) && /HR —/.test(r7.prev), r7.prev);
  setPolicy(p => { p.depts = { performance_coach: 'appearance' }; });
  const cOld = JSON.stringify(cases().filter(c => c.id === cid)[0]);
  const cv = (keyOf(pull('coach@x.com'), 'totCases') || []).filter(c => c.id === cid)[0];
  ok('linked department reads the case', !!cv);
  const bt = gas.data().keys.totCases.t;
  gas.post({ action: 'push', email: 'coach@x.com', pwHash: 'pw-coach@x.com', keys: { totCases: { v: JSON.stringify([Object.assign({}, cv, { title: 'Edited by Uniforms', byEmail: 'coach@x.com' })]), t: Date.now(), bt: bt } } });
  ok('…but cannot rewrite it', JSON.stringify(cases().filter(c => c.id === cid)[0]) === cOld, JSON.stringify(cases().filter(c => c.id === cid)[0]));
  gas.post({ action: 'push', email: 'coach@x.com', pwHash: 'pw-coach@x.com', keys: { totCases: { v: '[]', t: Date.now(), bt: gas.data().keys.totCases.t } } });
  ok('…or delete it', cases().some(c => c.id === cid));
  setPolicy(p => { p.depts = {}; });
  const tv = gas.data().keys.totTasks.t, mine = keyOf(pull('lead@x.com'), 'totTasks');
  gas.post({ action: 'push', email: 'lead@x.com', pwHash: 'pw-lead@x.com', keys: { totTasks: { v: JSON.stringify(mine.concat([{ id: 'fake-c1', title: 'peek', toRole: 'performance', fromEmail: 'lead@x.com', fromName: 'Levan Lead', fromRole: 'shift_lead', caseId: 'c1', ref: 'case:c1', status: 'todo' }])), t: Date.now(), bt: tv } } });
  ok('a made-up ticket with someone else\'s case id does not reveal that case', !(keyOf(pull('lead@x.com'), 'totCases') || []).some(c => c.id === 'c1'));
  const gr = gas.data(); gr.keys.totAccessGrants = { v: JSON.stringify({ v: 1, on: true, byEmail: { 'mgr@x.com': { views: { dept: { at: 1 }, tasks: { at: 1 } } } } }), t: Date.now() }; gas.setData(gr);
  const mg = await H.open({ email: 'mgr@x.com', pw: 'pw-mgr@x.com' }); await mg.sync(); await mg.waitForTimeout(800);
  const land = await mg.evaluate(() => { document.querySelectorAll('#gateOv,.tkOv').forEach(x => x.remove()); openSpace('performance'); return { v: currentView, sp: spaceOf() }; });
  ok('admin-only mode, manager granted only department boards: Performance opens its Overview instead of bouncing Home', land.v === 'spacehome' && land.sp === 'performance', JSON.stringify(land));
  const brd = await mg.evaluate(() => { const c = Array.from(document.querySelectorAll('#spaceHomeView .shCard')).filter(b => /Board/.test(b.textContent))[0]; if (c) c.click(); return { v: currentView, d: window.__dw && __dw.cur() }; });
  ok('…and its Board card opens the board', brd.v === 'dept' && brd.d === 'performance', JSON.stringify(brd));
  const lk = await mg.evaluate(() => Array.from(document.querySelectorAll('#spaceSub button')).filter(b => b.querySelector('.gtLk')).map(b => b.textContent.trim().slice(0, 20)));
  ok('…and the locked screens in that space show a lock', lk.some(t => /Exam Evaluation/.test(t)), lk.join(' | '));
  gr.keys.totAccessGrants = { v: JSON.stringify({ v: 1, on: false, byEmail: {} }), t: Date.now() }; gas.setData(gr);

  ok('no page errors', !H.errs.length, H.errs.join(' | '));
  console.log(fails ? fails + ' FAILED' : 'ALL PASSED'); await H.close(); process.exit(fails ? 1 : 0);
})();
