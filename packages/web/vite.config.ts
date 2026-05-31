import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// In dev the daemon runs on :3847. Vite serves the UI on :3000 and proxies
// /ws (and future /api) to the daemon, so the browser only ever talks to its
// own origin — which is what makes Tailscale / phone access "just work".
export default defineConfig({
  plugins: [react()],
  server: {
    host: true, // bind 0.0.0.0 so other tailnet devices (phone) can reach dev
    port: 3000,
    strictPort: true,
    proxy: {
      "/ws": { target: "ws://localhost:3847", ws: true },
      "/api": { target: "http://localhost:3847", changeOrigin: true },
    },
  },
});
