import "dotenv/config";
import express from "express";
import { ENV } from "./env";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { registerStorageProxy } from "./storageProxy";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { startWeeklyDigestCron } from "../digest";
import { handleIngestResearchReport } from "../ingestRouter";
import { handleNewsfeedRefresh } from "../newsfeedScheduled";
import { gscDigestHandler } from "../gscDigestHandler";
import { keywordPriorityDigestHandler } from "../keywordPriorityDigestHandler";
import { rankSnapshotHandler } from "../rankSnapshotHandler";
import { scoreboardDigestHandler } from "../scoreboardDigestHandler";
import { gscBackfillHandler } from "../gscBackfillHandler";
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

  // Extend server timeouts so long LLM calls (ebook generation, analysis) are not cut
  // off by the Cloud Run load balancer. Cloud Run's default request timeout is 3600s;
  // Node's default keepAliveTimeout (5s) is shorter than the LB's idle timeout (600s),
  // causing spurious 502s on long-running requests.
  server.keepAliveTimeout = 620_000; // 620 seconds
  server.headersTimeout  = 630_000; // must be > keepAliveTimeout

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
  // Storage proxy — serves /manus-storage/* paths via signed S3 URLs
  registerStorageProxy(app);
  // OAuth callback under /api/oauth/callback
  registerOAuthRoutes(app);
  // Ingest endpoint — accepts research reports from external apps
  // POST /api/ingest/research-report (authenticated via INGEST_SECRET header)
  app.post("/api/ingest/research-report", handleIngestResearchReport);
  // Daily newsfeed refresh — called by Manus scheduled task at 7 AM
  app.post("/api/scheduled/newsfeed-refresh", handleNewsfeedRefresh);
  // Weekly GSC SEO digest — every Monday 09:00 UTC
  app.post("/api/scheduled/gsc-digest", gscDigestHandler);
  app.post("/api/scheduled/keyword-priority-digest", keywordPriorityDigestHandler);
  // Weekly rank snapshot — every Monday at 10:00 UTC
  app.post("/api/scheduled/rank-snapshot", rankSnapshotHandler);
  app.post("/api/scheduled/scoreboard-digest", scoreboardDigestHandler);
  // Daily GSC indexing backfill — submits up to 200 unindexed URLs per day
  app.post("/api/scheduled/gsc-backfill", gscBackfillHandler);
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

  // ── Google Search Console OAuth ────────────────────────────────────────────
  // GET /api/gsc/auth-url — returns the GSC OAuth authorization URL
  app.get("/api/gsc/auth-url", async (req, res) => {
    try {
      await sdk.authenticateRequest(req);
      const { getGscAuthUrl } = await import("../googleSearchConsole");
      const url = getGscAuthUrl();
      return res.json({ url });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return res.status(400).json({ error: msg });
    }
  });

  // GET /api/gsc/callback — Google redirects here after authorization
  app.get("/api/gsc/callback", async (req, res) => {
    const code = req.query.code as string;
    if (!code) return res.status(400).send("Missing authorization code");
    try {
      const { exchangeGscCode } = await import("../googleSearchConsole");
      const { refreshToken } = await exchangeGscCode(code);
      // Store the refresh token in the DB for the owner (resolved by OWNER_OPEN_ID, not hardcoded)
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      const { getOwnerCredentials } = await import("../db");
      const { userCredentials, users } = await import("../../drizzle/schema");
      // Resolve owner userId from OWNER_OPEN_ID env
      const ownerOpenId = ENV.ownerOpenId || process.env.OWNER_OPEN_ID;
      if (!ownerOpenId) throw new Error("OWNER_OPEN_ID not configured");
      const [owner] = await db.select({ id: users.id }).from(users).where(eq(users.openId, ownerOpenId));
      if (!owner) throw new Error("Owner user not found in database");
      const ownerUserId = owner.id;
      const [existing] = await db.select().from(userCredentials).where(eq(userCredentials.userId, ownerUserId));
      if (existing) {
        await db.update(userCredentials).set({ gscRefreshToken: refreshToken }).where(eq(userCredentials.userId, ownerUserId));
      } else {
        await db.insert(userCredentials).values({ userId: ownerUserId, gscRefreshToken: refreshToken });
      }
      // If opened as a popup, notify the parent and close.
      // If opened as a full-page redirect, navigate back to the dashboard.
      return res.send(`
        <html><body style="font-family:sans-serif;padding:40px;max-width:600px;text-align:center">
          <h2 style="color:#16a34a">&#x2705; Google Search Console Connected!</h2>
          <p>Your Search Console data is now available in the SEO Dashboard.</p>
          <p style="color:#6b7280;font-size:14px">This window will close automatically...</p>
          <script>
            try {
              if (window.opener && !window.opener.closed) {
                window.opener.postMessage({ type: 'GSC_AUTH_SUCCESS' }, '*');
                setTimeout(() => window.close(), 800);
              } else {
                // Full-page flow: redirect to SEO dashboard
                setTimeout(() => { window.location.href = '/seo-dashboard'; }, 1500);
              }
            } catch(e) {
              setTimeout(() => { window.location.href = '/seo-dashboard'; }, 1500);
            }
          </script>
        </body></html>
      `);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return res.status(500).send(`<html><body><h2>\u274c Authorization failed</h2><p>${msg}</p></body></html>`);
    }
  });

  // ── Gmail OAuth routes (Backlink Outreach Engine) ───────────────────────
  // GET /api/gmail/auth-url — returns the OAuth URL for Alyzza to authorize
  app.get("/api/gmail/auth-url", async (req, res) => {
    try {
      await sdk.authenticateRequest(req);
      const { getGmailAuthUrl } = await import("../gmail");
      const url = getGmailAuthUrl();
      return res.json({ url });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return res.status(400).json({ error: msg });
    }
  });
  // GET /api/gmail/callback — Google redirects here after Alyzza authorizes
  app.get("/api/gmail/callback", async (req, res) => {
    const code = req.query.code as string;
    if (!code) return res.status(400).send("Missing authorization code");
    try {
      const { exchangeGmailCode } = await import("../gmail");
      const { refreshToken, email } = await exchangeGmailCode(code);
      // Store in process.env so the current server process can use it immediately
      process.env.GMAIL_REFRESH_TOKEN = refreshToken;
      // Also persist in DB so it survives restarts (stored in userCredentials as a generic token)
      const db = await getDb();
      if (db) {
        const { userCredentials } = await import("../../drizzle/schema");
        const [existing] = await db.select().from(userCredentials).where(eq(userCredentials.userId, 1));
        if (existing) {
          await db.update(userCredentials)
            .set({ gmailRefreshToken: refreshToken } as any)
            .where(eq(userCredentials.userId, 1));
        } else {
          await db.insert(userCredentials).values({ userId: 1, gmailRefreshToken: refreshToken } as any);
        }
      }
      return res.send(`
        <html><body style="font-family:sans-serif;padding:40px;max-width:600px">
          <h2>&#x2705; Gmail Connected!</h2>
          <p>Outreach emails will now be sent from <strong>${email}</strong> as Dr. Pedram Shojai.</p>
          <p><a href="/backlink-outreach">&larr; Return to Backlink Outreach</a></p>
          <script>setTimeout(() => { window.location.href = '/backlink-outreach'; }, 2000);</script>
        </body></html>
      `);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return res.status(500).send(`<html><body><h2>&#x274c; Authorization failed</h2><p>${msg}</p></body></html>`);
    }
  });
  // GET /api/gmail/status — check if Gmail is authorized
  app.get("/api/gmail/status", async (req, res) => {
    try {
      await sdk.authenticateRequest(req);
      return res.json({ authorized: !!process.env.GMAIL_REFRESH_TOKEN });
    } catch {
      return res.json({ authorized: false });
    }
  });

  // ── YouTube Data API OAuth ──────────────────────────────────────────────────
  // GET /api/youtube/auth-url — returns the OAuth URL for the channel owner to authorize
  app.get("/api/youtube/auth-url", async (req, res) => {
    try {
      await sdk.authenticateRequest(req);
      const { getYouTubeAuthUrl } = await import("../youtubeOAuth");
      const url = getYouTubeAuthUrl();
      return res.json({ url });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return res.status(400).json({ error: msg });
    }
  });
  // GET /api/youtube/callback — Google redirects here after authorization
  app.get("/api/youtube/callback", async (req, res) => {
    const code = req.query.code as string;
    if (!code) return res.status(400).send("Missing authorization code");
    try {
      const { exchangeYouTubeCode } = await import("../youtubeOAuth");
      const { refreshToken, channelTitle } = await exchangeYouTubeCode(code);
      // Store in process.env so the current server process can use it immediately
      process.env.YOUTUBE_REFRESH_TOKEN = refreshToken;
      // Persist in DB using the owner's actual userId (resolved via OWNER_OPEN_ID),
      // NOT a hardcoded userId=1 which may not match in all environments.
      const db = await getDb();
      if (db) {
        const { userCredentials, users } = await import("../../drizzle/schema");
        const ownerOpenId = ENV.ownerOpenId || process.env.OWNER_OPEN_ID;
        let ownerUserId = 1; // fallback
        if (ownerOpenId) {
          const [owner] = await db.select({ id: users.id }).from(users).where(eq(users.openId, ownerOpenId));
          if (owner) ownerUserId = owner.id;
        }
        const [existing] = await db.select().from(userCredentials).where(eq(userCredentials.userId, ownerUserId));
        if (existing) {
          await db.update(userCredentials)
            .set({ youtubeRefreshToken: refreshToken, youtubeChannelTitle: channelTitle } as any)
            .where(eq(userCredentials.userId, ownerUserId));
        } else {
          await db.insert(userCredentials).values({ userId: ownerUserId, youtubeRefreshToken: refreshToken, youtubeChannelTitle: channelTitle } as any);
        }
      }
      // If opened as a popup, notify the opener and close; otherwise redirect back.
      return res.send(`
        <html><body style="font-family:sans-serif;padding:40px;max-width:600px;text-align:center">
          <h2 style="color:#16a34a">&#x2705; YouTube Connected!</h2>
          <p>Channel: <strong>${channelTitle}</strong></p>
          <p>You can close this window and return to your workflow.</p>
          <script>
            // If opened as a popup, send a message to the parent and close.
            if (window.opener && !window.opener.closed) {
              window.opener.postMessage({ type: 'YOUTUBE_AUTH_SUCCESS', channelTitle: '${channelTitle.replace(/'/g, "\\'").replace(/"/g, '&quot;')}' }, window.location.origin);
              setTimeout(() => window.close(), 800);
            } else {
              // Fallback: full-page redirect back to the pipeline
              setTimeout(() => { window.location.href = '/video-to-blog'; }, 1500);
            }
          </script>
        </body></html>
      `);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return res.status(500).send(`<html><body style="font-family:sans-serif;padding:40px"><h2 style="color:#dc2626">&#x274c; Authorization failed</h2><p>${msg}</p><p><a href="/video-to-blog">&larr; Return to pipeline</a></p></body></html>`);
    }
  });
  // GET /api/youtube/status — check if YouTube is authorized
  app.get("/api/youtube/status", async (req, res) => {
    try {
      await sdk.authenticateRequest(req);
      return res.json({ authorized: !!process.env.YOUTUBE_REFRESH_TOKEN });
    } catch {
      return res.json({ authorized: false });
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

  // Reddit nightly refresh + analyze — called by Manus Heartbeat at 7:00 AM UTC
  const { handleRedditNightly } = await import("../redditScheduled");
  app.post("/api/scheduled/reddit-nightly", handleRedditNightly);

  // Buffer → Kanban status sync — every 30 min, advances 'scheduled' items past their dueAt to 'published'
  const { handleBufferSync } = await import("../bufferSyncHandler");
  app.post("/api/scheduled/buffer-sync", handleBufferSync);

  // Syndication pipeline — runs daily at 08:00 UTC
  // Processes pending syndication jobs: Substack (Day 1), Medium (Day 2), Quora (Day 3)
  app.post("/api/scheduled/syndication", async (req, res) => {
    try {
      const { handleSyndicationCron } = await import("../syndicationRouter");
      const result = await handleSyndicationCron(req as unknown as { headers: Record<string, string | string[] | undefined> });
      res.json({ ok: true, ...result });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[Syndication Cron] Handler error:", msg);
      res.status(500).json({ error: msg, timestamp: new Date().toISOString() });
    }
  });

  // ── Ads Optimization cron — daily at 06:00 UTC ──────────────────────────────
  app.post("/api/scheduled/ads-optimize", async (req, res) => {
    try {
      const { runDailyOptimization } = await import("../adsOptimizationEngine");
      const result = await runDailyOptimization();
      res.json({ ok: true, ...result });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[Ads Optimizer Cron] Handler error:", msg);
      res.status(500).json({ error: msg, timestamp: new Date().toISOString() });
    }
  });

  // ── Ads Weekly Digest — every Monday at 08:00 UTC ─────────────────────────
  app.post("/api/scheduled/ads-weekly-digest", async (req, res) => {
    try {
      const { generateWeeklyDigest } = await import("../adsWeeklyDigest");
      const result = await generateWeeklyDigest();
      res.json({ ok: true, ...result });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[Ads Digest Cron] Handler error:", msg);
      res.status(500).json({ error: msg, timestamp: new Date().toISOString() });
    }
  });

  // ── Video Pipeline cron — every 15 minutes, polls Descript jobs ────────────
  app.post("/api/scheduled/video-pipeline", async (req, res) => {
    try {
      const { processScheduledVideoJobs } = await import("../descriptPipeline");
      const result = await processScheduledVideoJobs();
      res.json({ ok: true, ...result });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[Video Pipeline Cron] Handler error:", msg);
      res.status(500).json({ error: msg, timestamp: new Date().toISOString() });
    }
  });

  // ── Hosted Landing Pages (ch.theurbanmonk.com) ────────────────────────────
  // Public routes: /{campaign}/{slug} — serves full HTML pages
  // Campaigns: lo | gut | sleep | webinar
  app.get("/:campaign(lo|gut|sleep|webinar)/:slug", async (req, res) => {
    try {
      const { campaign, slug } = req.params as { campaign: "lo" | "gut" | "sleep" | "webinar"; slug: string };
      const { getDb } = await import("../db");
      const { hostedLandingPages } = await import("../../drizzle/schema");
      const { eq, and } = await import("drizzle-orm");
      const { renderLandingPageHtml } = await import("../hostedLandingPagesRouter");
      const db = await getDb();
      if (!db) return res.status(503).send("Service unavailable");
      const [page] = await db
        .select()
        .from(hostedLandingPages)
        .where(and(eq(hostedLandingPages.campaign, campaign), eq(hostedLandingPages.slug, slug)))
        .limit(1);
      if (!page || page.status !== "published") {
        return res.status(404).send(`<!DOCTYPE html><html><head><title>Page Not Found</title></head><body style="font-family:sans-serif;text-align:center;padding:80px"><h1>404 — Page Not Found</h1><p>This page does not exist or has not been published yet.</p></body></html>`);
      }
      // Increment view count (fire and forget)
      db.update(hostedLandingPages).set({ viewCount: (page.viewCount || 0) + 1 }).where(eq(hostedLandingPages.id, page.id)).catch(() => {});
      const html = renderLandingPageHtml(page);
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.setHeader("Cache-Control", "public, max-age=60, stale-while-revalidate=300");
      return res.send(html);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[landing-page] Error:`, msg);
      return res.status(500).send(`<html><body><h2>Error</h2><p>${msg}</p></body></html>`);
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

    // ── Startup: Restore OAuth tokens from DB into process.env ───────────────
    // process.env tokens are set in-memory during OAuth callbacks but are lost
    // on every server restart. This restores them from the DB so the server
    // works correctly without requiring the user to re-authorize after restarts.
    (async () => {
      try {
        const { getDb } = await import("../db");
        const { userCredentials, users } = await import("../../drizzle/schema");
        const { eq } = await import("drizzle-orm");
        const db = await getDb();
        if (!db) return;
        const ownerOpenId = ENV.ownerOpenId || process.env.OWNER_OPEN_ID;
        let ownerUserId = 1;
        if (ownerOpenId) {
          const [owner] = await db.select({ id: users.id }).from(users).where(eq(users.openId, ownerOpenId));
          if (owner) ownerUserId = owner.id;
        }
        const [creds] = await db.select().from(userCredentials).where(eq(userCredentials.userId, ownerUserId));
        if (creds) {
          if ((creds as any).youtubeRefreshToken && !process.env.YOUTUBE_REFRESH_TOKEN) {
            process.env.YOUTUBE_REFRESH_TOKEN = (creds as any).youtubeRefreshToken;
            console.log(`[Startup] Restored YOUTUBE_REFRESH_TOKEN from DB (channel: ${(creds as any).youtubeChannelTitle ?? 'unknown'})`);
          }
          if ((creds as any).gmailRefreshToken && !process.env.GMAIL_REFRESH_TOKEN) {
            process.env.GMAIL_REFRESH_TOKEN = (creds as any).gmailRefreshToken;
            console.log(`[Startup] Restored GMAIL_REFRESH_TOKEN from DB`);
          }
        } else {
          console.log(`[Startup] No user credentials found in DB for owner userId=${ownerUserId}`);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`[Startup] Failed to restore OAuth tokens from DB:`, msg);
      }
    })();

    // Start the weekly Monday digest cron
    startWeeklyDigestCron();

    // ── Upload Watchdog: runs every 10 minutes ────────────────────────────────
    // Auto-recovers video jobs stuck in 'uploading' after a server restart.
    //
    // Recovery strategy (in priority order):
    //   1. If the job has a persisted ytUploadUri: attempt to RESUME the upload
    //      from where YouTube left off (YouTube resumable URIs are valid 7 days).
    //      This means zero re-uploading of already-sent chunks.
    //   2. If the URI is expired (404) or missing: reset to 'ready_for_review'
    //      so the VA can re-approve and trigger a fresh export + upload.
    const runUploadWatchdog = async () => {
      try {
        const { getDb } = await import("../db");
        const { videoJobs } = await import("../../drizzle/schema");
        const { eq, and, lt, isNotNull } = await import("drizzle-orm");
        const { spawnUploadWorker, isUploadWorkerRunning } = await import("../spawnUploadWorker");
        const db = await getDb();
        if (!db) return;
        // Use a shorter threshold (5 min) so we catch restarts quickly.
        const STUCK_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes
        const cutoff = Date.now() - STUCK_THRESHOLD_MS;
        // Find jobs stuck in 'uploading' where vaApprovedAt is set and older than 5 min
        const stuckJobs = await db
          .select({
            id: videoJobs.id,
            youtubeTitle: videoJobs.youtubeTitle,
            vaApprovedAt: videoJobs.vaApprovedAt,
          })
          .from(videoJobs)
          .where(and(
            eq(videoJobs.status, "uploading"),
            isNotNull(videoJobs.vaApprovedAt),
            lt(videoJobs.vaApprovedAt, cutoff)
          ));

        for (const job of stuckJobs) {
          const minutesStuck = job.vaApprovedAt ? Math.round((Date.now() - Number(job.vaApprovedAt)) / 60000) : '?';
          console.warn(`[Upload Watchdog] Job #${job.id} ("${job.youtubeTitle}") stuck in uploading for ${minutesStuck} min.`);

          // Check if the upload worker process is still running for this job
          if (isUploadWorkerRunning(job.id)) {
            console.log(`[Upload Watchdog] Job #${job.id}: Worker process is still running — skipping.`);
            continue;
          }

          // Worker is dead — re-spawn it. The worker will resume from the persisted URI if available.
          console.log(`[Upload Watchdog] Job #${job.id}: Worker not running — re-spawning upload worker.`);
          spawnUploadWorker(job.id);
        }

        if (stuckJobs.length > 0) {
          console.log(`[Upload Watchdog] Processed ${stuckJobs.length} stuck job(s).`);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`[Upload Watchdog] Error:`, msg);
      }
    };
    // Run immediately on startup (catches jobs stuck from before this deploy)
    runUploadWatchdog();
    // Then every 10 minutes
    setInterval(runUploadWatchdog, 10 * 60 * 1000);
  });
}

startServer().catch(console.error);
