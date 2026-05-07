/**
 * POST /api/upload/video-clip
 * Accepts a multipart/form-data upload with:
 *   - file: the MP4 file
 *   - jobId: the video_variant_job id
 *   - clipType: "hook" | "body" | "cta"
 *   - clipOrder: integer (for hooks: 1, 2, 3…)
 *
 * Returns immediately (202) with { pending: true, tempId } so Cloud Run
 * never times out waiting for the S3 upload to finish.
 * The client polls the job's clip list until the new clip appears.
 *
 * Auth: reads the session cookie the same way tRPC does.
 */

import { Request, Response } from "express";
import multer from "multer";
import fs from "fs";
import { getDb } from "./db";
import { videoClips, videoVariantJobs } from "../drizzle/schema";
import { eq, and } from "drizzle-orm";
import { storagePut } from "./storage";
import { sdk } from "./_core/sdk";

// Store uploads in /tmp, max 500 MB per file
const upload = multer({
  dest: "/tmp/vvf-uploads/",
  limits: { fileSize: 500 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === "video/mp4" || file.originalname.endsWith(".mp4")) {
      cb(null, true);
    } else {
      cb(new Error("Only MP4 files are accepted"));
    }
  },
});

function randomSuffix() {
  return Math.random().toString(36).slice(2, 8);
}

export const videoUploadMiddleware = upload.single("file");

/**
 * Background worker: uploads the temp file to S3, inserts the DB record,
 * then deletes the temp file. Runs after the 202 response is already sent.
 */
async function processUploadInBackground(opts: {
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

    // Read and upload to S3
    const fileBuffer = await fs.promises.readFile(filePath);
    const { url: s3Url } = await storagePut(s3Key, fileBuffer, "video/mp4");

    // Clean up temp file
    try { fs.unlinkSync(filePath); } catch {}

    // Insert clip record
    await db.insert(videoClips).values({
      jobId,
      clipType,
      s3Key,
      s3Url,
      filename: originalName,
      clipOrder,
    });

    // Update hookCount if this is a hook
    if (clipType === "hook") {
      const hooks = await db.select()
        .from(videoClips)
        .where(and(eq(videoClips.jobId, jobId), eq(videoClips.clipType, "hook")));
      await db.update(videoVariantJobs)
        .set({ hookCount: hooks.length })
        .where(eq(videoVariantJobs.id, jobId));
    }

    console.log(`[VVF] Background upload complete: ${clipType} clip for job ${jobId}`);
  } catch (err) {
    console.error(`[VVF] Background upload failed for job ${jobId}:`, err);
    // Clean up temp file on error too
    try { fs.unlinkSync(filePath); } catch {}
  }
}

export async function handleVideoClipUpload(req: Request, res: Response) {
  // Multer errors (file too large, wrong type) are handled by express error middleware
  // This handler only runs if multer succeeded
  try {
    // Auth check
    let user = null;
    try { user = await sdk.authenticateRequest(req); } catch { user = null; }
    if (!user) {
      if (req.file?.path) { try { fs.unlinkSync(req.file.path); } catch {} }
      return res.status(401).json({ error: "Unauthorized" });
    }

    const file = req.file;
    if (!file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

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

    // Verify job belongs to user (fast DB check — fine to do before responding)
    const [job] = await db.select()
      .from(videoVariantJobs)
      .where(and(eq(videoVariantJobs.id, jobId), eq(videoVariantJobs.userId, user.id)));

    if (!job) {
      fs.unlinkSync(file.path);
      return res.status(404).json({ error: "Job not found" });
    }

    // ── Respond immediately so Cloud Run doesn't time out ──────────────────
    // The client will poll the job's clip list until the new clip appears.
    const tempId = `${clipType}-${clipOrder}-${randomSuffix()}`;
    res.status(202).json({ pending: true, tempId, clipType, clipOrder });

    // ── Do the heavy work in the background ────────────────────────────────
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
    // Only send error if headers haven't been sent yet
    if (!res.headersSent) {
      return res.status(500).json({ error: msg });
    }
  }
}
