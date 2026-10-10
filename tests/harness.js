const { chromium } = (function () { try { return require('playwright'); } catch (e) { return require(require('child_process').execSync('npm root -g').toString().trim() + '/playwright'); } })();
const URL = 'https://script.google.com/macros/s/TEST/exec';
module.exports = async function (toolPath, gas) {
  const browser = await chromium.launch();
  const errs = [];
  async function open(who) {   // who: { admin:true } or { email, pw, name, role }
    const ctx = await browser.newContext(); const p = await ctx.newPage();
    p.on('pageerror', e => errs.push((who.email || 'admin') + ': ' + e.message));
    p.on('dialog', d => d.accept());
    await p.route(URL + '**', async r => { const body = r.request().postData(); let out; try { out = gas.post(body); } catch (e) { out = { error: 'server crash: ' + e.message }; errs.push('SERVER ' + e.stack); } await r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(out) }); });
    await p.addInitScript(w => {
      if (sessionStorage.getItem('__init')) return; sessionStorage.setItem('__init', '1');
      localStorage.setItem('totSyncCfg', JSON.stringify(w.admin ? { url: w.url, key: 'ADMKEY' } : { url: w.url }));
      if (w.admin) sessionStorage.setItem('totAdmin', '1');
      else localStorage.setItem('totAuth', JSON.stringify({ email: w.email, pwHash: w.pw, t: Date.now() }));
    }, Object.assign({ url: URL }, who));
    await p.goto('file://' + toolPath); await p.waitForTimeout(800);
    p.sync = async () => { await p.evaluate(() => new Promise(res => { const b = document.getElementById('tdBadge'); b.textContent = ''; b.click(); const t0 = Date.now(); (function w() { const s = b.textContent; if (/synced|failed|storage full/.test(s) && !/merging/.test(s) || Date.now() - t0 > 8000) res(s); else setTimeout(w, 50); })(); })); await p.waitForTimeout(1700); return p.evaluate(() => document.getElementById('tdBadge').textContent); };
    p.local = (k) => p.evaluate(k => { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } }, k);
    p.who = who.email || 'admin';
    return p;
  }
  return { open, errs, close: () => browser.close() };
};
