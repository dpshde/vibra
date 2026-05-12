import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    allowedHosts: [
      'vibra.localhost',
      'vibra.local',
      'omarchy.mist-ionian.ts.net',
      'omarchy.mist-ionian.ts.net:8443',
      '.mist-ionian.ts.net',
      '.ts.net',
      '.localhost',
      '.local',
      true  // allow all hosts for dev (tailscale changes hostname dynamically)
    ]
  }
});
