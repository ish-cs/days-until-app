const CACHE_NAME = 'daysuntil-cache-v8';

/** Static assets only — never precache HTML. */
const urlsToCache = [
  '/assets/style.css',
  '/assets/favicon.ico',
  '/images/icons/icon-72x72.png',
  '/images/icons/icon-96x96.png',
  '/images/icons/icon-128x128.png',
  '/images/icons/icon-144x144.png',
  '/images/icons/icon-152x152.png',
  '/images/icons/icon-192x192.png',
  '/images/icons/icon-384x384.png',
  '/images/icons/icon-512x512.png'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(urlsToCache))
      .catch((error) => console.error('Failed to cache URLs:', error))
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET' || req.url.includes('/.netlify/functions/')) {
    return;
  }

  const url = new URL(req.url);
  const path = url.pathname;

  // Critical: never serve cached worker/manifest — stale SW keeps broken fetch rules alive.
  if (path === '/sw.js' || path.endsWith('/sw.js') || path === '/manifest.json' || path.endsWith('/manifest.json')) {
    event.respondWith(fetch(req, { cache: 'no-store' }));
    return;
  }

  // SPA shell: network first, bypass HTTP disk cache too (Safari / bfcache edge cases).
  if (req.mode === 'navigate' || req.destination === 'document') {
    event.respondWith(
      fetch(req, { cache: 'no-store' })
        .then((networkResponse) => {
          if (networkResponse.ok) {
            const copy = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(req, copy).catch(() => {});
            });
          }
          return networkResponse;
        })
        .catch(() => caches.match('/index.html'))
    );
    return;
  }

  if (path.includes('/assets/') && (path.endsWith('.js') || path.endsWith('.css'))) {
    event.respondWith(fetch(req, { cache: 'no-store' }));
    return;
  }

  event.respondWith(
    caches.match(req).then((response) => response || fetch(req))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) return caches.delete(cacheName);
        })
      ).then(() => self.clients.claim());
    })
  );
});

self.addEventListener('push', (event) => {
  const data = event.data?.json() ?? {};
  event.waitUntil(
    self.registration.showNotification(data.title ?? 'Days Until', {
      body: data.body ?? '',
      icon: '/images/icons/icon-192x192.png',
      badge: '/images/icons/icon-72x72.png',
      data: { url: data.url ?? '/' },
      tag: data.tag ?? 'daysuntil-push',
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(clients.openWindow(event.notification.data.url));
});
