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
import { videoVariantJobs, videoClips, videoVariants, testVariants, videoProductionSessions, sessionScripts, userCredentials } from "../drizzle/schema";
import { eq, desc, and } from "drizzle-orm";
import { storagePut } from "./storage";
import ffmpeg from "fluent-ffmpeg";
import ffmpegStatic from "ffmpeg-static";
import fs from "fs";
import path from "path";
import os from "os";
import https from "https";
import http from "http";

// Use bundled ffmpeg-static binary so stitching works in Cloud Run (no system ffmpeg required)
if (ffmpegStatic) {
  ffmpeg.setFfmpegPath(ffmpegStatic);
}

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

    // ── Wait for all clip S3 uploads to complete ─────────────────────────────
    // Placeholder rows are inserted before S3 upload finishes (s3Url = "").
    // Poll up to 15 minutes for all clips to have a non-empty s3Url.
    const waitMaxMs = 15 * 60 * 1000;
    const waitInterval = 3000;
    const waitStart = Date.now();
    let readyClips: typeof videoClips.$inferSelect[] = [];

    while (Date.now() - waitStart < waitMaxMs) {
      readyClips = await db.select()
        .from(videoClips)
        .where(eq(videoClips.jobId, jobId))
        .orderBy(videoClips.clipOrder);

      const pendingUploads = readyClips.filter(c => !c.s3Url);
      if (pendingUploads.length === 0) break; // all clips have s3Url

      console.log(`[VVF] Job ${jobId}: waiting for ${pendingUploads.length} clip(s) to finish S3 upload…`);
      await new Promise(r => setTimeout(r, waitInterval));
    }

    // Only include clips whose S3 upload has completed (s3Url non-empty).
    const hookClips = readyClips.filter(c => c.clipType === "hook" && c.s3Url);
    const bodyClips = readyClips.filter(c => c.clipType === "body" && c.s3Url);
    const ctaClips  = readyClips.filter(c => c.clipType === "cta" && c.s3Url);

    if (hookClips.length === 0 || bodyClips.length === 0) {
      const pendingCount = readyClips.filter(c => !c.s3Url).length;
      const errMsg = pendingCount > 0
        ? `${pendingCount} clip(s) are still uploading to cloud storage. Please wait a moment and try again.`
        : "Need at least one hook clip and one body clip";
      await db.update(videoVariantJobs)
        .set({ status: "error", errorMessage: errMsg })
        .where(eq(videoVariantJobs.id, jobId));
      return;
    }

    const bodyClip = bodyClips[0];

    // ── Full combinatorial matrix: every hook × every CTA ──────────────────────
    // If no CTAs uploaded, generate one variant per hook (hook + body).
    // If CTAs exist, generate hook × CTA variants: N hooks × M CTAs = N×M total.
    const ctaVariants: (typeof ctaClips[0] | null)[] =
      ctaClips.length > 0 ? ctaClips : [null];

    let variantsDone = 0;

    for (const hookClip of hookClips) {
      for (const ctaClip of ctaVariants) {
      // Create variant row (pending)
      const ctaLabel = ctaClip ? ` + CTA ${ctaClip.clipOrder}` : "";
      const label = `Hook ${hookClip.clipOrder} + Body${ctaLabel}`;
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

        // Stitch: hook → body → cta
        const parts = [hookLocal, bodyLocal, ...(ctaLocal ? [ctaLocal] : [])];
        const ctaSuffix = ctaClip ? `-cta${ctaClip.clipOrder}` : "";
        outLocal = path.join(os.tmpdir(), `vvf-out-${jobId}-h${hookClip.clipOrder}${ctaSuffix}-${randomSuffix()}.mp4`);
        await concatVideos(parts, outLocal);

        // Upload to S3
        const s3Key = `video-variants/${jobId}/variant-h${hookClip.clipOrder}${ctaSuffix}-${randomSuffix()}.mp4`;
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
      } // end ctaVariants loop
    } // end hookClips loop

    // Mark job done
    await db.update(videoVariantJobs)
      .set({
        status: "done",
        variantCount: variantsDone,
        completedAt: new Date(),
      })
      .where(eq(videoVariantJobs.id, jobId));

    // ── Auto-create A/B tests if this job is linked to a Video Production Session ──
    try {
      const sessions = await db.select()
        .from(videoProductionSessions)
        .where(eq(videoProductionSessions.variantJobId, jobId))
        .limit(1);

      if (sessions.length > 0) {
        const session = sessions[0];

        // Get all approved hook scripts for this session
        const hookScripts = await db.select()
          .from(sessionScripts)
          .where(and(
            eq(sessionScripts.sessionId, session.id),
            eq(sessionScripts.scriptType, "hook"),
          ))
          .orderBy(sessionScripts.scriptOrder);

        // Get all completed variants for this job
        const doneVariants = await db.select()
          .from(videoVariants)
          .where(and(
            eq(videoVariants.jobId, jobId),
            eq(videoVariants.status, "done"),
          ))
          .orderBy(videoVariants.id);

        // Pair hooks: (Hook1 vs Hook2), (Hook3 vs Hook4), etc.
        for (let i = 0; i < hookScripts.length - 1; i += 2) {
          const scriptA = hookScripts[i];
          const scriptB = hookScripts[i + 1];
          const variantA = doneVariants[i];
          const variantB = doneVariants[i + 1];

          const notesA = variantA?.s3Url ? `Video: ${variantA.s3Url}` : "";
          const notesB = variantB?.s3Url ? `Video: ${variantB.s3Url}` : "";
          const notes = [notesA, notesB].filter(Boolean).join(" | ");

          await db.insert(testVariants).values({
            testName: `${session.sessionName} — Hook ${scriptA.scriptOrder} vs Hook ${scriptB.scriptOrder}`,
            topic: session.idea.slice(0, 500),
            platform: session.platform,
            variantType: "hook",
            variantA: scriptA.scriptText,
            variantB: scriptB.scriptText,
            notes: notes || null,
            status: "active",
          });
        }

        // If odd number of hooks, create a solo test for the last one vs the body
        if (hookScripts.length % 2 !== 0 && hookScripts.length > 0) {
          const lastHook = hookScripts[hookScripts.length - 1];
          const bodyScripts = await db.select()
            .from(sessionScripts)
            .where(and(
              eq(sessionScripts.sessionId, session.id),
              eq(sessionScripts.scriptType, "body"),
            ))
            .limit(1);

          if (bodyScripts.length > 0) {
            const lastVariant = doneVariants[hookScripts.length - 1];
            const notes = lastVariant?.s3Url ? `Video: ${lastVariant.s3Url}` : "";
            await db.insert(testVariants).values({
              testName: `${session.sessionName} — Hook ${lastHook.scriptOrder} (solo test)`,
              topic: session.idea.slice(0, 500),
              platform: session.platform,
              variantType: "hook",
              variantA: lastHook.scriptText,
              variantB: bodyScripts[0].scriptText.slice(0, 500),
              notes: notes || null,
              status: "active",
            });
          }
        }
      }
    } catch (abErr) {
      // Non-fatal: log but don't fail the job
      console.error("[VideoVariantFactory] A/B test auto-create failed:", abErr);
    }

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

  /** Syndicate all done variants to Buffer (video posts) */
  syndicateToBuffer: protectedProcedure
    .input(z.object({
      jobId: z.number().int(),
      channelIds: z.array(z.string()).min(1),
      caption: z.string().default(""),
      ctaUrl: z.string().optional(),
      channelServiceMap: z.record(z.string(), z.string()).optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      const [job] = await db.select().from(videoVariantJobs)
        .where(and(eq(videoVariantJobs.id, input.jobId), eq(videoVariantJobs.userId, ctx.user.id)));
      if (!job) throw new Error("Job not found");
      const variants = await db.select().from(videoVariants)
        .where(and(eq(videoVariants.jobId, input.jobId), eq(videoVariants.status, "done")));
      if (variants.length === 0) throw new Error("No completed variants to syndicate");

      const { pushToBuffer } = await import("./buffer");
      const results: { variantId: number; label: string; success: boolean; error?: string }[] = [];
      const serviceMap: Record<string, string> | undefined = input.channelServiceMap as Record<string, string> | undefined;

      for (const variant of variants) {
        if (!variant.s3Url) continue;
        const res = await pushToBuffer({
          text: input.caption || job.jobName,
          profileIds: input.channelIds,
          videoUrl: variant.s3Url,
          ctaUrl: input.ctaUrl,
          channelServiceMap: serviceMap,
        });
        results.push({
          variantId: variant.id,
          label: variant.variantLabel ?? `Variant ${variant.id}`,
          success: res.success,
          error: res.error,
        });
      }

      const successCount = results.filter(r => r.success).length;
      return { results, successCount, totalVariants: variants.length };
    }),

  /** Upload all done variants to Meta Ads Manager as AdVideo creatives */
  uploadToMetaAds: protectedProcedure
    .input(z.object({
      jobId: z.number().int(),
      adAccountId: z.string().min(1),
      pageId: z.string().min(1),
      accessToken: z.string().min(1),
      adName: z.string().default(""),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      const [job] = await db.select().from(videoVariantJobs)
        .where(and(eq(videoVariantJobs.id, input.jobId), eq(videoVariantJobs.userId, ctx.user.id)));
      if (!job) throw new Error("Job not found");
      const variants = await db.select().from(videoVariants)
        .where(and(eq(videoVariants.jobId, input.jobId), eq(videoVariants.status, "done")));
      if (variants.length === 0) throw new Error("No completed variants to upload");

      const adAccountId = input.adAccountId.startsWith("act_")
        ? input.adAccountId
        : `act_${input.adAccountId}`;
      const graphBase = "https://graph.facebook.com/v20.0";
      const results: {
        variantId: number;
        label: string;
        success: boolean;
        videoId?: string;
        creativeId?: string;
        error?: string;
      }[] = [];

      for (const variant of variants) {
        if (!variant.s3Url) continue;
        const label = variant.variantLabel ?? `Variant ${variant.id}`;
        try {
          // Step 1: Upload video to ad account via file_url
          const uploadRes = await fetch(
            `${graphBase}/${adAccountId}/advideos`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                file_url: variant.s3Url,
                title: `${input.adName || job.jobName} \u2014 ${label}`,
                access_token: input.accessToken,
              }),
            }
          );
          const uploadJson = await uploadRes.json() as { id?: string; video_id?: string; error?: { message: string } };
          if (uploadJson.error) throw new Error(uploadJson.error.message);
          const videoId = uploadJson.video_id ?? uploadJson.id;
          if (!videoId) throw new Error("No video_id returned from Meta");

          // Step 2: Create AdCreative referencing the video
          const creativeRes = await fetch(
            `${graphBase}/${adAccountId}/adcreatives`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                name: `${input.adName || job.jobName} \u2014 ${label}`,
                object_story_spec: {
                  page_id: input.pageId,
                  video_data: {
                    video_id: videoId,
                    call_to_action: { type: "LEARN_MORE" },
                  },
                },
                access_token: input.accessToken,
              }),
            }
          );
          const creativeJson = await creativeRes.json() as { id?: string; error?: { message: string } };
          if (creativeJson.error) throw new Error(creativeJson.error.message);

          results.push({ variantId: variant.id, label, success: true, videoId, creativeId: creativeJson.id });
        } catch (err: unknown) {
          results.push({
            variantId: variant.id,
            label,
            success: false,
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }

      const successCount = results.filter(r => r.success).length;
      return { results, successCount, totalVariants: variants.length };
    }),

  /** Get A/B test entries auto-created for a job's session */
  getLinkedABTests: protectedProcedure
    .input(z.object({ jobId: z.number().int() }))
    .query(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      // Find the session linked to this job
      const sessions = await db.select()
        .from(videoProductionSessions)
        .where(eq(videoProductionSessions.variantJobId, input.jobId))
        .limit(1);
      if (sessions.length === 0) return { tests: [], sessionName: null };
      const session = sessions[0];
      // Return the A/B tests whose name starts with the session name
      const tests = await db.select()
        .from(testVariants)
        .where(eq(testVariants.topic, session.idea.slice(0, 500)))
        .orderBy(desc(testVariants.createdAt))
        .limit(20);
      return { tests, sessionName: session.sessionName };
    }),

  /** Get saved Meta Ads credentials for the current user */
  getMetaCredentials: protectedProcedure
    .query(async ({ ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      const rows = await db.select()
        .from(userCredentials)
        .where(eq(userCredentials.userId, ctx.user.id))
        .limit(1);
      if (rows.length === 0) return { metaAdAccountId: "", metaPageId: "", metaAccessToken: "" };
      const row = rows[0];
      return {
        metaAdAccountId: row.metaAdAccountId ?? "",
        metaPageId: row.metaPageId ?? "",
        metaAccessToken: row.metaAccessToken ?? "",
      };
    }),

  /** Save Meta Ads credentials for the current user (upsert) */
  saveMetaCredentials: protectedProcedure
    .input(z.object({
      metaAdAccountId: z.string().max(128),
      metaPageId: z.string().max(128),
      metaAccessToken: z.string().max(4096),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      // Check if row already exists
      const existing = await db.select({ id: userCredentials.id })
        .from(userCredentials)
        .where(eq(userCredentials.userId, ctx.user.id))
        .limit(1);
      if (existing.length > 0) {
        await db.update(userCredentials)
          .set({
            metaAdAccountId: input.metaAdAccountId,
            metaPageId: input.metaPageId,
            metaAccessToken: input.metaAccessToken,
          })
          .where(eq(userCredentials.userId, ctx.user.id));
      } else {
        await db.insert(userCredentials).values({
          userId: ctx.user.id,
          metaAdAccountId: input.metaAdAccountId,
          metaPageId: input.metaPageId,
          metaAccessToken: input.metaAccessToken,
        });
      }
      return { success: true };
    }),
});
