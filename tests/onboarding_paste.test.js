/* Bug report: pasting trainee rows into "Paste here" filled every column with M / F. A data cell "M" (gender) was taken as a header that matches
   "email" and "last name", so every field whose name contains an "m" was read from the Gender column. */
const path = require('path'), tool = path.join(__dirname, '..', 'tool', 'PTF-pass-to-floor-Gunda.html');
const gas = require('./fakegas')(path.join(__dirname, '..', 'tool', 'Code.gs')); require('./seed')(gas);
let fails = 0; function ok(n, c, x) { if (!c) fails++; console.log((c ? '  ✅ ' : '  ❌ ') + n + (c ? '' : '  → ' + x)); }
const ROWS = [
  ['1', 'Nino Beridze', 'Facebook', 'F', '+995 555 111 222', 'nino.b@mail.com', 'Morning', 'No', 'English', 'Yes', 'Yes', '01001011111'],
  ['2', 'Luka Kapanadze', 'Referral', 'M', '+995 555 333 444', 'luka.k@mail.com', 'Night', 'Yes', 'Russian', 'Yes', 'No', '01001022222'],
  ['3', 'Mariam Tsereteli', 'Jobs.ge', 'F', '+995 555 555 666', 'mariam.t@mail.com', 'Afternoon', 'No', 'English', 'Yes', 'Yes', '01001033333']];
const HDR = ['N', 'Trainees', 'Source', 'Gender', 'Phone Number', 'E-mail', 'Pref. Shift', 'Experience', 'Language', 'Offer Sent', 'Offer Accepted', 'Personal ID'];
(async () => {
  const H = await require('./harness')(tool, gas);
  const d0 = gas.data(); d0.keys.totOnboardingHier = { v: JSON.stringify({ v: 1, trainers: [{ id: 'trainer_a', name: 'Tina Trainer', email: '', archived: false, onboardings: [] }] }), t: Date.now() }; gas.setData(d0);
  const A = await H.open({ admin: true }); await A.setViewportSize({ width: 1500, height: 950 }); await A.sync(); await A.reload(); await A.waitForTimeout(1200);
  const mk = (name) => A.evaluate(async (name) => { const w = (ms) => new Promise(r => setTimeout(r, ms)), q = (s) => document.querySelector(s);
    switchView('onboarding'); await w(300); const t = q('#obBrowser [data-t="trainer_a"] [data-x="openT"]'); if (t) { t.click(); await w(200); } q('#obBrowser [data-x="newO"]').click(); await w(200);
    q('#sName').value = name; q('#sTrack').value = 'GP'; q('#sDate').value = '2026-10-01'; q('#sDays').value = '5'; q('#sGo').click(); await w(800);
    const H0 = JSON.parse(localStorage.getItem('totOnboardingHier')); return H0.trainers[0].onboardings.filter(o => o.name === name)[0].id; }, name);
  const paste = (txt) => A.evaluate((txt) => { const dt = new DataTransfer(); dt.setData('text/plain', txt); document.getElementById('obPaste').dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true })); }, txt);
  const tr = (g) => A.evaluate((g) => { const H0 = JSON.parse(localStorage.getItem('totOnboardingHier')); return H0.trainers[0].onboardings.filter(o => o.id === g)[0].ws.trainees; }, g);
  const check = (label, T) => {
    const n = T.filter(t => t.firstName || t.lastName);
    ok(label + ': 3 trainees imported', n.length === 3, JSON.stringify(n.map(t => [t.firstName, t.lastName])));
    const nino = n.find(t => t.firstName === 'Nino') || {};
    ok(label + ': names, phone, e-mail, gender and Personal ID land in their own columns', nino.lastName === 'Beridze' && nino.email === 'nino.b@mail.com' && nino.phone === '+995 555 111 222' && nino.gender === 'Female' && nino.personalId === '01001011111', JSON.stringify(nino));
    ok(label + ': no field holds a lone M or F', !n.some(t => ['firstName', 'lastName', 'email', 'phone', 'employeeId', 'personalId', 'team', 'trainerEmail', 'empStage'].some(k => /^[MF]$/.test(String(t[k] || '')))), JSON.stringify(n[0]));
    ok(label + ': Luka is Male, Night shift preference', (n.find(t => t.firstName === 'Luka') || {}).gender === 'Male' && (n.find(t => t.firstName === 'Luka') || {}).shiftPref === 'Night', JSON.stringify(n.find(t => t.firstName === 'Luka')));
  };
  const g1 = await mk('Paste no header'); await paste(ROWS.map(r => r.join('\t')).join('\n')); await A.waitForTimeout(800); check('rows without a header', await tr(g1));
  const g2 = await mk('Paste with header'); await paste([HDR].concat(ROWS).map(r => r.join('\t')).join('\n')); await A.waitForTimeout(800); check('rows with the header', await tr(g2));
  const g3 = await mk('Paste with blank rows'); await paste(['', ''].concat(ROWS.map(r => r.join('\t'))).join('\n')); await A.waitForTimeout(800); check('rows after empty lines', await tr(g3));
  ok('no page errors', H.errs.length === 0, H.errs.join(' | '));
  await H.close(); console.log('onboarding_paste: ' + (fails ? fails + ' FAILED' : 'ALL PASSED')); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
