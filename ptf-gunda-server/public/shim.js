/* Pass to the Floor · Gunda · Server Edition: browser side.
   Loaded before the tool's own scripts. It (1) replaces the browser's storage by memory that the server fills, so nothing is kept on the laptop,
   (2) tells the tool who is signed in (from the Microsoft sign-in, not a password), (3) adds the CSRF header to every request and
   (4) listens for "something changed" from the server so other people's updates arrive within a second or two. */
(function () {
  'use strict';
  var B = window.__PTF_BOOT; if (!B) return;
  window.TOT_EDITION = 'server';
  var mem = Object.create(null);
  function S() {}
  S.prototype.getItem = function (k) { k = String(k); return k in mem ? mem[k] : null; };
  S.prototype.setItem = function (k, v) { mem[String(k)] = String(v); };
  S.prototype.removeItem = function (k) { delete mem[String(k)]; };
  S.prototype.key = function (i) { var a = Object.keys(mem); return i >= 0 && i < a.length ? a[i] : null; };
  S.prototype.clear = function () { mem = Object.create(null); };
  Object.defineProperty(S.prototype, 'length', { configurable: true, get: function () { return Object.keys(mem).length; } });
  window.Storage = S;
  var ls = new S();
  try { Object.defineProperty(window, 'localStorage', { configurable: true, get: function () { return ls; } }); } catch (e) { window.localStorage = ls; }

  /* seed: server key  "name"  -> storage "name";  "s~site~name" -> "SITE::site::name"  (the tool's own per-site layout) */
  Object.keys(B.keys || {}).forEach(function (k) {
    var e = B.keys[k]; if (!e || typeof e.v !== 'string') return;
    var m = /^s~([a-z0-9-]{1,30})~(.+)$/.exec(k); mem[m ? 'SITE::' + m[1] + '::' + m[2] : k] = e.v;
  });
  var PK = ['totAppTheme', 'totAppStyle', 'totSoundPrefs', 'totMusicPrefs', 'totConsentV1', 'totLastSite', 'rememberSupervisor', 'supFirstName'], pst = null;
  Object.keys(B.prefs || {}).forEach(function (k) { if (PK.indexOf(k) >= 0 && typeof B.prefs[k] === 'string') mem[k] = B.prefs[k]; });
  function savePrefs() { clearTimeout(pst); pst = setTimeout(function () { var o = {}; PK.forEach(function (k) { if (k in mem) o[k] = mem[k]; }); try { window.fetch('/api/prefs', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ prefs: o }) }); } catch (e) {} }, 1500); }
  var rawSet = S.prototype.setItem, rawRem = S.prototype.removeItem;
  S.prototype.setItem = function (k, v) { rawSet.call(this, k, v); if (PK.indexOf(String(k)) >= 0 && this === ls) savePrefs(); };
  S.prototype.removeItem = function (k) { rawRem.call(this, k); if (PK.indexOf(String(k)) >= 0 && this === ls) savePrefs(); };
  var u = B.user || {};
  mem.totSyncCfg = JSON.stringify(u.admin ? { url: '/api/rpc', key: 'sso' } : { url: '/api/rpc' });
  mem.totAuth = JSON.stringify({ email: u.email, pwHash: 'sso', t: Date.now() });
  if (u.role && !u.admin) mem.totTrainerRole = u.role;
  if (u.name && !mem.totTrainerDisplayName) mem.totTrainerDisplayName = u.name;
  try { if (u.admin) sessionStorage.setItem('totAdmin', '1'); else sessionStorage.removeItem('totAdmin'); } catch (e) {}
  window.__ptfSeq = B.seq || 0;

  /* every same-origin request carries the CSRF header; a signed-out answer sends the person to sign in again */
  var F = window.fetch;
  window.fetch = function (input, init) {
    try {
      var url = String(input && input.url || input), same = url.charAt(0) === '/' && url.charAt(1) !== '/';
      if (same) { init = Object.assign({}, init || {}); init.headers = Object.assign({}, init.headers || {}, { 'X-PTF-CSRF': B.csrf }); init.credentials = 'same-origin';
        return F.call(this, input, init).then(function (r) { if (r.status === 401) { location.href = '/auth/login?to=' + encodeURIComponent(location.pathname); } return r; }); }
    } catch (e) {}
    return F.apply(this, arguments);
  };

  /* push: the server says "seq N" when anything is saved by anyone; ask the sync to run */
  window.__ptfLive = function () {
    try {
      var es = new EventSource('/api/events'); var last = window.__ptfSeq || 0;
      /* spread the answers of many people over a few seconds, and never pull more often than every 4 s because of live notices */
      var wait = null, lastRun = 0;
      es.onmessage = function (ev) { try { var s = JSON.parse(ev.data).seq; if (s > last) { last = s; if (wait) return; var d = Math.max(Math.random() * 1500, lastRun + 4000 - Date.now()); wait = setTimeout(function () { wait = null; lastRun = Date.now(); if (window.totSyncNow) window.totSyncNow(); }, d); } } catch (e) {} };
    } catch (e) {}
  };
  window.addEventListener('load', function () { setTimeout(window.__ptfLive, 1500); });
  /* unsent edits: ask before the tab is closed, and send them as soon as the tab is hidden */
  window.addEventListener('beforeunload', function (e) { try { if (window.__ptfDirty && window.__ptfDirty()) { e.preventDefault(); e.returnValue = ''; return ''; } } catch (x) {} });
  document.addEventListener('visibilitychange', function () { if (document.hidden && window.totSyncNow) window.totSyncNow(); });
})();
