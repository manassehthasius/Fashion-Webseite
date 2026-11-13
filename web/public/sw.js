// Stilkompass Service Worker: Offline-Cache und Web-Push-Benachrichtigungen.
const VERSION = 'sk-v2';
const SHELL = ['./', './index.html', './manifest.webmanifest', './icon.svg', './icon-192.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).catch(() => {}));
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

async function networkFirst(req) {
  const cache = await caches.open(VERSION);
  try {
    const res = await fetch(req);
    if (res.ok) cache.put(req, res.clone());
    return res;
  } catch (err) {
    const hit = await cache.match(req, { ignoreSearch: true });
    if (hit) return hit;
    throw err;
  }
}

async function cacheFirst(req) {
  const cache = await caches.open(VERSION);
  const hit = await cache.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok) cache.put(req, res.clone());
  return res;
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return; // Bilder & Modelle: Browser-Cache bzw. Transformers.js-Cache
  if (url.pathname.includes('/api/')) return;
  if (url.pathname.includes('/assets/') || url.pathname.includes('/ort/')) return e.respondWith(cacheFirst(req));
  if (req.mode === 'navigate' || url.pathname.endsWith('.json') || url.pathname.endsWith('.bin') || url.pathname.endsWith('/') || url.pathname.endsWith('.html')) return e.respondWith(networkFirst(req));
});

self.addEventListener('push', (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch { d = { title: 'Stilkompass', body: e.data ? e.data.text() : '' }; }
  const title = d.title || 'Stilkompass';
  e.waitUntil(
    self.registration.showNotification(title, {
      body: d.body || '',
      icon: d.icon || './icon-192.png',
      badge: './icon-192.png',
      image: d.image,
      tag: d.tag || undefined,
      renotify: !!d.tag,
      data: { url: d.url || './#/alarme' },
    }),
  );
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const target = new URL(e.notification.data?.url || './#/alarme', self.registration.scope).href;
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const c of list) {
        if (c.url.startsWith(self.registration.scope) && 'focus' in c) {
          c.navigate(target).catch(() => {});
          return c.focus();
        }
      }
      return self.clients.openWindow(target);
    }),
  );
});
