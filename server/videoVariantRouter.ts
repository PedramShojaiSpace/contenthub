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
import { videoVariantJobs, videoClips, videoVariants, testVariants, videoProductionSessions, sessionScripts, userCredentials, contentItems } from "../drizzle/schema";
import { eq, desc, and } from "drizzle-orm";
import ffmpeg from "fluent-ffmpeg";
import ffmpegStatic from "ffmpeg-static";
import fs from "fs";
import path from "path";
import os from "os";
import https from "https";
import http from "http";
import FormData from "form-data";
import { ENV } from "./_core/env";
import { PassThrough } from "stream";
import { spawn } from "child_process";
import { safeParseJson } from "./fetchUtils";

// Use bundled ffmpeg-static binary so stitching works in Cloud Run (no system ffmpeg required)
if (ffmpegStatic) {
  ffmpeg.setFfmpegPath(ffmpegStatic);
}

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Upload a local file to forge storage via streaming multipart/form-data.
 * Uses native https.request + form-data ReadStream — avoids loading the entire
 * file into RAM (which causes silent hangs on Cloud Run for large files).
 */
function uploadFileFromDisk(
  filePath: string,
  s3Key: string,
  timeoutMs = 20 * 60 * 1000
): Promise<string> {
  const baseUrl = ENV.forgeApiUrl?.replace(/\/+$/, "");
  const serverKey = ENV.forgeApiKey;
  if (!baseUrl || !serverKey) throw new Error("Storage proxy credentials missing");

  const form = new FormData();
  form.append("file", fs.createReadStream(filePath), {
    filename: path.basename(filePath),
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
      }
    );

    req.on("error", (e) => {
      clearTimeout(timer);
      reject(new Error(`Storage upload network error: ${e.message}`));
    });

    form.pipe(req);
  });
}

function randomSuffix() {
  return Math.random().toString(36).slice(2, 8);
}

// Per-download timeout: 10 minutes. Large segment files on Cloud Run can take 3–5 min.
const DOWNLOAD_TIMEOUT_MS = 10 * 60 * 1000;
// Per-FFmpeg stitch timeout: 15 minutes. A 10-minute video stitching job should finish well within this.
const FFMPEG_TIMEOUT_MS = 15 * 60 * 1000;
// Per-variant total timeout (download + stitch + upload): 45 minutes.
const VARIANT_TIMEOUT_MS = 45 * 60 * 1000;

/** Download a single URL to a specific local path — with a hard timeout */
function downloadSingleUrl(url: string, dest: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    const client = url.startsWith("https") ? https : http;
    const req = client.get(url, (res) => {
      if (res.statusCode !== 200) {
        file.close();
        reject(new Error(`Download failed: ${res.statusCode} ${url}`));
        return;
      }
      res.pipe(file);
      file.on("finish", () => { file.close(); resolve(); });
      file.on("error", (e) => { req.destroy(); reject(e); });
      res.on("error", (e) => { req.destroy(); reject(e); });
    }).on("error", reject);

    // Hard timeout — destroy the request if it stalls
    const timer = setTimeout(() => {
      req.destroy();
      reject(new Error(`Download timed out after ${DOWNLOAD_TIMEOUT_MS / 60000} min: ${url}`));
    }, DOWNLOAD_TIMEOUT_MS);

    // Clear the timer once the file stream finishes (success or error)
    file.on("finish", () => clearTimeout(timer));
    file.on("error", () => clearTimeout(timer));
  });
}

/**
 * Download a URL (or JSON array of segment URLs) to a local temp file.
 * Large clips are stored as JSON arrays of 14 MB segment URLs by the uploader.
 * This function detects that case and concatenates the segments transparently.
 */
async function downloadToTemp(urlOrSegments: string, ext: string): Promise<string> {
  // Detect JSON array of segment URLs (produced by uploadFileSegmented)
  if (urlOrSegments.trimStart().startsWith("[")) {
    let segUrls: string[];
    try { segUrls = JSON.parse(urlOrSegments); } catch { throw new Error("Invalid segment URL JSON"); }
    if (!Array.isArray(segUrls) || segUrls.length === 0) throw new Error("Empty segment URL array");

    const dest = path.join(os.tmpdir(), `vvf-${randomSuffix()}.${ext}`);
    const outStream = fs.createWriteStream(dest, { flags: "w" });

    for (const segUrl of segUrls) {
      const segDest = path.join(os.tmpdir(), `vvf-seg-${randomSuffix()}.${ext}`);
      await downloadSingleUrl(segUrl, segDest);
      const segBuf = fs.readFileSync(segDest);
      await new Promise<void>((res, rej) => outStream.write(segBuf, (e) => e ? rej(e) : res()));
      try { fs.unlinkSync(segDest); } catch {}
    }

    await new Promise<void>((res) => outStream.end(res));
    return dest;
  }

  // Plain URL — original behaviour
  const dest = path.join(os.tmpdir(), `vvf-${randomSuffix()}.${ext}`);
  await downloadSingleUrl(urlOrSegments, dest);
  return dest;
}

/**
 * Concatenate MP4 files and STREAM the output directly to the forge upload API.
 * Returns the CDN URL of the uploaded file.
 *
 * This avoids writing the ~165 MB output to /tmp, which prevents OOM on Cloud Run
 * (tmpfs = RAM; writing 165 MB output on top of 234 MB source files = OOM kill).
 */
/**
 * Map an aspect ratio string to the target width × height for FFmpeg.
 */
function getTargetDimensions(aspectRatio: "9:16" | "16:9" | "1:1"): { w: number; h: number } {
  if (aspectRatio === "16:9") return { w: 1920, h: 1080 };
  if (aspectRatio === "1:1")  return { w: 1080, h: 1080 };
  return { w: 1080, h: 1920 }; // default 9:16
}

function concatAndUpload(
  inputPaths: string[],
  s3Key: string,
  aspectRatio: "9:16" | "16:9" | "1:1" = "9:16",
  timeoutMs = FFMPEG_TIMEOUT_MS,
): Promise<string> {
  const baseUrl = ENV.forgeApiUrl?.replace(/\/+$/, "");
  const serverKey = ENV.forgeApiKey;
  if (!baseUrl || !serverKey) throw new Error("Storage proxy credentials missing");

  const listPath = path.join(os.tmpdir(), `vvf-list-${randomSuffix()}.txt`);
  const listContent = inputPaths.map(p => `file '${p}'`).join("\n");
  fs.writeFileSync(listPath, listContent);

  return new Promise<string>((resolve, reject) => {
    let settled = false;
    const done = (err: Error | null, url?: string) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try { fs.unlinkSync(listPath); } catch {}
      if (err) reject(err); else resolve(url!);
    };

    // Hard timeout — kill FFmpeg if it stalls
    const timer = setTimeout(() => {
      try { ffmpegProc?.kill("SIGKILL"); } catch {}
      done(new Error(`FFmpeg stitch timed out after ${timeoutMs / 60000} min`));
    }, timeoutMs);

    // Use a PassThrough stream to bridge FFmpeg stdout → form-data → upload request
    const passthrough = new PassThrough();

    // Build form-data with the passthrough stream as the file field
    const form = new FormData();
    form.append("file", passthrough, {
      filename: path.basename(s3Key),
      contentType: "video/mp4",
    });

    // Build the upload request using form.getHeaders() so the boundary is correct
    const uploadPath = `/v1/storage/upload?path=${encodeURIComponent(s3Key)}`;
    const uploadUrl = new URL(baseUrl + uploadPath);
    const isHttps = uploadUrl.protocol === "https:";
    const transport = isHttps ? https : http;

    const uploadReq = transport.request(
      {
        hostname: uploadUrl.hostname,
        port: uploadUrl.port || (isHttps ? 443 : 80),
        path: uploadUrl.pathname + uploadUrl.search,
        method: "POST",
        headers: {
          ...form.getHeaders(),
          "Authorization": `Bearer ${serverKey}`,
        },
      },
      (res) => {
        let body = "";
        res.on("data", (d) => (body += d));
        res.on("end", () => {
          if (res.statusCode === 200) {
            try {
              const data = JSON.parse(body);
              if (data?.url) done(null, data.url);
              else done(new Error(`Storage proxy did not return a URL: ${body.slice(0, 200)}`));
            } catch {
              done(new Error(`Storage proxy response parse error: ${body.slice(0, 200)}`));
            }
          } else {
            done(new Error(`Storage upload failed (${res.statusCode}): ${body.slice(0, 200)}`));
          }
        });
      },
    );
    uploadReq.on("error", (e) => done(new Error(`Storage upload network error: ${e.message}`)));

    // Pipe form-data → upload request
    form.pipe(uploadReq);

    // Spawn FFmpeg with pipe:1 output (stdout)
    // Re-encode to 1080x1920 (9:16 vertical / Reels format) with production polish:
    //   - scale_and_pad: pillarbox/letterbox any mismatched source to fill 1080x1920
    //   - eq: subtle contrast (+5%) and saturation (+10%) boost for a polished look
    //   - fade: 0.5s fade-in at start, 0.3s fade-out at end (duration estimated at 180s)
    //   - apad/afade: matching audio fades
    // -movflags frag_keyframe+empty_moov makes the MP4 streamable without seeking
    //
    // NOTE: Estimated output duration for fade-out calculation.
    // We use 300s as a safe upper bound — the fade-out starts at (duration - 0.3s).
    // If the actual video is shorter, the fade-out still works because FFmpeg clips it.
    const { w, h } = getTargetDimensions(aspectRatio);
    const ESTIMATED_DURATION_S = 300;
    const FADE_IN_S = 0.5;
    const FADE_OUT_START_S = ESTIMATED_DURATION_S - 0.3;
    const vf = [
      // 1. Normalize to target dimensions with black bars for mismatched aspect ratios
      `scale=${w}:${h}:force_original_aspect_ratio=decrease,pad=${w}:${h}:(ow-iw)/2:(oh-ih)/2:black`,
      // 2. Subtle production grade: slight contrast and saturation boost
      `eq=contrast=1.05:saturation=1.10`,
      // 3. Fade in (0.5s) and fade out (0.3s)
      `fade=t=in:st=0:d=${FADE_IN_S}`,
      `fade=t=out:st=${FADE_OUT_START_S}:d=0.3`,
    ].join(",");
    const af = [
      `afade=t=in:st=0:d=${FADE_IN_S}`,
      `afade=t=out:st=${FADE_OUT_START_S}:d=0.3`,
    ].join(",");
    const ffmpegBin = ffmpegStatic || "ffmpeg";
    const args = [
      "-f", "concat",
      "-safe", "0",
      "-i", listPath,
      // Video: normalize aspect ratio + production grade + fades
      "-vf", vf,
      // Audio: matching fades
      "-af", af,
      // H.264 encoding: CRF 23 = good quality/size balance; preset fast = reasonable speed on Cloud Run
      "-c:v", "libx264",
      "-crf", "23",
      "-preset", "fast",
      "-c:a", "aac",
      "-b:a", "128k",
      "-movflags", "frag_keyframe+empty_moov",
      "-f", "mp4",
      "pipe:1",
    ];

    const ffmpegProc = spawn(ffmpegBin, args, { stdio: ["ignore", "pipe", "pipe"] });

    // Pipe FFmpeg stdout → passthrough → form-data → upload request
    ffmpegProc.stdout.pipe(passthrough);

    // Collect stderr for error reporting
    let stderrBuf = "";
    ffmpegProc.stderr.on("data", (d: Buffer) => {
      stderrBuf += d.toString();
      // Keep only last 2KB to avoid unbounded growth
      if (stderrBuf.length > 2048) stderrBuf = stderrBuf.slice(-2048);
    });

    ffmpegProc.on("close", (code: number | null) => {
      if (code !== 0 && !settled) {
        // FFmpeg failed — destroy the passthrough so form-data/upload can clean up
        passthrough.destroy(new Error(`FFmpeg exited with code ${code}: ${stderrBuf.slice(-500)}`));
        done(new Error(`FFmpeg exited with code ${code}: ${stderrBuf.slice(-500)}`));
      }
      // If code === 0, the upload response handler will call done(null, url)
    });

    ffmpegProc.on("error", (e: Error) => {
      passthrough.destroy(e);
      done(new Error(`FFmpeg spawn error: ${e.message}`));
    });
  });
}

/** Race a promise against a timeout, rejecting with a descriptive error if it stalls */
function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms / 60000} min`)), ms);
    promise.then(
      (v) => { clearTimeout(timer); resolve(v); },
      (e) => { clearTimeout(timer); reject(e); },
    );
  });
}

/** Run the full stitching job in the background (fire-and-forget) */
export async function runStitchingJob(jobId: number) {
  const db = await getDb();
  if (!db) return;

  try {
    // Fetch the job row to get aspectRatio and other metadata
    const [jobRow] = await db.select().from(videoVariantJobs).where(eq(videoVariantJobs.id, jobId));
    if (!jobRow) { console.error(`[VVF] Job ${jobId} not found`); return; }
    const aspectRatio = (jobRow.aspectRatio ?? "9:16") as "9:16" | "16:9" | "1:1";

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

    // ── Download body clip ONCE (reused across all variants) ──────────────────
    // Body is the largest file (149 MB). Download it once and reuse.
    console.log(`[VVF] Job ${jobId}: downloading body clip (${bodyClip.filename})…`);
    const bodyLocal = await downloadToTemp(bodyClip.s3Url, "mp4");
    console.log(`[VVF] Job ${jobId}: body clip ready at ${bodyLocal}`);

    // ── Pre-download CTA clips (small, reused across all hook variants) ─────────
    const ctaLocalMap = new Map<number, string>();
    for (const ctaClip of ctaClips) {
      console.log(`[VVF] Job ${jobId}: downloading CTA ${ctaClip.clipOrder} (${ctaClip.filename})…`);
      const ctaLocal = await downloadToTemp(ctaClip.s3Url, "mp4");
      ctaLocalMap.set(ctaClip.id, ctaLocal);
      console.log(`[VVF] Job ${jobId}: CTA ${ctaClip.clipOrder} ready`);
    }

    // ── Full combinatorial matrix: every hook × every CTA ──────────────────────
    // If no CTAs uploaded, generate one variant per hook (hook + body).
    // If CTAs exist, generate hook × CTA variants: N hooks × M CTAs = N×M total.
    //
    // MEMORY STRATEGY: Download each hook clip just-in-time, then delete it after
    // all its variants are done. This keeps /tmp usage to:
    //   body(149MB) + 1 hook(17MB) = 166MB — well within Cloud Run's 256MB tmpfs.
    // FFmpeg output is streamed directly to the forge upload API (no /tmp write).
    const ctaVariants: (typeof ctaClips[0] | null)[] =
      ctaClips.length > 0 ? ctaClips : [null];

    let variantsDone = 0;

    for (const hookClip of hookClips) {
      // Download this hook clip just-in-time
      console.log(`[VVF] Job ${jobId}: downloading hook ${hookClip.clipOrder} (${hookClip.filename})…`);
      const hookLocalPath = await downloadToTemp(hookClip.s3Url, "mp4");
      console.log(`[VVF] Job ${jobId}: hook ${hookClip.clipOrder} ready`);

      try {
        for (const ctaClip of ctaVariants) {
          // Create variant row (processing)
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

          const ctaLocalPath = ctaClip ? ctaLocalMap.get(ctaClip.id) ?? null : null;
          const ctaSuffix = ctaClip ? `-cta${ctaClip.clipOrder}` : "";
          const variantLabel = `Hook ${hookClip.clipOrder}${ctaSuffix}`;

          try {
            // Wrap the entire per-variant stitch+upload in a hard timeout
            await withTimeout(
              (async () => {
                // Stitch: hook → body → cta, streaming output directly to forge S3
                // No output file written to /tmp — avoids OOM on Cloud Run
                const parts = [hookLocalPath, bodyLocal, ...(ctaLocalPath ? [ctaLocalPath] : [])];
                const s3Key = `video-variants/${jobId}/variant-h${hookClip.clipOrder}${ctaSuffix}-${randomSuffix()}.mp4`;
                console.log(`[VVF] Job ${jobId}: stitching+uploading ${variantLabel} (${parts.length} parts, ${aspectRatio}, streaming to S3)…`);
                const s3Url = await concatAndUpload(parts, s3Key, aspectRatio);

                // Mark variant done
                await db.update(videoVariants)
                  .set({ status: "done", s3Key, s3Url })
                  .where(eq(videoVariants.id, variantId));

                variantsDone++;
                console.log(`[VVF] Job ${jobId}: ${variantLabel} done (${variantsDone} total)`);
              })(),
              VARIANT_TIMEOUT_MS,
              `Variant ${variantLabel}`,
            );
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            console.error(`[VVF] Job ${jobId}: ${variantLabel} failed — ${msg}`);
            await db.update(videoVariants)
              .set({ status: "error", errorMessage: msg })
              .where(eq(videoVariants.id, variantId));
          }
        } // end ctaVariants loop
      } finally {
        // Delete this hook clip after all its variants are done to free /tmp space
        try { fs.unlinkSync(hookLocalPath); } catch {}
      }
    } // end hookClips loop

    // Clean up body and CTA source files
    try { fs.unlinkSync(bodyLocal); } catch {}
    for (const f of Array.from(ctaLocalMap.values())) {
      try { fs.unlinkSync(f); } catch {}
    }

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
    .input(z.object({
      jobName: z.string().min(1).max(255),
      aspectRatio: z.enum(["9:16", "16:9", "1:1"]).default("9:16"),
      // Optional: hook scripts pre-loaded from Hook Generator
      hookScripts: z.array(z.object({
        hookText: z.string(),
        frameworkLabel: z.string().optional(),
        estimatedCTRLift: z.string().optional(),
      })).optional(),
      targetProduct: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      const [result] = await db.insert(videoVariantJobs).values({
        userId: ctx.user.id,
        jobName: input.jobName,
        status: "pending",
        hookCount: input.hookScripts?.length ?? 0,
        variantCount: 0,
        aspectRatio: input.aspectRatio,
        hookScripts: input.hookScripts ? JSON.stringify(input.hookScripts) : null,
        targetProduct: input.targetProduct ?? null,
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

      // Mark job as processing so the client knows to call /api/stitch-job/:jobId
      // The actual stitching runs in /api/stitch-job (long-lived HTTP request)
      // to keep the Cloud Run container alive during FFmpeg processing.
      await db.update(videoVariantJobs)
        .set({ status: "processing" })
        .where(eq(videoVariantJobs.id, input.jobId));
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
      // Legacy: send all variants to all these channels
      channelIds: z.array(z.string()).default([]),
      // Per-variant routing: variantId (as string key) -> channelId
      // When provided, each variant is sent only to its assigned channel
      variantChannelMap: z.record(z.string(), z.string()).optional(),
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
      const results: { variantId: number; label: string; channelId?: string; success: boolean; error?: string }[] = [];
      const serviceMap: Record<string, string> | undefined = input.channelServiceMap as Record<string, string> | undefined;

      for (const variant of variants) {
        if (!variant.s3Url) continue;

        // Determine target channel(s) for this variant
        let targetChannelIds: string[];
        if (input.variantChannelMap) {
          // Per-variant routing mode: each variant goes to its assigned channel only
          const assignedChannelId = input.variantChannelMap[String(variant.id)];
          if (!assignedChannelId) {
            results.push({
              variantId: variant.id,
              label: variant.variantLabel ?? `Variant ${variant.id}`,
              success: false,
              error: "No channel assigned — skipped",
            });
            continue;
          }
          targetChannelIds = [assignedChannelId];
        } else {
          // Legacy broadcast mode
          if (input.channelIds.length === 0) {
            results.push({
              variantId: variant.id,
              label: variant.variantLabel ?? `Variant ${variant.id}`,
              success: false,
              error: "No channels provided",
            });
            continue;
          }
          targetChannelIds = input.channelIds;
        }

        const res = await pushToBuffer({
          text: input.caption || job.jobName,
          profileIds: targetChannelIds,
          videoUrl: variant.s3Url,
          ctaUrl: input.ctaUrl,
          channelServiceMap: serviceMap,
        });
        results.push({
          variantId: variant.id,
          label: variant.variantLabel ?? `Variant ${variant.id}`,
          channelId: targetChannelIds[0],
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
          const uploadJson = await safeParseJson<{ id?: string; video_id?: string; error?: { message: string } }>(uploadRes, "Meta video upload");
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
          const creativeJson = await safeParseJson<{ id?: string; error?: { message: string } }>(creativeRes, "Meta ad creative");
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

  /**
   * Retry a single failed variant without resetting the whole job.
   * Re-stitches the variant using the same hook + body + CTA clips.
   * The actual stitching is triggered via /api/stitch-variant/:variantId.
   */
  retryVariant: protectedProcedure
    .input(z.object({ variantId: z.number().int() }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");

      // Verify ownership
      const [variant] = await db.select().from(videoVariants)
        .where(eq(videoVariants.id, input.variantId));
      if (!variant) throw new Error("Variant not found");
      const [job] = await db.select().from(videoVariantJobs)
        .where(and(eq(videoVariantJobs.id, variant.jobId), eq(videoVariantJobs.userId, ctx.user.id)));
      if (!job) throw new Error("Not authorized");
      if (variant.status !== "error") throw new Error("Variant is not in error state");

      // Reset variant to processing so the client knows to call /api/stitch-variant/:variantId
      await db.update(videoVariants)
        .set({ status: "processing", errorMessage: null, s3Key: null, s3Url: null })
        .where(eq(videoVariants.id, input.variantId));

      return { ok: true, variantId: input.variantId, jobId: job.id };
    }),

  /**
   * Reset a stuck/processing job back to "pending" so the user can retry.
   * Deletes all variant rows (they are stale/incomplete) and resets the job status.
   * Does NOT delete the uploaded clips — those are preserved so the user can re-run.
   */
  resetJob: protectedProcedure
    .input(z.object({ jobId: z.number().int() }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      const [job] = await db.select().from(videoVariantJobs)
        .where(and(eq(videoVariantJobs.id, input.jobId), eq(videoVariantJobs.userId, ctx.user.id)));
      if (!job) throw new Error("Job not found");
      // Delete stale variant rows
      await db.delete(videoVariants).where(eq(videoVariants.jobId, input.jobId));
      // Reset job to pending so startProcessing can be called again
      await db.update(videoVariantJobs)
        .set({ status: "pending", errorMessage: null, variantCount: 0, completedAt: null })
        .where(eq(videoVariantJobs.id, input.jobId));
      return { ok: true };
    }),

  /**
   * Bulk-create content_items in "pending_approval" status for all done variants.
   * Each variant becomes one content card in the Command Center Kanban.
   * Returns the count of cards created.
   */
  bulkSendToPendingApproval: protectedProcedure
    .input(z.object({ jobId: z.number().int() }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      const [job] = await db.select().from(videoVariantJobs)
        .where(and(eq(videoVariantJobs.id, input.jobId), eq(videoVariantJobs.userId, ctx.user.id)));
      if (!job) throw new Error("Job not found");

      const doneVariants = await db.select().from(videoVariants)
        .where(and(eq(videoVariants.jobId, input.jobId), eq(videoVariants.status, "done")));
      if (doneVariants.length === 0) throw new Error("No completed variants to send");

      let created = 0;
      for (const v of doneVariants) {
        if (!v.s3Url) continue;
        await db.insert(contentItems).values({
          title: `${job.jobName} — ${v.variantLabel}`,
          rawIdea: `Video variant from job: ${job.jobName}`,
          platform: "meta",
          status: "pending_approval",
          imageUrl: v.s3Url,  // store the variant video URL in imageUrl for preview
          notes: `Auto-created from Video Variant Factory job #${job.id}. Variant: ${v.variantLabel}.`,
        });
        created++;
      }
      return { created };
    }),

  /**
   * Duplicate a job with a different aspect ratio.
   * Copies the job row and all its clip references (same S3 URLs, no re-upload).
   * Returns the new job ID so the client can open it immediately.
   */
  duplicateJob: protectedProcedure
    .input(z.object({
      jobId: z.number().int(),
      aspectRatio: z.enum(["9:16", "16:9", "1:1"]),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");

      // Verify ownership
      const [job] = await db.select().from(videoVariantJobs)
        .where(and(eq(videoVariantJobs.id, input.jobId), eq(videoVariantJobs.userId, ctx.user.id)));
      if (!job) throw new Error("Job not found");

      // Build new job name: append the ratio label
      const ratioLabel = input.aspectRatio === "9:16" ? "Vertical" : input.aspectRatio === "16:9" ? "Horizontal" : "Square";
      const newJobName = `${job.jobName} (${ratioLabel})`;

      // Insert new job row
      const [newJob] = await db.insert(videoVariantJobs).values({
        userId: ctx.user.id,
        jobName: newJobName,
        status: "pending",
        hookCount: job.hookCount,
        variantCount: 0,
        aspectRatio: input.aspectRatio,
      }).$returningId();
      const newJobId = newJob.id;

      // Copy all clip rows (same S3 keys/URLs, no re-upload needed)
      const clips = await db.select().from(videoClips).where(eq(videoClips.jobId, input.jobId));
      if (clips.length > 0) {
        await db.insert(videoClips).values(
          clips.map(c => ({
            jobId: newJobId,
            clipType: c.clipType,
            s3Key: c.s3Key,
            s3Url: c.s3Url,
            filename: c.filename,
            durationSeconds: c.durationSeconds,
            clipOrder: c.clipOrder,
          }))
        );
      }

      return { newJobId, newJobName };
    }),
});
