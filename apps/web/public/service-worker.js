/* global self */
/*
 * Sprint 3 intentionally registers only a minimal worker. Realtime delivery
 * comes from an authenticated, open Socket.IO client; browser-closed delivery
 * needs Web Push/VAPID and is explicitly out of scope.
 */
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));
