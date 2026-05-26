import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.sesolibre.games',
  appName: 'SesoLibre Games',
  webDir: 'dist',
  // Android/iOS se agregan con `npx cap add android` en la fase de empaquetado.
};

export default config;
