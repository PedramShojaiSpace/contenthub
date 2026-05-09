/**
 * Chunked video upload for Video Variant Factory.
 *
 * FLOW:
 *   1. Browser slices file into 4 MB chunks and POSTs each to Cloud Run:
 *        POST /api/upload/video-chunk?uploadId=X&chunkIndex=N
 *        Body: raw binary (express.raw middleware)
 *        → 200 { received: true, chunkIndex }
 *
 *   2. Browser calls finalize. Cloud Run reassembles chunks on disk,
 *      then uploads the assembled MP4 to forge storage using multipart/form-data
 *      with the server-side API key (the only key with storage write permission).
 *      The CDN URL is written to the DB and returned to the browser.
 *        POST /api/upload/video-chunk/finalize
 *        → 200 { clipId, s3Url, s3Key }
 *
 * KEY FINDING: forge storage /v1/storage/upload REQUIRES multipart/form-data.
 * Raw binary (application/octet-stream) returns 400 "record not found".
 * The frontend API key also returns 400 — only the server-side key works.
 * Therefore the upload MUST happen server-side using multipart/form-data.
 * 150 MB uploads complete in ~5 seconds from the sandbox/Cloud Run environment.
 */

import express, { Request, Response } from "express";
import multer from "multer";
import fs from "fs";
import path from "path";
import os from "os";
import FormData from "form-data";
import https from "https";
import http from "http";
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

// Raw binary middleware for chunk uploads
export const videoChunkMiddleware = express.raw({
  type: "*/*",
  limit: "6mb",
});
export const videoUploadMiddleware = legacyUpload.single("file");

function randomSuffix() {
  return Math.random().toString(36).slice(2, 8);
}

// ── Upload assembled file to forge using multipart/form-data ─────────────────
// This is the ONLY format that forge storage accepts.
// Returns the CDN URL on success.
async function uploadToForgeMultipart(
  filePath: string,
  s3Key: string,
  filename: string,
  timeoutMs = 10 * 60 * 1000  // 10 min
): Promise<string> {
  const baseUrl = ENV.forgeApiUrl?.replace(/\/+$/, "");
  const serverKey = ENV.forgeApiKey;

  if (!baseUrl || !serverKey) {
    throw new Error("Storage proxy credentials missing");
  }

  const form = new FormData();
  form.append("file", fs.createReadStream(filePath), {
    filename,
    contentType: "video/mp4",
    knownLength: fs.statSync(filePath).size,
  });

  const uploadPath = `/v1/storage/upload?path=${encodeURIComponent(s3Key)}`;
  const url = new URL(baseUrl + uploadPath);
  const isHttps = url.protocol === "https:";
  const transport = isHttps ? https : http;

  return new Promise<string>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Storage upload timed out after ${timeoutMs / 1000}s`));
    }, timeoutMs);

    const headers = {
      ...form.getHeaders(),
      "Authorization": `Bearer ${serverKey}`,
    };

    const req = transport.request({
      hostname: url.hostname,
      port: url.port || (isHttps ? 443 : 80),
      path: url.pathname + url.search,
      method: "POST",
      headers,
    }, (res) => {
      let body = "";
      res.on("data", (d) => body += d);
      res.on("end", () => {
        clearTimeout(timer);
        if (res.statusCode === 200) {
          try {
            const data = JSON.parse(body);
            if (data?.url) {
              resolve(data.url);
            } else {
              reject(new Error(`Storage proxy did not return a URL: ${body.slice(0, 200)}`));
            }
          } catch {
            reject(new Error(`Storage proxy response parse error: ${body.slice(0, 200)}`));
          }
        } else {
          reject(new Error(`Storage upload failed (${res.statusCode}): ${body.slice(0, 200)}`));
        }
      });
    });

    req.on("error", (e) => {
      clearTimeout(timer);
      reject(new Error(`Storage upload network error: ${e.message}`));
    });

    form.pipe(req);
  });
}

// ── Chunk receive handler (raw binary) ────────────────────────────────────────
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

// ── Chunk finalize handler ─────────────────────────────────────────────────────
// Reassembles chunks, uploads to forge using multipart/form-data, writes DB.
export async function handleVideoChunkFinalize(req: Request, res: Response) {
  let assembledPath: string | null = null;
  let chunkDir: string | null = null;

  try {
    let user = null;
    try { user = await sdk.authenticateRequest(req); } catch { user = null; }
    if (!user) return res.status(401).json({ error: "Unauthorized" });

    const { uploadId, jobId: jobIdStr, clipType, clipOrder: clipOrderStr, filename, totalChunks: totalChunksStr } = req.body;

    const jobId = parseInt(jobIdStr ?? "0", 10);
    const clipOrder = parseInt(clipOrderStr ?? "0", 10);
    const totalChunks = parseInt(totalChunksStr ?? "0", 10);

    if (!uploadId) return res.status(400).json({ error: "uploadId is required" });
    if (!jobId) return res.status(400).json({ error: "jobId is required" });
    if (!totalChunks) return res.status(400).json({ error: "totalChunks is required" });

    const db = await getDb();
    if (!db) return res.status(500).json({ error: "DB unavailable" });

    const [job] = await db.select()
      .from(videoVariantJobs)
      .where(and(eq(videoVariantJobs.id, jobId), eq(videoVariantJobs.userId, user.id)));

    if (!job) return res.status(404).json({ error: "Job not found" });

    // Verify all chunks are present
    chunkDir = path.join(CHUNK_UPLOAD_DIR, uploadId);
    for (let i = 0; i < totalChunks; i++) {
      const chunkPath = path.join(chunkDir, `chunk-${i}`);
      if (!fs.existsSync(chunkPath)) {
        return res.status(400).json({ error: `Missing chunk ${i}` });
      }
    }

    // Reassemble chunks into one file
    assembledPath = path.join(os.tmpdir(), `vvf-assembled-${uploadId}.mp4`);
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

    // Clean up chunk dir immediately after reassembly
    try { fs.rmSync(chunkDir, { recursive: true, force: true }); } catch {}
    chunkDir = null;

    const safeName = (filename || `clip-${uploadId}.mp4`).replace(/[^a-zA-Z0-9._-]/g, "_");
    const s3Key = `video-clips/${jobId}/${clipType}-${clipOrder}-${randomSuffix()}-${safeName}`;

    console.log(`[VVF] Uploading ${safeName} (${(fs.statSync(assembledPath).size / 1024 / 1024).toFixed(1)} MB) to forge...`);

    // Upload to forge using multipart/form-data (the only format forge accepts)
    const s3Url = await uploadToForgeMultipart(assembledPath, s3Key, safeName);

    console.log(`[VVF] Upload complete: ${s3Url}`);

    // Clean up assembled file
    try { fs.unlinkSync(assembledPath); } catch {}
    assembledPath = null;

    // Write to DB
    const [inserted] = await db.insert(videoClips).values({
      jobId,
      clipType: clipType as "hook" | "body" | "cta",
      s3Key,
      s3Url,
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

    console.log(`[VVF] Clip saved: ${clipType} for job ${jobId}, clipId=${clipId}`);

    return res.status(200).json({ clipId, s3Url, s3Key });

  } catch (err) {
    // Clean up on error
    if (assembledPath) { try { fs.unlinkSync(assembledPath); } catch {} }
    if (chunkDir) { try { fs.rmSync(chunkDir, { recursive: true, force: true }); } catch {} }
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[VVF] Finalize error:`, msg);
    if (!res.headersSent) return res.status(500).json({ error: msg });
  }
}

// ── Confirm handler (kept for backward compatibility, now a no-op) ─────────────
// The new flow writes the DB in finalize, so confirm is not needed.
// Kept to avoid 404 errors if any in-flight requests still call it.
export async function handleVideoChunkConfirm(req: Request, res: Response) {
  try {
    let user = null;
    try { user = await sdk.authenticateRequest(req); } catch { user = null; }
    if (!user) return res.status(401).json({ error: "Unauthorized" });

    const { jobId: jobIdStr, s3Key, s3Url } = req.body;
    const jobId = parseInt(jobIdStr ?? "0", 10);

    if (!jobId) return res.status(400).json({ error: "jobId is required" });
    if (!s3Key) return res.status(400).json({ error: "s3Key is required" });
    if (!s3Url) return res.status(400).json({ error: "s3Url is required" });

    // In the new flow the DB is already written by finalize.
    // Just return success so old in-flight requests don't break.
    return res.status(200).json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (!res.headersSent) return res.status(500).json({ error: msg });
  }
}
