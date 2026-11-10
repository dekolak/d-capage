// Service worker minimal : met en cache l'app (pas l'API) pour un démarrage rapide sur chantier.
const CACHE = 'decapage-v2';
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(['/', '/icone.svg', '/espaces/kiavik/icone.svg'])));
  self.skipWaiting();
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))));
  self.clients.claim();
});
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.pathname.startsWith('/api/')) return;
  // Réseau d'abord, cache en secours (hors ligne).
  e.respondWith(
    fetch(e.request)
      .then((r) => {
        const copie = r.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copie));
        return r;
      })
      .catch(() => caches.match(e.request).then((r) => r || caches.match('/'))),
  );
});
