import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["icon.svg", "ocr-assets/**/*"],
      manifest: {
        name: "BloodLedger Synthetic Capture",
        short_name: "BloodLedger",
        description: "Simulation-only mobile OCR capture for BloodLedger Sprint 4",
        theme_color: "#7f1d1d",
        background_color: "#fffaf8",
        display: "standalone",
        start_url: "/",
        icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any maskable" }],
      },
      workbox: {
        navigateFallback: "/index.html",
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
