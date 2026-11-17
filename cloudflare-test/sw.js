self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  if (!event.data) return;
  let reminder;
  try {
    reminder = event.data.json();
  } catch {
    return;
  }
  if (!reminder?.title || !reminder?.body) return;
  event.waitUntil(self.registration.showNotification(reminder.title, {
    body: reminder.body,
    tag: reminder.tag,
    data: { url: self.registration.scope },
  }));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const scope = self.registration.scope;
  const url = event.notification.data?.url || scope;
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const existing = windows.find((client) => client.url.startsWith(scope));
    if (existing) return existing.focus();
    return self.clients.openWindow(url);
  })());
});
