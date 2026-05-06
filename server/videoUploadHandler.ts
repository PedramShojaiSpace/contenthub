/**
 * POST /api/upload/video-clip
 * Accepts a multipart/form-data upload with:
 *   - file: the MP4 file
 *   - jobId: the video_variant_job id
 *   - clipType: "hook" | "body" | "cta"
 *   - clipOrder: integer (for hooks: 1, 2, 3…)
 *
 * Returns: { clipId, s3Key, s3Url, filename }
 *
 * Auth: reads the session cookie the same way tRPC does.
 */

import { Request, Response } from "express";
import multer from "multer";
import path from "path";
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

export async function handleVideoClipUpload(req: Request, res: Response) {
  try {
    // Auth check
    let user = null;
    try { user = await sdk.authenticateRequest(req); } catch { user = null; }
    if (!user) {
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

    // Verify job belongs to user
    const [job] = await db.select()
      .from(videoVariantJobs)
      .where(and(eq(videoVariantJobs.id, jobId), eq(videoVariantJobs.userId, user.id)));

    if (!job) {
      fs.unlinkSync(file.path);
      return res.status(404).json({ error: "Job not found" });
    }

    // Upload to S3
    const originalName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_");
    const s3Key = `video-clips/${jobId}/${clipType}-${clipOrder}-${randomSuffix()}-${originalName}`;
    const fileBuffer = fs.readFileSync(file.path);
    const { url: s3Url } = await storagePut(s3Key, fileBuffer, "video/mp4");

    // Clean up temp file
    fs.unlinkSync(file.path);

    // Insert clip record
    const [result] = await db.insert(videoClips).values({
      jobId,
      clipType,
      s3Key,
      s3Url,
      filename: file.originalname,
      clipOrder,
    });
    const clipId = (result as unknown as { insertId: number }).insertId;

    // Update hookCount if this is a hook
    if (clipType === "hook") {
      const hooks = await db.select()
        .from(videoClips)
        .where(and(eq(videoClips.jobId, jobId), eq(videoClips.clipType, "hook")));
      await db.update(videoVariantJobs)
        .set({ hookCount: hooks.length })
        .where(eq(videoVariantJobs.id, jobId));
    }

    return res.json({ clipId, s3Key, s3Url, filename: file.originalname });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    // Clean up temp file if it exists
    if (req.file?.path) {
      try { fs.unlinkSync(req.file.path); } catch {}
    }
    return res.status(500).json({ error: msg });
  }
}
