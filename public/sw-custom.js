// Custom service worker per fix Android PWA
// IMPORTANTE: Il fetch event handler è NECESSARIO per PWA su Android

self.addEventListener('fetch', function(event) {
  // Passa attraverso tutte le richieste normalmente
  // Questo è necessario anche se vuoto per far funzionare la PWA
  event.respondWith(
    fetch(event.request).catch(() => {
      // Fallback per richieste offline se necessario
      return caches.match(event.request);
    })
  );
});

// Fix per click events in PWA
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Attiva immediatamente il service worker
self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});