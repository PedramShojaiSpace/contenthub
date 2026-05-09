/**
 * Chunked video upload for Video Variant Factory.
 *
 * NEW FLOW (browser-direct upload — bypasses Cloud Run for large S3 uploads):
 *
 *   1. Browser slices file into 4 MB chunks and POSTs each to Cloud Run:
 *        POST /api/upload/video-chunk?uploadId=X&chunkIndex=N&...
 *        → 200 { received: true, chunkIndex }
 *
 *   2. Browser calls finalize. Cloud Run reassembles chunks on disk,
 *      inserts a placeholder DB row, and returns the forge upload URL
 *      so the browser can upload directly to storage:
 *        POST /api/upload/video-chunk/finalize
 *        → 200 { s3Key, uploadUrl, forgeApiKey }
 *
 *   3. Browser uploads the assembled MP4 directly to the forge storage proxy
 *      using the returned uploadUrl + forgeApiKey. This bypasses Cloud Run
 *      entirely for the large upload, eliminating the proxy bottleneck.
 *
 *   4. Browser calls confirm with the final CDN URL:
 *        POST /api/upload/video-chunk/confirm
 *        Body: { uploadId, jobId, clipType, clipOrder, filename, s3Key, s3Url }
 *        → 200 { clipId }
 *
 * Legacy single-file endpoint still works for small files (< 8 MB):
 *   POST /api/upload/video-clip
 *     Fields: file, jobId, clipType, clipOrder
 *     → 202 { pending: true, tempId }
 */

import express, { Request, Response } from "express";
import multer from "multer";
import fs from "fs";
import path from "path";
import os from "os";
import { getDb } from "./db";
import { videoClips, videoVariantJobs } from "../drizzle/schema";
import { eq, and } from "drizzle-orm";
import { sdk } from "./_core/sdk";
import { ENV } from "./_core/env";

const CHUNK_UPLOAD_DIR = path.join(os.tmpdir(), "vvf-chunks");
const LEGACY_UPLOAD_DIR = path.join(os.tmpdir(), "vvf-uploads");

// Ensure temp dirs exist
try { fs.mkdirSync(CHUNK_UPLOAD_DIR, { recursive: true }); } catch {}
try { fs.mkdirSync(LEGACY_UPLOAD_DIR, { recursive: true }); } catch {}

// ── Multer instances ──────────────────────────────────────────────────────────

// For legacy single-file uploads (small files only)
const legacyUpload = multer({
  dest: LEGACY_UPLOAD_DIR,
  limits: { fileSize: 500 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === "video/mp4" || file.originalname.endsWith(".mp4")) {
      cb(null, true);
    } else {
      cb(new Error("Only MP4 files are accepted"));
    }
  },
});

// Raw binary middleware for chunk uploads — avoids multipart encoding overhead
// that can trigger Cloud Run gateway 413/502 errors.
// Metadata is passed via query parameters instead of form fields.
//
// IMPORTANT: type must be "*/*" (not "application/octet-stream") because the
// Cloud Run gateway / Vite proxy can rewrite or strip the Content-Type header
// in transit. Using "*/*" ensures express.raw() always parses the body buffer
// regardless of what the gateway does to the header. The route is scoped only
// to /api/upload/video-chunk so there is no risk of consuming other requests.
export const videoChunkMiddleware = express.raw({
  type: "*/*",
  limit: "6mb",
});
export const videoUploadMiddleware = legacyUpload.single("file");

function randomSuffix() {
  return Math.random().toString(36).slice(2, 8);
}

// ── Chunk receive handler (raw binary) ─────────────────────────────────────────
// Client sends: Content-Type: application/octet-stream
// Metadata in query params: uploadId, chunkIndex, totalChunks, jobId, clipType, clipOrder
export async function handleVideoChunkUpload(req: Request, res: Response) {
  try {
    let user = null;
    try { user = await sdk.authenticateRequest(req); } catch { user = null; }
    if (!user) return res.status(401).json({ error: "Unauthorized" });

    const chunkBuffer = req.body as Buffer;
    if (!Buffer.isBuffer(chunkBuffer) || chunkBuffer.length === 0) {
      return res.status(400).json({ error: "No chunk data received" });
    }

    const uploadId = (req.query.uploadId ?? req.headers["x-upload-id"]) as string;
    const chunkIndex = parseInt((req.query.chunkIndex ?? req.headers["x-chunk-index"]) as string ?? "0", 10);

    if (!uploadId) return res.status(400).json({ error: "uploadId is required" });

    // Write chunk buffer directly to disk
    const chunkDir = path.join(CHUNK_UPLOAD_DIR, uploadId);
    fs.mkdirSync(chunkDir, { recursive: true });
    const destPath = path.join(chunkDir, `chunk-${chunkIndex}`);
    fs.writeFileSync(destPath, chunkBuffer);

    return res.status(200).json({ received: true, chunkIndex });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (!res.headersSent) return res.status(500).json({ error: msg });
  }
}

// ── Chunk finalize handler ────────────────────────────────────────────────────
// NEW: Reassembles chunks on disk, inserts a placeholder DB row, and returns
// the forge upload URL + frontend API key so the browser can upload directly.
// The browser then calls /confirm once the upload succeeds.

export async function handleVideoChunkFinalize(req: Request, res: Response) {
  try {
    let user = null;
    try { user = await sdk.authenticateRequest(req); } catch { user = null; }
    if (!user) return res.status(401).json({ error: "Unauthorized" });

    const { uploadId, jobId: jobIdStr, clipType, clipOrder: clipOrderStr, filename, totalChunks: totalChunksStr } = req.body;

    const jobId = parseInt(jobIdStr ?? "0", 10);
    const clipOrder = parseInt(clipOrderStr ?? "0", 10);
    const totalChunks = parseInt(totalChunksStr ?? "0", 10);

    if (!uploadId || !jobId || !totalChunks) {
      return res.status(400).json({ error: "uploadId, jobId, totalChunks are required" });
    }

    const db = await getDb();
    if (!db) return res.status(500).json({ error: "DB unavailable" });

    const [job] = await db.select()
      .from(videoVariantJobs)
      .where(and(eq(videoVariantJobs.id, jobId), eq(videoVariantJobs.userId, user.id)));

    if (!job) return res.status(404).json({ error: "Job not found" });

    // Verify all chunks are present
    const chunkDir = path.join(CHUNK_UPLOAD_DIR, uploadId);
    for (let i = 0; i < totalChunks; i++) {
      const chunkPath = path.join(chunkDir, `chunk-${i}`);
      if (!fs.existsSync(chunkPath)) {
        return res.status(400).json({ error: `Missing chunk ${i}` });
      }
    }

    // Reassemble chunks into one file synchronously (fast — just disk I/O)
    const assembledPath = path.join(os.tmpdir(), `vvf-assembled-${uploadId}.mp4`);
    try {
      const writeStream = fs.createWriteStream(assembledPath);
      for (let i = 0; i < totalChunks; i++) {
        const chunkPath = path.join(chunkDir, `chunk-${i}`);
        const chunkData = await fs.promises.readFile(chunkPath);
        await new Promise<void>((resolve, reject) => {
          writeStream.write(chunkData, (err) => err ? reject(err) : resolve());
        });
      }
      await new Promise<void>((resolve, reject) => {
        writeStream.end((err: Error | null | undefined) => err ? reject(err) : resolve());
      });
      // Clean up chunk dir
      try { fs.rmSync(chunkDir, { recursive: true, force: true }); } catch {}
    } catch (err) {
      try { fs.unlinkSync(assembledPath); } catch {}
      try { fs.rmSync(chunkDir, { recursive: true, force: true }); } catch {}
      const msg = err instanceof Error ? err.message : String(err);
      return res.status(500).json({ error: `Reassembly failed: ${msg}` });
    }

    // Build the S3 key and forge upload URL
    const safeName = (filename || `clip-${uploadId}.mp4`).replace(/[^a-zA-Z0-9._-]/g, "_");
    const s3Key = `video-clips/${jobId}/${clipType}-${clipOrder}-${randomSuffix()}-${safeName}`;

    const baseUrl = ENV.forgeApiUrl?.replace(/\/+$/, "");
    const serverApiKey = ENV.forgeApiKey;
    const frontendApiKey = process.env.VITE_FRONTEND_FORGE_API_KEY ?? "";

    if (!baseUrl || !serverApiKey) {
      return res.status(500).json({ error: "Storage proxy credentials missing" });
    }

    const uploadUrl = `${baseUrl}/v1/storage/upload?path=${encodeURIComponent(s3Key)}`;

    // Insert a placeholder DB row so the confirm endpoint can update it
    const [inserted] = await db.insert(videoClips).values({
      jobId,
      clipType: clipType as "hook" | "body" | "cta",
      s3Key,
      s3Url: "",   // placeholder — updated by /confirm
      filename: filename || `clip-${uploadId}.mp4`,
      clipOrder,
    });
    const clipId = (inserted as any).insertId ?? null;

    if (clipType === "hook" && clipId !== null) {
      const hooks = await db.select()
        .from(videoClips)
        .where(and(eq(videoClips.jobId, jobId), eq(videoClips.clipType, "hook")));
      await db.update(videoVariantJobs)
        .set({ hookCount: hooks.length })
        .where(eq(videoVariantJobs.id, jobId));
    }

    // Schedule assembled file cleanup after 2 hours (browser uploads directly)
    setTimeout(() => {
      try { fs.unlinkSync(assembledPath); } catch {}
    }, 2 * 60 * 60 * 1000);

    console.log(`[VVF] Finalize ready: ${clipType} clip for job ${jobId}, clipId=${clipId}, key=${s3Key}`);

    // Return the upload URL and frontend API key so the browser can upload directly
    return res.status(200).json({
      s3Key,
      uploadUrl,
      // Use the frontend API key so the browser can authenticate with forge
      // without exposing the server-side key
      forgeApiKey: frontendApiKey || serverApiKey,
      clipId,
      assembledPath,  // returned so confirm endpoint can clean up
    });

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (!res.headersSent) return res.status(500).json({ error: msg });
  }
}

// ── Confirm handler ────────────────────────────────────────────────────────────
// Called by the browser after it successfully uploads to forge storage.
// Writes the final CDN URL to the DB row and cleans up the assembled temp file.

export async function handleVideoChunkConfirm(req: Request, res: Response) {
  try {
    let user = null;
    try { user = await sdk.authenticateRequest(req); } catch { user = null; }
    if (!user) return res.status(401).json({ error: "Unauthorized" });

    const { jobId: jobIdStr, clipType, clipOrder: clipOrderStr, s3Key, s3Url, assembledPath } = req.body;
    const jobId = parseInt(jobIdStr ?? "0", 10);
    const clipOrder = parseInt(clipOrderStr ?? "0", 10);

    if (!jobId || !s3Key || !s3Url) {
      return res.status(400).json({ error: "jobId, s3Key, s3Url are required" });
    }

    const db = await getDb();
    if (!db) return res.status(500).json({ error: "DB unavailable" });

    // Verify the job belongs to this user
    const [job] = await db.select()
      .from(videoVariantJobs)
      .where(and(eq(videoVariantJobs.id, jobId), eq(videoVariantJobs.userId, user.id)));
    if (!job) return res.status(404).json({ error: "Job not found" });

    // Update the placeholder row with the real CDN URL
    await db.update(videoClips)
      .set({ s3Url })
      .where(and(
        eq(videoClips.jobId, jobId),
        eq(videoClips.s3Key, s3Key),
      ));

    // Clean up assembled temp file
    if (assembledPath) {
      try { fs.unlinkSync(assembledPath); } catch {}
    }

    console.log(`[VVF] Confirm: ${clipType} clip for job ${jobId}, clipOrder=${clipOrder}, url=${s3Url.substring(0, 60)}...`);
    return res.status(200).json({ ok: true });

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (!res.headersSent) return res.status(500).json({ error: msg });
  }
}

// ── Legacy single-file handler (kept for backward compat / small files) ───────

export async function handleVideoClipUpload(req: Request, res: Response) {
  try {
    let user = null;
    try { user = await sdk.authenticateRequest(req); } catch { user = null; }
    if (!user) {
      if (req.file?.path) { try { fs.unlinkSync(req.file.path); } catch {} }
      return res.status(401).json({ error: "Unauthorized" });
    }

    const file = req.file;
    if (!file) return res.status(400).json({ error: "No file uploaded" });

    const jobId = parseInt(req.body.jobId ?? "0", 10);
    const clipType = (req.body.clipType ?? "hook") as "hook" | "body" | "cta";
    const clipOrder = parseInt(req.body.clipOrder ?? "0", 10);

    if (!jobId) {
      fs.unlinkSync(file.path);
      return res.status(400).json({ error: "jobId is required" });
    }

    const db = await getDb();
    if (!db) {
      fs.unlinkSync(file.path);
      return res.status(500).json({ error: "DB unavailable" });
    }

    const [job] = await db.select()
      .from(videoVariantJobs)
      .where(and(eq(videoVariantJobs.id, jobId), eq(videoVariantJobs.userId, user.id)));

    if (!job) {
      fs.unlinkSync(file.path);
      return res.status(404).json({ error: "Job not found" });
    }

    const tempId = `${clipType}-${clipOrder}-${randomSuffix()}`;
    res.status(202).json({ pending: true, tempId, clipType, clipOrder });

    // For legacy small-file uploads, still use the server-side upload path
    _processLegacyUpload({
      filePath: file.path,
      originalName: file.originalname,
      jobId,
      clipType,
      clipOrder,
    });

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (req.file?.path) { try { fs.unlinkSync(req.file.path); } catch {} }
    if (!res.headersSent) return res.status(500).json({ error: msg });
  }
}

// Legacy upload helper — only used by the old single-file endpoint
async function _processLegacyUpload(opts: {
  filePath: string;
  originalName: string;
  jobId: number;
  clipType: "hook" | "body" | "cta";
  clipOrder: number;
}) {
  const { filePath, originalName, jobId, clipType, clipOrder } = opts;
  try {
    const db = await getDb();
    if (!db) throw new Error("DB unavailable");

    const safeName = originalName.replace(/[^a-zA-Z0-9._-]/g, "_");
    const s3Key = `video-clips/${jobId}/${clipType}-${clipOrder}-${randomSuffix()}-${safeName}`;

    const baseUrl = ENV.forgeApiUrl?.replace(/\/+$/, "");
    const apiKey = ENV.forgeApiKey;
    if (!baseUrl || !apiKey) throw new Error("Storage proxy credentials missing");

    const buf = fs.readFileSync(filePath);
    const FormData = (await import("form-data")).default;
    const axios = (await import("axios")).default;
    const form = new FormData();
    form.append("file", buf, { filename: safeName, contentType: "video/mp4", knownLength: buf.length });
    const uploadUrl = `${baseUrl}/v1/storage/upload?path=${encodeURIComponent(s3Key)}`;
    const response = await axios.post(uploadUrl, form, {
      headers: { ...form.getHeaders(), Authorization: `Bearer ${apiKey}` },
      maxBodyLength: Infinity,
      maxContentLength: Infinity,
      timeout: 10 * 60 * 1000,
    });
    const s3Url = response.data?.url;
    if (!s3Url) throw new Error("Storage proxy did not return a URL");

    try { fs.unlinkSync(filePath); } catch {}

    await db.insert(videoClips).values({
      jobId,
      clipType,
      s3Key,
      s3Url,
      filename: originalName,
      clipOrder,
    });

    if (clipType === "hook") {
      const hooks = await db.select()
        .from(videoClips)
        .where(and(eq(videoClips.jobId, jobId), eq(videoClips.clipType, "hook")));
      await db.update(videoVariantJobs)
        .set({ hookCount: hooks.length })
        .where(eq(videoVariantJobs.id, jobId));
    }
  } catch (err) {
    console.error(`[VVF] Legacy upload failed for job ${jobId}:`, err);
    try { fs.unlinkSync(filePath); } catch {}
  }
}

// ── TEMPORARY DIAGNOSTIC: test storage proxy with a small video ───────────────
export async function handleStorageDiagnostic(req: Request, res: Response) {
  try {
    const baseUrl = ENV.forgeApiUrl?.replace(/\/+$/, "");
    const apiKey = ENV.forgeApiKey;
    if (!baseUrl || !apiKey) return res.json({ error: "No credentials" });

    const testBuffer = Buffer.alloc(1024 * 50, 0); // 50KB
    const key = `diag-test-${Date.now()}.mp4`;
    const uploadUrl = `${baseUrl}/v1/storage/upload?path=${encodeURIComponent(key)}`;

    const FormData = (await import("form-data")).default;
    const axios = (await import("axios")).default;
    const form = new FormData();
    form.append("file", testBuffer, { filename: key, contentType: "video/mp4", knownLength: testBuffer.length });

    const response = await axios.post(uploadUrl, form, {
      headers: { ...form.getHeaders(), Authorization: `Bearer ${apiKey}` },
      maxBodyLength: Infinity,
      timeout: 15000,
    });
    return res.json({ success: true, data: response.data });
  } catch (err: any) {
    return res.json({
      success: false,
      status: err.response?.status,
      statusText: err.response?.statusText,
      body: err.response?.data,
      message: err.message,
      code: err.code,
    });
  }
}
