import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  base: "/capture/",
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["bloodledger-logo-updated.png", "ocr-assets/**/*"],
      manifest: {
        name: "BloodLedger Inbound OCR Capture",
        short_name: "BloodLedger",
        description: "Simulation-only confirmed inbound OCR capture for BloodLedger Sprint 6",
        theme_color: "#7f1d1d",
        background_color: "#fffaf8",
        display: "standalone",
        start_url: "/capture/",
        icons: [{ src: "/capture/bloodledger-logo-updated.png", sizes: "1000x1000", type: "image/png", purpose: "any" }],
      },
      workbox: {
        navigateFallback: "/capture/index.html",
        maximumFileSizeToCacheInBytes: 5_250_000,
        runtimeCaching: [],
      },
    }),
  ],
  server: {
    host: "127.0.0.1",
    port: 5173,
    proxy: {
      "/api": "http://127.0.0.1:3000",
      "/healthz": "http://127.0.0.1:3000",
    },
  },
});
