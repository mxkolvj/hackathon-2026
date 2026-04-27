import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { crx } from "@crxjs/vite-plugin";
import manifest from "./public/manifest.json" with { type: "json" };

export default defineConfig({
  plugins: [react(), crx({ manifest })],
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
  define: {
    __BACKEND_URL__: JSON.stringify(
      process.env.BACKEND_URL ?? "http://localhost:3000",
    ),
  },
});
