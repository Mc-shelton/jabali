import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Vite config keeps the setup minimal while enabling fast HMR for React.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    open: true
  }
});
