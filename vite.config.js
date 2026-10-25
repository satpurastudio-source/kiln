import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import pkg from './package.json' with { type: 'json' }

export default defineConfig({
  // shown in Send feedback's device details
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  plugins: [
    react(),
    // Installable app + service worker. Updates are picked up on every app
    // open/resume (see src/pwa.js) — no more delete-and-re-add from home screen.
    VitePWA({
      registerType: 'prompt',
      injectRegister: false,
      includeAssets: ['icons/apple-touch-icon.png', 'icons/icon.svg'],
      manifest: {
        id: './',
        name: 'kiln — task studio',
        short_name: 'kiln',
        description: 'Shape · fire · ship. A calm, pretty task studio.',
        start_url: './',
        scope: './',
        display: 'standalone',
        orientation: 'any',
        background_color: '#0e0b08',
        theme_color: '#0e0b08',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        cleanupOutdatedCaches: true,
        // the landing page is a plain site, not part of the app shell: keep it
        // out of the cache and never answer its URL with the app's index.html
        globIgnores: ['welcome/**', 'email/**'],
        navigateFallbackDenylist: [/\/welcome(\/|$)/],
        // Supabase calls are never touched — only the app shell is cached.
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/,
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'google-fonts', expiration: { maxEntries: 20 } },
          },
        ],
      },
    }),
  ],
  // relative asset paths — works at any URL depth (GitHub Pages subpath,
  // local file previews, and later inside the Tauri app shell)
  base: './',
})
