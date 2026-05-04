// Service worker — network-first for HTML so a fresh deploy is picked
// up on every navigation, cache-first for everything else (CSS / JS /
// MP3 are already cache-busted via ?v=<SHA> so the cache key naturally
// rotates per deploy).
//
// Lives at the repo root so its default scope is the whole Pages site
// (/slothlife/ on github.io). Registered from assets/main.js.
//
// To upgrade: bump CACHE below; the activate step deletes any cache
// that doesn't match the current name. skipWaiting/clients.claim mean
// a freshly-installed worker takes over immediately instead of waiting
// for every tab to close.

const CACHE = 'slothlife-v1';

self.addEventListener('install', (event) => {
  // Take over from any older worker immediately.
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(
      names.filter((n) => n !== CACHE).map((n) => caches.delete(n))
    );
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  let url;
  try { url = new URL(req.url); } catch (_) { return; }
  if (url.origin !== self.location.origin) return;

  // HTML / navigation requests: network-first. The browser always sees
  // the freshest deployed index.html; the cache is only used if the
  // network fails (e.g. offline).
  const isHTML =
    req.mode === 'navigate' ||
    (req.headers.get('accept') || '').includes('text/html');

  if (isHTML) {
    event.respondWith((async () => {
      try {
        const fresh = await fetch(req, { cache: 'no-store' });
        const copy = fresh.clone();
        caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
        return fresh;
      } catch (e) {
        const cached = await caches.match(req);
        if (cached) return cached;
        const root = await caches.match('./');
        if (root) return root;
        throw e;
      }
    })());
    return;
  }

  // Everything else: cache-first. Asset URLs already carry ?v=<SHA>
  // (sed-substituted by .github/workflows/deploy-pages.yml) so a new
  // deploy never reuses an old cache key.
  event.respondWith((async () => {
    const cached = await caches.match(req);
    if (cached) return cached;
    const fresh = await fetch(req);
    if (fresh && fresh.ok) {
      const copy = fresh.clone();
      caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
    }
    return fresh;
  })());
});
