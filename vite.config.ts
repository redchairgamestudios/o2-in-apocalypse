import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';
import {VitePWA} from 'vite-plugin-pwa';

export default defineConfig(() => {
  return {
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: [
          'favicon.ico',
          'favicon.svg',
          'apple-touch-icon.png',
          'icon.svg',
          'app-logo.svg',
          'app-logo.png',
          'pwa-192x192.png',
          'pwa-512x512.png',
          'pwa-maskable-512x512.png',
        ],
        manifest: {
          id: '/',
          name: 'O² in Apocalypse',
          short_name: 'O²',
          description:
            'A high-fidelity 3D first-person zombie survival shooter with intense urban combat, weapon upgrades, and campaign missions.',
          theme_color: '#0a0a0c',
          background_color: '#0a0a0c',
          display: 'standalone',
          orientation: 'any',
          start_url: '/',
          scope: '/',
          icons: [
            {
              src: '/pwa-192x192.png',
              sizes: '192x192',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: '/pwa-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: '/pwa-maskable-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            },
          ],
        },
        workbox: {
          // Model formats must be precached or the PWA serves the shell offline
          // while 3D assets 404 — zombies then fall back to generic procedural
          // models forever. gltf/bin/fbx stay small (~3.5MB total: zombie model
          // + colossus sculpt); the giant .glb files (heli 49MB, rifle 34MB,
          // city 33MB, soldier 22MB) deliberately stream over the network —
          // adding them here exceeds the 8 MiB cap and breaks the SW build.
          globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2,gltf,bin,fbx}'],
          // Game art assets (boss PBR textures, lobby art) exceed the 2 MiB default
          maximumFileSizeToCacheInBytes: 8 * 1024 * 1024,
        },
        devOptions: {
          // Disabled: the dev service worker intercepts module requests and
          // serves stale bundles after server restarts, repeatedly breaking
          // dev loads. The PWA build still emits the production SW.
          enabled: false,
          type: 'module',
        },
      }),
    ],
    resolve: {
      alias: {
        '@': path.resolve(import.meta.dirname || '.', '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
