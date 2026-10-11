/* v3.42 information board: a free layout of blocks (desks, reminders, announcements, clock, today, pictures) edited in the tool and shown on a TV link. */
const path = require('path'), tool = path.join(__dirname, '..', 'tool', 'PTF-pass-to-floor-Gunda.html'), tvf = path.join(__dirname, '..', 'tool', 'PTF-tv.html'), code = path.join(__dirname, '..', 'tool', 'Code.gs');
const gas = require('./fakegas')(code); require('./seed')(gas);
let fails = 0; function ok(n, c, x) { if (!c) fails++; console.log((c ? '  ✅ ' : '  ❌ ') + n + (c ? '' : '  → ' + x)); }
const URL = 'https://script.google.com/macros/s/TEST/exec';
(async () => {
  const H = await require('./harness')(tool, gas), P = await H.open({ admin: true }); await P.setViewportSize({ width: 1700, height: 1000 }); await P.sync();
  const w = (ms) => P.waitForTimeout(ms), TV = () => P.evaluate(() => JSON.parse(localStorage.getItem('totTvScreens') || '[]'));
  await P.evaluate(() => { switchView('schedule'); SchedMount(); }); await w(400); await P.evaluate(() => document.querySelector('#scheduleView [data-sub="tv"]').click()); await w(400);
  await P.selectOption('#scheduleView #tvNew', 'info'); await P.evaluate(() => document.querySelector('#scheduleView [data-tva="add"]').click()); await w(400);
  let A = await TV(); ok('"+ New screen" can make an Information board', A.length === 1 && A[0].view === 'info' && A[0].board && A[0].board.blocks.length === 0, JSON.stringify(A[0]));
  ok('the screen has an Edit the board button', await P.evaluate(() => !!document.querySelector('#scheduleView [data-tva^="board|"]')));
  await P.evaluate(() => document.querySelector('#scheduleView [data-tva^="board|"]').click()); await w(500);
  ok('the editor opens full screen', await P.evaluate(() => !!document.querySelector('#ibEd') && !!document.querySelector('#ibEd .ibS')));
  await P.evaluate(() => document.querySelector('#ibEd [data-ibt="lobby"]').click()); await w(500);
  let B = (await TV())[0].board; ok('the Lobby layout adds 7 blocks (desks, today, announcement, reminders, ask-here)', B.blocks.length === 7 && ['desk', 'today', 'ann', 'note', 'ask'].every(t => B.blocks.some(b => b.t === t)), JSON.stringify(B.blocks.map(b => b.t)));
  /* select + drag */
  const box = await P.evaluate(() => { const e = document.querySelector('#ibEd .ibB[data-ib]'), r = e.getBoundingClientRect(); return { id: e.getAttribute('data-ib'), x: r.x + r.width / 2, y: r.y + r.height / 2, w: r.width }; });
  const x0 = B.blocks.find(b => b.id === box.id).x;
  await P.mouse.move(box.x, box.y); await P.mouse.down(); await P.mouse.move(box.x + 60, box.y + 30, { steps: 5 }); await P.mouse.up(); await w(500);
  B = (await TV())[0].board; const mv = B.blocks.find(b => b.id === box.id); ok('dragging a block moves it and saves', mv.x > x0, x0 + ' -> ' + mv.x);
  ok('the block is selected and the inspector shows its title', await P.evaluate(() => /Department desk/.test(document.querySelector('#ibIns').innerText) && document.querySelectorAll('#ibEd .ibHn').length === 8));
  /* resize with a handle */
  const w0 = mv.w; const hnd = await P.evaluate(() => { const r = document.querySelector('#ibEd .ibHn[data-h="se"]').getBoundingClientRect(); return { x: r.x + 5, y: r.y + 5 }; });
  await P.mouse.move(hnd.x, hnd.y); await P.mouse.down(); await P.mouse.move(hnd.x + 80, hnd.y + 40, { steps: 5 }); await P.mouse.up(); await w(500);
  B = (await TV())[0].board; ok('dragging a corner resizes the block', B.blocks.find(b => b.id === box.id).w > w0, w0 + ' -> ' + B.blocks.find(b => b.id === box.id).w);
  /* edit text in the inspector */
  await P.fill('#ibIns [data-ibp="ti"]', 'Academy <b>X</b>'); await w(500); B = (await TV())[0].board; ok('the title is edited and saved', B.blocks.find(b => b.id === box.id).ti === 'Academy <b>X</b>');
  ok('the title is shown as plain text (no markup injection)', await P.evaluate(() => !document.querySelector('#ibEd .ibB b') && /Academy <b>X<\/b>/.test(document.querySelector('#ibEd .ibB[data-ib] .ibH').textContent)));
  /* add a note, undo */
  await P.evaluate(() => document.querySelector('#ibEd [data-ibadd="note"]').click()); await w(400); B = (await TV())[0].board; ok('+ Note adds a block', B.blocks.length === 8);
  await P.evaluate(() => document.querySelector('#ibEd [data-ibu="undo"]').click()); await w(500); B = (await TV())[0].board; ok('Undo takes it away again', B.blocks.length === 7);
  /* format and rotation */
  await P.evaluate(() => { const s = document.querySelector('#ibEd [data-ibu="none"]'); s && s.click(); }); await w(200);
  await P.evaluate(() => { const s = document.querySelector('#ibEd [data-ibs="fmt"]'); s.value = '9:16'; s.dispatchEvent(new Event('change', { bubbles: true })); }); await w(500);
  const ratio = await P.evaluate(() => { const r = document.querySelector('#ibEd .ibS').getBoundingClientRect(); return r.width / r.height; });
  ok('portrait 9:16 makes the screen tall', Math.abs(ratio - 9 / 16) < 0.02, ratio);
  await P.evaluate(() => document.querySelector('#ibEd [data-ibs="rot"][data-v="90"]').click()); await w(400); B = (await TV())[0].board; ok('the picture can be turned 90° for a TV on its side', B.fmt === '9:16' && B.rot === 90, JSON.stringify([B.fmt, B.rot]));
  await P.evaluate(() => document.querySelector('#ibEd [data-ibu="prev"]').click()); await w(500);
  const prev = await P.evaluate(() => { const w = document.querySelector('#ibPrev .ibW'); return w ? { t: w.style.transform, n: w.querySelectorAll('.ibB').length, clk: (w.querySelector('[data-ibc]') || {}).textContent } : null; });
  ok('the preview shows the board turned 90° with the clock running', prev && /rotate\(90deg\)/.test(prev.t) && prev.n === 7 && /\d\d:\d\d/.test(prev.clk), JSON.stringify(prev));
  await P.keyboard.press('Escape'); await w(300); ok('Esc closes the preview', await P.evaluate(() => !document.querySelector('#ibPrev')));
  await P.evaluate(() => document.querySelector('#ibEd [data-ibu="done"]').click()); await w(500); ok('Done closes the editor', await P.evaluate(() => !document.querySelector('#ibEd')));
  /* server answer */
  A = await TV(); const tok = A[0].token;
  A[0].board.blocks.push({ id: 'evil1', t: 'script', x: 1, y: 1, w: 5, h: 5 }, { id: 'im1', t: 'img', x: 1, y: 1, w: 5, h: 5, img: 'javascript:alert(1)' }, { id: 'im2', t: 'img', x: 1, y: 1, w: 5, h: 5, img: 'data:image/png;base64,iVBORw0KGgo=' }, { id: 'c1', t: 'text', x: 500, y: -90, w: 9999, h: 0, tx: '<script>alert(1)</script>', c: 'red', bg: '#12345' });
  await P.evaluate((A) => localStorage.setItem('totTvScreens', JSON.stringify(A)), A); await P.sync(); await w(500);
  const r = gas.post({ action: 'tv', token: tok, d: '2026-10-08', h: 10 });
  ok('the TV answer carries the board, view "info"', r.ok && r.screen.view === 'info' && r.board && r.board.fmt === '9:16' && r.board.rot === 90, JSON.stringify(r).slice(0, 200));
  ok('unknown block types, javascript: pictures, bad colours and out-of-range numbers are cleaned', !r.board.blocks.some(b => b.t === 'script') && !r.board.blocks.find(b => b.id === 'im1').img && !!r.board.blocks.find(b => b.id === 'im2').img && r.board.blocks.find(b => b.id === 'c1').c === '' && r.board.blocks.find(b => b.id === 'c1').bg === '' && r.board.blocks.find(b => b.id === 'c1').x === 100 && r.board.blocks.find(b => b.id === 'c1').y === -5 && r.board.blocks.find(b => b.id === 'c1').w === 100, JSON.stringify(r.board.blocks.slice(-4)));
  ok('the answer for a wrong token is "not found"', gas.post({ action: 'tv', token: 'x'.repeat(30) }).error === 'not found');
  /* the TV page */
  const T = await P.context().newPage(); const errs = []; T.on('pageerror', e => errs.push(e.message)); T.on('dialog', d => d.dismiss());
  await T.route(URL + '**', async rt => { const out = gas.post(rt.request().postData()); await rt.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(out) }); });
  await T.setViewportSize({ width: 1280, height: 720 }); await T.goto('file://' + tvf + '#' + encodeURIComponent(URL) + '|' + tok); await T.waitForTimeout(1500);
  const tv = await T.evaluate(() => { const w = document.querySelector('#bd .ibW'); return w ? { t: w.style.transform, n: w.querySelectorAll('.ibB').length, txt: w.innerText.slice(0, 200), script: !!w.querySelector('script'), hd: document.getElementById('hd') && getComputedStyle(document.getElementById('hd')).display } : null; });
  ok('the TV page draws the board: blocks, turned 90°, no old header, scripts in text are not run', tv && tv.n >= 7 && /rotate\(90deg\)/.test(tv.t) && !tv.script && tv.hd === 'none', JSON.stringify(tv));
  ok('the TV page shows the text of the blocks (as text)', tv && /Academy <b>X<\/b>/.test(tv.txt) && /<script>alert\(1\)<\/script>/.test(await T.evaluate(() => document.querySelector('#bd').innerText)), tv && tv.txt);
  ok('no page errors', H.errs.length === 0 && errs.length === 0, JSON.stringify(H.errs.slice(0, 2).concat(errs.slice(0, 2))));
  await T.screenshot({ path: process.env.SHOT || '/tmp/tvboard.png' }); await H.close();
  console.log('info_board: ' + (fails ? fails + ' FAILED' : 'ALL PASSED')); process.exit(fails ? 1 : 0);
})();
