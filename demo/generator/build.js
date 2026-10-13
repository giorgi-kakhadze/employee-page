/* Builds demo/PTF-demo-backup.json: loads the fake data from gen.js into the real tool in a headless browser and saves it with the tool's own "Download full backup". Run: node demo/generator/build.js */
const { chromium } = require(require('child_process').execSync('npm root -g').toString().trim() + '/playwright');
const fs = require('fs'), TOOL = 'file://' + require('path').join(__dirname, '..', '..', 'tool', 'PTF-pass-to-floor-Gunda.html');
(async () => {
  const D = require('./gen.js')(); const info = D._info; delete D._info;
  const b = await chromium.launch(), ctx = await b.newContext({ acceptDownloads: true, viewport: { width: 1440, height: 900 } }), p = await ctx.newPage(), errs = [];
  p.on('pageerror', e => errs.push(e.message)); p.on('dialog', x => x.accept());
  await p.addInitScript(() => { if (!sessionStorage.getItem('__i')) { sessionStorage.setItem('__i', '1'); sessionStorage.setItem('totAdmin', '1'); } });
  await p.goto(TOOL); await p.waitForTimeout(1500);
  const bad = await p.evaluate((D) => { localStorage.clear(); const bad = []; for (const k in D) { try { localStorage.setItem(k, JSON.stringify(D[k])); } catch (e) { bad.push(k + ': ' + e.message); } } return bad; }, D);
  console.log('write problems:', bad);
  await p.reload(); await p.waitForTimeout(2500);
  const chk = await p.evaluate(async () => { const w = (ms) => new Promise(r => setTimeout(r, ms)), o = {};
    openSpace('fmd'); await w(800); o.fmdOverview = (document.getElementById('spaceHomeView').textContent.match(/(\d+) of (\d+) people/) || [])[0];
    switchView('tasks'); await w(600); o.tickets = document.querySelectorAll('#tasksView .kbCard, #tasksView .tkCard').length;
    openSpace('service'); await w(600); o.service = document.getElementById('spaceHomeView').textContent.replace(/\s+/g, ' ').slice(0, 200);
    openSpace('projects'); await w(400); Projects.go('progress'); await w(300); o.projects = document.querySelectorAll('#projectsView tbody tr').length;
    switchView('home'); await w(500); o.home = document.getElementById('homeView').textContent.replace(/\s+/g, ' ').slice(0, 300);
    return o; });
  console.log(JSON.stringify(chk, null, 1));
  const [dl] = await Promise.all([p.waitForEvent('download'), p.evaluate(() => window.exportBackup())]);
  const out = require('path').join(__dirname, '..', 'PTF-demo-backup.json'); await dl.saveAs(out);
  const j = JSON.parse(fs.readFileSync(out, 'utf8')); console.log('backup keys', Object.keys(j.data).length, 'size', (fs.statSync(out).size / 1048576).toFixed(2) + ' MB', 'missing:', Object.keys(D).filter(k => !(k in j.data)));
  
  console.log('errors', errs.slice(0, 5)); await b.close();
})();
