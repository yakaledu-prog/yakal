/* eslint-env serviceworker */
// The push half of the service worker.
//
// vite-plugin-pwa runs in generateSW mode, which writes sw.js from the Workbox
// config and leaves no room for handlers of our own. workbox.importScripts
// pulls this in, so the generated caching stays generated and this stays
// readable. injectManifest would be the other way round: our whole service
// worker, with the caching strategy copied into it by hand.
//
// Nothing here is bundled, so it is plain ES2020 with no imports.

// What a push carries. The sender puts the notification's own title and line
// in it, so this does no rendering: a service worker that had to know how to
// word a notification would be a third place that knows, after the app and the
// email.
self.addEventListener('push', (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    // A push with a body we cannot parse still means something happened.
    payload = {};
  }

  const title = payload.title || 'Yakal';
  const options = {
    body: payload.body || '',
    icon: '/icons/icon-192.png',
    // Android shows this small and monochrome in the status bar.
    badge: '/icons/badge-72.png',
    // Only when the sender says two notifications are about the same thing.
    //
    // This used to fall back to a fixed 'yakal', which made every untagged
    // notification replace the previous one: two lessons booked showed one
    // notification. Collapsing is lossy and stacking is only untidy, so
    // nothing collapses unless it was asked for.
    ...(payload.tag ? { tag: payload.tag, renotify: true } : {}),
    data: { url: payload.url || '/' },
    // No requireInteraction. A notification that will not go away until it is
    // dismissed is for alarms, and none of these are.
  };

  // waitUntil, or the worker can be killed before the notification is shown.
  event.waitUntil(self.registration.showNotification(title, options));
});

// Opening one focuses the tab that is already there rather than launching a
// second copy of the app.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
      for (const client of windows) {
        // Same origin is all that can be checked: the URL of a client is the
        // page it is on, which is rarely the page being opened.
        if ('focus' in client && 'navigate' in client) {
          return client.focus().then((c) => c.navigate(target));
        }
      }
      return self.clients.openWindow(target);
    })
  );
});

// A subscription can be rotated by the browser without anybody asking. Left
// alone, the old endpoint starts returning 410 and the device silently stops
// receiving anything. Telling the app lets it re-register.
self.addEventListener('pushsubscriptionchange', (event) => {
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
      for (const client of windows) client.postMessage({ type: 'push-subscription-changed' });
    })
  );
});
