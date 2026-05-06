/**
 * Video Variant Factory
 * ─────────────────────
 * Workflow:
 *  1. Client calls createJob → gets a jobId
 *  2. Client uploads clips via POST /api/upload/video-clip (multipart)
 *     Each upload returns a clipId.
 *  3. Client calls startProcessing(jobId) → server queues FFmpeg stitching
 *  4. Client polls getJob(jobId) until status === "done"
 *  5. Client downloads variants via s3Url on each VideoVariant row
 */

import { z } from "zod";
import { protectedProcedure, router } from "./_core/trpc";
import { getDb } from "./db";
import { videoVariantJobs, videoClips, videoVariants } from "../drizzle/schema";
import { eq, desc, and } from "drizzle-orm";
import { storagePut } from "./storage";
import ffmpeg from "fluent-ffmpeg";
import fs from "fs";
import path from "path";
import os from "os";
import https from "https";
import http from "http";

// ─── Helpers ────────────────────────────────────────────────────────────────

function randomSuffix() {
  return Math.random().toString(36).slice(2, 8);
}

/** Download a URL to a local temp file, return the local path */
function downloadToTemp(url: string, ext: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const dest = path.join(os.tmpdir(), `vvf-${randomSuffix()}.${ext}`);
    const file = fs.createWriteStream(dest);
    const client = url.startsWith("https") ? https : http;
    client.get(url, (res) => {
      if (res.statusCode !== 200) {
        reject(new Error(`Download failed: ${res.statusCode} ${url}`));
        return;
      }
      res.pipe(file);
      file.on("finish", () => { file.close(); resolve(dest); });
      file.on("error", reject);
    }).on("error", reject);
  });
}

/** Concatenate an array of local MP4 paths into a single output MP4 using FFmpeg concat demuxer */
function concatVideos(inputPaths: string[], outputPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    // Write a concat list file
    const listPath = outputPath + ".txt";
    const listContent = inputPaths.map(p => `file '${p}'`).join("\n");
    fs.writeFileSync(listPath, listContent);

    ffmpeg()
      .input(listPath)
      .inputOptions(["-f concat", "-safe 0"])
      .outputOptions(["-c copy"])
      .output(outputPath)
      .on("end", () => {
        fs.unlinkSync(listPath);
        resolve();
      })
      .on("error", (err) => {
        try { fs.unlinkSync(listPath); } catch {}
        reject(err);
      })
      .run();
  });
}

/** Run the full stitching job in the background (fire-and-forget) */
async function runStitchingJob(jobId: number) {
  const db = await getDb();
  if (!db) return;

  try {
    // Mark job as processing
    await db.update(videoVariantJobs)
      .set({ status: "processing" })
      .where(eq(videoVariantJobs.id, jobId));

    // Load all clips for this job
    const clips = await db.select()
      .from(videoClips)
      .where(eq(videoClips.jobId, jobId))
      .orderBy(videoClips.clipOrder);

    const hookClips = clips.filter(c => c.clipType === "hook");
    const bodyClips = clips.filter(c => c.clipType === "body");
    const ctaClips  = clips.filter(c => c.clipType === "cta");

    if (hookClips.length === 0 || bodyClips.length === 0) {
      await db.update(videoVariantJobs)
        .set({ status: "error", errorMessage: "Need at least one hook clip and one body clip" })
        .where(eq(videoVariantJobs.id, jobId));
      return;
    }

    const bodyClip = bodyClips[0];
    const ctaClip  = ctaClips[0] ?? null;

    let variantsDone = 0;

    for (const hookClip of hookClips) {
      // Create variant row (pending)
      const label = `Hook ${hookClip.clipOrder} + Body${ctaClip ? " + CTA" : ""}`;
      const [inserted] = await db.insert(videoVariants).values({
        jobId,
        hookClipId: hookClip.id,
        bodyClipId: bodyClip.id,
        ctaClipId: ctaClip?.id ?? undefined,
        variantLabel: label,
        status: "processing",
      });
      const variantId = (inserted as unknown as { insertId: number }).insertId;

      let hookLocal: string | null = null;
      let bodyLocal: string | null = null;
      let ctaLocal:  string | null = null;
      let outLocal:  string | null = null;

      try {
        // Download clips to temp
        hookLocal = await downloadToTemp(hookClip.s3Url, "mp4");
        bodyLocal = await downloadToTemp(bodyClip.s3Url, "mp4");
        if (ctaClip) {
          ctaLocal = await downloadToTemp(ctaClip.s3Url, "mp4");
        }

        // Stitch
        const parts = [hookLocal, bodyLocal, ...(ctaLocal ? [ctaLocal] : [])];
        outLocal = path.join(os.tmpdir(), `vvf-out-${jobId}-${hookClip.clipOrder}-${randomSuffix()}.mp4`);
        await concatVideos(parts, outLocal);

        // Upload to S3
        const s3Key = `video-variants/${jobId}/variant-hook${hookClip.clipOrder}-${randomSuffix()}.mp4`;
        const fileBuffer = fs.readFileSync(outLocal);
        const { url: s3Url } = await storagePut(s3Key, fileBuffer, "video/mp4");

        // Mark variant done
        await db.update(videoVariants)
          .set({ status: "done", s3Key, s3Url })
          .where(eq(videoVariants.id, variantId));

        variantsDone++;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        await db.update(videoVariants)
          .set({ status: "error", errorMessage: msg })
          .where(eq(videoVariants.id, variantId));
      } finally {
        // Clean up temp files
        for (const f of [hookLocal, bodyLocal, ctaLocal, outLocal]) {
          if (f) try { fs.unlinkSync(f); } catch {}
        }
      }
    }

    // Mark job done
    await db.update(videoVariantJobs)
      .set({
        status: "done",
        variantCount: variantsDone,
        completedAt: new Date(),
      })
      .where(eq(videoVariantJobs.id, jobId));

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await db.update(videoVariantJobs)
      .set({ status: "error", errorMessage: msg })
      .where(eq(videoVariantJobs.id, jobId));
  }
}

// ─── Router ─────────────────────────────────────────────────────────────────

export const videoVariantRouter = router({

  /** Create a new job shell (no clips yet) */
  createJob: protectedProcedure
    .input(z.object({ jobName: z.string().min(1).max(255) }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      const [result] = await db.insert(videoVariantJobs).values({
        userId: ctx.user.id,
        jobName: input.jobName,
        status: "pending",
        hookCount: 0,
        variantCount: 0,
      });
      const jobId = (result as unknown as { insertId: number }).insertId;
      return { jobId };
    }),

  /** Register a clip that was already uploaded to S3 via the REST endpoint */
  registerClip: protectedProcedure
    .input(z.object({
      jobId: z.number().int(),
      clipType: z.enum(["hook", "body", "cta"]),
      s3Key: z.string(),
      s3Url: z.string().url(),
      filename: z.string(),
      durationSeconds: z.number().optional(),
      clipOrder: z.number().int().default(0),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");

      // Verify job belongs to user
      const [job] = await db.select()
        .from(videoVariantJobs)
        .where(and(eq(videoVariantJobs.id, input.jobId), eq(videoVariantJobs.userId, ctx.user.id)));
      if (!job) throw new Error("Job not found");

      const [result] = await db.insert(videoClips).values({
        jobId: input.jobId,
        clipType: input.clipType,
        s3Key: input.s3Key,
        s3Url: input.s3Url,
        filename: input.filename,
        durationSeconds: input.durationSeconds,
        clipOrder: input.clipOrder,
      });
      const clipId = (result as unknown as { insertId: number }).insertId;

      // Update hookCount on job
      if (input.clipType === "hook") {
        const hooks = await db.select()
          .from(videoClips)
          .where(and(eq(videoClips.jobId, input.jobId), eq(videoClips.clipType, "hook")));
        await db.update(videoVariantJobs)
          .set({ hookCount: hooks.length })
          .where(eq(videoVariantJobs.id, input.jobId));
      }

      return { clipId };
    }),

  /** Delete a clip from a job */
  deleteClip: protectedProcedure
    .input(z.object({ clipId: z.number().int() }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      // Verify ownership via job
      const [clip] = await db.select().from(videoClips).where(eq(videoClips.id, input.clipId));
      if (!clip) throw new Error("Clip not found");
      const [job] = await db.select().from(videoVariantJobs)
        .where(and(eq(videoVariantJobs.id, clip.jobId), eq(videoVariantJobs.userId, ctx.user.id)));
      if (!job) throw new Error("Not authorized");
      await db.delete(videoClips).where(eq(videoClips.id, input.clipId));
      return { ok: true };
    }),

  /** Kick off FFmpeg stitching for a job */
  startProcessing: protectedProcedure
    .input(z.object({ jobId: z.number().int() }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      const [job] = await db.select()
        .from(videoVariantJobs)
        .where(and(eq(videoVariantJobs.id, input.jobId), eq(videoVariantJobs.userId, ctx.user.id)));
      if (!job) throw new Error("Job not found");
      if (job.status === "processing") throw new Error("Already processing");

      // Fire-and-forget
      runStitchingJob(input.jobId).catch(console.error);
      return { ok: true, message: "Processing started" };
    }),

  /** Get a single job with its clips and variants */
  getJob: protectedProcedure
    .input(z.object({ jobId: z.number().int() }))
    .query(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      const [job] = await db.select()
        .from(videoVariantJobs)
        .where(and(eq(videoVariantJobs.id, input.jobId), eq(videoVariantJobs.userId, ctx.user.id)));
      if (!job) throw new Error("Job not found");

      const clips = await db.select().from(videoClips)
        .where(eq(videoClips.jobId, input.jobId))
        .orderBy(videoClips.clipOrder);

      const variants = await db.select().from(videoVariants)
        .where(eq(videoVariants.jobId, input.jobId))
        .orderBy(videoVariants.id);

      return { job, clips, variants };
    }),

  /** List all jobs for the current user */
  listJobs: protectedProcedure
    .input(z.object({ limit: z.number().int().default(20) }))
    .query(async ({ ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      const jobs = await db.select()
        .from(videoVariantJobs)
        .where(eq(videoVariantJobs.userId, ctx.user.id))
        .orderBy(desc(videoVariantJobs.createdAt))
        .limit(20);
      return jobs;
    }),

  /** Delete a job and all its clips/variants */
  deleteJob: protectedProcedure
    .input(z.object({ jobId: z.number().int() }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      const [job] = await db.select()
        .from(videoVariantJobs)
        .where(and(eq(videoVariantJobs.id, input.jobId), eq(videoVariantJobs.userId, ctx.user.id)));
      if (!job) throw new Error("Job not found");
      await db.delete(videoVariants).where(eq(videoVariants.jobId, input.jobId));
      await db.delete(videoClips).where(eq(videoClips.jobId, input.jobId));
      await db.delete(videoVariantJobs).where(eq(videoVariantJobs.id, input.jobId));
      return { ok: true };
    }),
});
