import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import fs from "fs";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from "vite-plugin-pwa";

// Copia .htaccess para dist (necessário para SPA na Hostinger/Apache)
function copyHtaccess() {
  return {
    name: "copy-htaccess",
    closeBundle() {
      const src = path.resolve(__dirname, "public/.htaccess");
      const dest = path.resolve(__dirname, "dist/.htaccess");
      if (fs.existsSync(src)) {
        fs.copyFileSync(src, dest);
      }
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [
    react(),
    copyHtaccess(),
    mode === "development" && componentTagger(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["logo-icon.png", "pwa-icon-192.png", "pwa-icon-512.png", "favicon.ico", "favicon.svg"],
      workbox: {
        importScripts: ['sw-push.js'],
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/~oauth/, /^\/supabase/, /^\/api/],
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024, // 3 MB (chunk principal > 2 MB)
        runtimeCaching: [
          // ── Fontes Google ─────────────────────────────────────────────
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "google-fonts-cache",
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "gstatic-fonts-cache",
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          // ── Supabase REST API (dados operacionais) ────────────────────
          // NetworkFirst: tenta a rede e cai para cache em caso de falha.
          // Operadores em campo continuam vendo dados recentes mesmo offline.
          {
            urlPattern: /^https:\/\/[^/]+\.supabase\.co\/rest\/.*/i,
            handler: "NetworkFirst",
            options: {
              cacheName: "supabase-api-cache",
              networkTimeoutSeconds: 5,
              expiration: {
                maxEntries: 200,
                maxAgeSeconds: 60 * 60 * 24, // 24 h
              },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          // ── Imagens Cloudinary (evidências de campo) ──────────────────
          // CacheFirst: imagens raramente mudam; serve do cache imediatamente.
          {
            urlPattern: /^https:\/\/res\.cloudinary\.com\/.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "cloudinary-images-cache",
              expiration: {
                maxEntries: 300,
                maxAgeSeconds: 60 * 60 * 24 * 7, // 7 dias
              },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          // ── Open-Meteo (previsão do tempo / alertas de tempestade) ────
          {
            urlPattern: /^https:\/\/api\.open-meteo\.com\/.*/i,
            handler: "NetworkFirst",
            options: {
              cacheName: "open-meteo-cache",
              networkTimeoutSeconds: 5,
              expiration: {
                maxEntries: 20,
                maxAgeSeconds: 60 * 60, // 1 h
              },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
      manifest: {
        name: "Sentinella Web — Combate à Dengue",
        short_name: "Sentinella",
        description: "Plataforma de vigilância e combate ao Aedes aegypti para prefeituras brasileiras.",
        theme_color: "#2a9d8f",
        background_color: "#0f1722",
        display: "standalone",
        orientation: "portrait",
        scope: "/",
        start_url: "/",
        icons: [
          {
            src: "pwa-icon-192.png",
            sizes: "192x192",
            type: "image/png",
          },
          {
            src: "pwa-icon-512.png",
            sizes: "512x512",
            type: "image/png",
          },
          {
            src: "pwa-icon-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
    }),
  ].filter(Boolean),
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // React core
          'vendor-react': [
            'react',
            'react-dom',
            'react-router-dom',

            // Radix UI (evita ciclo entre vendor-react <-> vendor-radix)
            '@radix-ui/react-accordion',
            '@radix-ui/react-alert-dialog',
            '@radix-ui/react-aspect-ratio',
            '@radix-ui/react-avatar',
            '@radix-ui/react-checkbox',
            '@radix-ui/react-collapsible',
            '@radix-ui/react-context-menu',
            '@radix-ui/react-dialog',
            '@radix-ui/react-dropdown-menu',
            '@radix-ui/react-hover-card',
            '@radix-ui/react-label',
            '@radix-ui/react-menubar',
            '@radix-ui/react-navigation-menu',
            '@radix-ui/react-popover',
            '@radix-ui/react-progress',
            '@radix-ui/react-radio-group',
            '@radix-ui/react-scroll-area',
            '@radix-ui/react-select',
            '@radix-ui/react-separator',
            '@radix-ui/react-slider',
            '@radix-ui/react-slot',
            '@radix-ui/react-switch',
            '@radix-ui/react-tabs',
            '@radix-ui/react-toast',
            '@radix-ui/react-toggle',
            '@radix-ui/react-toggle-group',
            '@radix-ui/react-tooltip',
          ],

          // State & query
          'vendor-query': ['@tanstack/react-query'],

          // Supabase (auth + realtime + storage = pesado)
          'vendor-supabase': ['@supabase/supabase-js'],

          // Mapas e plugins
          'vendor-leaflet': [
            'leaflet',
            'react-leaflet',
            'leaflet.heat',
            'leaflet.markercluster',
            'leaflet-draw',
            'leaflet-kmz',
          ],

          // Gráficos
          'vendor-charts': ['recharts'],

          // PDF
          'vendor-pdf': ['jspdf', 'jspdf-autotable'],

          // Utilitários de data
          'vendor-dates': ['date-fns'],
        },
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
