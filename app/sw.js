"use strict";
const CACHE_PREFIX = "schwarze-raben-admin-shell-";
const CACHE_NAME = CACHE_PREFIX + "v14";
const APP = new URL("./", self.location.href);
// Only public, version-controlled UI files. No API, auth callback or user data.
const ASSETS = [
  "offline.html", "app.css?v=efc22394a88d", "install.js?v=0a04c8483701", "mobile.js?v=b5be8eb0cc47", "manifest.webmanifest", "qr.png",
  "icons/icon-180.png", "icons/icon-192.png", "icons/icon-512.png", "icons/icon-maskable-512.png",
  "../style.css?v=e1294113c8cb", "../portal.css?v=160fc595be42", "../config.js?v=a9cc7a500a2e", "../default-content.js?v=92cc7407f7a3", "../app.js?v=10052867750d",
  "../assets/clan-emblem.svg", "../assets/fonts/fraktur-latin.woff2", "../assets/fonts/medieval-latin.woff2", "../reading.css?v=c90e44f18c2a", "../branding.css?v=3c6c94ccb227", "../branding.js?v=55faf457736a", "../gallery-view.css?v=eac41aa838dc", "../gallery-view.js?v=20bd9b055a47", "../interactions.js?v=2537b87e72b4", "../profile-design.css?v=2ee5b20de400", "../profile-design.js?v=76756e8303af", "../clan-settings.js?v=a15899dd95a4", "../clan-settings.css?v=b4e10b672c41", "../pictures.js?v=dd0aba0bbb99", "../calendar.js?v=34cb65bcc8d3", "../profile-tools.js?v=0998cc44ca56", "../expansion.js?v=6041705e56f1", "../guide.js?v=f6cbb31a552e", "../backup-tools.js?v=7da2ead93887", "../expansion.css?v=f24dbc42ac06", "../media.js?v=567ba36f34e9", "../identity.js?v=19b12b8d712a", "../profiles.js?v=a5f66a0e8452", "../history.js?v=73ff77cd03ce", "../vendor/tus-4.3.1.js?v=8cbb1b63fccc", "../vendor/fflate-0.8.3.js?v=462ef8041fc9",
  "../spotify-player.js?v=36a5a38067ea", "../spotify-player.css?v=4bce575d39d5", "../clan-presentation.js?v=903992cff1fc", "../clan-presentation.css?v=8e5fe3d63cfc", "../updates.js?v=35318a66e333",
  "../qol.js?v=7e3587dedbc4", "../profile-plus.js?v=251856cfa8a7", "../calendar-plus.js?v=182e8831c9a0", "../community-plus.js?v=6a076d7c8f4c", "../maps-plus.js?v=38114bd19828", "../discord-channels.js?v=13efe9609494", "../qol.css?v=b0e825a8d433",
  "../admin.js?v=52837e3c8924", "../community.js?v=50740ab837d6", "../community.css?v=d8d4dd260063", "../effects.js?v=fc9950443d80", "../favicon.svg", "../vendor/supabase-2.117.2.js?v=59d39487c358"
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
