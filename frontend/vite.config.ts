import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// In development, API calls go to the Django server on port 8000.
// Set VITE_USE_MOCK=true to run the UI without a backend.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:8000',
    },
  },
});
