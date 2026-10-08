#!/usr/bin/env node
'use strict';
/* Builds public/tool.html and public/employee.html from the single-file edition's tool/PTF-pass-to-floor-Gunda.html and index.html.
   Like the rules port, this is a set of exact, asserted replacements: if the single-file tool changes in a way that breaks one, the build stops
   and says which, so the two editions do not drift apart silently. The UI itself (27,000 lines) is used as is. */
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..', '..'), out = path.join(__dirname, '..', 'public');
fs.mkdirSync(out, { recursive: true });
let s = fs.readFileSync(path.join(root, 'tool', 'PTF-pass-to-floor-Gunda.html'), 'utf8');
function rep(from, to, all) { const i = s.indexOf(from); if (i < 0) throw new Error('build: anchor not found: ' + from.slice(0, 80)); if (!all && s.indexOf(from, i + 1) >= 0) throw new Error('build: anchor not unique: ' + from.slice(0, 80)); s = all ? s.split(from).join(to) : s.slice(0, i) + to + s.slice(i + from.length); }
function repRe(re, to) { if (!re.test(s)) throw new Error('build: pattern not found: ' + re); s = s.replace(re, to); }

/* 1. the page's own Content-Security-Policy tag would block the server; the server sends the real policy as a header */
repRe(/<meta http-equiv="Content-Security-Policy"[^>]*>\n?/, '');
/* 2. before anything else: the person's data, then the storage replacement */
rep('<title>Pass-to-Floor (PTF) · Gunda</title>', '<title>Pass-to-Floor (PTF) · Gunda · Server Edition</title>\n<script src="/static/pre.js"></script>');
/* 3. embedded tools (iframes made with srcdoc) share the page's in-memory storage instead of the browser's */
rep("'<scr' + 'ipt>try{parent.totInstallScope&&parent.totInstallScope(window)}catch(e){}</scr' + 'ipt>' + themed",
    "'<scr' + 'ipt>try{Object.defineProperty(window,\"localStorage\",{configurable:true,get:function(){return parent.localStorage}});window.Storage=parent.Storage;parent.totInstallScope&&parent.totInstallScope(window)}catch(e){}</scr' + 'ipt>' + themed");

/* 4. sync with the server: only what changed is sent down (since = the sequence this browser already has) */
rep("body: JSON.stringify(Object.assign({ action: 'pull' }, authBody())) }); var srv = await res.json(); if (srv.error) throw new Error(srv.error);\n        var remote = srv.keys || {}, now = Date.now();",
    "body: JSON.stringify(Object.assign({ action: 'pull', since: window.__ptfSince || 0, site: window.__totSite || '' }, authBody())) }); var srv = await res.json(); if (srv.error) throw new Error(srv.error);\n        var remote = srv.keys || {}, now = Date.now(), delta = !!srv.delta, srvSeq = +srv.seq || 0;");
/* first sync after the page opened: the data came with the page, so record that this browser already matches the server (no false 'changed') */
rep("var meta = jget(MK, {}), meta0 = JSON.parse(JSON.stringify(meta)), prev = {}",
    "var meta = jget(MK, {}); if (!window.__ptfSeeded && window.__PTF_BOOT) { window.__ptfSeeded = true; window.__ptfSince = window.__PTF_BOOT.seq || 0; KEYS.forEach(function (k) { var e = window.__PTF_BOOT.keys[sk(k)], v = localStorage.getItem(k); if (e && typeof e.v === 'string' && v === e.v) meta[k] = { h: hash(v), t: +e.t || 0 }; }); }\n        var meta0 = JSON.parse(JSON.stringify(meta)), prev = {}");
/* a key the server did not send (unchanged there): a local edit is saved on top of the version we last saw */
rep("} else if (lv != null && changed) { push[sk(k)] = { v: lv, t: now, bt: 0 }; meta[k] = { h: lh, t: now }; }",
    "} else if (lv != null && changed) { push[sk(k)] = { v: lv, t: now, bt: delta && m ? (+m.t || 0) : 0 }; meta[k] = { h: lh, t: now }; }");
/* remember the sequence only after the round finished well */
rep("jset(MK, meta); if (again) { say('merging…');", "jset(MK, meta); if (srvSeq) window.__ptfSince = srvSeq; if (again) { say('merging…');");
/* the deleted-items list is sent only when it changed (a delta pull does not carry it) */
rep("if (Object.keys(TB).length && (!remote[sk(TK)] || remote[sk(TK)].v !== tj)) {", "if (Object.keys(TB).length && (delta ? tj !== window.__ptfTk : (!remote[sk(TK)] || remote[sk(TK)].v !== tj))) { window.__ptfTk = tj;");
rep("try { var tj = JSON.stringify(TB);", "try { var tj = JSON.stringify(TB); if (!delta && remote[sk(TK)] && remote[sk(TK)].v === tj) window.__ptfTk = tj;");
/* quicker: a change is sent after 2 s (nothing is kept on the laptop, so it should not wait long); other people's changes arrive by push, the 2-minute poll is only a safety net */
rep("timer = setTimeout(function () { timer = null; sync(false); }, 8000); }, 5000);", "timer = setTimeout(function () { timer = null; sync(false); }, 800); }, 1500);");
rep("setInterval(function () { sync(false); }, 90000);", "setInterval(function () { sync(false); }, 120000);");

rep("window.totSyncNow = function () {", "window.__ptfDirty = function () { try { return busy || dirty(); } catch (e) { return false; } };\n    window.totSyncNow = function () {");

/* 5. no Google Drive connection panel, no access-request panel, no password gate: sign-in is Microsoft's */
rep("var panel = document.querySelectorAll('.adOv')[1], box = panel && panel.querySelector('.adBox');\n    if (box) {\n      box.style.maxHeight", "var panel = null, box = null;\n    if (box) {\n      box.style.maxHeight");
rep("if (box && cfg.url) {\n      var d = document.createElement('details'); d.style.marginTop = '12px';\n      d.innerHTML = '<summary style=\"cursor:pointer;font-weight:600\">👥 Access requests", "if (false) {\n      var d = document.createElement('details'); d.style.marginTop = '12px';\n      d.innerHTML = '<summary style=\"cursor:pointer;font-weight:600\">👥 Access requests");
rep("if (!cfg.url || adm()) return;\n    var auth = null;", "return;   /* server edition: sign-in is done by Microsoft before the page is sent */\n    var auth = null;");
/* browser storage is not used, so its fullness warning does not apply */
rep("if (n > 4200000) a.push('Browser storage on the admin device", "if (false && n > 4200000) a.push('Browser storage on the admin device");

/* 5b. the tool's automatic "rolling backups" copy ALL data into the browser's IndexedDB (and optionally a folder on the laptop): not allowed here. The server keeps the backups. */
rep("var dbp = new Promise(function (res, rej) { if (!window.indexedDB) { rej(); return; }", "var dbp = new Promise(function (res, rej) { if (true) { rej(); return; }");
rep("function snap(why, force) { if (window.__totOut) return Promise.resolve(false);\n  var data = dump()", "function snap(why, force) { if (window.__totOut) return Promise.resolve(false);\n  if (window.TOT_EDITION === 'server') return Promise.resolve(false);   /* nothing is copied to this computer */\n  var data = dump()");

/* 6. wording that was about the laptop */
rep('title="All data is stored in this browser on this computer"><span class="status-dot" style="background:var(--green);box-shadow:0 0 6px var(--green);"></span> Data saved locally</span>', 'title="All data is stored on the company server. Nothing is kept on this computer."><span class="status-dot" style="background:var(--green);box-shadow:0 0 6px var(--green);"></span> Saved on the server</span>');
rep("if (pct >= 60) html += '<div class=\"hs-item warn\"><span>Browser storage</span>", "if (false) html += '<div class=\"hs-item warn\"><span>Browser storage</span>");
/* 6b. Sign out: nothing is kept on the laptop, so signing out = save what is waiting, end the server session (and Microsoft's), and the next person signs in with their own account */
{ const a = s.indexOf('<script id="signOutScript">'), b = s.indexOf('</script>', a); if (a < 0 || b < 0) throw new Error('build: signOutScript not found');
  s = s.slice(0, a) + '<script id="signOutScript">(function(){window.totSignOut=function(){if(window.__totOut)return;if(!confirm("Sign out?\\n\\nYour changes are saved first. The next person can then sign in with their own Microsoft account on this computer."))return;window.__totOut=false;var o=document.createElement("div");o.style.cssText="position:fixed;inset:0;z-index:2147483000;background:#0e1220;color:#e8ecf8;display:flex;align-items:center;justify-content:center;font:18px Arial,sans-serif;text-align:center";o.innerHTML="<div><div style=\\"font-size:42px\\">&#128682;</div><div style=\\"margin-top:8px\\">Saving your changes…</div></div>";document.body.appendChild(o);try{if(window.totSyncNow)window.totSyncNow()}catch(e){}var t0=Date.now();(function w(){var d=false;try{d=window.__ptfDirty&&window.__ptfDirty()}catch(e){}if(d&&Date.now()-t0<10000)return setTimeout(w,300);window.__totOut=true;window.__ptfDirty=function(){return false};location.href="/auth/logout"})()}})();' + s.slice(b);
}
fs.writeFileSync(path.join(out, 'tool.html'), s);
fs.copyFileSync(path.join(root, 'tool', 'PTF-tv.html'), path.join(out, 'tv.html')); fs.copyFileSync(path.join(__dirname, 'shim.js'), path.join(out, 'shim.js')); fs.copyFileSync(path.join(__dirname, 'pre.js'), path.join(out, 'pre.js'));

/* ---------- employee page ---------- */
let e = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
function erep(from, to) { const i = e.indexOf(from); if (i < 0) throw new Error('build(employee): anchor not found: ' + from.slice(0, 80)); e = e.slice(0, i) + to + e.slice(i + from.length); }
erep('<script src="https://accounts.google.com/gsi/client" async defer></script>\n', '');
erep("var SERVER_URL = 'PASTE-YOUR-APPS-SCRIPT-WEB-APP-URL-HERE';", "var SERVER_URL = '/api/employee', CSRF = '';");
erep("function configured(){return /^https:\\/\\/script\\.google\\.com\\/.+\\/exec$/.test(SERVER_URL)}", "function configured(){return true}");
erep("  if(!configured()){err('This page is not set up yet: the Apps Script web app address is missing (SERVER_URL). Ask the tool admin.');}\n  if(!window.google||!google.accounts){return setTimeout(init,200)}\n  google.accounts.id.initialize({client_id:CLIENT_ID,callback:function(r){tok=r.credential;load()},auto_select:false});\n  google.accounts.id.renderButton($('gbtn'),{theme:'outline',size:'large'});\n",
     "  fetch('/api/session',{credentials:'same-origin'}).then(function(r){if(r.status===401){location.href='/auth/login?to=/employee';return null}return r.json()}).then(function(j){if(!j)return;CSRF=j.csrf;tok='sso';load()}).catch(function(){err('Could not reach the server. Please try again.')});\n");
erep("  body.idToken=tok;\n  return fetch(SERVER_URL,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify(body)}).then(function(r){return r.json()});",
     "  return fetch(SERVER_URL,{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json','X-PTF-CSRF':CSRF},body:JSON.stringify(body)}).then(function(r){if(r.status===401||r.status===403)return{error:'sign-in invalid'};return r.json()});");
erep("function signedOut(m){tok=null;", "function signedOut(m){tok=null;if(!DEMO){location.href='/auth/login?to=/employee';return}");
erep('<button onclick="signOut()">Sign out</button>', '<button onclick="location.href=&quot;/auth/logout&quot;">Sign out</button>');
erep("'This Google account is not on the employee list.", "'Your Microsoft account is not on the employee list.");
fs.writeFileSync(path.join(out, 'employee.html'), e);
console.log('public/tool.html ' + Math.round(s.length / 1024) + ' KB, public/employee.html ' + Math.round(e.length / 1024) + ' KB');
