/* v3.41 "I am sick / late / leaving early": the employee reports it on their page, the schedule people get it on the bell and in the cover panel, and one click plans the cover. */
const path = require('path'), fs = require('fs');
const gas = require('./fakegas')(path.join(__dirname, '..', 'tool', 'Code.gs'));
let fails = 0; function ok(n, c, x) { if (!c) fails++; console.log((c ? '  ✅ ' : '  ❌ ') + n + (c ? '' : '  → ' + x)); }
const { chromium } = require(require('child_process').execSync('npm root -g').toString().trim() + '/playwright');
const URL = 'https://script.google.com/macros/s/TEST/exec', tmp = path.join(require('os').tmpdir(), 'report-page-test.html'), now = Date.now(), P = (o) => ({ v: JSON.stringify(o), t: now - 500 });
const iso = (d) => { const x = new Date(Date.now() + d * 864e5); return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0'); };
(async () => {
  fs.writeFileSync(tmp, fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8').replace(/var SERVER_URL = '[^']*'/, "var SERVER_URL = '" + URL + "'").replace('<script src="https://accounts.google.com/gsi/client" async defer></script>', ''));
  const today = iso(0), br = await chromium.launch(), perr = [];
  const emp = (n, mail) => ({ id: 'e' + mail, fullName: n, nickname: '', workId: 'W' + mail, status: 'Employed', email: mail, ext: { email: mail, position: 'Game presenter' } });
  gas.setData({ updatedAt: now, keys: { totAccessPolicy: P({ users: { 'sc@x.com': { role: 'scheduling_coordinator', name: 'Sc', sites: ['main'] }, 'lead@x.com': { role: 'shift_lead', name: 'Lead', sites: ['main'] }, 'trn@x.com': { role: 'training_coordinator', name: 'Trn', sites: ['main'] } }, roles: {} }),
    employeeDataSource: P([emp('Test Person', 'tester@x.com')]), totMySchedules: P({ byEmail: { 'tester@x.com': { name: 'Test Person', team: 't1', shift: 'morning', ver: 'v1', vat: now, sx: [{ d: today, s: 'morning', f: 0, t: 24 }], rx: [] } }, sent: {} }) } });
  const open = async () => { const E = await (await br.newContext({ viewport: { width: 390, height: 844 } })).newPage(); E.on('pageerror', (e) => perr.push(e.message)); E.on('dialog', (d) => d.accept());
    await E.route(URL + '**', async (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(gas.post(r.request().postData())) }));
    await E.addInitScript(() => { window.google = { accounts: { id: { initialize: (c) => { window.__gcb = c.callback; }, renderButton: () => setTimeout(() => window.__gcb({ credential: 'gtok:tester@x.com' }), 30) } } }; }); await E.goto('file://' + tmp); await E.waitForTimeout(900); return E; };
  let E = await open(); let t = await E.evaluate(() => document.body.innerText);
  ok('an employee with a shift today sees "Something wrong today?" with three buttons', /Something wrong today\?/.test(t) && !!(await E.$('[data-rep=sick]')) && !!(await E.$('[data-rep=late]')) && !!(await E.$('[data-rep=early]')), t.slice(0, 200));
  const m0 = gas.mails.length;
  await E.click('[data-rep=sick]'); await E.fill('#repN', 'Fever since last night'); await E.click('#repGo'); await E.waitForTimeout(900); t = await E.evaluate(() => document.body.innerText);
  ok('after sending: "You reported: sick" with the time', /You reported: sick/.test(t), t.slice(0, 250));
  let reps = JSON.parse(gas.data().keys.totAbsenceReports.v); ok('one report is stored with date, shift, type and note', reps.length === 1 && reps[0].type === 'sick' && reps[0].date === today && reps[0].shift === 'morning' && /Fever/.test(reps[0].note) && reps[0].status === 'new', JSON.stringify(reps));
  const sent = gas.mails.slice(m0); ok('the scheduling coordinator and the shift lead are e-mailed (not the trainer)', sent.map((m) => m.to).sort().join() === 'lead@x.com,sc@x.com' && /is sick/.test(sent[0].body), sent.map((m) => m.to).join());
  await E.click('[data-rep=sick]').catch(() => {}); const dup = gas.post(JSON.stringify({ action: 'report', idToken: 'gtok:tester@x.com', type: 'sick', date: today, shift: 'morning' })); ok('the same report twice is refused', /already reported/.test(dup.error || ''), JSON.stringify(dup));
  const bad = gas.post(JSON.stringify({ action: 'report', idToken: 'gtok:tester@x.com', type: 'late', date: today, shift: 'morning', minutes: 999 })); ok('a silly lateness is refused', /5 to 240/.test(bad.error || ''), JSON.stringify(bad));
  const wrong = gas.post(JSON.stringify({ action: 'report', idToken: 'gtok:tester@x.com', type: 'sick', date: today, shift: 'night' })); ok('a shift that is not theirs is refused', /not a working shift/.test(wrong.error || ''), JSON.stringify(wrong));
  const old = gas.post(JSON.stringify({ action: 'report', idToken: 'gtok:tester@x.com', type: 'sick', date: iso(-3), shift: 'morning' })); ok('an old date is refused', /only for today/.test(old.error || ''), JSON.stringify(old));
  await E.context().close();
  /* the tool */
  const H = await require('./harness')(path.join(__dirname, '..', 'tool', 'PTF-pass-to-floor-Gunda.html'), gas), T = await H.open({ admin: true }); await T.setViewportSize({ width: 1500, height: 950 }); await T.sync();
  await T.evaluate((day) => { switchView('schedule'); const S = JSON.parse(localStorage.getItem('totSchedule') || '{}'); S.teams = [{ id: 't1', name: 'Team 1' }];
    S.roster = { anchor: day, people: ['Test Person', 'W2', 'W3', 'W4', 'W5', 'W6'].map((n) => ({ name: n, g: 'A', sh: 'morning', t: 't1' })) }; S.cfg = { len: 8, maxrun: 4, tables: 100, tt: { t1: [1, 4] } }; S.days = {}; S.sched = {}; localStorage.setItem('totSchedule', JSON.stringify(S)); window.__totNowH = 8; SchedMount(); }, today); await T.waitForTimeout(500);
  await T.evaluate(() => { document.querySelector('#scheduleView [data-sub="rot"]').click(); }); await T.waitForTimeout(300); await T.evaluate(() => document.querySelector('#scheduleView [data-a="load"]').click()); await T.waitForTimeout(500); await T.evaluate(() => document.querySelector('#scheduleView [data-a="gen"]').click()); await T.waitForTimeout(1200);
  await T.sync(); await T.waitForTimeout(500);
  const bell = await T.evaluate(() => { document.getElementById('bellBtn').click(); return new Promise((res) => setTimeout(() => res(document.querySelector('.tkOv') ? document.querySelector('.tkOv').innerText : ''), 500)); });
  ok('the bell shows the absence report', /absence report/.test(bell) && /Test Person/.test(bell), bell.slice(0, 300));
  await T.evaluate(() => { const c = [...document.querySelectorAll('.tkOv [data-k]')].find((x) => /absence report/.test(x.innerText)); c && c.click(); }); await T.waitForTimeout(900);
  const panel = await T.evaluate(() => document.querySelector('#scCv') ? document.querySelector('#scCv').innerText : '');
  ok('clicking it opens the cover panel with the report and a "Plan the cover" button', /Reported by the employees/.test(panel) && /Test Person is sick/.test(panel) && /Plan the cover/.test(panel), panel.slice(0, 300));
  await T.evaluate(() => document.querySelector('#scheduleView [data-cvrep]').click()); await T.waitForTimeout(1000);
  const sh = await T.evaluate((day) => JSON.parse(localStorage.getItem('totSchedule')).days[day].shifts.morning, today); const row = sh.rows.find((r) => r.name === 'Test Person');
  ok('the person is marked absent for the whole shift (sick) and the rest of the rotation is planned again with 5 people on 4 tables', row.abs && row.abs[0].why === 'sick' && row.cells.every((c) => c === 'OFF') && (() => { for (let q = 0; q < 16; q++) { const tb = sh.rows.filter((r) => r.name !== 'Test Person').map((r) => r.cells[q]).filter((v) => /^\d+$/.test(v)).sort().join(); if (tb !== '1,2,3,4') return false; } return true; })(), JSON.stringify(row.abs));
  const ab = await T.evaluate(() => JSON.parse(localStorage.getItem('totAbsenceReports'))); ok('the report is marked as handled', ab[0].status === 'handled', JSON.stringify(ab[0]));
  /* late and early: the planned absence is cut to the right half hours */
  await T.evaluate((day) => { const a = JSON.parse(localStorage.getItem('totAbsenceReports')); a.push({ id: 'l1', name: 'W2', type: 'late', minutes: 30, date: day, shift: 'morning', ts: Date.now(), u: Date.now(), status: 'new' }, { id: 'e1', name: 'W3', type: 'early', at: '12:00', date: day, shift: 'morning', ts: Date.now(), u: Date.now(), status: 'new' }); localStorage.setItem('totAbsenceReports', JSON.stringify(a)); SchedMount(); }, today); await T.waitForTimeout(500);
  await T.evaluate(() => { const b = document.querySelector('#scheduleView [data-sub="rot"]'); b && b.click(); }); await T.waitForTimeout(300); await T.evaluate(() => { const b = document.querySelector('#scheduleView [data-a="cv"]'); if (!document.querySelector('#scCv')) b.click(); }); await T.waitForTimeout(300);
  await T.evaluate(() => document.querySelector('[data-cvrep="l1"]').click()); await T.waitForTimeout(700); await T.evaluate(() => { if (!document.querySelector('#scCv')) document.querySelector('#scheduleView [data-a="cv"]').click(); }); await T.waitForTimeout(300);
  await T.evaluate(() => document.querySelector('[data-cvrep="e1"]').click()); await T.waitForTimeout(900);
  const sh2 = await T.evaluate((day) => JSON.parse(localStorage.getItem('totSchedule')).days[day].shifts.morning, today), w2 = sh2.rows.find((r) => r.name === 'W2'), w3 = sh2.rows.find((r) => r.name === 'W3');
  ok('"I will be late (30 min)": absent for the first half hour only', w2.abs && w2.abs[0].a === 0 && w2.abs[0].b === 1 && w2.cells[0] === 'OFF' && w2.cells[1] !== 'OFF', JSON.stringify(w2.abs) + w2.cells.slice(0, 3));
  ok('"I have to leave at 12:00": absent from slot 8 to the end, the first four hours stay', w3.abs && w3.abs[0].a === 8 && w3.cells.slice(8).every((c) => c === 'OFF') && w3.cells.slice(0, 8).every((c) => c !== 'OFF'), JSON.stringify(w3.abs) + w3.cells.join());
  ok('no page errors', perr.length === 0 && H.errs.length === 0, perr.concat(H.errs).slice(0, 3).join(' | ')); await H.close(); await br.close();
  console.log('report: ' + (fails ? fails + ' FAILED' : 'ALL PASSED')); process.exit(fails ? 1 : 0);
})();
