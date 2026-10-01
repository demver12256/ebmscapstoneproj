const CACHE_NAME = 'beniaid-pwa-v3';
const ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/dswd-logo.jpg',
  '/icons/dswd-logo-192.png',
  '/icons/dswd-logo-512.png',
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS);
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((cacheName) => cacheName !== CACHE_NAME)
          .map((cacheName) => caches.delete(cacheName))
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  // Only handle GET requests
  if (event.request.method !== 'GET') return;

  // Only handle http and https requests (ignore chrome-extension://, etc.)
  if (!event.request.url.startsWith('http')) return;

  // Bypass service worker caching for API calls
  if (event.request.url.includes('/api/')) return;

  // Always check the network for the app shell so phones receive the latest build.
  // Keep the cached shell as an offline fallback.
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((networkResponse) => {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put('/index.html', responseToCache));
          return networkResponse;
        })
        .catch(() => caches.match('/index.html'))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }

      return fetch(event.request).catch((error) => {
        // If navigation request fails (e.g. offline), fallback to index.html
        if (event.request.mode === 'navigate') {
          return caches.match('/index.html');
        }
        console.warn('Service worker network fetch failed for:', event.request.url);
        return new Response('Network error', {
          status: 408,
          headers: { 'Content-Type': 'text/plain' },
        });
      });
    })
  );
});

