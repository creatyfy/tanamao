import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

// Detecta se está rodando no Capacitor (app nativo)
const isNative = () => {
  return typeof (window as any).Capacitor !== 'undefined' &&
    (window as any).Capacitor.isNativePlatform();
};

export function usePushNotifications() {
  const [permission, setPermission] = useState<'default' | 'granted' | 'denied'>('default');

  useEffect(() => {
    if (isNative()) {
      initNativePush();
    } else {
      if ('Notification' in window) {
        setPermission(Notification.permission as any);
      }
    }
  }, []);

  const initNativePush = async () => {
    try {
      const { PushNotifications } = await import('@capacitor/push-notifications');

      const permResult = await PushNotifications.requestPermissions();

      if (permResult.receive === 'granted') {
        setPermission('granted');

        // Cria canal de alta prioridade no Android (necessário para som e heads-up)
        try {
          await PushNotifications.createChannel({
            id: 'high_importance_channel',
            name: 'Notificações Importantes',
            description: 'Corridas, pedidos e atualizações urgentes',
            importance: 5, // IMPORTANCE_HIGH
            visibility: 1,
            sound: 'default',
            vibration: true,
            lights: true,
          });
        } catch (e) {
          // createChannel só existe no Android, ignora no iOS
        }

        await PushNotifications.register();
      } else {
        setPermission('denied');
        return;
      }

      // Listener: token gerado — salva no banco
      PushNotifications.addListener('registration', async (token) => {
        console.log('FCM Token:', token.value);
        // Tenta salvar imediatamente e retry se usuário não estiver logado ainda
        await saveTokenWithRetry(token.value, detectPlatform());
      });

      PushNotifications.addListener('registrationError', (err) => {
        console.error('Push registration error:', err);
      });

      // Listener: notificação recebida com app em PRIMEIRO PLANO
      // Toca som porque o sistema não toca automaticamente quando app está aberto
      PushNotifications.addListener('pushNotificationReceived', (notification) => {
        console.log('Push received (foreground):', notification);
        // Toca som local quando app está aberto
        playAlertSound();
        if (navigator.vibrate) navigator.vibrate([400, 150, 400, 150, 600]);
      });

      // Listener: usuário tocou na notificação
      PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
        console.log('Push action:', action);
      });

    } catch (err) {
      console.warn('PushNotifications plugin not available:', err);
    }
  };

  const detectPlatform = (): string => {
    const cap = (window as any).Capacitor;
    if (!cap) return 'web';
    return cap.getPlatform() === 'ios' ? 'ios' : 'android';
  };

  const saveTokenWithRetry = async (token: string, platform: string, attempt = 0) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        // Usuário não logado ainda — tenta novamente em 3 segundos
        if (attempt < 5) {
          setTimeout(() => saveTokenWithRetry(token, platform, attempt + 1), 3000);
        }
        return;
      }
      await saveToken(token, platform);
    } catch (err) {
      console.warn('Failed to save push token:', err);
    }
  };

  const registerForPush = async () => {
    try {
      const { PushNotifications } = await import('@capacitor/push-notifications');
      await PushNotifications.register();
    } catch (err) {
      console.warn('Failed to register for push:', err);
    }
  };

  const saveToken = async (token: string, platform: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      await supabase.from('push_tokens').upsert({
        user_id: user.id,
        token,
        platform,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id,token' });
    } catch (err) {
      console.warn('Failed to save push token:', err);
    }
  };

  const requestPermission = async (): Promise<boolean> => {
    if (isNative()) {
      try {
        const { PushNotifications } = await import('@capacitor/push-notifications');
        const result = await PushNotifications.requestPermissions();
        if (result.receive === 'granted') {
          setPermission('granted');
          await registerForPush();
          return true;
        }
        setPermission('denied');
        return false;
      } catch (err) {
        console.warn('Failed to request push permission:', err);
        return false;
      }
    } else {
      if (!('Notification' in window)) return false;
      try {
        const perm = await Notification.requestPermission();
        setPermission(perm as any);
        return perm === 'granted';
      } catch {
        return false;
      }
    }
  };

  const playAlertSound = () => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const audioCtx = new AudioCtx();
      const playBeep = (freq: number, start: number, dur: number) => {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.frequency.value = freq;
        osc.type = 'sine';
        gain.gain.setValueAtTime(0.7, audioCtx.currentTime + start);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + start + dur);
        osc.start(audioCtx.currentTime + start);
        osc.stop(audioCtx.currentTime + start + dur + 0.05);
      };
      playBeep(880, 0, 0.25);
      playBeep(1100, 0.3, 0.25);
      playBeep(880, 0.6, 0.25);
      playBeep(1320, 0.9, 0.4);
    } catch (err) {
      console.warn('Audio error:', err);
    }
  };

  const sendNotification = async (title: string, options?: NotificationOptions) => {
    // Som local (app em primeiro plano)
    playAlertSound();
    if (navigator.vibrate) navigator.vibrate([400, 150, 400, 150, 600]);

    // Notificação visual web
    if (!isNative() && 'Notification' in window && Notification.permission === 'granted') {
      try {
        new Notification(title, {
          icon: '/icon-192.png',
          badge: '/icon-192.png',
          ...options,
        });
      } catch (err) {
        console.error('Local notification error:', err);
      }
    }
  };

  return { permission, requestPermission, sendNotification, saveToken };
}
