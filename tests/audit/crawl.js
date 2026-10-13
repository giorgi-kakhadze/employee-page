/* Audit crawler: every role × every space × every tab; optional "click every button" pass. Dialogs are DISMISSED (nothing destructive is confirmed),
   window.open / print are stubbed. Records page errors, console errors, horizontal overflow at phone width and unlabeled controls.
   node tests/audit/crawl.js [--click] [--roles=admin,mgr] [--out=file.json] */
const path = require('path'), fs = require('fs'), tool = path.join(__dirname, '..', '..', 'tool', 'PTF-pass-to-floor-Gunda.html'), code = path.join(__dirname, '..', '..', 'tool', 'Code.gs');
const arg = (k, d) => { const a = process.argv.find(x => x.startsWith('--' + k)); return a ? (a.split('=')[1] || true) : d; };
const CLICK = !!arg('click', false), ROLES = String(arg('roles', 'admin,mgr,hr,lead,coach,fmd,newbie')).split(','), OUT = arg('out', '/tmp/crawl.json'), MAXB = +arg('maxb', 70);
const gas = require('../fakegas')(code); const users = require('../seed')(gas);
/* realistic data on the server: the 200-person demo (everything except access policy, which the seed owns) */
const demo = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'demo', 'PTF-demo-backup-200.json'), 'utf8')).data, D = gas.data(), now = Date.now();
Object.keys(demo).forEach(k => { if (/^(totAccessPolicy|totAccessGrants|totSyncCfg|totSyncMeta|totAuth|totTrainerRole|totTrainerDisplayName|totTrainerEmail|totMailerCfg|totAdminHash)$/.test(k)) return; D.keys[k] = { v: typeof demo[k] === 'string' ? demo[k] : JSON.stringify(demo[k]), t: now - 500 }; });
const XSS = !!arg('xss', false);
if (XSS) { /* hostile text in every human-entered field: if any screen runs it, window.__xss records where */
  const PAY = '<img src=x onerror="window.__xss=(window.__xss||0)+1">', FIELDS = /^(name|fullName|nickname|title|body|text|note|notes|desc|details|msg|label|ti|tx|lo|comment|reason|summary|subject|caseTitle|empName|toName|fromName|who|line|q|a|act|n)$/;
  const walk = (o) => { if (Array.isArray(o)) return o.map(walk); if (o && typeof o === 'object') { Object.keys(o).forEach(k => { const v = o[k]; if (typeof v === 'string' && FIELDS.test(k) && v.length < 200 && !/@/.test(v) && !/^\d/.test(v)) o[k] = v + PAY; else o[k] = walk(v); }); return o; } return o; };
  Object.keys(D.keys).forEach(k => { if (/^totAccessPolicy$/.test(k)) return; try { D.keys[k].v = JSON.stringify(walk(JSON.parse(D.keys[k].v))); } catch (e) {} });
}
gas.setData(D); gas.addUser('newbie@x.com', 'pw-newbie@x.com', 'Nora New');
const ROLE_EMAIL = { mgr: 'mgr@x.com', hr: 'hr@x.com', lead: 'lead@x.com', coach: 'coach@x.com', fmd: Object.keys(users).find(e => /fmd|sched/i.test(e) || /scheduling/.test(users[e].role)) || 'fmd@x.com', newbie: 'newbie@x.com' };
const R = { started: new Date().toISOString(), roles: {}, errors: [], overflow: [], unlabeled: [], screens: 0, clicks: 0 };
(async () => {
  const H = await require('../harness')(tool, gas);
  for (const role of ROLES) {
    const P = role === 'admin' ? await H.open({ admin: true }) : await H.open({ email: ROLE_EMAIL[role], pw: 'pw-' + ROLE_EMAIL[role] });
    P.removeAllListeners('dialog'); P.on('dialog', d => d.dismiss().catch(() => {}));
    let cur = role + ':start'; const errs = [];
    P.on('pageerror', e => { errs.push(e.message); R.errors.push({ role, where: cur, kind: 'pageerror', msg: String(e.message).slice(0, 300) }); });
    P.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|net::ERR|favicon/.test(m.text())) R.errors.push({ role, where: cur, kind: 'console', msg: m.text().slice(0, 300) }); });
    await P.setViewportSize({ width: 1440, height: 900 }); try { await P.sync(); } catch (e) {} await P.waitForTimeout(1500);
    await P.evaluate(() => { window.print = () => {}; window.open = () => null; HTMLAnchorElement.prototype.click = function () {}; });
    const vis = [], cleanup = () => P.evaluate(() => { document.querySelectorAll('.tkOv,#setOv,#ibEd,#ibPrev,.adOv.open,#scAsk,.modal-backdrop').forEach(o => { if (o.classList && o.classList.contains('adOv')) o.classList.remove('open'); else o.remove(); }); try { document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); } catch (e) {} });
    async function measure(label) {
      R.screens++; vis.push(label);
      if (XSS) { const x = await P.evaluate(() => { const n = window.__xss || 0; window.__xss = 0; return n; }).catch(() => 0); if (x) (R.xss = R.xss || []).push({ role, where: label, hits: x }); }
      const m = await P.evaluate(() => { const vis = (e) => e.offsetParent !== null && getComputedStyle(e).visibility !== 'hidden'; const un = Array.from(document.querySelectorAll('button, [role=button], input:not([type=hidden]), select, textarea')).filter(vis).filter(e => { const t = (e.innerText || e.value || '').trim(), a = e.getAttribute('aria-label') || e.getAttribute('title') || e.getAttribute('placeholder') || (e.id && document.querySelector('label[for="' + e.id + '"]')) || e.closest('label'); return !t && !a; }); return { un: un.slice(0, 8).map(e => e.tagName + (e.id ? '#' + e.id : '') + (e.className ? '.' + String(e.className).split(' ')[0] : '')), nUn: un.length }; });
      if (m.nUn) R.unlabeled.push({ role, where: label, n: m.nUn, sample: m.un });
      await P.setViewportSize({ width: 390, height: 844 }); await P.waitForTimeout(250);
      const o = await P.evaluate(() => ({ sw: document.documentElement.scrollWidth, w: innerWidth, wide: Array.from(document.querySelectorAll('body *')).filter(e => { const r = e.getBoundingClientRect(); return r.right > innerWidth + 4 && r.width > 40 && e.offsetParent !== null && !e.closest('.wrap,.tbl-wrap,[style*="overflow"],table,pre,.ob-grid,.fs-grid,#ibEd') && getComputedStyle(e).position !== 'fixed'; }).slice(0, 4).map(e => e.tagName + (e.id ? '#' + e.id : '') + (e.className ? '.' + String(e.className).split(' ')[0] : '')) }));
      if (o.sw > o.w + 4) R.overflow.push({ role, where: label, scrollWidth: o.sw, width: o.w, culprits: o.wide });
      await P.setViewportSize({ width: 1440, height: 900 }); await P.waitForTimeout(150);
    }
    async function clickAll(label, reopen) {
      if (!CLICK) return; const btns = await P.evaluate(() => Array.from(document.querySelectorAll('main button, .view button, #spaceSub button, .sc button, #deptView button, #tasksView button')).filter(e => e.offsetParent !== null && !e.disabled).map((e, i) => { e.setAttribute('data-crawl', String(i)); return { i, t: (e.innerText || e.title || e.getAttribute('aria-label') || '').trim().slice(0, 40) }; }));
      for (const b of btns.slice(0, MAXB)) {
        if (/sign ?out|log ?out|restore|reset all|delete all|wipe|clear all data|factory/i.test(b.t)) continue;
        cur = label + ' › [' + b.t + ']'; R.clicks++;
        const okc = await P.evaluate((i) => { const e = document.querySelector('[data-crawl="' + i + '"]'); if (!e || e.offsetParent === null) return false; try { e.click(); } catch (x) { return 'threw ' + x.message; } return true; }, b.i).catch(e => 'eval ' + e.message);
        if (typeof okc === 'string') R.errors.push({ role, where: cur, kind: 'click', msg: okc });
        await P.waitForTimeout(120); await cleanup();
        const still = await P.evaluate(() => document.querySelectorAll('[data-crawl]').length).catch(() => 0);
        if (!still) { try { await reopen(); await P.waitForTimeout(250); await P.evaluate(() => { Array.from(document.querySelectorAll('main button, .view button, #spaceSub button, .sc button, #deptView button, #tasksView button')).filter(e => e.offsetParent !== null && !e.disabled).forEach((e, i) => e.setAttribute('data-crawl', String(i))); }); } catch (e) {} }
      }
      await P.evaluate(() => document.querySelectorAll('[data-crawl]').forEach(e => e.removeAttribute('data-crawl')));
    }
    /* Home */
    cur = role + ':home'; await P.evaluate(() => switchView('home')); await P.waitForTimeout(600); await measure(role + ':home'); await clickAll(role + ':home', () => P.evaluate(() => switchView('home')));
    const bar = await P.evaluate(() => Array.from(document.querySelectorAll('.nav-tabs button')).filter(b => b.offsetParent !== null).map(b => ({ id: b.id, t: b.innerText.trim().slice(0, 30) })));
    R.roles[role] = { topBar: bar.map(b => b.t || b.id), spaces: {} };
    for (const b of bar) {
      if (!b.id || /bellBtn|searchBtn|tdBadge|sitePill|psPill|spPill/.test(b.id)) continue;
      cur = role + ':' + b.id; await cleanup(); await P.evaluate((id) => document.getElementById(id).click(), b.id); await P.waitForTimeout(700);
      const subs = await P.evaluate(() => { const s = document.getElementById('spaceSub'); return s && s.classList.contains('show') ? Array.from(s.querySelectorAll('button')).filter(x => x.offsetParent !== null).map((x, i) => ({ i, t: x.innerText.trim().slice(0, 30) })) : []; });
      R.roles[role].spaces[b.t || b.id] = subs.map(s => s.t);
      if (!subs.length) { await measure(role + ':' + (b.t || b.id)); await clickAll(role + ':' + (b.t || b.id), () => P.evaluate((id) => document.getElementById(id).click(), b.id)); continue; }
      for (const s of subs) {
        const label = role + ':' + (b.t || b.id) + ' › ' + s.t; cur = label;
        const open = async () => { await P.evaluate((id) => document.getElementById(id).click(), b.id); await P.waitForTimeout(400); await P.evaluate((i) => { const x = Array.from(document.getElementById('spaceSub').querySelectorAll('button')).filter(x => x.offsetParent !== null)[i]; if (x) x.click(); }, s.i); await P.waitForTimeout(600); };
        await cleanup(); await open(); await measure(label);
        /* schedule: every sub tab */
        const st = await P.evaluate(() => { const v = document.getElementById('scheduleView'); return v && v.offsetParent !== null ? Array.from(v.querySelectorAll('.subbar [data-sub]')).map(x => x.getAttribute('data-sub')) : []; });
        if (st.length && /Schedule/i.test(s.t)) { for (const k of st) { const l2 = label + ' › ' + k; cur = l2; await P.evaluate((k) => { const e = document.querySelector('#scheduleView .subbar [data-sub="' + k + '"]'); if (e) e.click(); }, k); await P.waitForTimeout(700); await measure(l2); await clickAll(l2, async () => { await open(); await P.evaluate((k) => { const e = document.querySelector('#scheduleView .subbar [data-sub="' + k + '"]'); if (e) e.click(); }, k); await P.waitForTimeout(500); }); } }
        else await clickAll(label, open);
      }
    }
    R.roles[role].visited = vis.length; R.roles[role].errors = errs.length;
    console.log(role + ': screens ' + vis.length + ', page errors ' + errs.length + ', top bar: ' + R.roles[role].topBar.join(' | '));
    await P.context().close();
  }
  await H.close(); fs.writeFileSync(OUT, JSON.stringify(R, null, 1));
  const uniq = {}; R.errors.forEach(e => { const k = e.kind + ': ' + e.msg.slice(0, 140); (uniq[k] = uniq[k] || []).push(e.role + ' @ ' + e.where); });
  if (XSS) console.log('XSS hits: ' + JSON.stringify(R.xss || []).slice(0, 2000));
  console.log('screens ' + R.screens + ', clicks ' + R.clicks + ', distinct errors ' + Object.keys(uniq).length + ', overflow screens ' + R.overflow.length + ', screens with unlabeled controls ' + R.unlabeled.length);
  Object.keys(uniq).slice(0, 60).forEach(k => console.log(' ✗ ' + k + '\n     ' + uniq[k].slice(0, 3).join(' | ') + (uniq[k].length > 3 ? ' (+' + (uniq[k].length - 3) + ')' : '')));
})();
