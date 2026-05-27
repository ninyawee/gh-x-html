// Minimal MV3 service worker. Currently a no-op — exists so the extension
// has a stable handle for tooling (Playwright/CDP discover the extension by
// looking up its service workers) and for future cross-context messaging if
// the popup ever needs to talk to content scripts.
//
// Keep this file lightweight. All trust/rewrite logic lives in content.js.

self.addEventListener("install", () => {
  // Skip waiting so updates take effect immediately on reload.
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});
