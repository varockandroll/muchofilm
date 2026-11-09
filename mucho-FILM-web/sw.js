/**
 * mucho FILM — Service Worker para iPadOS y macOS PWA
 * Caching inteligente para modo autónomo y soporte sin conexión
 */

const CACHE_NAME = 'mucho-film-red-v5';

const CORE_ASSETS = [
  './',
  'index.html',
  'styles.css',
  'manifest.json',
  'assets/icons/icon-192.png',
  'assets/icons/icon-512.png',
  'assets/icons/apple-touch-icon.png',
  'assets/logo-mucho-film.svg',
  'assets/logo-mucho-film-red.svg',
  'js/tiff-codec.js',
  'js/shaders.js',
  'js/analog-assets.js',
  'js/frames.js',
  'js/carousel.js',
  'js/qrcode.js',
  'js/app.js'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(CORE_ASSETS).catch((err) => {
        console.warn('[SW] Algunos recursos no pudieron precachearse:', err);
      });
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Los endpoints API van siempre a la red
  if (url.pathname.startsWith('/api/')) {
    return;
  }

  // Estrategia Network-First con fallback a Caché para tener siempre la última versión
  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200 && event.request.method === 'GET') {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return networkResponse;
      })
      .catch(() => {
        return caches.match(event.request).then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }
          if (event.request.headers.get('accept')?.includes('text/html')) {
            return caches.match('index.html');
          }
        });
      })
  );
});
