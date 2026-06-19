import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import svgr from '@svgr/rollup'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  base: './',
  plugins: [
    react(),
    svgr(),
    VitePWA({
      // Auto-update the service worker in the background and reload on activate.
      registerType: 'autoUpdate',
      // Keep the existing public/manifest.json instead of generating one.
      manifest: false,
      workbox: {
        // Precache the app shell plus every image and font so the game is fully
        // playable offline. Assets live in public/assets and are copied verbatim
        // into the build output, where these globs pick them up.
        globPatterns: ['**/*.{js,css,html,png,jpg,jpeg,svg,ttf,ico,webmanifest}'],
        // Largest asset is ~560KB; keep a comfortable cap.
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
        // SPA fallback so deep navigations work offline. Excludes plain files
        // like version.txt, which should be served as-is, not the app shell.
        navigateFallback: 'index.html',
        navigateFallbackDenylist: [/version\.txt$/],
      },
    }),
  ],
  server: {
    port: 3000,
    open: true,
  },
})
