// Simple service worker: app ko offline chalne deta hai (phone pe install ke baad bhi).
// Strategy: network pehle, fail ho to cache se. Data localStorage mein hai, yahan nahi.
const CACHE = 'persona-v2';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    fetch(event.request)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(event.request, copy));
        return res;
      })
      .catch(() => caches.match(event.request))
  );
});
