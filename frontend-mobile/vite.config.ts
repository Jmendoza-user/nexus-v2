import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// NEXUS V2.0 frontend-mobile dev server.
// Puerto 3101, host 0.0.0.0 para acceso remoto (Jerson).
export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 3101,
    strictPort: true,
    // Hosts permitidos por el dev server (Vite bloquea hosts desconocidos).
    // Detrás de Nginx Proxy Manager con TLS para nexus.j4smartsolutions.com.
    allowedHosts: ['nexus.j4smartsolutions.com', 'localhost', '168.231.64.45'],
    // HMR a través del proxy HTTPS (websocket por 443/wss).
    hmr: { host: 'nexus.j4smartsolutions.com', clientPort: 443, protocol: 'wss' },
    // Proxy del API al backend NEXUS V2.0 en dev (puerto 3110).
    // Solo proxy, sin rewrites: /api/* del frontend → http://localhost:3110/api/*.
    proxy: {
      '/api': {
        target: 'http://localhost:3110',
        changeOrigin: true,
      },
    },
  },
  preview: {
    host: '0.0.0.0',
    port: 3101,
    strictPort: true,
  },
});
