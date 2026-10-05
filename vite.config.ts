import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { defineConfig, type Plugin } from "vite";

// `jsxLocPlugin` injects a DOM-only `data-loc` prop into every JSX element.
// React Three Fiber receives that prop on Three.js objects and attempts to
// apply it as an object property, causing /products to crash at runtime.
function vitePluginOptionalAnalytics(): Plugin {
  let endpoint = "";
  return {
    name: "optional-analytics",
    configResolved(config) {
      endpoint = config.env.VITE_ANALYTICS_ENDPOINT ?? "";
    },
    transformIndexHtml(html) {
      return endpoint ? html : html.replace(/\s*<script[^>]*%VITE_ANALYTICS_ENDPOINT%[\s\S]*?<\/script>/, "");
    },
  };
}

const plugins = [react(), tailwindcss(), vitePluginOptionalAnalytics()];

export default defineConfig({
  base: process.env.GITHUB_PAGES === "true" ? "/modernite-bipv-platform/" : "/",
  plugins,
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets"),
    },
  },
  envDir: path.resolve(import.meta.dirname),
  root: path.resolve(import.meta.dirname, "client"),
  publicDir: path.resolve(import.meta.dirname, "client", "public"),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
  },
  server: {
    host: true,
    allowedHosts: [
      ".manuspre.computer",
      ".manus.computer",
      ".manus-asia.computer",
      ".manuscomputer.ai",
      ".manusvm.computer",
      "localhost",
      "127.0.0.1",
    ],
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
  },
});
