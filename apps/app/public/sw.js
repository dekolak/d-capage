// Service worker : met en cache l'app (pas l'API) pour un démarrage rapide sur chantier,
// et affiche les notifications envoyées aux admins (mot de passe oublié…).
const CACHE = 'decapage-v3';
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

// Notification reçue (Web Push) : { titre, texte, url }
self.addEventListener('push', (e) => {
  let n = { titre: 'Nouvelle notification', texte: '', url: '/' };
  try {
    n = { ...n, ...e.data.json() };
  } catch {
    /* charge vide ou illisible */
  }
  e.waitUntil(self.registration.showNotification(n.titre, { body: n.texte, icon: '/icone-192.png', badge: '/icone-192.png', data: { url: n.url } }));
});

// Toucher la notification : ouvre (ou ramène) l'app sur la bonne page.
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const url = new URL(e.notification.data?.url || '/', self.location.origin).href;
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((fenetres) => {
      const f = fenetres.find((c) => c.url.startsWith(self.location.origin));
      if (f) return f.focus().then(() => f.navigate(url));
      return self.clients.openWindow(url);
    }),
  );
});
