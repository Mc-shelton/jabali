import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Vite config keeps the setup minimal while enabling fast HMR for React.
export default defineConfig({
  // Absolute base: the site is served from the domain root, and relative ('./')
  // paths break asset loading on deep routes (e.g. /events/:slug) served via the
  // SPA fallback.
  base: '/',
  plugins: [react()],
  server: {
    port: 5173,
    open: true
  }
});
