/**
 * Service Worker for Board Controller PWA
 *
 * Caches static assets for offline use and handles network requests.
 */

const CACHE_NAME = 'board-controller-v1';
const STATIC_ASSETS = [
  '/controller/',
  '/controller/index.html',
  '/controller/style.css',
  '/controller/app.js',
  '/controller/manifest.json'
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((name) => name !== CACHE_NAME)
            .map((name) => caches.delete(name))
        );
      })
      .then(() => self.clients.claim())
  );
});

// Fetch event - network first, fallback to cache for static assets
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // API requests - network only (don't cache)
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(fetch(event.request));
    return;
  }

  // Static assets - network first with cache fallback
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Clone response to cache it
        if (response.ok && event.request.method === 'GET') {
          const responseClone = response.clone();
          caches.open(CACHE_NAME)
            .then((cache) => cache.put(event.request, responseClone));
        }
        return response;
      })
      .catch(() => {
        // Network failed, try cache
        return caches.match(event.request);
      })
  );
});
