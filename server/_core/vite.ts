import express, { type Express } from "express";
import fs from "fs";
import { type Server } from "http";
import { nanoid } from "nanoid";
import path from "path";
import { ENV } from "./env";

export async function setupVite(app: Express, server: Server) {
  const { createServer: createViteServer } = await import("vite");
  const { default: viteConfig } = await import("../../vite.config");
  const serverOptions = {
    middlewareMode: true,
    hmr: { server },
    allowedHosts: true as const,
  };

  const vite = await createViteServer({
    ...viteConfig,
    configFile: false,
    server: serverOptions,
    appType: "custom",
  });

  app.use(vite.middlewares);
  app.use("*", async (req, res, next) => {
    const url = req.originalUrl;

    try {
      const clientTemplate = path.resolve(
        import.meta.dirname,
        "../..",
        "client",
        "index.html"
      );

      // always reload the index.html file from disk incase it changes
      let template = await fs.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`
      );
      const page = await vite.transformIndexHtml(url, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e as Error);
      next(e);
    }
  });
}

export function serveStatic(app: Express) {
  const distPath =
    process.env.NODE_ENV === "development"
      ? path.resolve(import.meta.dirname, "../..", "dist", "public")
      : path.resolve(import.meta.dirname, "public");
  if (!fs.existsSync(distPath)) {
    console.error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`
    );
  }

  app.use(
    express.static(distPath, {
      index: false,
      setHeaders(res, filePath) {
        if (filePath.includes(`${path.sep}assets${path.sep}`)) res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
        else if (filePath.endsWith(".html") || filePath.endsWith("build.json")) res.setHeader("Cache-Control", "no-cache");
      },
    }),
  );

  // Public browser config is inlined so the map can start without a round trip.
  const publicConfig = JSON.stringify({ googleMapsApiKey: ENV.googleMapsBrowserKey || null }).replace(/</g, "\\u003c");
  const analytics = /^[a-f0-9]{32}$/i.test(ENV.cfWebAnalyticsToken)
    ? `<script defer src="https://static.cloudflareinsights.com/beacon.min.js" data-cf-beacon='{"token":"${ENV.cfWebAnalyticsToken}"}'></script>`
    : "";
  let indexHtml: string | null = null;
  app.use("*", (_req, res) => {
    indexHtml ??= fs
      .readFileSync(path.resolve(distPath, "index.html"), "utf-8")
      .replace("</head>", `<script>window.__MODERNITE_PUBLIC_CONFIG__=${publicConfig}</script>${analytics}</head>`);
    res.status(200).set({ "Content-Type": "text/html", "Cache-Control": "no-cache" }).end(indexHtml);
  });
}
