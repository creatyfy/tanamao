import { useState, useEffect } from 'react';

export function usePushNotifications() {
  const [permission, setPermission] = useState<NotificationPermission>('default');

  useEffect(() => {
    if ('Notification' in window) {
      setPermission(Notification.permission);
    }
  }, []);

  const requestPermission = async () => {
    if (!('Notification' in window)) {
      console.warn('Este navegador não suporta notificações desktop/mobile.');
      return false;
    }
    try {
      const perm = await Notification.requestPermission();
      setPermission(perm);
      return perm === 'granted';
    } catch (error) {
      console.error('Erro ao solicitar permissão de notificação:', error);
      return false;
    }
  };

  const sendNotification = (title: string, options?: NotificationOptions) => {
    if ('Notification' in window && Notification.permission === 'granted') {
      try {
        new Notification(title, {
          icon: '/icon-192.png',
          badge: '/icon-192.png',
          vibrate: [200, 100, 200],
          ...options,
        });
        
        // Fallback de vibração para mobile caso a notificação não vibre nativamente
        if (navigator.vibrate) {
          navigator.vibrate([200, 100, 200]);
        }
      } catch (error) {
        console.error('Erro ao disparar notificação:', error);
      }
    }
  };

  return { permission, requestPermission, sendNotification };
}
