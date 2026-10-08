"use strict";
const CACHE_PREFIX = "schwarze-raben-admin-shell-";
const CACHE_NAME = CACHE_PREFIX + "v10";
const APP = new URL("./", self.location.href);
// Only public, version-controlled UI files. No API, auth callback or user data.
const ASSETS = [
  "offline.html", "app.css?v=efc22394a88d", "install.js?v=0a04c8483701", "mobile.js?v=b5be8eb0cc47", "manifest.webmanifest", "qr.png",
  "icons/icon-180.png", "icons/icon-192.png", "icons/icon-512.png", "icons/icon-maskable-512.png",
  "../style.css?v=e1294113c8cb", "../portal.css?v=160fc595be42", "../config.js?v=a9cc7a500a2e", "../default-content.js?v=92cc7407f7a3", "../app.js?v=10052867750d",
  "../clan-settings.js?v=ca825ca88b7c", "../clan-settings.css?v=b4e10b672c41", "../pictures.js?v=dd0aba0bbb99", "../calendar.js?v=aacd02630866", "../profile-tools.js?v=248a1656f639", "../expansion.js?v=9b7f16640c12", "../guide.js?v=f6cbb31a552e", "../backup-tools.js?v=7da2ead93887", "../expansion.css?v=f24dbc42ac06", "../media.js?v=cea9906cc26d", "../identity.js?v=19b12b8d712a", "../profiles.js?v=368817ac21dc", "../history.js?v=73ff77cd03ce", "../vendor/tus-4.3.1.js?v=8cbb1b63fccc", "../vendor/fflate-0.8.3.js?v=462ef8041fc9",
  "../admin.js?v=517665a05a79", "../community.js?v=25656aa27d88", "../community.css?v=bb6febdeb7a6", "../effects.js?v=fc9950443d80", "../favicon.svg", "../vendor/supabase-2.117.2.js?v=59d39487c358"
].map(path => new URL(path, APP).href);
const STATIC_URLS = new Set(ASSETS);
self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS.map(url => new Request(url, {cache: "reload"})))).then(() => self.skipWaiting()));
});
self.addEventListener("activate", event => {
  event.waitUntil(caches.keys().then(names => Promise.all(names.filter(name => name.startsWith(CACHE_PREFIX) && name !== CACHE_NAME).map(name => caches.delete(name)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== APP.origin || request.headers.has("Authorization")) return;
  if (request.mode === "navigate") {
    // Navigation is never cached, including Discord URLs with a one-time code.
    event.respondWith(fetch(request).catch(() => caches.match(new URL("offline.html", APP).href)));
    return;
  }
  // Only exact public asset URLs, including their known content versions.
  if (!STATIC_URLS.has(url.href)) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    try {
      const response = await fetch(request, {cache: "no-cache"});
      if (response.ok && !response.redirected && response.type === "basic") {
        await cache.put(request, response.clone());
      }
      return response;
    } catch (error) {
      const stored = await cache.match(request);
      if (stored) return stored;
      throw error;
    }
  })());
});
