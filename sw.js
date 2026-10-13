/* My work page: service worker. It only makes the page itself (the shell) and the icons available without a connection.
   It never stores data: the API is never cached here (what the person chose to keep for offline use is kept by the page, and removed when they sign out). */
const V = 'ptf-emp-v1', SHELL = new Request(self.registration.scope + '__shell');
self.addEventListener('install', (e) => { e.waitUntil(self.skipWaiting()); });
self.addEventListener('activate', (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== V).map((k) => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', (e) => {
  const r = e.request, u = new URL(r.url);
  if (r.method !== 'GET' || u.origin !== location.origin || /\/api\//.test(u.pathname) || /\/auth\//.test(u.pathname)) return;   /* the API, sign-in and other sites go straight to the network */
  if (r.mode === 'navigate') {   /* the page: network first, the last good copy when there is no connection */
    e.respondWith(fetch(r).then((res) => { if (res.status === 200 && res.type === 'basic' && !res.redirected) { const c = res.clone(); caches.open(V).then((ch) => ch.put(SHELL, c)); } return res; })
      .catch(() => caches.open(V).then((ch) => ch.match(SHELL)).then((m) => m || new Response('<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Offline</title><body style="font:16px system-ui;padding:24px"><h2>You are offline</h2><p>Open this page once with a connection, then it can be opened here without one.</p>', { headers: { 'Content-Type': 'text/html; charset=utf-8' } }))));
    return;
  }
  if (/\.(png|webmanifest|svg)$/.test(u.pathname)) e.respondWith(caches.open(V).then((ch) => ch.match(r).then((m) => m || fetch(r).then((res) => { if (res.ok) ch.put(r, res.clone()); return res; }))));
});
