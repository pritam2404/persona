// Simple service worker: app ko offline chalne deta hai (phone pe install ke baad bhi).
// Strategy: network pehle, fail ho to cache se. Data localStorage mein hai, yahan nahi.
const CACHE = 'persona-v3';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  // Sirf app ki apni files. Voice model (HuggingFace, ~60 MB) aur CDN files ko mat chhuo -
  // voice model library khud browser storage (OPFS) mein rakhti hai; dobara cache = double jagah.
  if (new URL(event.request.url).origin !== self.location.origin) return;
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
