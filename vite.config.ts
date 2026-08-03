import { defineConfig } from 'vite'
import path from 'path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    // ============================================================
    // Installable, and fast on the second visit.
    //
    // The service worker precaches the built shell so a returning visitor
    // renders from disk instead of waiting on the network. It does not cache
    // any API response: those are scoped by row level security, and anything
    // written to disk survives a sign-out and is readable by any script on the
    // origin. A child's messages and grades are not worth a faster back
    // button.
    //
    // autoUpdate rather than a prompt. This is a tool people open to check a
    // lesson time, not somewhere they want a dialogue about versions.
    // ============================================================
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.png', 'icons/apple-touch-icon.png'],
      manifest: {
        name: 'Yakal Education Services',
        short_name: 'Yakal',
        description: 'Tutoring and college admissions, for students, parents and tutors.',
        // standalone is what makes it open without browser chrome, which is
        // most of what separates an installed app from a bookmark.
        display: 'standalone',
        orientation: 'portrait',
        // Installed, this opens at sign-in rather than the marketing page.
        // Somebody who put the app on their home screen has already been sold
        // to; what they want is their lessons. Signed in, /login sends them
        // straight on to their own dashboard.
        start_url: '/login',
        scope: '/',
        theme_color: '#1099A1',
        // White, matching the splash the OS paints behind the icon, so the
        // icon does not sit on a plate of a slightly different shade.
        background_color: '#ffffff',
        categories: ['education'],
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          // Android crops icons to the launcher's shape and only guarantees
          // the middle 80%, so these carry their own margin and background.
          { src: '/icons/maskable-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
          { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // The app is one big lazy-loaded bundle now, so the chunks are the
        // shell. 4 MB covers them; the default 2 MB silently drops the largest.
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        // The shell only: the entry, the pinned vendor chunks, styles and
        // fonts. Precaching every chunk meant a student's phone downloading
        // the admin dashboard and the counselor tools in the background, 4.6 MB
        // of pages they will never open. Page chunks are cached below as they
        // are actually visited.
        globPatterns: ['**/*.{css,html,woff2}', 'assets/index-*.js', 'assets/vendor-*.js'],
        // Every unknown path falls back to the SPA entry, or a deep link
        // opened offline gets a 404 from the cache rather than the app.
        navigateFallback: '/index.html',
        // Never the API. Supabase and our own routes must always be live: a
        // cached session time is worse than a spinner.
        navigateFallbackDenylist: [/^\/api\//],
        runtimeCaching: [
          {
            // A page's chunk, kept once it has been opened. Stale while
            // revalidate: render from disk immediately, fetch a newer one in
            // the background, so a returning visitor never waits and never
            // stays on an old build for more than one visit.
            urlPattern: ({ url, request }) =>
              request.destination === 'script' && url.pathname.startsWith('/assets/'),
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'page-chunks',
              expiration: { maxEntries: 60, maxAgeSeconds: 30 * 24 * 60 * 60 },
            },
          },
          {
            // Course thumbnails and avatars. Images are immutable at their URL
            // here, so a cache hit is always correct.
            urlPattern: ({ request }) => request.destination === 'image',
            handler: 'CacheFirst',
            options: {
              cacheName: 'images',
              expiration: { maxEntries: 120, maxAgeSeconds: 30 * 24 * 60 * 60 },
            },
          },
        ],
        cleanupOutdatedCaches: true,
      },
      devOptions: {
        // On, so the install flow can be tested with `npm run dev`. Without a
        // live service worker Chrome never fires beforeinstallprompt, and the
        // install offer simply never appears, which reads as broken rather
        // than as not-yet-built.
        //
        // The cost is that a stale chunk can survive a save. If dev ever
        // serves code you have already changed, unregister the worker in
        // Application > Service Workers and reload.
        enabled: true,
        type: 'module',
        navigateFallback: 'index.html',
      },
    }),
  ],
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
    allowedHosts: [
      'd1ba-196-188-245-97.ngrok-free.app'
    ],
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
})
