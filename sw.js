// App-update service worker (Classroom-survivors)
// Goal: defeat stale caches on devices that pin index.html/JS — especially
// iOS/Android home-screen "PWA" shortcuts that ignore Cache-Control: max-age.
//
// Strategy:
//  - Intercept every same-origin navigation + asset request and force a
//    network fetch with `cache: 'no-cache'` (revalidate each load). This makes
//    GitHub Pages' max-age irrelevant for these clients and guarantees the
//    newest HTML/JS/CSS is used.
//  - Activate immediately (skipWaiting + clients.claim) so a new sw.js takes
//    effect on the very next load, not after the next close.
//  - The SW file itself is registered with ?v=<APP_VERSION>, so a version bump
//    in index.html forces the browser to fetch and install the new worker.
//
// Note: media (images/audio/speech models) are NOT loaded via <script> tags
// and are fetched at runtime by the game; this worker applies the same
// no-cache revalidation to them too, which only costs a conditional 304 when
// they are unchanged — it does NOT force a full re-download of those large
// assets on every page view (the server still serves 304 + cached bytes).

const CACHE = 'cs-app-' + (self.registration ? '' : '');

self.addEventListener('install', () => {
  // Take over open pages immediately.
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Only handle GET requests for our own origin (the game assets).
  if (req.method !== 'GET') return;
  if (url.origin !== self.location.origin) return;

  // Bypass the HTTP cache entirely: revalidate from the network every time.
  // The browser still honors 304 Not-Modified, so unchanged files are cheap.
  event.respondWith(
    fetch(req, { cache: 'no-cache', redirect: 'follow' })
      .catch(() => {
        // If offline, fall back to whatever the browser has (best effort).
        return fetch(req);
      })
  );
});
