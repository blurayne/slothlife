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

const CACHE = 'slothlife-v2';

self.addEventListener('install', (event) => {
  // Take over from any older worker immediately.
  self.skipWaiting();
});

// Page → SW message channel: SKIP_WAITING (newly-installed worker
// finishes activation early) and CLEAR_CACHE (page-triggered refresh
// asks the SW to drop every Cache Storage entry it owns).
self.addEventListener('message', (event) => {
  const msg = event.data || {};
  if (msg.type === 'SKIP_WAITING') {
    self.skipWaiting();
    return;
  }
  if (msg.type === 'CLEAR_CACHE') {
    event.waitUntil((async () => {
      const names = await caches.keys();
      await Promise.all(names.map((n) => caches.delete(n)));
      if (event.ports && event.ports[0]) {
        event.ports[0].postMessage({ type: 'CACHE_CLEARED' });
      }
    })());
  }
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

  // version.js + backend-config.js — same network-first treatment as
  // HTML so the panel header (and the diagnostic <meta name="app-
  // version">) and the runtime CONVEX_URL never reflect stale build
  // info even if the cache-bust query is missing or the browser
  // somehow lands on a cached entry from an older deploy.
  if (url.pathname.endsWith('/assets/version.js') ||
      url.pathname.endsWith('/assets/backend-config.js')) {
    event.respondWith((async () => {
      try {
        const fresh = await fetch(req, { cache: 'no-store' });
        const copy = fresh.clone();
        caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
        return fresh;
      } catch (e) {
        const cached = await caches.match(req);
        if (cached) return cached;
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
