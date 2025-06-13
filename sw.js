const CACHE_NAME = 'daysuntil-cache-v1';
const urlsToCache = [
  '/',
  '/index.html',
  '/timer.html', // Added the timer page to cache
  '/assets/style.css', // Corrected path based on your HTML
  '/app.js',   // Your main JavaScript file
  // Add all static assets your app needs to function offline
  // Include all icon paths from your manifest.json
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
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Opened cache');
        // Ensure all resources in urlsToCache are available for caching.
        // If any fail, the service worker installation will fail.
        return cache.addAll(urlsToCache);
      })
      .catch(error => {
        console.error('Failed to cache URLs:', error);
      })
  );
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        // Cache hit - return response
        if (response) {
          return response;
        }
        return fetch(event.request);
      })
  );
});

self.addEventListener('activate', (event) => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});