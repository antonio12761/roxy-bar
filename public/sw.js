// Service Worker per Bar Roxy PWA
const CACHE_NAME = 'roxy-bar-v1';
const FIDELITY_CACHE = 'roxy-fidelity-v1';

// URLs da pre-cachare per la fidelity card
const FIDELITY_URLS = [
  '/fidelity',
  '/manifest-fidelity.json',
  '/api/fidelity/card/',
];

self.addEventListener('install', function(event) {
  console.log('[SW] Installing service worker');
  
  event.waitUntil(
    caches.open(FIDELITY_CACHE).then(function(cache) {
      return cache.addAll(FIDELITY_URLS.filter(url => !url.includes('/api/')));
    })
  );
  
  self.skipWaiting();
});

self.addEventListener('activate', function(event) {
  console.log('[SW] Activating service worker');
  
  event.waitUntil(
    caches.keys().then(function(cacheNames) {
      return Promise.all(
        cacheNames.map(function(cacheName) {
          if (cacheName !== CACHE_NAME && cacheName !== FIDELITY_CACHE) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  
  return self.clients.claim();
});

self.addEventListener('fetch', function(event) {
  const url = new URL(event.request.url);
  
  // Gestione speciale per la fidelity card
  if (url.pathname.startsWith('/fidelity') || url.pathname.startsWith('/api/fidelity/')) {
    event.respondWith(
      caches.match(event.request).then(function(response) {
        return response || fetch(event.request).then(function(fetchResponse) {
          // Cache solo le risposte GET per la fidelity
          if (event.request.method === 'GET' && fetchResponse.status === 200) {
            const responseToCache = fetchResponse.clone();
            caches.open(FIDELITY_CACHE).then(function(cache) {
              cache.put(event.request, responseToCache);
            });
          }
          return fetchResponse;
        }).catch(function() {
          // Se offline, mostra una pagina di fallback
          if (url.pathname === '/fidelity') {
            return new Response('Offline - Riconnettiti per vedere la tua carta fedeltà', {
              headers: { 'Content-Type': 'text/html; charset=utf-8' }
            });
          }
        });
      })
    );
    return;
  }
  
  // Per tutte le altre richieste, usa la strategia network-first
  event.respondWith(
    fetch(event.request).catch(function() {
      return caches.match(event.request);
    })
  );
});