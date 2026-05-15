/**
 * Chunked video upload for Video Variant Factory — STATELESS ARCHITECTURE.
 *
 * ROOT CAUSE OF "Missing chunk X" BUG:
 *   Cloud Run can run multiple container instances. Chunks written to /tmp on
 *   instance A are invisible to instance B when finalize runs. This caused
 *   "Missing chunk 0" errors every time.
 *
 * FIX — STATELESS CHUNK STORAGE:
 *   Each chunk is uploaded to forge storage immediately as it arrives.
 *   Finalize downloads all chunks from forge, concatenates them in /tmp
 *   (single request, same instance), uploads the assembled file, then
 *   deletes the chunk files from forge.
 *
 * FLOW:
 *   1. Browser slices file into 4 MB chunks and POSTs each:
 *        POST /api/upload/video-chunk?uploadId=X&chunkIndex=N
 *        Body: raw binary (express.raw middleware)
 *        → Server uploads chunk to forge at vvf-chunks/{uploadId}/chunk-{N}
 *        → 200 { received: true, chunkIndex, chunkUrl }
 *
 *   2. Browser calls finalize:
 *        POST /api/upload/video-chunk/finalize
 *        → Server downloads all chunks from forge, concatenates, uploads assembled MP4
 *        → 200 { clipId, s3Url, s3Key }
 *
 * KEY FINDING: forge storage /v1/storage/upload REQUIRES multipart/form-data.
 * Raw binary returns 400 "record not found". Only server-side key works.
 * 4 MB chunks upload in ~250ms. 150 MB assembled file uploads in ~5s.
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

const LEGACY_UPLOAD_DIR = path.join(os.tmpdir(), "vvf-uploads");
try { fs.mkdirSync(LEGACY_UPLOAD_DIR, { recursive: true }); } catch {}

// ── Multer (legacy, kept for backward compat) ─────────────────────────────────
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

// Raw binary middleware for chunk uploads — accepts any content-type
export const videoChunkMiddleware = express.raw({
  type: "*/*",
  limit: "6mb",
});
export const videoUploadMiddleware = legacyUpload.single("file");

function randomSuffix() {
  return Math.random().toString(36).slice(2, 8);
}

// ── Forge storage helpers ─────────────────────────────────────────────────────

const FORGE_UPLOAD_MAX_RETRIES = 3;
const FORGE_UPLOAD_BASE_DELAY_MS = 3000; // 3s → 6s → 12s

/**
 * Upload a Buffer to forge storage using multipart/form-data.
 * Retries up to FORGE_UPLOAD_MAX_RETRIES times on transient 5xx / HTML gateway errors.
 * Returns the CDN URL.
 */
async function uploadBufferToForge(
  data: Buffer,
  s3Key: string,
  filename: string,
  timeoutMs = 5 * 60 * 1000
): Promise<string> {
  const baseUrl = ENV.forgeApiUrl?.replace(/\/+$/, "");
  const serverKey = ENV.forgeApiKey;
  if (!baseUrl || !serverKey) throw new Error("Storage proxy credentials missing");

  for (let attempt = 0; attempt <= FORGE_UPLOAD_MAX_RETRIES; attempt++) {
    // Rebuild FormData each attempt (streams can only be piped once)
    const form = new FormData();
    form.append("file", data, {
      filename,
      contentType: "application/octet-stream",
      knownLength: data.length,
    });

    const result = await makeForgeUploadRequest(form, s3Key, baseUrl, serverKey, timeoutMs);
    if ("url" in result) return result.url;

    // Transient error — wait and retry
    if (attempt < FORGE_UPLOAD_MAX_RETRIES) {
      const delay = FORGE_UPLOAD_BASE_DELAY_MS * Math.pow(2, attempt);
      console.warn(`[ForgeUpload] Transient ${result.statusCode} on buffer upload — retrying in ${delay}ms (attempt ${attempt + 1}/${FORGE_UPLOAD_MAX_RETRIES})`);
      await new Promise((r) => setTimeout(r, delay));
    } else {
      throw new Error(`Storage upload failed after ${FORGE_UPLOAD_MAX_RETRIES} retries (${result.statusCode}). The storage service is temporarily unavailable — please try again.`);
    }
  }
  throw new Error("Storage upload failed: unexpected retry loop exit");
}

/**
 * Upload a file from disk to forge storage using multipart/form-data.
 * Retries up to FORGE_UPLOAD_MAX_RETRIES times on transient 5xx / HTML gateway errors.
 * Returns the CDN URL.
 */
async function uploadFileToForge(
  filePath: string,
  s3Key: string,
  filename: string,
  timeoutMs = 10 * 60 * 1000
): Promise<string> {
  const baseUrl = ENV.forgeApiUrl?.replace(/\/+$/, "");
  const serverKey = ENV.forgeApiKey;
  if (!baseUrl || !serverKey) throw new Error("Storage proxy credentials missing");

  const fileSize = fs.statSync(filePath).size;

  for (let attempt = 0; attempt <= FORGE_UPLOAD_MAX_RETRIES; attempt++) {
    // Rebuild FormData each attempt (ReadStream can only be consumed once)
    const form = new FormData();
    form.append("file", fs.createReadStream(filePath), {
      filename,
      contentType: "video/mp4",
      knownLength: fileSize,
    });

    const result = await makeForgeUploadRequest(form, s3Key, baseUrl, serverKey, timeoutMs);
    if ("url" in result) return result.url;

    // Transient error — wait and retry
    if (attempt < FORGE_UPLOAD_MAX_RETRIES) {
      const delay = FORGE_UPLOAD_BASE_DELAY_MS * Math.pow(2, attempt);
      console.warn(`[ForgeUpload] Transient ${result.statusCode} on file upload — retrying in ${delay}ms (attempt ${attempt + 1}/${FORGE_UPLOAD_MAX_RETRIES})`);
      await new Promise((r) => setTimeout(r, delay));
    } else {
      throw new Error(`Storage upload failed after ${FORGE_UPLOAD_MAX_RETRIES} retries (${result.statusCode}). The storage service is temporarily unavailable — please try again.`);
    }
  }
  throw new Error("Storage upload failed: unexpected retry loop exit");
}

/**
 * Returns true for transient gateway errors that are safe to retry.
 */
function isTransientStorageError(statusCode: number | undefined, body: string): boolean {
  if (!statusCode) return false;
  if (statusCode === 500 || statusCode === 502 || statusCode === 503 || statusCode === 504) return true;
  // Some gateways return 200 with an HTML error body
  if (body.trimStart().startsWith("<")) return true;
  return false;
}

function makeForgeUploadRequest(
  form: FormData,
  s3Key: string,
  baseUrl: string,
  serverKey: string,
  timeoutMs: number
): Promise<{ url: string } | { transient: true; statusCode: number }> {
  const uploadPath = `/v1/storage/upload?path=${encodeURIComponent(s3Key)}`;
  const url = new URL(baseUrl + uploadPath);
  const isHttps = url.protocol === "https:";
  const transport = isHttps ? https : http;

  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Storage upload timed out after ${timeoutMs / 1000}s`));
    }, timeoutMs);

    const headers = {
      ...form.getHeaders(),
      Authorization: `Bearer ${serverKey}`,
    };

    const req = transport.request(
      {
        hostname: url.hostname,
        port: url.port || (isHttps ? 443 : 80),
        path: url.pathname + url.search,
        method: "POST",
        headers,
      },
      (res) => {
        let body = "";
        res.on("data", (d) => (body += d));
        res.on("end", () => {
          clearTimeout(timer);
          if (res.statusCode === 200 && !body.trimStart().startsWith("<")) {
            try {
              const data = JSON.parse(body);
              if (data?.url) {
                resolve({ url: data.url });
              } else {
                reject(new Error(`Storage proxy did not return a URL: ${body.slice(0, 200)}`));
              }
            } catch {
              reject(new Error(`Storage proxy response parse error: ${body.slice(0, 200)}`));
            }
          } else if (isTransientStorageError(res.statusCode, body)) {
            // Signal transient error to caller so it can rebuild FormData and retry
            resolve({ transient: true, statusCode: res.statusCode ?? 500 });
          } else {
            reject(new Error(`Storage upload failed (${res.statusCode}): ${body.slice(0, 200)}`));
          }
        });
      }
    );

    req.on("error", (e) => {
      clearTimeout(timer);
      reject(new Error(`Storage upload network error: ${e.message}`));
    });

    form.pipe(req);
  });
}

/**
 * Download a URL to a Buffer with a timeout.
 */
async function downloadToBuffer(url: string, timeoutMs = 5 * 60 * 1000): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Download timed out: ${url}`)), timeoutMs);
    const isHttps = url.startsWith("https");
    const transport = isHttps ? https : http;

    transport.get(url, (res) => {
      if (res.statusCode !== 200) {
        clearTimeout(timer);
        reject(new Error(`Download failed (${res.statusCode}): ${url}`));
        return;
      }
      const chunks: Buffer[] = [];
      res.on("data", (d) => chunks.push(d));
      res.on("end", () => {
        clearTimeout(timer);
        resolve(Buffer.concat(chunks));
      });
      res.on("error", (e) => {
        clearTimeout(timer);
        reject(e);
      });
    }).on("error", (e) => {
      clearTimeout(timer);
      reject(e);
    });
  });
}

// ── Chunk receive handler (raw binary) ────────────────────────────────────────
// Immediately uploads the chunk to forge storage so it's accessible from any
// Cloud Run instance. No /tmp dependency.
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
    const chunkIndex = parseInt(
      (req.query.chunkIndex ?? req.headers["x-chunk-index"]) as string ?? "0",
      10
    );

    if (!uploadId) return res.status(400).json({ error: "uploadId is required" });

    // Upload chunk directly to forge storage — stateless, works across instances
    const s3Key = `vvf-chunks/${uploadId}/chunk-${chunkIndex}`;
    const chunkUrl = await uploadBufferToForge(chunkBuffer, s3Key, `chunk-${chunkIndex}`);

    console.log(`[VVF] Chunk ${chunkIndex} stored: ${s3Key} (${(chunkBuffer.length / 1024).toFixed(0)} KB)`);

    return res.status(200).json({ received: true, chunkIndex, chunkUrl });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[VVF] Chunk upload error:`, msg);
    if (!res.headersSent) return res.status(500).json({ error: msg });
  }
}

// ── Chunk finalize handler ─────────────────────────────────────────────────────
// Downloads all chunks from forge, concatenates in /tmp (single instance, safe),
// uploads the assembled MP4 to forge, writes DB record, cleans up chunk files.
export async function handleVideoChunkFinalize(req: Request, res: Response) {
  let assembledPath: string | null = null;

  try {
    let user = null;
    try { user = await sdk.authenticateRequest(req); } catch { user = null; }
    if (!user) return res.status(401).json({ error: "Unauthorized" });

    const {
      uploadId,
      jobId: jobIdStr,
      clipType,
      clipOrder: clipOrderStr,
      filename,
      totalChunks: totalChunksStr,
      chunkUrls,  // CDN URLs returned by chunk upload — download directly, no forge GET needed
    } = req.body;

    const jobId = parseInt(jobIdStr ?? "0", 10);
    const clipOrder = parseInt(clipOrderStr ?? "0", 10);
    const totalChunks = parseInt(totalChunksStr ?? "0", 10);

    if (!uploadId) return res.status(400).json({ error: "uploadId is required" });
    if (!jobId) return res.status(400).json({ error: "jobId is required" });
    if (!totalChunks) return res.status(400).json({ error: "totalChunks is required" });

    const db = await getDb();
    if (!db) return res.status(500).json({ error: "DB unavailable" });

    const [job] = await db
      .select()
      .from(videoVariantJobs)
      .where(and(eq(videoVariantJobs.id, jobId), eq(videoVariantJobs.userId, user.id)));

    if (!job) return res.status(404).json({ error: "Job not found" });

    const baseUrl = ENV.forgeApiUrl?.replace(/\/+$/, "");
    const serverKey = ENV.forgeApiKey;
    if (!baseUrl || !serverKey) return res.status(500).json({ error: "Storage credentials missing" });

    // Validate that chunkUrls were provided by the client
    // Each chunk upload returns a CDN URL — the client collects them and sends here.
    // We download directly from CDN (no forge GET endpoint needed — it returns 404).
    const urls: string[] = Array.isArray(chunkUrls) ? chunkUrls : [];
    if (urls.length !== totalChunks) {
      return res.status(400).json({
        error: `chunkUrls length mismatch: got ${urls.length}, expected ${totalChunks}`,
      });
    }
    for (let i = 0; i < totalChunks; i++) {
      if (!urls[i]) return res.status(400).json({ error: `Missing chunk ${i}` });
    }

    console.log(`[VVF] Finalizing ${totalChunks} chunks for uploadId=${uploadId}`);

    // Download all chunks from CDN in order and concatenate
    assembledPath = path.join(os.tmpdir(), `vvf-assembled-${uploadId}.mp4`);
    const writeStream = fs.createWriteStream(assembledPath);

    for (let i = 0; i < totalChunks; i++) {
      const chunkData = await downloadToBuffer(urls[i]);
      console.log(`[VVF] Downloaded chunk ${i}: ${(chunkData.length / 1024).toFixed(0)} KB`);

      // Write to assembled file
      await new Promise<void>((resolve, reject) => {
        writeStream.write(chunkData, (err) => (err ? reject(err) : resolve()));
      });
    }

    await new Promise<void>((resolve, reject) => {
      writeStream.end((err: Error | null | undefined) => (err ? reject(err) : resolve()));
    });

    const assembledSize = fs.statSync(assembledPath).size;
    const safeName = (filename || `clip-${uploadId}.mp4`).replace(/[^a-zA-Z0-9._-]/g, "_");
    const s3Key = `video-clips/${jobId}/${clipType}-${clipOrder}-${randomSuffix()}-${safeName}`;

    console.log(`[VVF] Uploading assembled ${safeName} (${(assembledSize / 1024 / 1024).toFixed(1)} MB) to forge...`);

    // Upload assembled file to forge
    const s3Url = await uploadFileToForge(assembledPath, s3Key, safeName);

    console.log(`[VVF] Upload complete: ${s3Url}`);

    // Clean up assembled file
    try { fs.unlinkSync(assembledPath); } catch {}
    assembledPath = null;

    // Clean up chunk files from forge (fire and forget — don't block the response)
    cleanupChunksFromForge(uploadId, totalChunks, baseUrl!, serverKey!).catch((e) =>
      console.warn(`[VVF] Chunk cleanup warning: ${e.message}`)
    );

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
      const hooks = await db
        .select()
        .from(videoClips)
        .where(and(eq(videoClips.jobId, jobId), eq(videoClips.clipType, "hook")));
      await db
        .update(videoVariantJobs)
        .set({ hookCount: hooks.length })
        .where(eq(videoVariantJobs.id, jobId));
    }

    console.log(`[VVF] Clip saved: ${clipType} for job ${jobId}, clipId=${clipId}`);

    return res.status(200).json({ clipId, s3Url, s3Key });
  } catch (err) {
    if (assembledPath) { try { fs.unlinkSync(assembledPath); } catch {} }
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[VVF] Finalize error:`, msg);
    if (!res.headersSent) return res.status(500).json({ error: msg });
  }
}

/**
 * Delete chunk files from forge storage after successful assembly.
 * Fire-and-forget — errors are logged but don't affect the response.
 */
async function cleanupChunksFromForge(
  uploadId: string,
  totalChunks: number,
  baseUrl: string,
  serverKey: string
): Promise<void> {
  for (let i = 0; i < totalChunks; i++) {
    const chunkKey = `vvf-chunks/${uploadId}/chunk-${i}`;
    const deleteUrl = `${baseUrl}/v1/storage/file?path=${encodeURIComponent(chunkKey)}`;
    const isHttps = deleteUrl.startsWith("https");
    const transport = isHttps ? https : http;

    await new Promise<void>((resolve) => {
      const req = transport.request(
        deleteUrl,
        { method: "DELETE", headers: { Authorization: `Bearer ${serverKey}` } },
        (res) => {
          res.resume();
          res.on("end", resolve);
        }
      );
      req.on("error", () => resolve());
      req.end();
    });
  }
}

// ── Confirm handler (kept for backward compatibility) ─────────────────────────
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

    // DB is already written by finalize. Return success for backward compat.
    return res.status(200).json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (!res.headersSent) return res.status(500).json({ error: msg });
  }
}
