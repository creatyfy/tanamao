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

      // Pede permissão automaticamente
      const permResult = await PushNotifications.requestPermissions();

      if (permResult.receive === 'granted') {
        setPermission('granted');
        await PushNotifications.register();
      } else {
        setPermission('denied');
        return;
      }

      // Listener: token gerado
      PushNotifications.addListener('registration', async (token) => {
        console.log('FCM Token:', token.value);
        await saveToken(token.value, detectPlatform());
      });

      // Listener: erro no registro
      PushNotifications.addListener('registrationError', (err) => {
        console.error('Push registration error:', err);
      });

      // Listener: notificação recebida com app aberto
      PushNotifications.addListener('pushNotificationReceived', (notification) => {
        console.log('Push received:', notification);
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
      // Web fallback
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

  const sendNotification = async (title: string, options?: NotificationOptions) => {
    // Som de alerta via AudioContext (funciona no app aberto, nativo e web)
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
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
      }
    } catch (err) {
      console.warn('Audio error:', err);
    }

    // Vibração forte
    if (navigator.vibrate) navigator.vibrate([400, 150, 400, 150, 600]);

    // Notificação visual — apenas web (no nativo o som+vibração já avisam)
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

  return { permission, requestPermission, sendNotification };
}
