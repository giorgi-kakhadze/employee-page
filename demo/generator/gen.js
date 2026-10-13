/* Builds a realistic fake data set for PTF (example company, all names made up). Output: { key: value-object } */
const fs = require('fs');
module.exports = function () {
  const html = fs.readFileSync(require('path').join(__dirname, '..', '..', 'tool', 'PTF-pass-to-floor-Gunda.html'), 'utf8');
  const a = html.indexOf('  function items(a, p) {'), b = html.indexOf('  function newWs(tr, date, time, days)');
  const defCfg = new Function(html.slice(a, b) + '; return defCfg;')();
  let seed = 20261007; const rnd = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
  const R = (n) => Math.floor(rnd() * n), P = (arr) => arr[R(arr.length)], chance = (p) => rnd() < p;
  const DAY = 864e5, NOW = Date.now(), p2 = (n) => String(n).padStart(2, '0');
  const iso = (t) => { const d = new Date(t); return d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate()); };
  const d = (n) => iso(NOW + n * DAY), ymOf = (t) => iso(t).slice(0, 7), TODAY = d(0), YM = ymOf(NOW);
  const prevM = new Date(); prevM.setDate(1); prevM.setMonth(prevM.getMonth() - 1); const PYM = ymOf(prevM.getTime());
  const nextM = new Date(); nextM.setDate(1); nextM.setMonth(nextM.getMonth() + 1); const NYM = ymOf(nextM.getTime());
  const dim = (ym) => new Date(+ym.slice(0, 4), +ym.slice(5, 7), 0).getDate();
  let idn = 0; const uid = (p) => p + (NOW - 1e9 + (idn++) * 997).toString(36) + idn;

  const FN_M = ['Giorgi', 'Luka', 'Nika', 'Davit', 'Irakli', 'Levan', 'Sandro', 'Lasha', 'Beka', 'Tornike', 'Zura', 'Gela', 'Saba', 'Dato', 'Nodar', 'Otar', 'Vakhtang', 'Archil', 'Mikheil', 'Shota', 'Revaz', 'Temur', 'Ilia', 'Aleksandre', 'Gabriel'];
  const FN_F = ['Ana', 'Nino', 'Mariam', 'Salome', 'Elene', 'Tamar', 'Natia', 'Ketevan', 'Sopho', 'Mariami', 'Teona', 'Nana', 'Lika', 'Tiko', 'Eka', 'Maia', 'Khatia', 'Lela', 'Nutsa', 'Barbare', 'Keti', 'Diana', 'Irina', 'Lana', 'Gvantsa'];
  const LN = ['Beridze', 'Kapanadze', 'Gelashvili', 'Lomidze', 'Tsiklauri', 'Abashidze', 'Japaridze', 'Kvaratskhelia', 'Maisuradze', 'Chikovani', 'Gogoladze', 'Mamaladze', 'Nozadze', 'Shengelia', 'Bakradze', 'Kharaishvili', 'Javakhishvili', 'Dolidze', 'Tabatadze', 'Kobakhidze', 'Tsereteli', 'Chkheidze', 'Gvenetadze', 'Margvelashvili', 'Kurtanidze', 'Sulaberidze', 'Meladze', 'Natsvlishvili', 'Gabunia', 'Iashvili'];
  const used = {}; const person = () => { for (;;) { const f = chance(.5) ? P(FN_F) : P(FN_M), l = P(LN), n = f + ' ' + l; if (!used[n]) { used[n] = 1; return { f, l, n, g: FN_F.includes(f) ? 'Female' : 'Male' }; } } };
  const slug = (s) => s.toLowerCase().replace(/[^a-z]+/g, '.').replace(/^\.|\.$/g, '');

  /* ---------- staff accounts (the access list holds the people who use the tool) ---------- */
  const STAFF = [['manager', 5], ['shift_lead', 5], ['training_coordinator', 5], ['senior', 2], ['performance_coach', 3], ['scheduling_coordinator', 2], ['hr_recruiter', 2], ['service_manager', 2]];
  const users = {}, staff = {};
  STAFF.forEach(([role, n]) => { staff[role] = []; for (let i = 0; i < n; i++) { const p = person(), email = slug(p.n) + '@example.com'; users[email] = { role, name: p.n, sites: ['main'] }; staff[role].push({ email, name: p.n, role }); } });
  const SL = staff.shift_lead, MG = staff.manager, TC = staff.training_coordinator, PC = staff.performance_coach, SC = staff.scheduling_coordinator, HR = staff.hr_recruiter, SM = staff.service_manager, SN = staff.senior;
  const policy = { users, roles: {}, depts: {}, upd: NOW };

  /* ---------- 1000 employees ---------- */
  const POS = [['VIP Game Presenter', 'vip', 10], ['Premium Game Presenter', 'prem', 22], ['Game Presenter', 'gp', 33], ['Beginner Game Presenter', 'beg', 15], ['Shuffler', 'shuf', 15], ['Pit Supervisor', 'pit', 5]];
  const posPick = () => { let x = R(100); for (const p of POS) { if (x < p[2]) return p; x -= p[2]; } return POS[2]; };
  const TEAMS = ['Team A', 'Team B', 'Team C', 'Team D', 'Team E', 'Team F', 'Team G', 'Team H'], SHIFTS = ['morning', 'afternoon', 'night'];
  const GAMES = { Roulette: '🎡', Blackjack: '🃏', Baccarat: '🎴', Poker: '♠️', 'Dragon Tiger': '🐉' };
  const emps = [];
  for (let i = 0; i < 1000; i++) {
    const p = person(), ps = posPick(), team = TEAMS[i % 8], sh = SHIFTS[i % 3], wid = 'E' + (10001 + i), start = d(-(20 + R(1400)));
    const st = i >= 985 ? (chance(.5) ? 'Terminated' : 'Retired') : i >= 940 ? 'Probation' : 'Employed';
    const gs = ps[1] === 'shuf' ? [] : Object.keys(GAMES).sort(() => rnd() - .5).slice(0, ps[1] === 'beg' ? 1 : 2 + R(3));
    emps.push({ id: 'emp' + i, fullName: p.n, nickname: p.f, workId: wid, code: wid, status: st, gender: p.g, pos: ps, team, sh,
      ext: { employeeId: wid, position: ps[0], phone: '+995 5' + (50 + R(49)) + ' ' + p2(R(100)) + ' ' + p2(R(100)) + ' ' + p2(R(100)), email: slug(p.n) + '@example.com', startDate: st === 'Probation' ? d(-(5 + R(60))) : start, team, shift: sh[0].toUpperCase() + sh.slice(1), games: gs.join(', '), manager: SL[i % 5].name, badge: 'B-' + (5000 + i) } });
  }
  const active = emps.filter(e => e.status === 'Employed' || e.status === 'Probation'), floor = active.filter(e => e.pos[1] !== 'pit');
  const employeeDataSource = emps.map(e => { const o = Object.assign({}, e); delete o.pos; delete o.team; delete o.sh; delete o.gender; return o; });

  /* ---------- schedule, rotation, pay ---------- */
  const sched = {}, codes = { morning: 'M', afternoon: 'A', night: 'N' };
  [PYM, YM, NYM].forEach((ym, mi) => { sched[ym] = {}; const n = dim(ym);
    active.forEach((e, i) => { const r = { d: {} }, ph = i % 6; for (let k = 1; k <= n; k++) { const cy = (k + ph) % 6; r.d[k] = cy < 4 ? codes[e.sh] : 'OFF'; }
      if (chance(.06)) { const s = 2 + R(n - 6); for (let k = s; k < s + 4; k++) r.d[k] = 'VAC'; } if (chance(.04)) { const s = 1 + R(n - 2); r.d[s] = 'SICK'; r.d[s + 1] = 'SICK'; }
      sched[ym][e.fullName.toLowerCase()] = r; }); });
  const days = {}; [-1, 0, 1].forEach(off => { const ds = d(off), mk = (sh, st) => { const people = active.filter(e => e.sh === sh && e.pos[1] !== 'pit' && e.pos[1] !== 'shuf').slice(0, 300).filter((e, i) => { const r = sched[ds.slice(0, 7)][e.fullName.toLowerCase()]; return r && r.d[+ds.slice(8)] === codes[sh]; }).slice(0, 40);
      const cells = people.map(() => []); for (let c = 0; c < 16; c++) { let k = 0; people.forEach((e, j) => { if ((c + j) % 5 === 4) cells[j].push('B'); else cells[j].push(String(1 + (k++ + Math.floor(c / 4) * 3) % 32)); }); }
      return { start: st, rows: people.map((e, j) => ({ name: e.fullName, t: '', cells: cells[j] })) }; };
    days[ds] = { shifts: { morning: mk('morning', 8), afternoon: mk('afternoon', 16), night: mk('night', 0) } }; });
  const hrs = {}; hrs[YM] = {}; active.slice(0, 40).forEach((e, i) => { if (i % 7 === 0) hrs[YM][e.fullName.toLowerCase()] = { [1 + R(Math.max(1, new Date().getDate() - 1))]: 4 + R(3) }; });
  const totSchedule = { roster: { anchor: YM + '-01', people: active.map((e, i) => ({ name: e.fullName, g: i % 2 ? 'B' : 'A', sh: e.sh, t: e.team, pos: e.pos[1], wid: e.workId })) },
    sched, days, hrs, cfg: { len: 8, tables: 32, auto: false },
    pay: { unit: 'hour', day: 0, night: 0, hol: 2, mult: {}, raises: [], bonus: [], vacPct: 100, pos: POS.map(p => ({ id: p[1], name: p[0], day: { vip: 14, prem: 12, gp: 10, beg: 8, shuf: 8, pit: 16 }[p[1]], night: { vip: 17, prem: 15, gp: 13, beg: 10, shuf: 10, pit: 19 }[p[1]] })) } };

  /* ---------- evaluations ---------- */
  const CRIT = { Roulette: ['Greeting the table', 'Ball spin', 'Closing bets on time', 'Payout accuracy', 'Chip handling', 'Announcing the result', 'Camera position', 'Customer interaction'],
    Blackjack: ['Greeting the table', 'Card handling', 'Dealing procedure', 'Payout accuracy', 'Game protection', 'Decision offering', 'Camera position', 'Customer interaction'],
    Baccarat: ['Greeting the table', 'Card squeeze', 'Dealing procedure', 'Payout accuracy', 'Game protection', 'Commenting', 'Camera position', 'Customer interaction'],
    Poker: ['Greeting the table', 'Card handling', 'Pot calculation', 'Game protection', 'Commenting', 'Customer interaction'],
    'Dragon Tiger': ['Greeting the table', 'Card handling', 'Dealing procedure', 'Payout accuracy', 'Commenting', 'Customer interaction'] };
  const NOTES = ['Paid the wrong amount once; count the chips twice', 'Closed the bets late', 'Card exposed during the deal', 'Forgot to announce the result', 'Hand blocked the camera', 'Keep the pace steady', 'Smile and look at the camera more'];
  const evalResults = []; let evn = 0;
  floor.filter(e => e.pos[1] !== 'shuf').forEach((e, i) => { if (i % 3) return; const nE = 1 + R(3), weak = chance(.12);
    for (let k = 0; k < nE; k++) { const g = P(e.ext.games.split(', ').filter(Boolean)) || 'Blackjack', cr = CRIT[g], ts = NOW - (2 + R(80)) * DAY + R(8) * 36e5, sc = {}, notes = {}; let got = 0;
      cr.forEach((c, ci) => { const ok = weak ? chance(.65) : chance(.9); sc['c' + ci] = ok ? 1 : 0; if (ok) got++; else if (chance(.6)) notes['c' + ci] = P(NOTES); });
      const t = new Date(ts), sup = P(PC.concat(SL));
      evalResults.push({ id: Math.floor(ts) + (evn++), uid: 'ev' + evn, name: e.fullName, workId: e.workId, typeId: slug(g).replace(/\./g, ''), typeLabel: g, typeIcon: GAMES[g], criteria: cr.map((c, ci) => ({ id: 'c' + ci, name: c, hint: '', group: 'Main' })), scores: sc, notes,
        supervisor: sup.name, total: Math.round(got / cr.length * 100), hasZero: got < cr.length, date: t.toLocaleDateString('en-GB'), time: p2(t.getHours()) + ':' + p2(t.getMinutes()), ts, mode: 'grid', scoringVersion: 1, isoDate: iso(ts), kind: P(['regular', 'regular', 'regular', 'closeup', 'exam']) }); } });
  const evalShare = {}; evalResults.forEach(r => { if (chance(.6)) evalShare[r.uid] = { on: true, wid: r.workId, email: (emps.find(e => e.workId === r.workId) || { ext: {} }).ext.email, fb: r.total === 100 ? 'Perfect round, well done.' : 'Good work. Focus on: ' + r.criteria.filter(c => !r.scores[c.id]).map(c => c.name).slice(0, 2).join(', ') + '.' }; });

  /* ---------- retraining (red trainings) ---------- */
  const low = evalResults.filter(r => r.total < 75), totRetrain = { v: 1, sessions: [] };
  [PYM, YM].forEach((ym, si) => { const rows = low.filter(r => r.isoDate.slice(0, 7) <= ym).slice(si * 25, si * 25 + 25).map((r, j) => ({ id: uid('rt'), date: ym === YM ? d(-3 + (j % 10)) : ym + '-' + p2(5 + j % 20), time: P(['10:00', '14:00', '16:00']), name: r.name, wid: r.workId, signedBy: P(PC).name, reason: r.typeLabel + ' — ' + r.criteria.filter(c => !r.scores[c.id]).map(c => c.name).slice(0, 2).join(', ') + ' (' + r.total + '%)', attend: ym === PYM ? P(['yes', 'yes', 'yes', 'no']) : (j % 3 === 0 ? 'yes' : ''), violation: chance(.1) ? 'yes' : 'no', trainer: P(TC).name, comment: '' }));
    totRetrain.sessions.push({ id: uid('rs'), month: ym, title: 'Retraining ' + ym, created: NOW - (si ? 3 : 33) * DAY, rows }); });
  const coachingActions = low.slice(0, 60).map((r, i) => ({ id: uid('a'), name: r.name, text: 'Follow-up on ' + r.typeLabel + ': ' + (r.criteria.filter(c => !r.scores[c.id]).map(c => c.name)[0] || 'procedure'), due: d(-5 + R(20)), done: i % 3 === 0, ts: r.ts + DAY }));
  const traineeNotes = low.slice(0, 40).map(r => ({ id: uid('n'), name: r.name, text: P(['Needs more practice on payouts', 'Confident at the table, nervous on camera', 'Retake planned next week', 'Improved a lot since the last check']), author: P(TC.concat(PC)).name, ts: r.ts + 2 * DAY }));

  /* ---------- onboarding groups (trainees) ---------- */
  const trainers = TC.map(t => ({ id: uid('trainer_'), name: t.name, email: t.email, archived: false, onboardings: [] }));
  const newHires = [];
  trainers.forEach((tr, ti) => { [['GP', -35, 'completed'], ['SH', -14, 'completed'], [ti % 2 ? 'SH' : 'GP', -2, 'active']].forEach(([track, off, status], oi) => { if (oi === 1 && ti > 2) return;
    const start = d(off), ws = { startDate: start, startTime: '09:00', days: 5, cfg: defCfg(track), todoDone: {}, widths: {}, trainees: [] };
    for (let k = 0; k < 8 + R(8); k++) { const p = person(), wid = 'N' + (20001 + newHires.length), fin = status === 'completed' ? (chance(.82) ? 'Finished Training' : P(['Drop Out', 'Absent', 'Terminated'])) : (chance(.2) ? 'Last shift in training' : '');
      const vals = {}; for (let h = 0; h < 5; h++) vals['h' + h] = status === 'active' && h > 2 ? '' : String(chance(.92) ? 8 : 4);
      ws.cfg.tests.forEach(t => { if (!t.text && (status === 'completed' || chance(.5))) vals[t.id] = String(55 + R(46)); });
      ws.cfg.cats.forEach(c => c.items.forEach(it => { if (status === 'completed' || chance(.4)) vals[it.id] = String(Math.max(0, it.max - R(2))); }));
      const t = { vals, x: {}, firstName: p.f, lastName: p.l, nickname: p.f, employeeId: wid, personalId: String(10000000000 + R(9e9)), gender: p.g, phone: '+995 5' + (50 + R(49)) + ' ' + p2(R(100)) + ' ' + p2(R(100)) + ' ' + p2(R(100)), email: slug(p.n) + '@example.com',
        position: track === 'GP' ? 'Game Presenter' : 'Shuffler', empStage: 'Beginner', language: P(['English', 'English', 'Russian', 'Turkish']), employment: P(['Full time', 'Part time']), games: track === 'GP' ? 'Black Jack' : '', trainerEmail: tr.email, startDate: start,
        managerEmail: P(SL).email, shiftType: P(['Day', 'Night', 'Rotating']), experience: chance(.3) ? 'Yes' : 'No', team: P(TEAMS), source: P(['LinkedIn', 'Referral', 'Job site', 'Walk-in']), status: fin };
      if (fin === 'Finished Training') t.finOn = d(off + 5); t.contract = 'Yes'; t.survey = chance(.7) ? 'Yes' : 'No'; ws.trainees.push(t); newHires.push(t); }
    tr.onboardings.push({ id: uid('onboarding_'), name: (track === 'GP' ? 'Game Presenters' : 'Shufflers') + ' ' + start, track, status, created: NOW + off * DAY - 5 * DAY, updated: NOW + Math.min(0, off + 5) * DAY, ws }); }); });
  const totOnboardingHier = { v: 1, trainers };

  /* ---------- workshop registers + onboarding files ---------- */
  const wsNodes = {}, mkNode = (o) => { const id = uid('f'); wsNodes[id] = Object.assign({ id, c: NOW, u: NOW }, o); return id; };
  [PYM, YM].forEach((ym, mi) => { const fid = mkNode({ p: null, t: 'folder', name: ym + ' workshops' });
    [['Workshop - 3 days', 3, 'Roulette'], ['Workshop - 2 days', 2, 'Blackjack'], ['Workshop - 1 day', 1, 'Baccarat']].forEach(([tpl, nd, g], wi) => { const date = mi ? d(-10 + wi * 6) : ym + '-' + p2(6 + wi * 7), tr = P(TC).name;
      const rows = [['Employee name', 'Work ID', 'Signed by', 'Trainer', 'Status'].concat(Array.from({ length: nd }, (_, k) => 'Day ' + (k + 1)), ['Notes'])];
      floor.slice((mi * 3 + wi) * 18, (mi * 3 + wi) * 18 + 12 + R(8)).forEach(e => { const past = date < TODAY; rows.push([e.fullName, e.workId, P(SL).name, tr, past ? P(['Passed', 'Passed', 'Passed', 'Failed', 'Did not attend']) : ''].concat(Array.from({ length: nd }, () => past ? P(['Present', 'Present', 'Present', 'Late', 'Absent']) : ''), [''])); });
      mkNode({ p: fid, t: 'file', name: g + ' — ' + tpl + ' — ' + date, c: NOW - 20 * DAY, u: NOW - 2 * DAY, reg: { v: 2, tpl, days: nd, extra: '', date, trainer: tr, group: 'G' + (mi * 3 + wi + 1) }, wb: { sheets: [{ name: 'Register', rows }] } }); }); });
  const totWorkshopFiles = { v: 1, nodes: wsNodes };
  const obNodes = {}; (function () { const id1 = uid('f'); obNodes[id1] = { id: id1, p: null, t: 'folder', name: 'Onboarding documents', c: NOW, u: NOW }; const id2 = uid('f');
    obNodes[id2] = { id: id2, p: id1, t: 'file', name: 'New hire contacts ' + YM, c: NOW, u: NOW, wb: { sheets: [{ name: 'Sheet 1', rows: [['Name', 'Employee ID', 'Phone', 'Trainer', 'Start date']].concat(newHires.slice(-25).map(t => [t.firstName + ' ' + t.lastName, t.employeeId, t.phone, (trainers.find(x => x.email === t.trainerEmail) || {}).name || '', t.startDate])) }] } };
    const id3 = uid('f'); obNodes[id3] = { id: id3, p: id1, t: 'file', name: 'Uniform sizes', c: NOW, u: NOW, wb: { sheets: [{ name: 'Sheet 1', rows: [['Name', 'Size', 'Shoes']].concat(newHires.slice(-15).map(t => [t.firstName + ' ' + t.lastName, P(['S', 'M', 'L', 'XL']), String(36 + R(10))])) }] } }; })();
  const totOnboardingFiles = { v: 1, nodes: obNodes };

  /* ---------- tickets, cases, announcements, comments ---------- */
  const DEPTS = ['academy', 'performance', 'fmd', 'appearance', 'hr', 'access', 'it', 'service'], ROLE_OF = { academy: TC, performance: PC.concat(SL), fmd: SC, hr: HR, service: SM, appearance: [], access: [], it: [] };
  const TT = { academy: ['Prepare training room for Monday group', 'ID cards for the new group', 'Logbooks to sign for ', 'Workshop slot for '], performance: ['Re-evaluation: ', 'Live exam for ', 'Coaching session with ', 'Check camera position — '], fmd: ['Schedule first shifts for ', 'Swap request check — ', 'Night shift cover needed', 'Add to rotation: '],
    appearance: ['Collect the uniform from ', 'New uniform sizes for the group', 'Damaged vest replacement — '], hr: ['Contract for ', 'Probation review: ', 'Exit interview with '], access: ['Fingerprint access for ', 'Remove building access — '], it: ['Laptop for ', 'Reset back-office account — ', 'Headset broken at table '], service: ['Incident follow-up: ', 'Jira import check', 'Weekly incident report'] };
  const STS = ['todo', 'todo', 'doing', 'doing', 'waiting', 'done', 'done', 'done'];
  const totTasks = []; let tkn = 0;
  const mkTask = (o) => { tkn++; const id = 'tk' + tkn, created = o.created || NOW - R(40) * DAY - R(20) * 36e5, from = o.from || P(MG.concat(SL, TC, HR)), to = o.toPerson;
    const t = Object.assign({ id, num: 'TK-' + (1000 + tkn), title: '', details: '', toRole: 'fmd', toEmail: to ? to.email : '', toName: to ? to.name : '', fromName: from.name, fromEmail: from.email, fromRole: from.role, pri: P(['normal', 'normal', 'normal', 'high', 'urgent', 'low']), due: d(-5 + R(25)), status: 'todo', created, u: created, hist: [{ ts: created, who: from.name, act: 'created' }], rel: '', empId: '', caseId: '', caseTitle: '' }, o);
    delete t.toPerson; delete t.from; if (t.status !== 'todo') t.hist.push({ ts: created + 36e5 * (2 + R(30)), who: (to || from).name, act: 'status → ' + t.status }); totTasks.push(t); return t; };
  for (let i = 0; i < 140; i++) { const dep = P(DEPTS), e = P(active), tt = P(TT[dep]), assignee = (ROLE_OF[dep] || []).length && chance(.7) ? P(ROLE_OF[dep]) : null;
    mkTask({ title: /[ —:]$/.test(tt) || / for $| with $| from $/.test(tt) ? tt + e.fullName : tt, details: 'Work ID ' + e.workId + ', ' + e.ext.position + ', ' + e.team + '.', toRole: dep, toPerson: assignee, status: P(STS), rel: e.fullName, empId: e.workId,
      reason: undefined }); }
  totTasks.filter(t => t.status === 'waiting').forEach(t => { t.reason = { status: 'waiting', text: 'Waiting for the employee to confirm the date', by: t.toName || 'Team', ts: t.u }; });
  totTasks.slice(0, 6).forEach(t => { t.esc = { on: true, by: t.fromName, email: t.fromEmail, ts: NOW - 2 * DAY, reason: 'Still open after the due date' }; });
  const totCases = [], TSTEPS = [['hr', 'Process the termination'], ['appearance', 'Collect the uniform and confirm it was returned'], ['access', 'Remove building / fingerprint access'], ['fmd', 'Remove from future schedules'], ['it', 'Remove or disable system access']];
  emps.filter(e => e.status === 'Terminated').slice(0, 6).forEach((e, ci) => { const by = P(HR), id = 'case' + ci, created = NOW - (3 + ci * 6) * DAY;
    totCases.push({ id, kind: 'termination', title: 'Termination: ' + e.fullName, empName: e.fullName, empId: e.workId, lastDay: iso(created + 7 * DAY), note: 'Resigned (personal reasons).', by: by.name, byEmail: by.email, created, u: created });
    TSTEPS.forEach(([dep, tt], si) => mkTask({ title: 'Termination: ' + e.fullName + ' — ' + tt, toRole: dep, from: by, status: ci > 2 ? 'done' : P(['todo', 'doing', 'done']), created, caseId: id, caseTitle: 'Termination: ' + e.fullName, rel: e.fullName, empId: e.workId, ref: 'case:' + id, due: iso(created + (si ? 3 : 1) * DAY) })); });
  const totAnnouncements = [['New studio floor opens next month', 'Training for the second floor starts on Monday. Check your schedule.', [], true, true], ['Uniform check this week', 'Bring your full uniform on your next shift for the yearly check.', ['appearance', 'performance'], false, false], ['HR: updated vacation policy', 'The new policy is in Documents → HR.', [], true, false], ['Service: incident reporting', 'Every procedural mistake goes to Jira within the shift.', ['service', 'performance'], false, false], ['Academy: trainer meeting Friday 15:00', 'All trainers, room 2.', ['academy'], false, false], ['Payday moved', 'Salaries are paid on the 5th this month.', [], false, true]]
    .map((x, i) => { const f = P(MG); return { id: 'an' + i, title: x[0], body: x[1], toRoles: x[2], important: x[3], pinned: x[4], expires: '', fromName: f.name, fromEmail: f.email, fromRole: 'manager', created: NOW - (i * 3 + 1) * DAY, u: NOW - (i * 3 + 1) * DAY }; });
  const allStaff = [].concat(...Object.values(staff)), totComments = [];
  totTasks.slice(0, 90).forEach((t, i) => { if (i % 2) return; const w = P(allStaff); totComments.push({ id: 'cm' + i, kind: 'task', ref: t.id, who: w.name, email: w.email, role: w.role, ts: t.created + 5 * 36e5, text: P(['On it, will update by tomorrow.', 'Done from our side.', 'Can we move the date?', 'Employee confirmed.', 'Waiting for the documents.']) }); });
  totAnnouncements.forEach((a, i) => allStaff.slice(i * 3, i * 3 + 4).forEach((w, j) => totComments.push({ id: 'ca' + i + '_' + j, kind: a.important ? 'ack' : 'ann', ref: a.id, who: w.name, email: w.email, role: w.role, ts: a.created + 36e5 * (j + 1), text: a.important ? '' : 'Thanks!' })));

  /* ---------- service incidents ---------- */
  const IT = ['Procedural mistake', 'Wrong result / payout', 'Card / ball handling', 'Game resumed', 'Behaviour', 'Late bet closing'];
  const totIncidents = []; for (let i = 0; i < 180; i++) { const e = P(floor), ts = NOW - R(75) * DAY - R(24) * 36e5, g = P(e.ext.games.split(', ').filter(Boolean).concat(['Blackjack']));
    totIncidents.push({ id: 'in' + i, key: 'SM-' + (4000 + i), date: iso(ts), time: p2(new Date(ts).getHours()) + ':' + p2(R(60)), name: e.fullName, empId: e.workId, nick: e.nickname, m: 1, game: g, table: g.slice(0, 2).toUpperCase() + ' ' + (1 + R(12)), shift: e.sh[0].toUpperCase() + e.sh.slice(1), type: P(IT), severity: P(['Low', 'Low', 'Medium', 'Medium', 'High', 'Critical']), summary: P(['Burned two cards', 'Paid the wrong number', 'Ball dropped out of the wheel', 'Wrong shoe used', 'Late close of bets', 'Card exposed', 'Dealt to the wrong box']), description: '', action: P(['Game resumed with the internal tool', 'Round voided', 'Payout corrected', 'Coaching booked']), status: P(['Done', 'Done', 'Open', 'In Progress']), reporter: P(SM).name, src: chance(.8) ? 'jira' : 'manual', ts, u: ts }); }
  const totIncImports = [{ id: 'ii1', ts: NOW - 7 * DAY, u: NOW - 7 * DAY, by: SM[0].name, file: 'jira-export-week-' + (40) + '.csv', rows: 92, added: 88, updated: 2, same: 0, errors: 2, unmatched: 0, ids: [], prev: [] }, { id: 'ii2', ts: NOW - DAY, u: NOW - DAY, by: SM[1].name, file: 'jira-export-week-41.csv', rows: 60, added: 56, updated: 4, same: 0, errors: 0, unmatched: 0, ids: [], prev: [] }];

  /* ---------- remarks, bonuses, requests, game counts ---------- */
  const RM = [['positive', 'Thank you from a VIP player', 'A player praised the friendly game in the chat.'], ['positive', 'Helped a trainee', 'Showed the new group the table routine.'], ['remark', 'Late 10 minutes', 'Be at the table 5 minutes before the shift.'], ['remark', 'Uniform', 'Name badge missing.'], ['violation', 'Phone on the floor', 'Phones stay in the locker.'], ['disciplinary', 'Written warning', 'Second late arrival this month.']];
  const totRemarks = []; for (let i = 0; i < 90; i++) { const e = P(active), x = P(RM), by = P(SL.concat(MG)); totRemarks.push({ id: 'r' + i, key: e.fullName.toLowerCase(), name: e.fullName, workId: e.workId, date: d(-R(60)), kind: x[0], title: x[1], text: x[2], share: x[0] !== 'disciplinary' || chance(.5), by: by.name, ts: NOW - R(60) * DAY, u: NOW }); }
  const progs = [{ id: 'bp1', name: 'VIP quality bonus', type: 'Performance', pos: ['vip'], levels: [[50, 'Average evaluation 80%+'], [100, '85%+'], [150, '90%+ and no incidents'], [200, '95%+'], [300, '100% all month']] }, { id: 'bp2', name: 'Premium quality bonus', type: 'Performance', pos: ['prem'], levels: [[40, '80%+'], [80, '90%+'], [120, '95%+']] }, { id: 'bp3', name: 'Game presenter bonus', type: 'Performance', pos: ['gp', 'beg'], levels: [[30, '85%+'], [60, '95%+']] }, { id: 'bp4', name: 'Shuffler attendance', type: 'Attendance', pos: ['shuf'], levels: [[30, 'No late arrivals'], [60, 'No late arrivals and no sick days']] }]
    .map(p => ({ id: p.id, name: p.name, type: p.type, pos: p.pos, levels: p.levels.map(l => ({ amount: l[0], rule: l[1] })), on: true }));
  const totBonusCfg = { programs: progs }, totBonusReviews = [];
  floor.slice(0, 120).forEach((e, i) => { const pr = progs.find(p => p.pos.includes(e.pos[1])); if (!pr) return; const key = e.fullName.toLowerCase().replace(/\s+/g, ' '), by = SL[i % 5].name;
    totBonusReviews.push({ id: PYM + '|' + key, ym: PYM, key, name: e.fullName, workId: e.workId, levels: { [pr.id]: 1 + R(pr.levels.length) }, note: '', status: 'final', created: NOW - 20 * DAY, by, at: NOW - 6 * DAY, u: NOW - 6 * DAY, finalAt: NOW - 6 * DAY, finalBy: by });
    if (i % 3 === 0) totBonusReviews.push({ id: YM + '|' + key, ym: YM, key, name: e.fullName, workId: e.workId, levels: { [pr.id]: 1 + R(pr.levels.length) }, note: 'Draft', status: 'draft', created: NOW - DAY, by, at: NOW - DAY, u: NOW - DAY }); });
  const RQ = [['swap', 'Swap with a colleague, family event'], ['giveaway', 'Doctor appointment'], ['annual', 'Annual leave, travelling'], ['sick', 'Flu'], ['dayoff', 'Moving house'], ['payq', 'Overtime on the 12th is missing']];
  const totEmpRequests = []; for (let i = 0; i < 45; i++) { const e = P(active), x = P(RQ), f = d(x[0] === 'sick' ? -R(3) : 2 + R(25)); totEmpRequests.push({ id: 'rq' + i, workId: e.workId, name: e.fullName, email: e.ext.email, type: x[0], from: f, to: x[0] === 'annual' ? iso(Date.parse(f) + 4 * DAY) : f, with: x[0] === 'swap' ? P(active).fullName : '', shift: x[0] === 'swap' || x[0] === 'giveaway' ? e.sh : '', note: x[1], status: P(['pending', 'pending', 'approved', 'declined']), created: NOW - R(10) * DAY, u: NOW, src: 'employee', hist: [] }); }
  const totGameCounts = []; floor.filter((e, i) => e.ext.games && i % 2 === 0).forEach((e, i) => { const g = e.ext.games.split(', ')[0]; [PYM, YM].forEach(ym => totGameCounts.push({ id: 'gc' + i + ym, k: e.workId.toLowerCase() + '|' + g.toLowerCase() + '|' + ym, empId: e.workId, name: e.fullName, game: g, period: ym, count: (ym === YM ? 150 : 600) + R(ym === YM ? 500 : 900), src: 'Grafana CSV', batch: 'b' + ym, ts: NOW, u: NOW })); });
  const totImportHistory = [PYM, YM].map(ym => ({ id: 'b' + ym, ts: NOW - (ym === YM ? 1 : 8) * DAY, u: NOW, by: SC[0].name, source: 'Grafana CSV', file: 'game-counts-' + ym + '.csv', rows: floor.length, added: floor.length, replaced: 0, dupStored: 0, dupFile: 0, unmatched: 0, errors: 0, ids: [], prev: [], undone: false }));

  /* ---------- uniforms ---------- */
  const UT = [['Dealer vest', 'Team A'], ['Dealer vest', 'Team B'], ['Shirt', 'Team C'], ['Shirt', 'Team D'], ['Jacket', 'Team E']], uniforms = [], txs = [];
  for (let i = 0; i < 320; i++) { const t = P(UT), e = i < 210 ? floor[i] : null, st = e ? 'Issued' : P(['Available', 'Available', 'Available', 'Damaged', 'Lost', 'Maintenance']), at = new Date(NOW - R(200) * DAY).toISOString();
    uniforms.push({ id: 'U-' + String(1 + i).padStart(4, '0'), team: t[1], type: t[0], size: P(['XS', 'S', 'M', 'M', 'L', 'XL']), status: st, location: e ? 'Employee' : 'Appearance', pin: String(1000 + R(9000)), qr: String(1000 + R(9000)), employee: e ? e.fullName : '', employeeId: e ? e.workId : '', issuedAt: e ? at : '', returnedAt: '', notes: st === 'Damaged' ? 'Torn sleeve' : '' });
    if (e) txs.push({ id: 'tx' + i, ts: Date.parse(at), action: 'Issued', uniformId: uniforms[i].id, team: t[1], type: t[0], size: uniforms[i].size, employee: e.fullName, employeeId: e.workId, reason: P(['Other', 'Team changed', 'Damaged uniform']) }); }
  txs.sort((a, b) => b.ts - a.ts);
  const totAppearanceDept = { uniforms, teams: [...new Set(UT.map(x => x[1]))].map(n => ({ name: n })), types: UT.map(x => ({ name: x[0], team: x[1] })), txs, trainees: newHires.slice(-12).map((t, i) => ({ name: t.firstName + ' ' + t.lastName, workId: t.employeeId, group: 'New group', team: t.team, size: P(['S', 'M', 'L']), uniformId: '', issued: i % 3 === 0 })), audit: txs.slice(0, 40).map(x => ({ t: x.ts, who: 'Uniforms desk', action: 'issue', detail: x.uniformId + ' → ' + x.employee })), cfg: { kiosk: false } };

  /* ---------- HR: lifecycle, recruiting workbook, documents ---------- */
  const EVT = ['Hired', 'Probation started', 'Probation passed', 'Position change', 'Team / shift change', 'Leave started', 'Leave ended', 'Warning / note'];
  const totLifecycle = active.slice(0, 120).map((e, i) => ({ id: 'lc' + i, empId: e.workId, name: e.fullName, type: P(EVT), date: d(-R(200)), note: '', by: P(HR).name, ts: NOW - R(200) * DAY, u: NOW }));
  const CST = ['New', 'Contacted', 'Interview', 'Offer sent', 'Accepted', 'Started training', 'Rejected', 'Withdrawn'], cand = [];
  for (let i = 0; i < 60; i++) { const p = person(); cand.push([p.n, '+995 5' + (50 + R(49)) + ' ' + p2(R(100)) + ' ' + p2(R(100)), slug(p.n) + '.cand@example.com', P(['LinkedIn', 'Referral', 'Job site', 'Walk-in']), P(CST), d(-10 + R(30)), P(HR).name, '']); }
  const totWorkbooks = { v: 1, books: [{ id: 'wb1', name: 'Candidates ' + YM, created: NOW - 30 * DAY, updated: NOW, versions: [], audit: [], sheets: [{ name: 'Sheet 1', cols: [['Candidate', 'text'], ['Phone', 'text'], ['Email', 'text'], ['Source', 'text'], ['Status', 'status'], ['Interview date', 'date'], ['Owner', 'text'], ['Notes', 'text']].map(c => ({ n: c[0], t: c[1], opts: c[1] === 'status' ? CST : undefined })), rows: cand }] }] };
  const totDeptDocs = [['hr', 'Vacation policy 2026', 'Policy'], ['hr', 'Employment contract template', 'Form / template'], ['academy', 'Trainer handbook', 'Guide / SOP'], ['academy', 'Blackjack dealing standard', 'Guide / SOP'], ['performance', 'Evaluation criteria explained', 'Guide / SOP'], ['fmd', 'Shift swap rules', 'Policy'], ['appearance', 'Uniform care guide', 'Guide / SOP'], ['service', 'Incident reporting SOP', 'Guide / SOP'], ['it', 'Account request form', 'Form / template'], ['access', 'Fingerprint enrolment steps', 'Guide / SOP']]
    .map((x, i) => ({ id: 'dc' + i, dept: x[0], by: P(MG).name, ts: NOW - i * 5 * DAY, title: x[1], url: 'https://example.com/docs/' + slug(x[1]), cat: x[2], vis: i % 3 ? 'all' : 'dept', owner: P(MG).name, review: d(30 + i * 10), note: '', u: NOW }));

  /* ---------- projects and teams ---------- */
  const totTeams = [{ id: 'tmA', name: 'Floor coaches', dept: 'performance', lead: PC[0].email, members: PC.map(x => x.email).concat(SL.slice(0, 2).map(x => x.email)), desc: 'Evaluations and coaching on the floor' }, { id: 'tmB', name: 'Trainers', dept: 'academy', lead: TC[0].email, members: TC.map(x => x.email), desc: 'All onboarding trainers' }, { id: 'tmC', name: 'Launch task force', dept: '', lead: MG[0].email, members: [MG[0].email, SC[0].email, HR[0].email, TC[1].email, SM[0].email], desc: 'Second studio floor' }];
  const h = (w, a, ago) => ({ ts: NOW - (ago || 0) * 36e5, who: w.name, email: w.email, act: a });
  const totProjects = [{ id: 'pj1', title: 'Second studio floor launch', desc: 'Open 12 new tables by next month: hiring, training, schedules, uniforms, access.', status: 'active', priority: 'high', color: '#3b82f6', ownerEmail: MG[0].email, ownerName: MG[0].name, byEmail: MG[0].email, visibility: 'members', start: d(-20), due: d(35), assignees: { depts: ['performance', 'hr', 'fmd', 'academy'], teams: ['tmC'], people: [] }, editors: { depts: [], people: [MG[1].email] }, viewers: { depts: ['it'], people: [] }, tags: ['2026', 'studio'], fields: { Budget: '48000', Tables: '12' }, stages: [{ name: 'Idea' }, { name: 'Planning' }, { name: 'Build' }, { name: 'Go-live check', gate: true }, { name: 'Live' }], stage: 2, gateApprovers: { people: [MG[0].email, MG[1].email] }, hist: [h(MG[0], 'created the project', 500)] },
    { id: 'pj2', parent: 'pj1', title: 'Hire 40 game presenters', status: 'active', ownerEmail: HR[0].email, ownerName: HR[0].name, byEmail: HR[0].email, visibility: 'inherit', start: d(-18), due: d(10), assignees: { depts: ['hr'] }, hist: [h(HR[0], 'created the sub-project', 400)] },
    { id: 'pj3', parent: 'pj1', title: 'Train the new groups', status: 'help', ownerEmail: TC[0].email, ownerName: TC[0].name, byEmail: TC[0].email, visibility: 'inherit', start: d(-2), due: d(28), assignees: { teams: ['tmB'] }, hist: [h(TC[0], 'created the sub-project', 300)] },
    { id: 'pj4', title: 'Reduce procedural mistakes by 20%', status: 'active', ownerEmail: SM[0].email, ownerName: SM[0].name, byEmail: SM[0].email, visibility: 'org', start: d(-30), due: d(60), assignees: { depts: ['service', 'performance'] }, hist: [h(SM[0], 'created the project', 700)] },
    { id: 'pj5', title: 'Uniform renewal 2026', status: 'planned', ownerEmail: MG[2].email, ownerName: MG[2].name, byEmail: MG[2].email, visibility: 'members', start: d(10), due: d(70), assignees: { depts: ['appearance'] }, hist: [h(MG[2], 'created the project', 100)] }];
  const pit = (o) => Object.assign({ kind: 'task', status: 'todo', created: NOW - 5 * DAY, hist: [] }, o);
  const totProjItems = [pit({ id: 'pi1', pid: 'pj1', kind: 'milestone', title: 'Floor opens', due: d(35), start: d(35) }), pit({ id: 'pi2', pid: 'pj1', title: 'Table layout and camera specs', status: 'waiting', waitingFor: 'specs from Studio Tech', waitSince: NOW - 6 * DAY, start: d(-8), due: d(-1), assigneeEmail: MG[1].email, assigneeName: MG[1].name }),
    pit({ id: 'pi3', pid: 'pj2', title: 'Interviews (80 candidates)', status: 'doing', start: d(-10), due: d(6), assigneeEmail: HR[0].email, assigneeName: HR[0].name }), pit({ id: 'pi4', pid: 'pj2', title: 'Contracts signed', status: 'blocked', blocker: 'salary bands not approved', deps: ['pi3'], start: d(6), due: d(10), assigneeEmail: HR[1].email, assigneeName: HR[1].name }),
    pit({ id: 'pi5', pid: 'pj3', title: 'Trainers for group B', status: 'help', help: 'need 2 more trainers for 2 weeks', start: d(-1), due: d(7), assigneeEmail: TC[0].email, assigneeName: TC[0].name }), pit({ id: 'pi6', pid: 'pj3', parentItem: 'pi5', title: 'Trainers for group B — ' + TC[1].name, status: 'doing', assigneeEmail: TC[1].email, assigneeName: TC[1].name, due: d(5) }),
    pit({ id: 'pi7', pid: 'pj4', title: 'Weekly incident review', status: 'doing', assigneeEmail: SM[1].email, assigneeName: SM[1].name, due: d(4) }), pit({ id: 'pi8', pid: 'pj4', title: 'Retraining for the top 20 presenters with mistakes', status: 'todo', assigneeEmail: PC[0].email, assigneeName: PC[0].name, due: d(14) }),
    { id: 'pa1', pid: 'pj1', kind: 'approval', ref: 'stage:3', title: 'Enter the stage “Go-live check”', approvers: [MG[0].email, MG[1].email], rule: 'all', decisions: { [MG[1].email]: { d: 'approved', note: 'OK from my side', who: MG[1].name, ts: NOW - 36e5 } }, status: 'pending', by: MG[0].name, byEmail: MG[0].email, created: NOW - 5 * 36e5, hist: [] }];

  /* ---------- audit log ---------- */
  const auditLog = totTasks.slice(0, 60).map((t, i) => ({ id: 'au' + i, ts: t.created, who: t.fromName, email: t.fromEmail, role: t.fromRole, cat: 'tasks', act: 'Task "' + t.title + '" created' }));

  return { employeeDataSource, totAccessPolicy: policy, totSchedule, evalResults, evalShare, totRetrain, coachingActions, traineeNotes, totOnboardingHier, totWorkshopFiles, totOnboardingFiles, totTasks, totCases, totAnnouncements, totComments,
    totIncidents, totIncImports, totRemarks, totBonusCfg, totBonusReviews, totEmpRequests, totGameCounts, totImportHistory, totAppearanceDept, totLifecycle, totWorkbooks, totDeptDocs, totTeams, totProjects, totProjItems, auditLog,
    _info: { employees: emps.length, staff: Object.fromEntries(STAFF.map(s => [s[0], s[1]])), staffList: allStaff.map(s => s.role + ': ' + s.name + ' <' + s.email + '>'), evaluations: evalResults.length, tickets: totTasks.length, onboardings: trainers.reduce((n, t) => n + t.onboardings.length, 0), trainees: newHires.length } };
};
