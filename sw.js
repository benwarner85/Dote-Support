// This service worker intentionally removes itself.
// It clears all caches, unregisters, and then reloads open pages.

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    // Clear all caches
    const keys = await caches.keys();
    await Promise.all(keys.map(k => caches.delete(k)));

    // Unregister this service worker
    await self.registration.unregister();

    // Reload any open clients so they come back without SW control
    const clients = await self.clients.matchAll({ type: "window" });
    clients.forEach(c => c.navigate(c.url));
  })());
});

// Pass-through fetch (shouldn't be used much before unregister completes)
self.addEventListener("fetch", () => {});
