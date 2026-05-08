/**
 * Chunked video upload for Video Variant Factory.
 *
 * The Cloud Run gateway has a hard request-body size limit (~32 MB).
 * To support large MP4 files (100 MB+), the browser slices the file into
 * 8 MB chunks and sends them one at a time.
 *
 * Endpoints:
 *   POST /api/upload/video-chunk
 *     Fields: uploadId, chunkIndex, totalChunks, jobId, clipType, clipOrder
 *     File:   chunk (binary slice of the MP4)
 *     → 200 { received: true, chunkIndex }
 *
 *   POST /api/upload/video-chunk/finalize
 *     Body (JSON): { uploadId, jobId, clipType, clipOrder, filename, totalChunks }
 *     → 202 { pending: true, tempId } (background: reassemble → S3 → DB)
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
import FormData from "form-data";
import axios from "axios";
import { getDb } from "./db";
import { videoClips, videoVariantJobs } from "../drizzle/schema";
import { eq, and } from "drizzle-orm";
import { sdk } from "./_core/sdk";

const CHUNK_UPLOAD_DIR = path.join(os.tmpdir(), "vvf-chunks");
const LEGACY_UPLOAD_DIR = path.join(os.tmpdir(), "vvf-uploads");

// Ensure temp dirs exist
try { fs.mkdirSync(CHUNK_UPLOAD_DIR, { recursive: true }); } catch {}
try { fs.mkdirSync(LEGACY_UPLOAD_DIR, { recursive: true }); } catch {}

// ── Multer instances ──────────────────────────────────────────────────────────

// For legacy single-file uploads (small files only))
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
export const videoChunkMiddleware = express.raw({
  type: "application/octet-stream",
  limit: "6mb",
});
export const videoUploadMiddleware = legacyUpload.single("file");

function randomSuffix() {
  return Math.random().toString(36).slice(2, 8);
}

// ── Stream upload to storage proxy using axios (no full-file RAM load) ────────
// Uses Node.js form-data with a ReadStream so the file is piped directly
// from disk to the proxy without buffering the whole video in memory.
async function streamUploadToStorage(
  relKey: string,
  filePath: string,
  contentType: string,
  timeoutMs = 20 * 60 * 1000  // 20-minute timeout for large files
): Promise<{ key: string; url: string }> {
  const { ENV } = await import("./_core/env");
  const baseUrl = ENV.forgeApiUrl?.replace(/\/+$/, "");
  const apiKey = ENV.forgeApiKey;
  if (!baseUrl || !apiKey) throw new Error("Storage proxy credentials missing");

  const key = relKey.replace(/^\/+/, "");
  const uploadUrl = `${baseUrl}/v1/storage/upload?path=${encodeURIComponent(key)}`;
  const filename = key.split("/").pop() ?? key;

  const form = new FormData();
  // Append as a ReadStream — axios will stream it directly without loading into RAM
  form.append("file", fs.createReadStream(filePath), {
    filename,
    contentType,
    knownLength: fs.statSync(filePath).size,
  });

  const response = await axios.post(uploadUrl, form, {
    headers: {
      ...form.getHeaders(),
      Authorization: `Bearer ${apiKey}`,
    },
    maxBodyLength: Infinity,
    maxContentLength: Infinity,
    timeout: timeoutMs,
  });

  const url = response.data?.url;
  if (!url) throw new Error("Storage proxy did not return a URL");
  return { key, url };
}

// ── Background S3 upload + DB insert ─────────────────────────────────────────

async function processUploadInBackground(opts: {
  filePath: string;
  originalName: string;
  jobId: number;
  clipType: "hook" | "body" | "cta";
  clipOrder: number;
}) {
  const { filePath, originalName, jobId, clipType, clipOrder } = opts;
  let clipId: number | null = null;
  try {
    const db = await getDb();
    if (!db) throw new Error("DB unavailable");

    const safeName = originalName.replace(/[^a-zA-Z0-9._-]/g, "_");
    const s3Key = `video-clips/${jobId}/${clipType}-${clipOrder}-${randomSuffix()}-${safeName}`;

    // ── Insert a placeholder row BEFORE the S3 upload so the client poll
    // can detect the clip immediately after finalize, even for large files.
    // s3Url starts as empty string and gets updated once S3 confirms.
    const [inserted] = await db.insert(videoClips).values({
      jobId,
      clipType,
      s3Key,
      s3Url: "",          // placeholder — updated below
      filename: originalName,
      clipOrder,
    });
    clipId = (inserted as any).insertId ?? null;

    if (clipType === "hook" && clipId !== null) {
      const hooks = await db.select()
        .from(videoClips)
        .where(and(eq(videoClips.jobId, jobId), eq(videoClips.clipType, "hook")));
      await db.update(videoVariantJobs)
        .set({ hookCount: hooks.length })
        .where(eq(videoVariantJobs.id, jobId));
    }

    // ── Stream file directly to storage proxy (no full-file RAM load) ─────────
    console.log(`[VVF] Starting stream upload for ${clipType} clip (job ${jobId}): ${filePath}`);
    const { url: s3Url } = await streamUploadToStorage(s3Key, filePath, "video/mp4");

    try { fs.unlinkSync(filePath); } catch {}

    // ── Update the placeholder row with the real S3 URL ───────────────────────
    if (clipId !== null) {
      await db.update(videoClips)
        .set({ s3Url })
        .where(eq(videoClips.id, clipId));
    }

    console.log(`[VVF] Stream upload complete: ${clipType} clip for job ${jobId} (clipId=${clipId})`);
  } catch (err) {
    console.error(`[VVF] Background upload failed for job ${jobId}:`, err);
    // Remove the placeholder row so the client poll doesn't find a broken clip
    if (clipId !== null) {
      try {
        const db = await getDb();
        if (db) await db.delete(videoClips).where(eq(videoClips.id, clipId));
      } catch {}
    }
    try { fs.unlinkSync(filePath); } catch {}
  }
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

    // Respond immediately — reassembly + S3 upload happens in background
    const tempId = `${clipType}-${clipOrder}-${randomSuffix()}`;
    res.status(202).json({ pending: true, tempId, clipType, clipOrder });

    // Background: reassemble chunks into one file, then upload to S3
    (async () => {
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

        await processUploadInBackground({
          filePath: assembledPath,
          originalName: filename || `clip-${uploadId}.mp4`,
          jobId,
          clipType: clipType as "hook" | "body" | "cta",
          clipOrder,
        });
      } catch (err) {
        console.error(`[VVF] Chunk finalize failed for uploadId ${uploadId}:`, err);
        try { fs.unlinkSync(assembledPath); } catch {}
        try { fs.rmSync(chunkDir, { recursive: true, force: true }); } catch {}
      }
    })();

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

    processUploadInBackground({
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
