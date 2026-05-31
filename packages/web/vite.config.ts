import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// In dev the daemon runs on :3847. Vite serves the UI on :3000 and proxies
// /ws (and future /api) to the daemon, so the browser only ever talks to its
// own origin — which is what makes Tailscale / phone access "just work".
export default defineConfig({
  plugins: [react()],
  server: {
    host: true, // bind 0.0.0.0 so other tailnet devices (phone) can reach dev
    // Vite blocks requests whose Host header it doesn't recognize (DNS-rebinding
    // protection). We're reached by Tailscale hostname (e.g. ganymede-macmini),
    // which varies per machine — allow any host since access is already gated by
    // the tailnet. Restrict to e.g. [".ts.net", "localhost"] if you prefer.
    allowedHosts: true,
    port: 3000,
    strictPort: true,
    proxy: {
      "/ws": { target: "ws://localhost:3847", ws: true },
      "/api": { target: "http://localhost:3847", changeOrigin: true },
    },
  },
});
