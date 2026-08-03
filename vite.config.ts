import { defineConfig } from 'vite'
import path from 'path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  envPrefix: ['VITE_', 'GEMINI_'],
  build: {
    rollupOptions: {
      output: {
        // Vendor split out from app code. The libraries change on an upgrade,
        // the app changes on every deploy, and keeping them apart means a
        // returning visitor re-downloads only what actually moved. That
        // matters more once a service worker is caching these.
        manualChunks(id) {
          if (!id.includes("node_modules")) return;
          if (/node_modules[\\/](react|react-dom|react-router|react-router-dom|scheduler)[\\/]/.test(id)) {
            return "vendor-react";
          }
          if (id.includes("@supabase")) return "vendor-supabase";
          if (id.includes("@tanstack")) return "vendor-query";
          // Everything else is left alone deliberately. Naming a catch-all
          // "vendor" chunk pulled the heavy per-page libraries - the Zoom SDK,
          // the waveform drawer, the charts - out of the routes that lazily
          // load them and back into the bundle everybody downloads.
          return undefined;
        },
      },
    },
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
})
