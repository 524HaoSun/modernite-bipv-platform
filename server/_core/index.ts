import { registerControlRoutes } from "../control/routes";
import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { registerStorageProxy } from "./storageProxy";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { registerWeatherRoutes } from "../weather-service";
import { registerStudioAdvisorRoute } from "../studio-advisor";
import { registerProjectReportRoute } from "../project-share-service";
import { controlStore } from "../control/store";
import { setSession } from "../control/auth";
import { createHash, randomBytes } from "node:crypto";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  const app = express();
  const server = createServer(app);
  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  registerControlRoutes(app);
  if (process.env.CONTROL_PREVIEW === "1") {
    app.post("/api/control/preview/login", (req, res) => {
      const allowed = process.env.PUBLIC_BASE_URL;
      if (req.headers.origin !== allowed || !req.is("application/json"))
        return void res.status(403).json({ error: "Open this demo from the preview URL" });
      const store = controlStore();
      let user = store.byEmail("admin@example.test");
      if (!user)
        user = store.createUser("admin@example.test", "Preview administrator", [
          "super", "product", "technical", "pricing", "sales",
        ]);
      const token = randomBytes(32).toString("base64url");
      const expires = Date.now() + 4 * 60 * 60 * 1000;
      store.db
        .prepare("INSERT INTO sessions VALUES(?,?,?)")
        .run(createHash("sha256").update(token).digest("hex"), user.id, expires);
      setSession(res, token, expires);
      res.json({ user });
    });
  }
  registerStorageProxy(app);
  registerOAuthRoutes(app);
  registerWeatherRoutes(app);
  registerStudioAdvisorRoute(app);
  registerProjectReportRoute(app);
  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}

startServer().catch(console.error);
