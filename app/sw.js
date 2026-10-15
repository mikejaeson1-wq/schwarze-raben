"use strict";
const CACHE_PREFIX = "schwarze-raben-admin-shell-";
const CACHE_NAME = CACHE_PREFIX + "v17";
const APP = new URL("./", self.location.href);
// Only public, version-controlled UI files. No API, auth callback or user data.
const ASSETS = [
  "../updates.css?v=a7d7b264d4ce",
  "../future-core.js?v=478216624a05", "../future-profiles.js?v=0d468e487a4f", "../future-planning.js?v=6985657425b3", "../future-chat.js?v=019ab2ce4a84", "../future.css?v=0a9fe8535748", "../spotify-connect.js?v=670050f9e6e1",
  "../next-core.js?v=3aa1687fdb60", "../next-profiles.js?v=5764b1532d34", "../next-community.js?v=a7d7b3e1c1aa", "../next.css?v=674fb157f2b7",
  "offline.html", "app.css?v=efc22394a88d", "install.js?v=0a04c8483701", "mobile.js?v=b5be8eb0cc47", "manifest.webmanifest", "qr.png",
  "icons/icon-180.png", "icons/icon-192.png", "icons/icon-512.png", "icons/icon-maskable-512.png",
  "../style.css?v=e1294113c8cb", "../portal.css?v=160fc595be42", "../config.js?v=a9cc7a500a2e", "../default-content.js?v=92cc7407f7a3", "../app.js?v=d139a854d315",
  "../assets/clan-emblem.svg", "../assets/fonts/fraktur-latin.woff2", "../assets/fonts/medieval-latin.woff2", "../reading.css?v=c90e44f18c2a", "../branding.css?v=3c6c94ccb227", "../branding.js?v=55faf457736a", "../gallery-view.css?v=eac41aa838dc", "../gallery-view.js?v=04918ff3eeb7", "../interactions.js?v=2537b87e72b4", "../profile-design.css?v=2ee5b20de400", "../profile-design.js?v=f555ce9da7fa", "../clan-settings.js?v=a15899dd95a4", "../clan-settings.css?v=b4e10b672c41", "../pictures.js?v=555e656be5a2", "../calendar.js?v=91f509ec7ebb", "../profile-tools.js?v=22d56f609960", "../expansion.js?v=99de58553ea1", "../guide.js?v=f6cbb31a552e", "../backup-tools.js?v=7da2ead93887", "../expansion.css?v=f24dbc42ac06", "../media.js?v=567ba36f34e9", "../identity.js?v=19b12b8d712a", "../profiles.js?v=03266c44e6bc", "../history.js?v=73ff77cd03ce", "../vendor/tus-4.3.1.js?v=8cbb1b63fccc", "../vendor/fflate-0.8.3.js?v=462ef8041fc9",
  "../spotify-player.js?v=a4e940808d79", "../spotify-player.css?v=4bce575d39d5", "../clan-presentation.js?v=33a13056974a", "../clan-presentation.css?v=8e5fe3d63cfc", "../updates.js?v=4d38d3eb5937",
  "../qol.js?v=fe7428c91d80", "../profile-plus.js?v=b4d84a511783", "../calendar-plus.js?v=904f6e399367", "../community-plus.js?v=ef4a225dcd87", "../maps-plus.js?v=38114bd19828", "../discord-channels.js?v=13efe9609494", "../qol.css?v=b0e825a8d433",
  "../admin.js?v=52837e3c8924", "../community.js?v=7e49244dd89e", "../community.css?v=d8d4dd260063", "../effects.js?v=fc9950443d80", "../favicon.svg", "../vendor/supabase-2.117.2.js?v=59d39487c358"
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
