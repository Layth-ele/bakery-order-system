/*
 * Push notifications — loaded into the app's service worker (vite.config.ts
 * workbox.importScripts), so the home-screen app on iPhone/Android receives
 * them even when closed.
 *
 * The server (functions/src/pushNotifications.ts) sends data-only Firebase
 * Cloud Messaging messages: { title, body, url, tag, badge }. Every push shows
 * a notification (iOS requires that) and sets the app-icon badge to the
 * number of unread notifications.
 */
self.addEventListener('push', (event) => {
  let data = {};
  try {
    const json = event.data ? event.data.json() : {};
    data = json.data || json;
  } catch (_) {
    data = { body: event.data ? event.data.text() : '' };
  }
  const title = data.title || 'Delight Bakehouse';
  const badge = Number(data.badge);
  const nav = self.navigator;
  const setBadge =
    nav && 'setAppBadge' in nav && Number.isFinite(badge)
      ? (badge > 0 ? nav.setAppBadge(badge) : nav.clearAppBadge()).catch(() => {})
      : Promise.resolve();
  event.waitUntil(
    Promise.all([
      self.registration.showNotification(title, {
        body: data.body || '',
        icon: '/pwa-192x192.png',
        badge: '/pwa-64x64.png',
        tag: data.tag || undefined,
        data: { url: data.url || '/' },
      }),
      setBadge,
    ])
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
      for (const w of windows) {
        if ('focus' in w) {
          if ('navigate' in w && !w.url.endsWith(url)) w.navigate(url).catch(() => {});
          return w.focus();
        }
      }
      return self.clients.openWindow(url);
    })
  );
});
