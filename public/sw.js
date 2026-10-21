// Service worker: gør det muligt at installere appen på hjemmeskærmen. Henter altid fra nettet (ingen cache).
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', () => {});
