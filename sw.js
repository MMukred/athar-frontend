/* Athar web app service worker.
 * Keeps the app shell (HTML, CSS, JS, fonts, images) on the device so the
 * installed app opens instantly. API calls always go to the network and are
 * never cached. Bump VERSION on every release so phones pick up new files.
 */
const VERSION = "athar-v2026-11-28b";
const SHELL = [
  "./",
  "index.html",
  "apply.html",
  "manifest.webmanifest",
  "css/apply.css",
  "css/login.css",
  "css/rtl.css",
  "css/style.css",
  "css/theme.css",
  "css/ui.css",
  "js/api.js",
  "js/app.js",
  "js/apply.js",
  "js/auth.js",
  "js/core.js",
  "js/criteria-modal.js",
  "js/icons.js",
  "js/modals.js",
  "js/qr-scanner.js",
  "js/search.js",
  "js/spotlight.js",
  "js/store.js",
  "js/translations.js",
  "js/ui-enhance.js",
  "js/absence-alert.js",
  "js/rsvp.js",
  "js/mobile-nav.js",
  "js/profile-edit.js",
  "js/views/attendance-qr.js",
  "js/views/attendance-scan.js",
  "js/views/audit.js",
  "js/views/certificates.js",
  "js/views/committees.js",
  "js/views/dashboard.js",
  "js/views/evaluations.js",
  "js/views/hours.js",
  "js/views/index.js",
  "js/views/meetings.js",
  "js/views/portal.js",
  "js/views/portal-impact.js",
  "js/views/applications.js",
  "js/views/ideas.js",
  "js/views/certificates-bulk.js",
  "js/views/report-charts.js",
  "js/views/reports.js",
  "js/views/settings.js",
  "js/views/users.js",
  "js/views/volunteers.js",
  "js/views/whatsapp.js",
  "js/utils/diff.js",
  "js/utils/export.js",
  "js/utils/qr-adapter.js",
  "js/utils/qr.js",
  "js/vendor/qrcode.js",
  "assets/brand/logo-horizontal.svg",
  "assets/brand/logo-horizontal-white.svg",
  "assets/brand/logo-vertical-white.svg",
  "assets/brand/geo-white.png",
  "assets/brand/pattern-gold.png",
  "assets/brand/login-photo.jpg",
  "assets/logo.svg",
  "assets/icons/icon-192.png",
  "assets/icons/icon-512.png",
  "assets/icons/apple-touch-icon.png",
  "assets/icons/favicon-32.png",
  "assets/fonts/tajawal/tajawal-arabic-400-normal.woff2",
  "assets/fonts/tajawal/tajawal-arabic-500-normal.woff2",
  "assets/fonts/tajawal/tajawal-arabic-700-normal.woff2",
  "assets/fonts/tajawal/tajawal-arabic-800-normal.woff2",
  "assets/fonts/tajawal/tajawal-latin-400-normal.woff2",
  "assets/fonts/tajawal/tajawal-latin-500-normal.woff2",
  "assets/fonts/tajawal/tajawal-latin-700-normal.woff2",
  "assets/fonts/tajawal/tajawal-latin-800-normal.woff2"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(VERSION).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // API, fonts, WhatsApp: straight to network

  // Pages: network first so a new release shows up, cached copy when offline.
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(VERSION).then((c) => c.put(req, copy));
          return res;
        })
        .catch(() => caches.match(req).then((r) => r || caches.match("index.html")))
    );
    return;
  }

  // Static files: serve from cache, refresh in the background.
  event.respondWith(
    caches.open(VERSION).then((cache) =>
      cache.match(req).then((cached) => {
        const network = fetch(req)
          .then((res) => {
            if (res && res.ok) cache.put(req, res.clone());
            return res;
          })
          .catch(() => cached);
        return cached || network;
      })
    )
  );
});
