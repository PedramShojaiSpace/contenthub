import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { startWeeklyDigestCron } from "../digest";
import { handleIngestResearchReport } from "../ingestRouter";
import { handleNewsfeedRefresh } from "../newsfeedScheduled";
import { videoUploadMiddleware, handleVideoClipUpload, videoChunkMiddleware, handleVideoChunkUpload, handleVideoChunkFinalize } from "../videoUploadHandler";

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

  // ── Video upload MUST be registered BEFORE body parsers ──────────────────────
  // express.json() / urlencoded() will consume the request stream if they run
  // first on a multipart request, causing multer to fail mid-upload.
  //
  // Chunked upload endpoints (bypass Cloud Run 32 MB gateway limit):
  app.post("/api/upload/video-chunk", videoChunkMiddleware, handleVideoChunkUpload);
  app.post("/api/upload/video-chunk/finalize", handleVideoChunkFinalize);
  // Legacy single-file endpoint (kept for backward compat / small files):
  app.post("/api/upload/video-clip", videoUploadMiddleware, handleVideoClipUpload);

  // Multer error handler — returns JSON so the client sees the real cause
  app.use((err: any, _req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (err && err.code && err.code.startsWith('LIMIT_')) {
      return res.status(413).json({ error: `File too large: ${err.message}` });
    }
    if (err && err.message === 'Only MP4 files are accepted') {
      return res.status(400).json({ error: err.message });
    }
    next(err);
  });

  // Configure body parser with larger size limit for JSON/form endpoints
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  // OAuth callback under /api/oauth/callback
  registerOAuthRoutes(app);
  // Ingest endpoint — accepts research reports from external apps
  // POST /api/ingest/research-report (authenticated via INGEST_SECRET header)
  app.post("/api/ingest/research-report", handleIngestResearchReport);
  // Daily newsfeed refresh — called by Manus scheduled task at 7 AM
  app.post("/api/scheduled/newsfeed-refresh", handleNewsfeedRefresh);
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
    // Start the weekly Monday digest cron
    startWeeklyDigestCron();
  });
}

startServer().catch(console.error);
