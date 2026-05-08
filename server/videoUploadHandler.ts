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

import { Request, Response } from "express";
import multer from "multer";
import fs from "fs";
import path from "path";
import os from "os";
import { getDb } from "./db";
import { videoClips, videoVariantJobs } from "../drizzle/schema";
import { eq, and } from "drizzle-orm";
import { storagePut } from "./storage";
import { sdk } from "./_core/sdk";

const CHUNK_UPLOAD_DIR = path.join(os.tmpdir(), "vvf-chunks");
const LEGACY_UPLOAD_DIR = path.join(os.tmpdir(), "vvf-uploads");

// Ensure temp dirs exist
try { fs.mkdirSync(CHUNK_UPLOAD_DIR, { recursive: true }); } catch {}
try { fs.mkdirSync(LEGACY_UPLOAD_DIR, { recursive: true }); } catch {}

// ── Multer instances ──────────────────────────────────────────────────────────

// For chunk uploads: each chunk is at most 4 MB, no mime filter (it's a raw binary slice)
const chunkUpload = multer({
  dest: CHUNK_UPLOAD_DIR,
  limits: { fileSize: 6 * 1024 * 1024 }, // 6 MB safety margin (chunks are 4 MB)
});

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

export const videoChunkMiddleware = chunkUpload.single("chunk");
export const videoUploadMiddleware = legacyUpload.single("file");

function randomSuffix() {
  return Math.random().toString(36).slice(2, 8);
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

    // ── Read file and upload to S3 with a 15-minute hard timeout ─────────────
    const fileBuffer = await fs.promises.readFile(filePath);
    const controller = new AbortController();
    const uploadTimeout = setTimeout(() => controller.abort(), 15 * 60 * 1000);
    let s3Url: string;
    try {
      const result = await storagePutWithSignal(s3Key, fileBuffer, "video/mp4", controller.signal);
      s3Url = result.url;
    } finally {
      clearTimeout(uploadTimeout);
    }

    try { fs.unlinkSync(filePath); } catch {}

    // ── Update the placeholder row with the real S3 URL ───────────────────────
    if (clipId !== null) {
      await db.update(videoClips)
        .set({ s3Url })
        .where(eq(videoClips.id, clipId));
    }

    console.log(`[VVF] Background upload complete: ${clipType} clip for job ${jobId} (clipId=${clipId})`);
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

// storagePut wrapper that accepts an AbortSignal for large-file timeout support
async function storagePutWithSignal(
  relKey: string,
  data: Buffer | Uint8Array | string,
  contentType: string,
  signal: AbortSignal
): Promise<{ key: string; url: string }> {
  // storagePut uses fetch internally — we replicate it here with signal support
  const { ENV } = await import("./_core/env");
  const baseUrl = ENV.forgeApiUrl?.replace(/\/+$/, "");
  const apiKey = ENV.forgeApiKey;
  if (!baseUrl || !apiKey) throw new Error("Storage proxy credentials missing");

  const key = relKey.replace(/^\/+/, "");
  const uploadUrl = new URL(`${baseUrl}/v1/storage/upload`);
  uploadUrl.searchParams.set("path", key);

  const blob = new Blob([data as any], { type: contentType });
  const form = new FormData();
  form.append("file", blob, key.split("/").pop() ?? key);

  const response = await fetch(uploadUrl.toString(), {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
    signal,
  });

  if (!response.ok) {
    const message = await response.text().catch(() => response.statusText);
    throw new Error(`Storage upload failed (${response.status}): ${message}`);
  }

  const url = (await response.json()).url;
  return { key, url };
}

// ── Chunk receive handler ─────────────────────────────────────────────────────

export async function handleVideoChunkUpload(req: Request, res: Response) {
  try {
    let user = null;
    try { user = await sdk.authenticateRequest(req); } catch { user = null; }
    if (!user) {
      if (req.file?.path) { try { fs.unlinkSync(req.file.path); } catch {} }
      return res.status(401).json({ error: "Unauthorized" });
    }

    const chunk = req.file;
    if (!chunk) return res.status(400).json({ error: "No chunk received" });

    const uploadId = req.body.uploadId as string;
    const chunkIndex = parseInt(req.body.chunkIndex ?? "0", 10);

    if (!uploadId) {
      fs.unlinkSync(chunk.path);
      return res.status(400).json({ error: "uploadId is required" });
    }

    // Move chunk to a named location so finalize can find it
    const chunkDir = path.join(CHUNK_UPLOAD_DIR, uploadId);
    fs.mkdirSync(chunkDir, { recursive: true });
    const destPath = path.join(chunkDir, `chunk-${chunkIndex}`);
    fs.renameSync(chunk.path, destPath);

    return res.status(200).json({ received: true, chunkIndex });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (req.file?.path) { try { fs.unlinkSync(req.file.path); } catch {} }
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
