import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// Vite config keeps the setup minimal while enabling fast HMR for React.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const bypassKey = env.VITE_PAYMENT_BYPASS_KEY || '';

  return {
  // Absolute base: the site is served from the domain root, and relative ('./')
  // paths break asset loading on deep routes (e.g. /events/:slug) served via the
  // SPA fallback.
  base: '/',
  plugins: [react()],
  server: {
    port: 5173,
    open: true,
    proxy: {
      '/api': {
        target: env.DEV_API_ORIGIN || 'http://127.0.0.1:8787',
        changeOrigin: false,
        // Injected by the dev proxy; it is never shipped in browser code.
        ...(bypassKey ? { headers: { 'X-JC-Payment-Bypass': bypassKey } } : {}),
      },
    },
  }
  };
});
