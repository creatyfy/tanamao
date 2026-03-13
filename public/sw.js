// Service Worker básico para PWA e preparação para Web Push

const CACHE_NAME = 'ta-na-mao-v1';

self.addEventListener('install', (event) => {
  self.skipWaiting();
  console.log('[Service Worker] Instalado');
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
  console.log('[Service Worker] Ativado');
});

// Intercepta requisições (pode ser expandido para cache offline no futuro)
self.addEventListener('fetch', (event) => {
  // Pass-through básico
  return;
});

// Ouvinte para notificações Web Push em segundo plano (App Fechado)
// Requer servidor de Push (VAPID) para disparar
self.addEventListener('push', function(event) {
  if (event.data) {
    try {
      const data = event.data.json();
      const options = {
        body: data.body,
        icon: data.icon || 'https://images.unsplash.com/photo-1571091718767-18b5b1457add?w=192&h=192&fit=crop',
        badge: data.badge || 'https://images.unsplash.com/photo-1571091718767-18b5b1457add?w=96&h=96&fit=crop',
        vibrate: [200, 100, 200, 100, 200],
        data: {
          url: data.url || '/'
        }
      };
      
      event.waitUntil(
        self.registration.showNotification(data.title, options)
      );
    } catch (e) {
      console.error('[Service Worker] Erro ao processar push data:', e);
    }
  }
});

// Ação ao clicar na notificação
self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList) {
      // Se já houver uma janela aberta, foca nela
      for (let i = 0; i < clientList.length; i++) {
        let client = clientList[i];
        if (client.url === '/' && 'focus' in client) {
          return client.focus();
        }
      }
      // Caso contrário, abre uma nova janela
      if (clients.openWindow) {
        return clients.openWindow(event.notification.data.url || '/');
      }
    })
  );
});
