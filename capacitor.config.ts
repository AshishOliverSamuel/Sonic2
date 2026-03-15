import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.yourname.sonic',
  appName: 'Sonic',
  webDir: 'out',
  server: {
    url: 'https://sonic-amber-three.vercel.app',  // 👈 your actual Vercel URL
    cleartext: true
  }
};

export default config;