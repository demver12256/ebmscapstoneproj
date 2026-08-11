const CACHE_NAME = 'ebms-pwa-v1';
const ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
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

