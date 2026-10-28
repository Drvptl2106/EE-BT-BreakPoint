// The installed app's offline helper (registered by src/chrome.js). It only ever caches this site's OWN files so the app
// opens fast on a weak signal; it never touches the database, so live data is always fresh or clearly "Reconnecting".
//   pages (.html):          network first, the saved copy only when offline, so an update shows up on the next open
//   stamped files (?v=...): saved on first use and reused; a new version has a new address (scripts/stamp.mjs)
//   anything else here:     network first, saved copy when offline
// Older copies of a stamped file are dropped when a new one is saved, so the cache never grows.
const CACHE = 'breakpoint-app';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));

async function networkFirst(req) {
  const cache = await caches.open(CACHE);
  try {
    const res = await fetch(req);
    if (res.ok) await cache.put(req, res.clone());
    return res;
  } catch (err) {
    return (await cache.match(req, { ignoreSearch: req.mode === 'navigate' })) || Promise.reject(err);
  }
}
async function savedFirst(req) {
  const cache = await caches.open(CACHE), hit = await cache.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok) {
    const path = new URL(req.url).pathname;
    for (const old of await cache.keys()) if (new URL(old.url).pathname === path) await cache.delete(old);
    await cache.put(req, res.clone());
  }
  return res;
}

self.addEventListener('fetch', e => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin) return;   // the database and fonts go straight to the network
  e.respondWith(url.searchParams.has('v') ? savedFirst(req) : networkFirst(req));
});
