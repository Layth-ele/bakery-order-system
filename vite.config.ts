/**
 * Vite configuration — Pass 3 production-tuned
 *
 * Changes from baseline:
 *   - Removed `figma:asset/...` alias (asset was missing, broke builds)
 *   - Added `manualChunks` strategy that splits heavy vendors into independently
 *     cacheable chunks. Customer entry no longer ships admin-only deps.
 *   - Source maps disabled for production (was already implicit; explicit now)
 *   - chunkSizeWarningLimit set to 400 KB
 *   - assetsInlineLimit at 4 KB
 *   - Build target esnext (modern browsers only — admin/wholesale clients are
 *     known stable; we don't need to ship transpiled IE polyfills)
 *   - Strip console.log / console.debug in production via esbuild.pure;
 *     console.warn / console.error retained for ops visibility
 */

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';
import { VitePWA } from 'vite-plugin-pwa';

/**
 * Progressive Web App: installable on phones/desktops, app-shell cached by a
 * Workbox service worker. Only same-origin app files are cached — Firestore,
 * Auth and Cloud Function calls always go to the network, so data is never
 * stale. New versions are announced in-app (PwaUpdatePrompt) instead of
 * silently swapping code under a user mid-order.
 * Icons: public/ (regenerate with `npm run generate:icons`).
 */
const BRAND = { theme: '#2c2416', background: '#fbf6ee' };

const pwa = VitePWA({
  registerType: 'prompt',
  injectRegister: false, // registered by src/components/pwa/PwaUpdatePrompt.tsx
  includeAssets: ['favicon.ico', 'apple-touch-icon-180x180.png', 'app-icon.svg'],
  manifest: {
    id: '/',
    name: 'Delight Bakehouse',
    short_name: 'Delight',
    description: 'Wholesale ordering, payments and invoices for Delight Bakehouse.',
    lang: 'en',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'any',
    theme_color: BRAND.theme,
    background_color: BRAND.background,
    categories: ['business', 'food', 'shopping'],
    icons: [
      { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
      { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
      { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  },
  workbox: {
    // App shell + shared chunks are precached for instant start-up.
    globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
    // Admin-only heavy chunks (Excel/PDF/charts ≈ 1.6 MB) are cached on first
    // use instead, so customers' phones don't download them at install.
    globIgnores: ['**/excel-*.js', '**/pdf-*.js', '**/charts-*.js'],
    navigateFallback: '/index.html',
    // Never hijack Firebase's reserved paths (auth handler, init.json).
    navigateFallbackDenylist: [/^\/__\//],
    cleanupOutdatedCaches: true,
    // Phone push notifications + app-icon badge (public/push-sw.js).
    importScripts: ['push-sw.js'],
    runtimeCaching: [
      {
        // Hashed build files are immutable — safe to cache-first.
        urlPattern: ({ url, sameOrigin }) => sameOrigin && url.pathname.startsWith('/assets/'),
        handler: 'CacheFirst',
        options: {
          cacheName: 'app-assets',
          expiration: { maxEntries: 80, maxAgeSeconds: 60 * 60 * 24 * 60 },
        },
      },
    ],
  },
});

export default defineConfig({
  plugins: [react(), tailwindcss(), pwa],

  resolve: {
    extensions: ['.js', '.jsx', '.ts', '.tsx', '.json'],
    alias: {
      // Legacy version-pinned imports (Figma export residue)
      'sonner@2.0.3': 'sonner',
      'react-hook-form@7.55.0': 'react-hook-form',
      // Standard alias
      '@': path.resolve(__dirname, './src'),
      // Suppress Node.js built-ins used by xlsx-js-style in browser
      'stream': path.resolve(__dirname, './src/utils/emptyStream.ts'),
    },
  },

  build: {
    target: 'esnext',
    outDir: 'dist',
    sourcemap: false,
    cssCodeSplit: true,
    chunkSizeWarningLimit: 400, // KB — alert on regressions
    assetsInlineLimit: 4096,    // 4KB inline threshold
    minify: 'esbuild',

    rollupOptions: {
      output: {
        // ✅ PASS 3: manualChunks splits heavy vendors into cacheable groups.
        //
        // Split rationale:
        //   excel       — admin-only Excel export (xlsx)
        //   pdf         — admin-only PDF generation (jspdf, html-to-image)
        //   charts      — admin-only analytics (recharts + d3 chains)
        //   firebase-firestore — read/write to Firestore (everyone needs it)
        //   firebase-auth      — authentication (everyone needs it)
        //   firebase-storage   — file uploads (mostly admin)
        //   firebase-functions — Cloud Function calls
        //   firebase-core      — Firebase app init shared
        //   radix       — Radix UI primitives (shared, cache-friendly)
        //   icons       — lucide-react (shared, cache-friendly)
        //   tanstack    — react-query (data fetching layer)
        //   motion      — framer-motion (animations, optional)
        //   forms       — react-hook-form, zod, sonner toast
        //   utils       — date-fns, clsx, etc.
        //   react-vendor — react, react-dom, react-router (immutable)
        //   vendor      — fallback for everything else
        manualChunks(id: string) {
          if (!id.includes('node_modules')) return undefined;

          // Order matters: most specific first
          if (id.includes('xlsx-js-style') || /node_modules\/xlsx\b/.test(id)) return 'excel';
          if (id.includes('jspdf') || id.includes('html-to-image') || id.includes('html2canvas')) return 'pdf';
          if (id.includes('recharts') || id.includes('victory-vendor') || id.match(/node_modules\/d3-/)) return 'charts';

          // Firebase split — auth and firestore are loaded eagerly; others lazy
          if (id.includes('@firebase/auth') || id.includes('firebase/auth')) return 'firebase-auth';
          if (id.includes('@firebase/firestore') || id.includes('firebase/firestore')) return 'firebase-firestore';
          if (id.includes('@firebase/storage') || id.includes('firebase/storage')) return 'firebase-storage';
          if (id.includes('@firebase/functions') || id.includes('firebase/functions')) return 'firebase-functions';
          if (id.includes('@firebase/messaging') || id.includes('firebase/messaging')) return 'firebase-messaging';
          if (id.includes('@firebase/performance') || id.includes('firebase/performance')) return 'firebase-perf';
          if (id.includes('@firebase/') || id.includes('firebase/')) return 'firebase-core';

          if (id.includes('@radix-ui/')) return 'radix';
          if (id.includes('lucide-react')) return 'icons';

          if (id.includes('@tanstack/')) return 'tanstack';
          if (id.includes('framer-motion') || id.includes('motion-dom') || id.includes('motion-utils')) return 'motion';

          if (id.includes('react-hook-form') || id.includes('sonner') || id.includes('class-variance-authority')) return 'forms';
          if (id.includes('zod')) return 'forms';

          if (id.includes('date-fns') || id.includes('clsx') || id.includes('tailwind-merge')) return 'utils';

          if (id.includes('react-router') || id.includes('react-dom') || id.match(/node_modules\/react\/(?!.*node_modules)/) || id.match(/node_modules\/scheduler\b/)) return 'react-vendor';

          // Anything else
          return 'vendor';
        },

        chunkFileNames: 'assets/[name]-[hash].js',
        entryFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]',
      },
    },
  },

  esbuild: {
    drop: process.env.NODE_ENV === 'production' ? ['debugger'] : [],
    pure: process.env.NODE_ENV === 'production' ? ['console.log', 'console.debug'] : [],
  },

  server: {
    port: 3000,
    open: true,
  },

  preview: {
    port: 3000,
  },
});
