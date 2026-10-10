/* v3.28: evaluations — the coach picks the kind (Regular / Beginner / Exam), close-up scoring (only main criteria count, procedural points are shown
   as deductions), and photos / videos attached while evaluating, saved with the result. */
const path = require('path'), tool = process.argv[2] || path.join(__dirname, '..', 'tool', 'PTF-pass-to-floor-Gunda.html'), code = process.argv[3] || path.join(__dirname, '..', 'tool', 'Code.gs');
const gas = require('./fakegas')(code); require('./seed')(gas);
let fails = 0; function ok(n, c, x) { if (!c) fails++; console.log((c ? '  ✅ ' : '  ❌ ') + n + (x ? '  → ' + x : '')); }
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFklEQVR42mP8z8DwHwMDAwMjIwMDAwAsCAP9b1E0kQAAAABJRU5ErkJggg==', 'base64');
(async () => {
  const H = await require('./harness')(tool, gas);
  const P = await H.open({ admin: true }); await P.setViewportSize({ width: 1440, height: 900 }); await P.sync();
  await P.evaluate(() => openWs('exam', 'performance')); await P.waitForTimeout(2500);
  const fr = P.frames().filter(f => f !== P.mainFrame())[0];
  const has = await fr.evaluate(() => typeof selectType === 'function' && typeof totScore === 'function' && Array.isArray(ALL_TYPES) && ALL_TYPES.length > 0);
  ok('the evaluation tool is open', has);

  console.log('1. Kind picker and close-up scoring');
  const kinds = await fr.evaluate(() => { buildTypeGrid(); return Array.from(document.querySelectorAll('#sessKindBar [data-sk]')).map(b => b.textContent); });
  ok('the coach can choose Regular, Beginner or Exam before evaluating', ['Type default', 'Regular', 'Beginner', 'Exam'].every(k => kinds.indexOf(k) >= 0), kinds.join(', '));
  const cu = await fr.evaluate(() => { const t = ALL_TYPES[0], c = t.criteria; const valOf = id => 3;
    const a = totScore(Object.assign({}, t, { method: 'average' }), c, id => id === c[0].id ? 0 : 3, 3).pct, eq = Math.round((c.length - 1) * 3 / (c.length * 3) * 100);
    const T = Object.assign({}, t, { method: 'closeup' }), main = totMainIds(c);
    const s1 = totScore(T, c, id => main.indexOf(id) >= 0 ? 3 : 1, 3), s2 = totScore(T, c, id => id === main[0] ? 1 : 3, 3);
    return { n: c.length, main: main.length, s1, s2, a, eq, wavg: totScore(Object.assign({}, t, { method: 'average' }), c, () => 3, 3).pct }; });
  ok('close-up: full stars on the main criteria = 100% even with procedural mistakes', cu.s1.pct === 100 && cu.s1.ded === (cu.n - cu.main) * 2, JSON.stringify(cu.s1));
  ok('close-up: a lost point on a main criterion lowers the score', cu.s2.pct === Math.round((cu.main * 3 - 2) / (cu.main * 3) * 100) && cu.s2.ded === 0, JSON.stringify(cu.s2));
  ok('with nothing ticked as Main, the first 6 criteria are the main ones', cu.main === Math.min(6, cu.n), cu.main);

  console.log('2. A close-up Beginner evaluation with a photo');
  await fr.evaluate(() => { const t = ALL_TYPES[0]; t.method = 'closeup'; t.criteria.forEach((c, i) => { if (i < 2) c.main = true; else delete c.main; }); lsSet('wsCustomConfig', JSON.stringify(ALL_TYPES));
    window.__sessKind = 'Beginner'; buildTypeGrid(); selectType(t.id); goToForm(); });
  await fr.waitForTimeout(300);
  const card = await fr.evaluate(() => (document.getElementById('typecard-' + ALL_TYPES[0].id) || {}).textContent || '');
  ok('the game card says close-up scoring and how many main criteria', /close-up scoring \(2 main\)/.test(card), card.replace(/\s+/g, ' ').slice(0, 120));
  await fr.evaluate(() => { document.getElementById('firstName').value = 'Nino Test WS9001'; const s = document.getElementById('supFirstName'); if (s) s.value = 'Cora';
    CRITERIA.forEach((c, i) => setScore(1, c.id, i < 2 ? 3 : 2)); });
  await fr.setInputFiles('#evMedia-f1', [{ name: 'table-photo.png', mimeType: 'image/png', buffer: PNG }]);
  const listed = await fr.evaluate(() => document.getElementById('evMediaList-f1').textContent);
  ok('the photo is listed before saving', /table-photo\.png/.test(listed), listed);
  const meter = await fr.evaluate(() => document.getElementById('meterScore-1').textContent);
  ok('the live score shows 100% with the procedural deduction next to it', /^100% · −\d+ procedural$/.test(meter), meter);
  await fr.evaluate(() => saveAndNext()); await P.waitForTimeout(1500);
  const rec = await P.evaluate(() => { const a = JSON.parse(localStorage.getItem('evalResults') || '[]'); return a[a.length - 1]; });
  ok('result saved as Beginner, close-up, 100%, with the deduction', rec && rec.kind === 'Beginner' && rec.method === 'closeup' && rec.total === 100 && rec.ded > 0, rec && JSON.stringify({ kind: rec.kind, method: rec.method, total: rec.total, ded: rec.ded }));
  ok('the result lists the attached photo', rec && (rec.media || []).length === 1 && rec.media[0].kind === 'image', rec && JSON.stringify(rec.media));
  ok('main criteria are marked on the saved result', rec && rec.criteria.filter(c => c.main).length === 2);
  const ph = await P.evaluate((u) => (JSON.parse(localStorage.getItem('evalPhotos') || '{}')[u] || []), String(rec.uid || rec.id));
  ok('the photo is stored with the result (shrunk JPEG)', ph.length === 1 && /^data:image\/jpeg;base64,/.test(ph[0].d) && ph[0].n === 'table-photo.png', ph.length + ' ' + (ph[0] ? ph[0].d.slice(0, 30) : ''));
  const after = await fr.evaluate(() => document.getElementById('evMediaList-f1').textContent);
  ok('the attach list is empty again for the next person', !/table-photo/.test(after), after);
  const tags = await fr.evaluate(() => Array.from(document.querySelectorAll('.mode-tag')).map(t => t.textContent.trim()).join(' | '));
  ok('Results show the kind, close-up deduction and 📎 1', /Beginner/.test(tags) && /close-up · −\d+ procedural/.test(tags) && /📎 1/.test(tags), tags.slice(0, 200));
  await P.evaluate((u) => totMediaView(u), String(rec.uid || rec.id)); await P.waitForTimeout(200);
  ok('the 📎 viewer shows the photo', await P.evaluate(() => !!document.querySelector('.tkOv img[src^="data:image/jpeg"]')));
  await P.evaluate(() => document.querySelectorAll('.tkOv').forEach(o => o.remove()));
  const jr = await P.evaluate(() => (JSON.parse(localStorage.getItem('totJournal') || '[]') || []).filter(x => x.src === 'evalResults').map(x => x.act + ' · ' + x.dep + ' · ' + x.p));
  ok('saving in the evaluation frame is recorded in Performance → History', jr.some(a => /^Evaluation saved: Nino Test – .*100% \(Beginner\) · performance · nino test$/.test(a)), jr.join(' | '));

  console.log('3. A video picked while evaluating');
  await fr.evaluate(() => { document.getElementById('firstName').value = 'Gela Test WS9002'; CRITERIA.forEach(c => setScore(1, c.id, 3)); });
  await fr.setInputFiles('#evMedia-f1', [{ name: 'clip.mp4', mimeType: 'video/mp4', buffer: Buffer.from('not really a video') }]);
  await fr.evaluate(() => saveAndNext()); await P.waitForTimeout(2500);
  const rec2 = await P.evaluate(() => { const a = JSON.parse(localStorage.getItem('evalResults') || '[]'); return a[a.length - 1]; });
  ok('the result notes the video', rec2 && rec2.name && (rec2.media || []).some(m => m.kind === 'video'), rec2 && JSON.stringify(rec2.media));
  const vids = await P.evaluate((u) => JSON.parse(localStorage.getItem('evalVideos') || '{}')[u], String(rec2.uid || rec2.id));
  ok('the video is uploaded to Drive and linked to that result (as in Performance → Videos)', !!vids && /^drive-file-/.test(vids.id) && vids.name === 'clip.mp4' && gas.uploads.length >= 1, JSON.stringify(vids));

  console.log('4. Grid (several people at once)');
  await fr.evaluate(() => { loadGridState(activeType.id); gridState.participants = [{ name: 'Ana Grid', workId: 'WS9003' }]; CRITERIA.forEach(c => { gridState.scores[c.id] = [1]; }); gridState.supervisor = 'Cora'; buildGridTable(); });
  const clip = await fr.evaluate(() => !!document.querySelector('#gridTable th.name-col .col-media input[type=file]'));
  ok('each grid column has a 📎 attach button', clip);
  await fr.setInputFiles('#gridTable th.name-col .col-media input[type=file]', [{ name: 'grid-photo.png', mimeType: 'image/png', buffer: PNG }]);
  const cnt = await fr.evaluate(() => document.querySelector('#gridTable th.name-col .col-media').textContent.trim());
  ok('the column shows how many files are attached', cnt === '📎 1', cnt);
  await fr.evaluate(() => saveGridToResults()); await P.waitForTimeout(1500);
  const g = await P.evaluate(() => { const a = JSON.parse(localStorage.getItem('evalResults') || '[]'), r = a[a.length - 1]; return { r, ph: (JSON.parse(localStorage.getItem('evalPhotos') || '{}')[String(r.uid || r.id)] || []).length }; });
  ok('grid result saved with its photo', g.r.name === 'Ana Grid' && g.r.mode === 'grid' && (g.r.media || []).length === 1 && g.ph === 1, JSON.stringify({ n: g.r.name, m: g.r.media, ph: g.ph }));

  console.log('5. Admin sets the scoring method in the type editor');
  const ed = await fr.evaluate(() => { const t = ALL_TYPES[1]; openGameEditor(t.id); const m = document.getElementById('edMethod'); m.value = 'closeup'; m.dispatchEvent(new Event('change'));
    const boxes = Array.from(document.querySelectorAll('#edGroups .ed-main input')).slice(0, 3); boxes.forEach(b => { b.checked = true; b.dispatchEvent(new Event('change')); });
    const info = document.getElementById('edMethodInfo').textContent; saveGameEditor(); const t2 = ALL_TYPES.filter(x => x.id === t.id)[0], cfg = JSON.parse(localStorage.getItem('wsCustomConfig')).filter(x => x.id === t.id)[0];
    return { info, n: boxes.length, method: t2.method, main: t2.criteria.filter(c => c.main).length, stored: cfg.method }; });
  ok('the editor offers Average / Close-up and a Main tick per criterion', ed.n === 3 && /Close-up: 3 main criteria count/.test(ed.info), ed.info.slice(0, 120));
  ok('saving keeps the method and the main criteria', ed.method === 'closeup' && ed.main === 3 && ed.stored === 'closeup', JSON.stringify(ed));

  ok('no page errors', !H.errs.length, H.errs.join(' | '));
  console.log(fails ? fails + ' FAILED' : 'ALL PASSED'); await H.close(); process.exit(fails ? 1 : 0);
})();
