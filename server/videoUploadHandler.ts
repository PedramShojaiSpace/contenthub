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

// ── Upload a single buffer segment to the storage proxy ─────────────────────
const SEGMENT_SIZE = 14 * 1024 * 1024; // 14 MB — safely under the ~20 MB proxy limit

async function uploadSegmentToStorage(
  segKey: string,
  buffer: Buffer,
  contentType: string,
): Promise<string> {
  const { ENV } = await import("./_core/env");
  const baseUrl = ENV.forgeApiUrl?.replace(/\/+$/, "");
  const apiKey = ENV.forgeApiKey;
  if (!baseUrl || !apiKey) throw new Error("Storage proxy credentials missing");

  const key = segKey.replace(/^\/+/, "");
  const uploadUrl = `${baseUrl}/v1/storage/upload?path=${encodeURIComponent(key)}`;
  const filename = key.split("/").pop() ?? key;

  const form = new FormData();
  form.append("file", buffer, { filename, contentType, knownLength: buffer.length });

  const response = await axios.post(uploadUrl, form, {
    headers: { ...form.getHeaders(), Authorization: `Bearer ${apiKey}` },
    maxBodyLength: Infinity,
    maxContentLength: Infinity,
    timeout: 3 * 60 * 1000, // 3 min per segment
  });

  const url = response.data?.url;
  if (!url) throw new Error(`Storage proxy did not return a URL for segment ${segKey}`);
  return url;
}

// ── Segment-upload a file, splitting into 14 MB chunks if needed ──────────────
// For files ≤ 14 MB: uploads as a single segment, returns a plain URL string.
// For files > 14 MB: splits into N segments, uploads each, returns a JSON array
// of URLs that downloadToTemp() in the stitching job knows how to reassemble.
async function uploadFileSegmented(
  baseKey: string,
  filePath: string,
  contentType: string,
): Promise<string> {
  const fileSize = fs.statSync(filePath).size;

  if (fileSize <= SEGMENT_SIZE) {
    // Small file — single upload
    const buf = fs.readFileSync(filePath);
    return uploadSegmentToStorage(baseKey, buf, contentType);
  }

  // Large file — split into segments
  const fd = fs.openSync(filePath, "r");
  const urls: string[] = [];
  let offset = 0;
  let segIndex = 0;

  try {
    while (offset < fileSize) {
      const segSize = Math.min(SEGMENT_SIZE, fileSize - offset);
      const buf = Buffer.alloc(segSize);
      fs.readSync(fd, buf, 0, segSize, offset);
      const segKey = `${baseKey}.seg${segIndex}`;
      console.log(`[VVF] Uploading segment ${segIndex} (${(segSize / 1024 / 1024).toFixed(1)} MB) → ${segKey}`);
      const url = await uploadSegmentToStorage(segKey, buf, contentType);
      urls.push(url);
      offset += segSize;
      segIndex++;
    }
  } finally {
    fs.closeSync(fd);
  }

  console.log(`[VVF] Segmented upload complete: ${segIndex} segments for ${baseKey}`);
  // Return a JSON array so downloadToTemp() can detect and reassemble
  return JSON.stringify(urls);
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

    // ── Upload file in 14 MB segments to stay under the storage proxy limit ─────
    console.log(`[VVF] Starting segmented upload for ${clipType} clip (job ${jobId}): ${filePath}`);
    const s3Url = await uploadFileSegmented(s3Key, filePath, "video/mp4");

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

// ── TEMPORARY DIAGNOSTIC: test storage proxy with a small video ───────────────
export async function handleStorageDiagnostic(req: Request, res: Response) {
  try {
    const { ENV } = await import("./_core/env");
    const baseUrl = ENV.forgeApiUrl?.replace(/\/+$/, "");
    const apiKey = ENV.forgeApiKey;
    if (!baseUrl || !apiKey) return res.json({ error: "No credentials" });

    // Create a tiny fake MP4 buffer (just header bytes for testing)
    const testBuffer = Buffer.alloc(1024 * 50, 0); // 50KB
    const key = `diag-test-${Date.now()}.mp4`;
    const uploadUrl = `${baseUrl}/v1/storage/upload?path=${encodeURIComponent(key)}`;

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
