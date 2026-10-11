import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { localAccountSwitcher } from "./dev-account-switcher";
export default defineConfig({ plugins: [react(), localAccountSwitcher()], cacheDir: process.env.BLOODLEDGER_VITE_CACHE_DIR ?? "node_modules/.vite", server: { host: "127.0.0.1", port: 5174, proxy: { "/api": "http://127.0.0.1:3000", "/capture": "http://127.0.0.1:3000" } } });
