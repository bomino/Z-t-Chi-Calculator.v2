/**
 * Service Worker for the Z-t-Chi Calculator PWA.
 *
 * Strategy:
 *   - App shell (same-origin): cache-first, falls back to network.
 *     Lets the app load instantly and work offline after first visit.
 *   - CDN resources (jStat, MathJax): network-first, falls back to cache.
 *     Honours SRI freshness while still degrading gracefully when offline.
 *   - New deployments: the CACHE_VERSION bump at top invalidates the old
 *     cache on activation.
 */
'use strict';

const CACHE_VERSION = 'ztchi-v17';

const APP_SHELL = [
  './',
  './index.html',
  './z_calculator.html',
  './t_calculator.html',
  './chi_square.html',
  './compare.html',
  './simulate.html',
  './epidemiology.html',
  './corrections.html',
  './datasets.html',
  './assumption.html',
  './guide.html',
  './notation.html',
  './error-traps.html',
  './instructor.html',
  './styles.css',
  './manifest.webmanifest',
  './icon.svg',
  './js/common.js',
  './js/state.js',
  './js/backend.js',
  './js/layout.js',
  './js/theme.js',
  './js/reports.js',
  './js/predict.js',
  './js/checks.js',
  './js/show-work.js',
  './js/three-level.js',
  './js/ai-interpret.js',
  './js/instructor.js',
  './js/instructor-builder.js',
  './js/problem-overlay.js',
  './js/z_calculator.js',
  './js/t_calculator.js',
  './js/chi_square.js',
  './js/compare.js',
  './js/simulate.js',
  './js/epidemiology.js',
  './js/corrections.js',
  './js/datasets.js',
  './js/assumption.js',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) =>
      // Use reloaded fetches so SRI'd HTML references match freshly
      cache.addAll(APP_SHELL.map((u) => new Request(u, { cache: 'reload' })))
    ).catch(() => { /* swallow install failures; next visit retries */ })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(names.filter((n) => n !== CACHE_VERSION).map((n) => caches.delete(n)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  if (url.origin === self.location.origin) {
    // Same-origin: cache-first, network fallback, then write-through.
    event.respondWith(
      caches.match(req).then((cached) => {
        if (cached) return cached;
        return fetch(req).then((res) => {
          if (res && res.status === 200 && res.type === 'basic') {
            const copy = res.clone();
            caches.open(CACHE_VERSION).then((cache) => cache.put(req, copy));
          }
          return res;
        }).catch(() => caches.match('./index.html'));
      })
    );
    return;
  }

  // CDN (jStat, MathJax): network-first, fall back to cache if offline.
  event.respondWith(
    fetch(req).then((res) => {
      if (res && res.status === 200) {
        const copy = res.clone();
        caches.open(CACHE_VERSION).then((cache) => cache.put(req, copy));
      }
      return res;
    }).catch(() => caches.match(req))
  );
});
