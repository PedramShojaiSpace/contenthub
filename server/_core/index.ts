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
import { getDriveAuthUrl, exchangeCodeForTokens, exportVariantsToDrive, isDriveAuthorized } from "../googleDrive";
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

  // ── Google Drive OAuth ──────────────────────────────────────────────────────
  // GET /api/drive/auth-url — returns the Google OAuth authorization URL
  app.get("/api/drive/auth-url", async (req, res) => {
    try {
      await sdk.authenticateRequest(req);
      const url = getDriveAuthUrl();
      return res.json({ url });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return res.status(400).json({ error: msg });
    }
  });

  // GET /api/drive/callback — Google redirects here after authorization
  app.get("/api/drive/callback", async (req, res) => {
    const code = req.query.code as string;
    if (!code) return res.status(400).send("Missing authorization code");
    try {
      const { refreshToken } = await exchangeCodeForTokens(code);
      // Store the refresh token as an environment variable via the forge secrets API
      // For now, display it so the owner can add it to secrets manually
      return res.send(`
        <html><body style="font-family:sans-serif;padding:40px;max-width:600px">
          <h2>✅ Google Drive Connected!</h2>
          <p>Add this refresh token to your project secrets as <strong>GOOGLE_REFRESH_TOKEN</strong>:</p>
          <textarea style="width:100%;height:80px;font-family:monospace;font-size:12px">${refreshToken}</textarea>
          <p>Go to <strong>Settings → Secrets</strong> in your Manus project and add the value above, then close this tab.</p>
        </body></html>
      `);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return res.status(500).send(`<html><body><h2>❌ Authorization failed</h2><p>${msg}</p></body></html>`);
    }
  });

  // GET /api/drive/status — check if Drive is authorized
  app.get("/api/drive/status", async (req, res) => {
    try {
      await sdk.authenticateRequest(req);
      return res.json({ authorized: isDriveAuthorized() });
    } catch {
      return res.json({ authorized: false });
    }
  });

  // POST /api/drive/export/:jobId — export all done variants for a job to Drive
  app.post("/api/drive/export/:jobId", async (req, res) => {
    try {
      const user = await sdk.authenticateRequest(req);
      const jobId = parseInt(req.params.jobId, 10);
      if (isNaN(jobId)) return res.status(400).json({ error: "Invalid jobId" });

      const db = await getDb();
      if (!db) return res.status(500).json({ error: "DB unavailable" });

      // Verify job belongs to this user
      const { videoVariantJobs: jobsTable, videoVariants: variantsTable } = await import("../../drizzle/schema");
      const [job] = await db.select().from(jobsTable)
        .where(and(eq(jobsTable.id, jobId), eq(jobsTable.userId, user.id)));
      if (!job) return res.status(404).json({ error: "Job not found" });

      // Get all done variants
      const variants = await db.select().from(variantsTable)
        .where(and(eq(variantsTable.jobId, jobId)));
      const doneVariants = variants.filter((v: any) => v.status === "done" && v.s3Url);
      if (doneVariants.length === 0) {
        return res.status(400).json({ error: "No completed variants to export" });
      }

      console.log(`[Drive Export] Exporting ${doneVariants.length} variants for job ${jobId}…`);
      const result = await exportVariantsToDrive({
        jobTitle: job.jobName || `Job ${jobId}`,
        variants: doneVariants.map((v: any) => ({ label: v.variantLabel, s3Url: v.s3Url })),
      });

      return res.json(result);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[Drive Export] Error:`, msg);
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
