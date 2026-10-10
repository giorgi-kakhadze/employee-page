/* v3.31 Bonuses, month review, pay statements and the employee page (Home / Schedule / Rotation).
   Tool: bonus programs with levels per position, the month review (shifts, hours, salary so far, evaluations, mistakes, incidents, remarks), hours changed
   for a day (left early) and hourly pay, final month, remarks shown or internal, pay pages published. Server: who receives what; 'me' returns the
   employee's own statement, shown remarks, incidents and evaluation comments; new request types. Employee page: the three buttons and what they show. */
const path = require('path'), fs = require('fs'), tool = process.argv[2] || path.join(__dirname, '..', 'tool', 'PTF-pass-to-floor-Gunda.html'), code = process.argv[3] || path.join(__dirname, '..', 'tool', 'Code.gs');
const gas = require('./fakegas')(code); require('./seed')(gas);
const SHOTS = process.env.SHOTS || '';
let fails = 0; function ok(n, c, x) { if (!c) fails++; console.log((c ? '  ✅ ' : '  ❌ ') + n + (x ? '  → ' + x : '')); }
const pull = (email) => gas.post({ action: 'pull', email, pwHash: 'pw-' + email });
const keyOf = (r, k) => { try { return JSON.parse((r.keys[k] || {}).v); } catch (e) { return null; } };
const p2 = (n) => ('0' + n).slice(-2), now = new Date(), prev = new Date(now.getFullYear(), now.getMonth() - 1, 1), ym1 = prev.getFullYear() + '-' + p2(prev.getMonth() + 1);
(async () => {
  const H = await require('./harness')(tool, gas);
  const A = await H.open({ admin: true }); await A.setViewportSize({ width: 1500, height: 950 }); await A.sync();
  await A.evaluate(({ ym1 }) => {
    localStorage.setItem('employeeDataSource', JSON.stringify([
      { id: 1, fullName: 'Ana Beridze', nickname: 'Annie', workId: 'W1000', code: 'W1000', status: 'Employed', ext: { position: 'VIP Game Presenter', team: 'Team Red', manager: 'Mia Manager', email: 'ana@x.com' } },
      { id: 2, fullName: 'Dato Lomidze', nickname: 'DatoL', workId: 'W1001', code: 'W1001', status: 'Employed', ext: { position: 'Shuffler', team: 'Team Red', manager: 'Mia Manager', email: 'dato@x.com' } }]));
    const S = JSON.parse(localStorage.getItem('totSchedule') || '{}');
    S.roster = { anchor: ym1 + '-01', people: [{ name: 'Ana Beridze', g: 'A', sh: 'morning', t: '', pos: 'vip' }, { name: 'Dato Lomidze', g: 'A', sh: 'morning', t: '', pos: 'shuf' }] };
    S.sched = {}; S.sched[ym1] = { 'ana beridze': { d: { 1: 'M', 2: 'M', 3: 'N', 7: 'VAC' }, c: {} }, 'dato lomidze': { d: { 1: 'M' }, c: {} } };
    S.pay = { unit: 'hour', day: 0, night: 0, hol: 2, mult: {}, raises: [], bonus: [], vacPct: 100, pos: [{ id: 'vip', name: 'VIP Game Presenter', day: 10, night: 14 }, { id: 'prem', name: 'Premium Game Presenter', day: 9, night: 12 }, { id: 'beg', name: 'Beginner Game Presenter', day: 8, night: 10 }, { id: 'shuf', name: 'Shuffler', day: 7, night: 9 }] };
    S.cfg = S.cfg || {}; S.cfg.len = 8;
    localStorage.setItem('totSchedule', JSON.stringify(S));
    localStorage.setItem('evalResults', JSON.stringify([{ id: 501, uid: 'u501', name: 'Ana Beridze', workId: 'W1000', typeLabel: 'Roulette', total: 92, date: ym1 + '-02', ts: new Date(ym1 + '-02T12:00:00').getTime(), criteria: [{ id: 'c1', name: 'Payout accuracy' }, { id: 'c2', name: 'Game protection' }], scores: { c1: 2, c2: 3 }, notes: { c1: 'Recheck the split payout' } }]));
    localStorage.setItem('evalShare', JSON.stringify({ u501: { on: true, wid: 'W1000', fb: 'Good pace.' } }));
    localStorage.setItem('totIncidents', JSON.stringify([{ id: 'i1', key: 'SM-9', date: ym1 + '-03', name: 'Ana Beridze', empId: 'W1000', type: 'Procedural mistake', game: 'Roulette', severity: 'Medium', summary: 'Closed bets late', status: 'Done', reporter: 'Sandro', m: 1 }]));
  }, { ym1 });
  await A.waitForTimeout(500);

  console.log('1. Bonus programs (FMD → 🏅 Bonuses & month)');
  await A.evaluate(() => DeptOpen('fmd', 'bonus')); await A.waitForTimeout(300);
  const bar = await A.evaluate(() => Array.from(document.querySelectorAll('#spaceSub button')).map(b => b.textContent.trim()));
  ok('FMD has 🏅 Bonuses & month', bar.some(t => /Bonuses & month/.test(t)), bar.join(' | '));
  await A.evaluate(() => document.querySelector('#dwBody .tkTabs [data-v="programs"]').click()); await A.waitForTimeout(200);
  await A.evaluate(() => document.querySelector('#dwBody [data-a="ex"]').click()); await A.waitForTimeout(300);
  let C = await A.local('totBonusCfg');
  const vip = (C.programs || []).filter(p => /VIP/.test(p.name))[0] || {};
  ok('example programs: VIP 5 levels for VIP presenters only, Shuffler for shufflers', C.programs.length === 4 && vip.levels.length === 5 && vip.pos.join() === 'vip' && C.programs.some(p => /Shuffler/.test(p.name) && p.pos.join() === 'shuf'), JSON.stringify(C.programs.map(p => [p.name, p.pos, p.levels.length])));
  await A.evaluate(() => { const card = Array.from(document.querySelectorAll('.bnProg')).filter(c => /VIP/.test(c.querySelector('.bnPN').value))[0]; const i = card.querySelectorAll('.bnLA')[2]; i.value = '175'; i.dispatchEvent(new Event('change', { bubbles: true })); });
  await A.waitForTimeout(200); C = await A.local('totBonusCfg');
  ok('a level amount can be changed (VIP level 3 → 175)', C.programs.filter(p => /VIP/.test(p.name))[0].levels[2].amount === 175);
  await A.evaluate(() => { document.querySelector('#dwBody [data-a="padd"]').click(); });
  await A.waitForTimeout(150); await A.evaluate(() => { const c = Array.from(document.querySelectorAll('.bnProg')).pop(); const n = c.querySelector('.bnPN'); n.value = 'Night shift bonus'; n.dispatchEvent(new Event('change', { bubbles: true })); });
  await A.waitForTimeout(150); await A.evaluate(() => { const c = Array.from(document.querySelectorAll('.bnProg')).pop(); c.querySelector('[data-a="ladd"]').click(); });
  await A.waitForTimeout(150); C = await A.local('totBonusCfg');
  ok('a new program with its own name and 2 levels', C.programs.length === 5 && C.programs[4].name === 'Night shift bonus' && C.programs[4].levels.length === 2);

  console.log('2. Month review');
  await A.evaluate(() => document.querySelector('#dwBody .tkTabs [data-v="review"]').click()); await A.waitForTimeout(200);
  await A.evaluate((ym1) => { const i = document.getElementById('bnYm'); i.value = ym1; i.dispatchEvent(new Event('change', { bubbles: true })); }, ym1); await A.waitForTimeout(300);
  const row = await A.evaluate(() => { const tr = Array.from(document.querySelectorAll('.bnTbl tbody tr')).filter(t => /Ana Beridze/.test(t.textContent))[0]; return tr ? Array.from(tr.cells).map(c => c.textContent.trim()) : null; });
  ok('Ana: 3 shifts, 24 hours, evaluation 92%, 1 point lost, 1 incident, salary so far shown', row && row[1] === '3' && row[2] === '24' && /^92%/.test(row[3]) && row[4] === '1' && row[5] === '1' && /^352\.00$/.test(row[9]), JSON.stringify(row));
  const opts = await A.evaluate(() => { const g = (n) => Array.from(document.querySelectorAll('.bnTbl tbody tr')).filter(t => new RegExp(n).test(t.textContent))[0]; return { ana: Array.from(g('Ana Beridze').querySelectorAll('select.bnLv')).map(s => s.title), dato: Array.from(g('Dato Lomidze').querySelectorAll('select.bnLv')).map(s => s.title) }; });
  ok('each person sees only the bonuses of their position (+ programs for everyone)', opts.ana.join() === 'VIP quality bonus,Night shift bonus' && opts.dato.join() === 'Shuffler attendance bonus,Night shift bonus', JSON.stringify(opts));
  await A.evaluate(() => { const s = Array.from(document.querySelectorAll('select.bnLv')).filter(x => x.getAttribute('data-k') === 'ana beridze' && /VIP/.test(x.title))[0]; s.value = '3'; s.dispatchEvent(new Event('change', { bubbles: true })); }); await A.waitForTimeout(300);
  let R = (await A.local('totBonusReviews')) || [], rv = R.filter(r => r.key === 'ana beridze')[0] || {};
  ok('choosing VIP level 3 saves a draft review', rv.ym === ym1 && rv.status === 'draft' && Object.values(rv.levels || {})[0] === 3, JSON.stringify(rv));
  await A.evaluate(() => Array.from(document.querySelectorAll('.bnOpen')).filter(b => /Ana Beridze/.test(b.textContent))[0].click()); await A.waitForTimeout(300);
  const md = await A.evaluate(() => { const m = document.getElementById('bnM'); return { cards: Array.from(m.querySelectorAll('.dbT')).map(x => x.textContent), hrs: m.querySelectorAll('input.bnH').length, txt: m.textContent }; });
  ok('the person month shows the numbers, the days with editable hours, the evaluation comment and the incident', md.hrs === 3 && md.cards.indexOf('3Shifts worked') >= 0 && md.cards.indexOf('24Hours') >= 0 && /Recheck the split payout/.test(md.txt) && /SM-9/.test(md.txt), md.cards.join(' | '));
  await A.evaluate((ym1) => { const i = document.querySelector('#bnM input.bnH[data-d="' + ym1 + '-02"]'); i.value = '5'; i.dispatchEvent(new Event('change', { bubbles: true })); }, ym1); await A.waitForTimeout(1800);
  const hrs = await A.evaluate((ym1) => { const S = JSON.parse(localStorage.getItem('totSchedule')); return S.hrs && S.hrs[ym1] && S.hrs[ym1]['ana beridze']; }, ym1);
  ok('left early: 5 hours on day 2 are saved in the schedule', hrs && hrs[2] === 5, JSON.stringify(hrs));
  const pay = await A.evaluate((ym1) => totPay.month('Ana Beridze', ym1), ym1);
  ok('hourly pay: 8h×10 + 5h×10 + night 8h×14 = 242, vacation day 8h×10 = 80, bonus 175', pay.amt === 242 && pay.leave === 80 && pay.bonus === 175 && pay.total === 497 && pay.hours === 21, JSON.stringify(pay));
  await A.evaluate(() => { const m = document.getElementById('bnM'); m.querySelector('#rmK').value = 'positive'; m.querySelector('#rmT').value = 'Thank you from a VIP player'; m.querySelector('#rmX').value = 'Very friendly game.'; m.querySelector('[data-a="radd"]').click(); }); await A.waitForTimeout(300);
  await A.evaluate(() => { const m = document.getElementById('bnM'); m.querySelector('#rmK').value = 'violation'; m.querySelector('#rmT').value = 'Phone on the floor'; m.querySelector('#rmS').checked = false; m.querySelector('[data-a="radd"]').click(); }); await A.waitForTimeout(300);
  const rm = (await A.local('totRemarks')) || [];
  ok('remarks: positive feedback (shown) and a violation (internal)', rm.length === 2 && rm.some(x => x.kind === 'positive' && x.share) && rm.some(x => x.kind === 'violation' && x.share === false), JSON.stringify(rm.map(x => [x.kind, x.share])));
  await A.evaluate(() => document.querySelector('#bnM [data-a="final"]').click()); await A.waitForTimeout(400);
  R = (await A.local('totBonusReviews')) || []; rv = R.filter(r => r.key === 'ana beridze')[0] || {};
  ok('the month is marked final', rv.status === 'final' && !!rv.finalBy);
  const locked = await A.evaluate(() => ({ sel: document.querySelector('#bnM select.bnLv').disabled, hrs: document.querySelectorAll('#bnM input.bnH').length }));
  ok('final months are locked (levels and hours) until reopened', locked.sel && locked.hrs === 0, JSON.stringify(locked));
  await A.evaluate(() => document.querySelector('.tkOv [data-x]').click());
  if (SHOTS) { await A.evaluate(() => { const i = document.getElementById('bnYm'); i.dispatchEvent(new Event('change', { bubbles: true })); }); await A.waitForTimeout(200); await A.screenshot({ path: SHOTS + '/1_month_review.png' }); await A.evaluate(() => Array.from(document.querySelectorAll('.bnOpen')).filter(b => /Ana Beridze/.test(b.textContent))[0].click()); await A.waitForTimeout(300); await A.screenshot({ path: SHOTS + '/2_person_month.png' }); await A.evaluate(() => document.querySelector('.tkOv [data-x]').click()); await A.evaluate(() => document.querySelector('#dwBody .tkTabs [data-v="programs"]').click()); await A.waitForTimeout(200); await A.screenshot({ path: SHOTS + '/3_bonus_programs.png' }); }
  const prof = await A.evaluate(() => { PersonHub.open('Ana Beridze'); const t = document.querySelector('[data-ph="tab"][data-t="month"]'); if (!t) return null; t.click(); return !!document.getElementById('bnPYm'); });
  await A.evaluate((ym1) => { const i = document.getElementById('bnPYm'); i.value = ym1; i.dispatchEvent(new Event('change', { bubbles: true })); }, ym1); await A.waitForTimeout(200);
  const prof2 = await A.evaluate(() => document.getElementById('bnProf').textContent);
  ok('the profile has a 🏅 Month tab with the same review (any month)', prof && /Bonus for/.test(prof2) && /Final/.test(prof2) && /Positive feedback/.test(prof2), prof2.slice(0, 120));
  if (SHOTS) await A.screenshot({ path: SHOTS + '/4_profile_month.png' });
  await A.evaluate(() => document.querySelector('[data-ph="close"]').click());

  console.log('3. Pay pages for employees');
  const n = await A.evaluate(() => totPublishPay(true));
  const MP = await A.local('totMyPay'), st = MP && MP.byEmail && MP.byEmail['ana@x.com'] && MP.byEmail['ana@x.com'].months[ym1];
  ok('statements written for the employees with an e-mail', n === 2 && !!st, n);
  ok('Ana\'s statement: 3 shifts, 21 h, shifts 242, leave 80, VIP L3 175, total 497, final, day 2 marked as changed hours', st && st.final && st.totals.shifts === 3 && st.totals.hours === 21 && st.totals.earned === 242 && st.totals.leave === 80 && st.totals.total === 497 && st.bonus[0].level === 3 && st.days.filter(d => d.act).length === 1, JSON.stringify(st && st.totals));
  await A.sync();

  console.log('4. Server: who receives what');
  const mg = pull('mgr@x.com'), co = pull('coach@x.com'), fm = pull('fmd@x.com'), hr = pull('hr@x.com');
  ok('managers receive programs, reviews, remarks and pay pages', ['totBonusCfg', 'totBonusReviews', 'totRemarks', 'totMyPay'].every(k => !!mg.keys[k]));
  ok('a coach and FMD receive remarks, but not reviews or pay pages', !!co.keys.totRemarks && !co.keys.totBonusReviews && !co.keys.totMyPay && !fm.keys.totBonusReviews && !fm.keys.totMyPay && !fm.keys.totBonusCfg, Object.keys(fm.keys).filter(k => /Bonus|MyPay|Remarks/.test(k)).join());
  const before = gas.data().keys.totBonusCfg.v;
  const r1 = gas.post({ action: 'push', email: 'mgr@x.com', pwHash: 'pw-mgr@x.com', keys: { totBonusCfg: { v: JSON.stringify({ programs: [] }), t: Date.now(), bt: gas.data().keys.totBonusCfg.t } } });
  ok('a manager may change the programs', (r1.denied || []).indexOf('totBonusCfg') < 0 && gas.data().keys.totBonusCfg.v !== before);
  gas.post({ action: 'push', admin: 'ADMKEY', keys: { totBonusCfg: { v: before, t: Date.now() + 5 } } });
  const r2 = gas.post({ action: 'push', email: 'fmd@x.com', pwHash: 'pw-fmd@x.com', keys: { totMyPay: { v: '{}', t: Date.now(), bt: gas.data().keys.totMyPay.t } } });
  ok('nobody else may write pay pages', (r2.denied || []).indexOf('totMyPay') >= 0 && gas.data().keys.totMyPay.v !== '{}');
  const me = gas.post({ action: 'me', idToken: 'gtok:ana@x.com' }), mp = (me.pay || [])[0] || {};
  ok('"me": Ana gets her own statement (total 497, bonus level 3)', mp.ym === ym1 && mp.totals.total === 497 && mp.bonus[0].amount === 175, JSON.stringify(me.error || mp.totals));
  ok('"me": the positive feedback but not the internal violation', (me.remarks || []).length === 1 && me.remarks[0].kind === 'positive', JSON.stringify(me.remarks));
  ok('"me": her incident and the evaluator\'s comment', (me.incidents || []).length === 1 && me.incidents[0].summary === 'Closed bets late' && me.evaluations[0].criteria.some(c => c.note === 'Recheck the split payout'), JSON.stringify(me.incidents));
  const md2 = gas.post({ action: 'me', idToken: 'gtok:dato@x.com' });
  ok('"me": Dato never gets Ana\'s pay or remarks', !(md2.pay || []).some(x => x.totals.total === 497) && !(md2.remarks || []).length && !(md2.incidents || []).length);
  const q1 = gas.post({ action: 'reqNew', idToken: 'gtok:ana@x.com', type: 'payq', from: new Date().toISOString().slice(0, 10), note: 'Day 2: I worked 5 hours, is that right?' });
  ok('new request types: Question about my pay', q1.ok && q1.requests.some(r => r.type === 'payq'), JSON.stringify(q1.error || ''));

  console.log('5. The employee page');
  const { chromium } = (function () { try { return require('playwright'); } catch (e) { return require(require('child_process').execSync('npm root -g').toString().trim() + '/playwright'); } })();
  const URL = 'https://script.google.com/macros/s/TEST/exec', tmp = path.join(require('os').tmpdir(), 'emp-page-test.html');
  fs.writeFileSync(tmp, fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8').replace(/var SERVER_URL = '[^']*'/, "var SERVER_URL = '" + URL + "'").replace('<script src="https://accounts.google.com/gsi/client" async defer></script>', ''));
  const br = await chromium.launch(), E = await (await br.newContext({ viewport: { width: 420, height: 900 } })).newPage(), perr = [];
  E.on('pageerror', e => perr.push(e.message)); E.on('dialog', d => d.accept());
  await E.route(URL + '**', async r => { await r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(gas.post(r.request().postData())) }); });
  await E.addInitScript(() => { window.google = { accounts: { id: { initialize: (c) => { window.__gcb = c.callback; }, renderButton: () => setTimeout(() => window.__gcb({ credential: 'gtok:ana@x.com' }), 30) } } }; });
  await E.goto('file://' + tmp); await E.waitForTimeout(800);
  const nav3 = await E.evaluate(() => Array.from(document.querySelectorAll('nav.main3 button')).map(b => b.textContent.trim()));
  ok('three buttons: Home, Schedule, Rotation', nav3.join('|') === '🏠 Home|📅 Schedule|🔄 Rotation', nav3.join('|'));
  const home = await E.evaluate(() => document.getElementById('pg').textContent);
  ok('Home: personal information, salary with the VIP bonus, evaluation, mistakes and incidents, feedback, games', /My information/.test(home) && /Employee IDW1000/.test(home) && /497\.00 GEL/.test(home) && /VIP quality bonus Level 3 of 5/.test(home) && /92%/.test(home) && /Incidents on the floor \(1\)/.test(home) && /Thank you from a VIP player/.test(home) && !/Phone on the floor/.test(home), home.slice(0, 200));
  await E.evaluate(() => document.querySelector('[data-ev="0"]').click()); await E.waitForTimeout(100);
  ok('tapping an evaluation shows the criteria and the evaluator\'s comment', /Recheck the split payout/.test(await E.evaluate(() => document.getElementById('ev0').textContent)));
  if (SHOTS) await E.screenshot({ path: SHOTS + '/5_employee_home.png', fullPage: true });
  await E.evaluate(() => document.querySelector('nav.main3 [data-t="schedule"]').click()); await E.waitForTimeout(100);
  const types = await E.evaluate(() => Array.from(document.querySelectorAll('#rqT option')).map(o => o.textContent));
  ok('Schedule: requests for swap, give away, vacation, sick leave, day off and pay questions', ['Swap a shift', 'Give away a shift', 'Vacation / annual leave', 'Sick leave', 'Day off', 'Question about my pay'].every(t => types.indexOf(t) >= 0), types.join(' | '));
  await E.selectOption('#rqT', 'dayoff'); await E.fill('#rqF', new Date(Date.now() + 10 * 864e5).toISOString().slice(0, 10)); await E.click('#rqGo'); await E.waitForTimeout(400);
  ok('a day-off request is sent and listed', /Day off/.test(await E.evaluate(() => document.getElementById('myreq').nextElementSibling.textContent)));
  const editable = await E.evaluate(() => document.querySelectorAll('#pg input:not(#rqW):not(#rqF):not(#rqTo), #pg [contenteditable]').length);
  ok('nothing else on the page can be edited', editable === 0, editable);
  if (SHOTS) await E.screenshot({ path: SHOTS + '/6_employee_schedule.png', fullPage: true });
  await E.evaluate(() => document.querySelector('nav.main3 [data-t="rotation"]').click()); await E.waitForTimeout(100);
  ok('Rotation: view only', /View only/.test(await E.evaluate(() => document.getElementById('pg').textContent)) && await E.evaluate(() => !document.querySelector('#pg input, #pg select, #pg textarea')));
  ok('no page errors on the employee page', !perr.length, perr.join(' | '));
  await br.close();

  ok('no page errors in the tool', !H.errs.length, H.errs.join(' | '));
  console.log(fails ? fails + ' FAILED' : 'ALL PASSED'); await H.close(); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
