/**
 * sw-push.js — importado pelo service worker gerado pelo Workbox (vite.config.ts).
 *
 * Recebe eventos Push enviados pela Edge Function sla-push-critico e exibe
 * notificações nativas ao usuário (inclusive com o app fechado/em background).
 *
 * Payload esperado (JSON):
 *   { title: string, body: string, tag?: string, url?: string }
 */

/* eslint-disable no-restricted-globals */

self.addEventListener('push', function (event) {
  if (!event.data) return;

  let data = {};
  try {
    data = event.data.json();
  } catch {
    data = { title: 'SentinelaWeb', body: event.data.text() };
  }

  const title = data.title || 'SentinelaWeb';
  const options = {
    body: data.body || '',
    icon: '/pwa-icon-192.png',
    badge: '/pwa-icon-192.png',
    tag: data.tag || 'sentinela-sla',
    data: { url: data.url || '/' },
    requireInteraction: true, // mantém visível até o usuário interagir
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', function (event) {
  event.notification.close();
  const url = event.notification.data?.url || '/';
  event.waitUntil(
    clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then(function (windowClients) {
        // Foca janela existente se já estiver aberta
        for (const client of windowClients) {
          if (client.url === url && 'focus' in client) {
            return client.focus();
          }
        }
        // Caso contrário abre nova aba
        if (clients.openWindow) return clients.openWindow(url);
      })
  );
});
