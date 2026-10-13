/* Runs first. Works out which location this tab is on, then loads that location's data and the storage replacement, in that order. */
(function () {
  var s = ''; try { var h = location.hash; s = h.indexOf('#site=') === 0 ? h.slice(6) : (sessionStorage.getItem('totSite') || ''); } catch (e) {}
  s = String(s).replace(/[^a-z0-9-]/g, '').slice(0, 30);
  document.write('<script src="/api/boot.js?site=' + s + '"><\/script><script src="/static/shim.js"><\/script>');
})();
