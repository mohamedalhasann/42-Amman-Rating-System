import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: '/staff/',
  // never inline assets (fonts) as data: URLs; the CSP only allows files from 'self'
  build: {assetsInlineLimit: 0},
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
    proxy: {
      '/api': {target: 'http://127.0.0.1:8000', changeOrigin: true},
      '/login': {target: 'http://127.0.0.1:8000', changeOrigin: true},
      '/setup': {target: 'http://127.0.0.1:8000', changeOrigin: true},
      '/reset': {target: 'http://127.0.0.1:8000', changeOrigin: true},
      '/welcome': {target: 'http://127.0.0.1:8000', changeOrigin: true},
      '/assets': {target: 'http://127.0.0.1:8000', changeOrigin: true},
      '^/$': {target: 'http://127.0.0.1:8000', changeOrigin: true},
    },
  },
});
