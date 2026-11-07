import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// In development, API calls go to the Django server on port 8000.
// Set VITE_USE_MOCK=true to run the UI without a backend.
export default defineConfig({
  plugins: [react()],
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
    proxy: {
      '/api': {target:'http://127.0.0.1:8000',changeOrigin:true},
      '/staff': {target:'http://127.0.0.1:8000',changeOrigin:true},
    },
  },
});
