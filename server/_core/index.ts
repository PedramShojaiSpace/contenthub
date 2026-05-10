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
import { videoUploadMiddleware, videoChunkMiddleware, handleVideoChunkUpload, handleVideoChunkFinalize, handleVideoChunkConfirm } from "../videoUploadHandler";
import { runStitchingJob } from "../videoVariantRouter";
import { sdk } from "./sdk";
import { getDb } from "../db";
import { videoVariantJobs } from "../../drizzle/schema";
import { eq, and } from "drizzle-orm";

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
  app.post("/api/upload/video-chunk/finalize", express.json(), handleVideoChunkFinalize);
  // Confirm endpoint — browser calls this after direct-to-forge upload succeeds
  app.post("/api/upload/video-chunk/confirm", express.json(), handleVideoChunkConfirm);
  // Legacy single-file endpoint removed — all uploads now use chunked flow

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
  // ── Stitch job endpoint ─────────────────────────────────────────────────────
  // Runs the full stitching job SYNCHRONOUSLY within an HTTP request.
  // This keeps the Cloud Run container alive (active request) for the full
  // duration of FFmpeg processing, preventing child process termination.
  // The client calls this fire-and-forget after startProcessing.
  app.post("/api/stitch-job/:jobId", async (req, res) => {
    try {
      const user = await sdk.authenticateRequest(req);
      const jobId = parseInt(req.params.jobId, 10);
      if (isNaN(jobId)) return res.status(400).json({ error: "Invalid jobId" });
      // Verify job belongs to this user
      const db = await getDb();
      if (!db) return res.status(500).json({ error: "DB unavailable" });
      const [job] = await db.select()
        .from(videoVariantJobs)
        .where(and(eq(videoVariantJobs.id, jobId), eq(videoVariantJobs.userId, user.id)));
      if (!job) return res.status(404).json({ error: "Job not found" });
      // Run stitching synchronously — keeps this HTTP request alive on Cloud Run
      // so the container stays up and FFmpeg child processes are not killed.
      console.log(`[stitch-job] Starting job ${jobId} for user ${user.id}`);
      await runStitchingJob(jobId);
      console.log(`[stitch-job] Job ${jobId} complete`);
      return res.json({ ok: true });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[stitch-job] Error:`, msg);
      return res.status(500).json({ error: msg });
    }
  });

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
