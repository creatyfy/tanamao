import type { CapacitorConfig } from '@capacitor/cli';
const config: CapacitorConfig = {
  appId: 'com.tanamao.delivery',
  appName: 'Tá Na Mão',
  webDir: 'dist',
  android: {
    backgroundColor: '#10b981',
  },
  plugins: {
    SplashScreen: {
      launchAutoHide: true,
      backgroundColor: '#10b981',
      androidSplashResourceName: 'splash',
      showSpinner: false,
    },
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
  },
};
export default config;
