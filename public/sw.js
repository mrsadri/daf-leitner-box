/*
 * Service worker: shows push reminders and opens the app when one is tapped.
 * It deliberately caches nothing, so every deploy reaches users immediately.
 */

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));

self.addEventListener('push', event => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data ? event.data.text() : '' };
  }
  const title = data.title || 'لایتنر DaF';
  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || '',
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      tag: data.tag || 'daf-reminder',
      lang: data.lang || 'fa',
      dir: data.lang === 'en' ? 'ltr' : 'rtl',
      data: { url: data.url || '/' }
    })
  );
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  // Payloads are data, not authority to navigate away from the app.
  let target = self.location.origin + '/';
  try {
    const raw = event.notification.data && event.notification.data.url;
    const candidate = new URL(typeof raw === 'string' ? raw : '/', self.location.origin);
    if (candidate.origin === self.location.origin && !candidate.username && !candidate.password) target = candidate.href;
  } catch { /* Malformed payloads open the app home. */ }
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(windows => {
      // Reuse an open window of the app if there is one
      for (const client of windows) {
        if (new URL(client.url).origin === self.location.origin && 'focus' in client) {
          return client.navigate(target).then(c => (c || client).focus());
        }
      }
      return self.clients.openWindow(target);
    })
  );
});
