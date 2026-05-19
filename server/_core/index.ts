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
import multer from "multer";
import { PDFParse } from "pdf-parse";
import mammoth from "mammoth";
import { storagePut } from "../storage";
import { runStitchingJob } from "../videoVariantRouter";
import { videoVariants } from "../../drizzle/schema";
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

  // ── Stitch single variant endpoint ──────────────────────────────────────────
  // Re-stitches a single failed variant without resetting the whole job.
  // Called by the client after retryVariant mutation marks the variant as processing.
  app.post("/api/stitch-variant/:variantId", async (req, res) => {
    try {
      const user = await sdk.authenticateRequest(req);
      const variantId = parseInt(req.params.variantId, 10);
      if (isNaN(variantId)) return res.status(400).json({ error: "Invalid variantId" });

      const db = await getDb();
      if (!db) return res.status(500).json({ error: "DB unavailable" });

      // Load variant + verify job ownership
      const [variant] = await db.select().from(videoVariants).where(eq(videoVariants.id, variantId));
      if (!variant) return res.status(404).json({ error: "Variant not found" });
      const [job] = await db.select().from(videoVariantJobs)
        .where(and(eq(videoVariantJobs.id, variant.jobId), eq(videoVariantJobs.userId, user.id)));
      if (!job) return res.status(404).json({ error: "Job not found or not authorized" });

      // Re-run stitching for just this variant
      const { videoClips } = await import("../../drizzle/schema");
      const clips = await db.select().from(videoClips).where(eq(videoClips.jobId, variant.jobId));
      const hookClip = clips.find((c: any) => c.id === variant.hookClipId);
      const bodyClip = clips.find((c: any) => c.id === variant.bodyClipId);
      const ctaClip = variant.ctaClipId ? clips.find((c: any) => c.id === variant.ctaClipId) : null;
      if (!hookClip || !bodyClip) return res.status(400).json({ error: "Source clips not found" });

      // Import helpers from videoVariantRouter
      const { runStitchingJob: _unused, ...rest } = await import("../videoVariantRouter");
      // Re-run the full job (simplest safe approach — re-stitches all variants)
      // For a single-variant retry we re-run the full job which is idempotent for done variants
      console.log(`[stitch-variant] Retrying variant ${variantId} via full job re-run for job ${job.id}`);
      await runStitchingJob(job.id);
      return res.json({ ok: true });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[stitch-variant] Error:`, msg);
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

      const notes = typeof req.body?.notes === "string" ? req.body.notes.trim() : "";
      console.log(`[Drive Export] Exporting ${doneVariants.length} variants for job ${jobId}…`);
      const result = await exportVariantsToDrive({
        jobTitle: job.jobName || `Job ${jobId}`,
        variants: doneVariants.map((v: any) => ({ label: v.variantLabel, s3Url: v.s3Url })),
        notes: notes || undefined,
      });

      // Persist the Drive folder URL on the job row so it shows in History
      if (result.folderUrl) {
        await db.update(jobsTable)
          .set({ driveExportUrl: result.folderUrl })
          .where(eq(jobsTable.id, jobId));
      }

      return res.json(result);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[Drive Export] Error:`, msg);
      return res.status(500).json({ error: msg });
    }
  });

  // ── Book PDF upload endpoints ────────────────────────────────────────────────
  // POST /api/books/upload — accepts PDF + bookId, extracts text, uploads to S3
  const pdfUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });

  app.post("/api/books/upload", pdfUpload.single("pdf"), async (req: any, res: any) => {
    try {
      const user = await sdk.authenticateRequest(req);
      const file = req.file;
      if (!file) return res.status(400).json({ error: "No PDF file provided" });
      if (file.mimetype !== "application/pdf" && !file.originalname.endsWith(".pdf")) {
        return res.status(400).json({ error: "Only PDF files are accepted" });
      }

      // Extract text from PDF
      let text = "";
      let pageCount = 0;
      try {
        const parser = new PDFParse({ data: file.buffer });
        const parsed = await parser.getText();
        text = parsed.text ?? "";
        pageCount = parsed.total ?? 0;
      } catch (parseErr) {
        console.error("[books/upload] PDF parse error:", parseErr);
        text = "";
        pageCount = 0;
      }

      // Upload PDF to S3
      const suffix = Math.random().toString(36).substring(2, 8);
      const s3Key = `books/${user.id}/${suffix}-${file.originalname.replace(/[^a-zA-Z0-9._-]/g, "-")}`;
      const { url: s3Url } = await storagePut(s3Key, file.buffer, "application/pdf");

      return res.json({ s3Key, s3Url, text, pageCount });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[books/upload] Error:", msg);
      return res.status(500).json({ error: msg });
    }
  });

  // POST /api/books/extract-pdf — extract text only (no S3 upload)
  app.post("/api/books/extract-pdf", pdfUpload.single("pdf"), async (req: any, res: any) => {
    try {
      await sdk.authenticateRequest(req);
      const file = req.file;
      if (!file) return res.status(400).json({ error: "No PDF file provided" });

      const parser = new PDFParse({ data: file.buffer });
      const parsed = await parser.getText();
      return res.json({ text: parsed.text ?? "", pageCount: parsed.total ?? 0 });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return res.status(500).json({ error: msg });
    }
  });

  // POST /api/upload-card — accepts PNG blob from client-side canvas renderer,
  // uploads it to S3, returns public URL. Used by TitleCardRenderer.tsx.
  const cardUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });
  app.post("/api/upload-card", cardUpload.single("file"), async (req: any, res: any) => {
    try {
      const user = await sdk.authenticateRequest(req);
      const file = req.file;
      if (!file) return res.status(400).json({ error: "No file provided" });
      const platform = (req.body?.platform as string) ?? "unknown";
      const suffix = Date.now() + "-" + Math.random().toString(36).substring(2, 6);
      const key = `title-cards/${user.id}/${platform}-${suffix}.png`;
      const { url } = await storagePut(key, file.buffer, "image/png");
      return res.json({ url });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[upload-card] Error:", msg);
      return res.status(500).json({ error: msg });
    }
  });

  // POST /api/ebook/upload-source — accepts PDF/TXT/MD document as ebook source,
  // extracts text, uploads to S3, returns { s3Url, text, fileName, wordCount }
  const ebookSourceUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });
  app.post("/api/ebook/upload-source", ebookSourceUpload.single("file"), async (req: any, res: any) => {
    try {
      const user = await sdk.authenticateRequest(req);
      const file = req.file;
      if (!file) return res.status(400).json({ error: "No file provided" });

      const mime = file.mimetype;
      const name = file.originalname ?? "source";
      let extractedText = "";

      if (mime === "application/pdf" || name.endsWith(".pdf")) {
        try {
          const parser = new PDFParse({ data: file.buffer });
          const parsed = await parser.getText();
          extractedText = parsed.text ?? "";
        } catch (e) {
          extractedText = "";
        }
      } else if (
        mime === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
        name.endsWith(".docx")
      ) {
        try {
          const result = await mammoth.extractRawText({ buffer: file.buffer });
          extractedText = result.value ?? "";
        } catch (e) {
          extractedText = "";
        }
      } else {
        // TXT, MD — treat buffer as UTF-8 text
        extractedText = file.buffer.toString("utf-8");
      }

      // Upload original file to S3
      const suffix = Date.now() + "-" + Math.random().toString(36).substring(2, 6);
      const safeFileName = name.replace(/[^a-zA-Z0-9._-]/g, "-");
      const s3Key = `ebook-sources/${user.id}/${suffix}-${safeFileName}`;
      const { url: s3Url } = await storagePut(s3Key, file.buffer, mime || "application/octet-stream");

      const wordCount = extractedText.split(/\s+/).filter(Boolean).length;
      return res.json({ s3Url, text: extractedText, fileName: name, wordCount });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[ebook/upload-source] Error:", msg);
      return res.status(500).json({ error: msg });
    }
  });

  // POST /api/ebook/upload-enhancement-doc — accepts PDF/TXT/MD document for chapter enhancement,
  // extracts text, returns { text, fileName, wordCount }
  const ebookEnhancementUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });
  app.post("/api/ebook/upload-enhancement-doc", ebookEnhancementUpload.single("file"), async (req: any, res: any) => {
    try {
      const user = await sdk.authenticateRequest(req);
      const file = req.file;
      if (!file) return res.status(400).json({ error: "No file provided" });

      const mime = file.mimetype;
      const name = file.originalname ?? "doc";
      let extractedText = "";

      if (mime === "application/pdf" || name.endsWith(".pdf")) {
        try {
          const parser = new PDFParse({ data: file.buffer });
          const parsed = await parser.getText();
          extractedText = parsed.text ?? "";
        } catch (e) {
          extractedText = "";
        }
      } else if (
        mime === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
        name.endsWith(".docx")
      ) {
        try {
          const result = await mammoth.extractRawText({ buffer: file.buffer });
          extractedText = result.value ?? "";
        } catch (e) {
          extractedText = "";
        }
      } else {
        // TXT, MD — treat buffer as UTF-8 text
        extractedText = file.buffer.toString("utf-8");
      }

      const wordCount = extractedText.split(/\s+/).filter(Boolean).length;
      return res.json({ text: extractedText, fileName: name, wordCount });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[ebook/upload-enhancement-doc] Error:", msg);
      return res.status(500).json({ error: msg });
    }
  });

  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
      onError({ path, error }) {
        // Log every tRPC error with full stack trace to trace JSON.parse crashes
        const cause = error.cause;
        const causeMsg = cause instanceof Error ? cause.message : String(cause ?? '');
        const causeStack = cause instanceof Error ? cause.stack : '';
        console.error(`[tRPC ERROR] path=${path} code=${error.code}`);
        console.error(`[tRPC ERROR] message: ${error.message}`);
        if (causeMsg) console.error(`[tRPC ERROR] cause: ${causeMsg}`);
        if (causeStack) console.error(`[tRPC ERROR] cause.stack:\n${causeStack}`);
        if (error.stack) console.error(`[tRPC ERROR] error.stack:\n${error.stack}`);
      },
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
