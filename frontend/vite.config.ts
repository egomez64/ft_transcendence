import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    hmr: {
      protocol: 'wss',
      host: 'localhost',
      clientPort: 8443,
      path: '/vite-hmr',
    },
    origin: 'https://localhost:8443',
  },
});
