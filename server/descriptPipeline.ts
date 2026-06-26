/**
 * Descript Video Pipeline Orchestrator
 *
 * Three production paths (productionPath field):
 *
 * ── heygen_then_descript (default avatar flow) ──────────────────────────────
 *   0. Start HeyGen render (fires immediately on job creation)
 *   1. Poll HeyGen until completed → download MP4 → upload to S3
 *   2. Generate B-roll prompt + metadata via AI
 *   3. Import S3 avatar video into Descript
 *   4. Run Underlord B-roll agent on the imported avatar video
 *   5. Export project to MP4 → ready_for_review
 *   6. On VA approval: distribute to all outputChannels
 *
 * ── heygen_only ──────────────────────────────────────────────────────────────
 *   0. Start HeyGen render (fires immediately on job creation)
 *   1. Poll HeyGen until completed → download MP4 → upload to S3
 *   2. Generate metadata via AI
 *   3. Mark ready_for_review (skip Descript entirely)
 *   4. On VA approval: distribute to all outputChannels
 *
 * ── descript_only (original AI voice flow) ──────────────────────────────────
 *   1. Generate B-roll prompt + metadata via AI
 *   2. Create Descript project via agent — Underlord narrates with Pedram AI voice
 *   3. Run B-roll editing agent pass
 *   4. Export project to MP4 → ready_for_review
 *   5. On VA approval: distribute to all outputChannels
 *
 * outputChannels: JSON array of destination platforms e.g. ["youtube","tiktok","meta"]
 *
 * DB status enum: pending|rendering|importing|editing|rendering|ready_for_review|approved|uploading|published|failed|rejected
 *
 * NOTE: We intentionally skip downloading the MP4 at the export step because videos can be
 * 500MB–1GB. Instead we store the Descript share_url for VA preview and only
 * download on approval (handled in videoPipelineRouter approveVideoJob).
 */

import { eq, or } from "drizzle-orm";
import { getDb } from "./db";
import { videoJobs, contentItems } from "../drizzle/schema";
import { generateBrollPrompt } from "./brollPromptGenerator";
import {
  createProjectWithVoice,
  importVideoFromUrl,
  runUnderlordAgent,
  getJobStatus,
  exportProject,
} from "./descriptClient";
import { storagePut } from "./storage";
import { ENV } from "./_core/env";

// ── HeyGen helpers (inline to avoid circular imports) ────────────────────────

const HEYGEN_API_BASE = "https://api.heygen.com";

async function heygenFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const apiKey = ENV.heygenApiKey;
  if (!apiKey) throw new Error("HEYGEN_API_KEY is not configured");
  return fetch(`${HEYGEN_API_BASE}${path}`, {
    ...options,
    headers: {
      "X-Api-Key": apiKey,
      "Content-Type": "application/json",
      ...(options.headers ?? {}),
    },
  });
}

/** Split text into chunks at paragraph boundaries, each under maxLen chars */
function splitScriptIntoChunks(text: string, maxLen = 4800): string[] {
  const paragraphs = text.split(/\n{2,}/).map(p => p.trim()).filter(Boolean);
  const chunks: string[] = [];
  let current = "";

  for (const para of paragraphs) {
    // If a single paragraph exceeds maxLen, split it at sentence boundaries
    if (para.length > maxLen) {
      const sentences = para.match(/[^.!?]+[.!?]+[\s]*/g) ?? [para];
      for (const sentence of sentences) {
        if ((current + sentence).length > maxLen && current) {
          chunks.push(current.trim());
          current = sentence;
        } else {
          current += sentence;
        }
      }
    } else if ((current + "\n\n" + para).length > maxLen && current) {
      chunks.push(current.trim());
      current = para;
    } else {
      current = current ? current + "\n\n" + para : para;
    }
  }
  if (current.trim()) chunks.push(current.trim());
  return chunks.filter(c => c.length > 0);
}

async function checkHeyGenQuota(): Promise<void> {
  const res = await heygenFetch("/v2/user/remaining_quota");
  if (!res.ok) return; // if quota check fails, let the render attempt proceed
  const json = (await res.json()) as { error: null | string; data: { remaining_quota: number } };
  const remaining = json.data?.remaining_quota ?? -1;
  console.log(`[HeyGen] Quota check: remaining_quota=${remaining}`);
  if (remaining === 0) {
    throw new Error(
      "HeyGen API quota exhausted (remaining_quota=0). Please top up API credits at app.heygen.com → Account → Credits. Job will retry automatically once credits are restored."
    );
  }
}

/**
 * Strip all production/direction notes from a script so only spoken dialogue
 * reaches HeyGen. Removes:
 *  - Lines in [square brackets] e.g. [B-ROLL: forest shot]
 *  - Lines in (parentheses) e.g. (pause here)
 *  - ALL-CAPS section headers e.g. INTRO:, HOOK:, OUTRO:, B-ROLL:, CTA:
 *  - Lines starting with common direction keywords
 *  - Markdown bold/italic markers
 *  - Timestamps e.g. [0:00], (0:00-0:08)
 *  - Empty lines collapsed to single blank
 */
function cleanScriptForHeyGen(raw: string): string {
  // Step 1: Remove the entire PRODUCTION NOTES block (=== PRODUCTION NOTES === to end of string)
  let text = raw.replace(/===\s*PRODUCTION NOTES\s*===[\s\S]*/i, "").trim();

  // Step 2: Remove === SECTION: ... === headers (entire line)
  text = text.replace(/^===.*===\s*$/gm, "");

  // Step 3: Remove inline [PAUSE] and [EMPHASIS] markers (keep surrounding text)
  text = text
    .replace(/\[PAUSE\]/gi, "")
    .replace(/\[EMPHASIS\]/gi, "")
    .replace(/\[BEAT\]/gi, "")
    .replace(/\[BREATHE\]/gi, "");

  const directionKeywords = [
    /^\[.*?\]/,           // [anything in brackets]
    /^\(.*?\)/,           // (anything in parens)
    /^[A-Z][A-Z\s]{3,}:/, // ALL CAPS HEADER:
    /^b[-\s]?roll/i,
    /^\[?b[-\s]?roll/i,
    /^visual/i,
    /^cut to/i,
    /^scene/i,
    /^shot:/i,
    /^note:/i,
    /^direction/i,
    /^transition/i,
    /^music:/i,
    /^sfx:/i,
    /^\d+:\d+/,           // timestamp lines like 0:00 or 1:23
    /^production notes/i,
    /^delivery tip/i,
    /^pacing/i,
  ];

  const lines = text.split("\n");
  const cleaned: string[] = [];

  for (const rawLine of lines) {
    // Strip markdown bold/italic and inline brackets/timestamps
    let line = rawLine
      .replace(/\*\*|__/g, "")          // bold markers
      .replace(/\*|_/g, "")             // italic markers
      .replace(/\[\d+:\d+(?:-\d+:\d+)?\]/g, "") // [0:00] or [0:00-0:08]
      .replace(/\(\d+:\d+(?:-\d+:\d+)?\)/g, "") // (0:00) or (0:00-0:08)
      .trim();

    // Skip empty lines (will be re-added as paragraph breaks)
    if (!line) {
      cleaned.push("");
      continue;
    }

    // Skip direction lines
    const isDirection = directionKeywords.some(re => re.test(line));
    if (isDirection) continue;

    // Skip lines that are entirely in brackets or parens
    if (/^\[.*\]$/.test(line) || /^\(.*\)$/.test(line)) continue;

    cleaned.push(line);
  }

  // Collapse multiple blank lines into one, trim leading/trailing whitespace
  return cleaned
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

async function startHeyGenRender(scriptText: string): Promise<string> {
  const avatarId = ENV.heygenAvatarId;
  const voiceId = ENV.heygenVoiceId;
  if (!avatarId) throw new Error("HEYGEN_AVATAR_ID is not configured");
  if (!voiceId) throw new Error("HEYGEN_VOICE_ID is not configured");

  // Pre-flight: check quota before submitting to avoid burning credits on doomed renders
  await checkHeyGenQuota();

  // Strip all production directions — HeyGen must only receive spoken dialogue
  const spokenText = cleanScriptForHeyGen(scriptText);
  console.log(`[HeyGen] Script cleaned: ${scriptText.length} chars → ${spokenText.length} chars (removed ${scriptText.length - spokenText.length} chars of directions)`);

  // HeyGen limits each clip to 5000 chars. Split long scripts into multiple clips
  // which HeyGen concatenates into a single video automatically.
  const HEYGEN_CHAR_LIMIT = 4800; // leave 200 char buffer
  const chunks = splitScriptIntoChunks(spokenText, HEYGEN_CHAR_LIMIT);
  console.log(`[HeyGen] Script split into ${chunks.length} clip(s) (total ${scriptText.length} chars)`);

  const video_inputs = chunks.map(chunk => ({
    character: { type: "avatar", avatar_id: avatarId, avatar_style: "normal" },
    voice: { type: "text", input_text: chunk, voice_id: voiceId, speed: 1.0 },
    background: { type: "color", value: "#f5f0e8" },
  }));

  const body = {
    video_inputs,
    dimension: { width: 1920, height: 1080 },
    aspect_ratio: null,
    test: false,
  };

  const res = await heygenFetch("/v2/video/generate", { method: "POST", body: JSON.stringify(body) });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HeyGen generate failed (${res.status}): ${text}`);
  }
  const json = (await res.json()) as { error: null | string; data: { video_id: string } };
  if (json.error) throw new Error(`HeyGen API error: ${json.error}`);
  if (!json.data?.video_id) throw new Error("HeyGen returned no video_id");
  return json.data.video_id;
}

async function pollHeyGenStatus(heygenVideoId: string): Promise<{
  status: "pending" | "processing" | "waiting" | "failed" | "completed";
  video_url?: string;
  error?: { code: string; detail: string };
}> {
  // Use the underscore endpoint (/v1/video_status.get) — the dot variant (/v1/video.status.get)
  // returns 404 HTML for many videos. The underscore endpoint is the correct one per HeyGen docs.
  const res = await heygenFetch(`/v1/video_status.get?video_id=${heygenVideoId}`);

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HeyGen status check failed (${res.status}): ${text.substring(0, 200)}`);
  }

  const json = (await res.json()) as {
    code: number;
    data: {
      id?: string;
      video_id?: string;
      status: "pending" | "processing" | "waiting" | "failed" | "completed";
      video_url?: string;
      error?: { code: string; detail: string };
    };
  };

  if (!json.data) throw new Error(`HeyGen status response missing data field for video ${heygenVideoId}`);

  // Guard: if status is completed but video_url is missing, throw a clear error rather than
  // letting fetch(undefined) produce a cryptic "Failed to parse URL from undefined" error.
  if (json.data.status === "completed" && !json.data.video_url) {
    throw new Error(`HeyGen video ${heygenVideoId} is 'completed' but video_url is missing — retry in a few minutes.`);
  }

  return json.data;
}

async function downloadAndUploadToS3(
  videoUrl: string,
  jobId: number,
  jobLabel: string
): Promise<{ s3Key: string; s3Url: string }> {
  console.log(`${jobLabel} Downloading HeyGen video from: ${videoUrl}`);
  // 30-minute timeout — HeyGen videos can be 200–900 MB; 5 min was too short for long renders
  let res: Response;
  try {
    res = await fetch(videoUrl, { signal: AbortSignal.timeout(1_800_000) });
  } catch (err: any) {
    throw new Error(`HEYGEN_DOWNLOAD_TIMEOUT: ${err?.message ?? String(err)}. The video may be very large — try again.`);
  }
  if (!res.ok) throw new Error(`HEYGEN_DOWNLOAD_FAILED: HTTP ${res.status} when downloading HeyGen video`);
  let buffer: Buffer;
  try {
    buffer = Buffer.from(await res.arrayBuffer());
  } catch (err: any) {
    throw new Error(`HEYGEN_BUFFER_TIMEOUT: ${err?.message ?? String(err)}. Video may be too large.`);
  }
  console.log(`${jobLabel} Downloaded ${(buffer.length / 1024 / 1024).toFixed(1)} MB. Uploading to S3...`);
  const s3Key = `avatar-videos/job-${jobId}-${Date.now()}.mp4`;
  const { url: s3Url } = await storagePut(s3Key, buffer, "video/mp4");
  console.log(`${jobLabel} Uploaded to S3: ${s3Url}`);
  return { s3Key, s3Url };
}

// ── Helper: fetch full job row with blog URL ──────────────────────────────────

async function fetchJobRow(jobId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const r = await db
    .select({
      id: videoJobs.id,
      contentItemId: videoJobs.contentItemId,
      scriptText: videoJobs.scriptText,
      brollPrompt: videoJobs.brollPrompt,
      descriptProjectId: videoJobs.descriptProjectId,
      descriptImportJobId: videoJobs.descriptImportJobId,
      descriptAgentJobId: videoJobs.descriptAgentJobId,
      descriptPublishJobId: videoJobs.descriptPublishJobId,
      descriptShareUrl: videoJobs.descriptShareUrl,
      descriptDownloadUrl: videoJobs.descriptDownloadUrl,
      s3VideoKey: videoJobs.s3VideoKey,
      s3VideoUrl: videoJobs.s3VideoUrl,
      youtubeVideoId: videoJobs.youtubeVideoId,
      youtubeTitle: videoJobs.youtubeTitle,
      youtubeDescription: videoJobs.youtubeDescription,
      youtubeTags: videoJobs.youtubeTags,
      youtubeThumbnailUrl: videoJobs.youtubeThumbnailUrl,
      ctaId: videoJobs.ctaId,
      ctaLabel: videoJobs.ctaLabel,
      ctaText: videoJobs.ctaText,
      ctaUrl: videoJobs.ctaUrl,
      videoType: videoJobs.videoType,
      productionPath: videoJobs.productionPath,
      outputChannels: videoJobs.outputChannels,
      heygenVideoId: videoJobs.heygenVideoId,
      status: videoJobs.status,
      errorMessage: videoJobs.errorMessage,
      retryCount: videoJobs.retryCount,
      vaApprovedAt: videoJobs.vaApprovedAt,
      publishedAt: videoJobs.publishedAt,
      createdAt: videoJobs.createdAt,
      updatedAt: videoJobs.updatedAt,
      blogUrl: contentItems.publishUrl,
    })
    .from(videoJobs)
    .leftJoin(contentItems, eq(videoJobs.contentItemId, contentItems.id))
    .where(eq(videoJobs.id, jobId))
    .limit(1);
  return r[0] ?? null;
}

// ── Main pipeline function ────────────────────────────────────────────────────

export async function processVideoJob(jobId: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");

  let job = await fetchJobRow(jobId);
  if (!job) throw new Error(`Video job ${jobId} not found`);

  const jobLabel = `[Pipeline Job #${jobId}]`;

  try {
    // ════════════════════════════════════════════════════════════════════════
    // ════════════════════════════════════════════════════════════════════════
    // Determine effective path from productionPath (falls back to videoType for legacy)
    // ════════════════════════════════════════════════════════════════════════
    const effectivePath = job.productionPath ?? (job.videoType === "avatar" ? "heygen_then_descript" : "descript_only");

    // ════════════════════════════════════════════════════════════════════════
    // HEYGEN_ONLY PIPELINE — HeyGen render → ready_for_review (no Descript)
    // ════════════════════════════════════════════════════════════════════════
    if (effectivePath === "heygen_only") {

      // Step H0: Start HeyGen render
      if (!job.heygenVideoId) {
        console.log(`${jobLabel} [HeyGen-Only] Starting HeyGen render...`);
        const heygenVideoId = await startHeyGenRender(job.scriptText);
        console.log(`${jobLabel} [HeyGen-Only] HeyGen video_id: ${heygenVideoId}`);
        await db.update(videoJobs).set({
          heygenVideoId,
          status: "rendering",
          errorMessage: null,
        }).where(eq(videoJobs.id, jobId));
        return;
      }

      // Step H1: Poll HeyGen until completed → download → S3
      if (job.status === "rendering" && job.heygenVideoId && !job.s3VideoUrl) {
        const heygenStatus = await pollHeyGenStatus(job.heygenVideoId);
        console.log(`${jobLabel} [HeyGen-Only] HeyGen status: ${heygenStatus.status}`);

        if (heygenStatus.status === "failed") {
          throw new Error(`HeyGen render failed: ${heygenStatus.error?.detail ?? "unknown error"}`);
        }
        if (heygenStatus.status !== "completed") return; // still rendering

        const { s3Key, s3Url } = await downloadAndUploadToS3(heygenStatus.video_url!, jobId, jobLabel);

        // Generate metadata (title, description, tags) without B-roll prompt
        const brollResult = await generateBrollPrompt({
          scriptTitle: job.youtubeTitle ?? "Urban Monk Video",
          scriptText: job.scriptText,
          topic: job.youtubeTitle ?? "Urban Monk Video",
          keywords: job.youtubeTags ? JSON.parse(job.youtubeTags) : [],
          blogUrl: job.blogUrl ?? undefined,
        });

        await db.update(videoJobs).set({
          s3VideoKey: s3Key,
          s3VideoUrl: s3Url,
          descriptDownloadUrl: s3Url, // use S3 URL directly as download URL
          youtubeTitle: (brollResult.youtubeTitle ?? job.youtubeTitle ?? "Urban Monk Video").substring(0, 512),
          youtubeDescription: brollResult.youtubeDescription,
          youtubeTags: JSON.stringify(brollResult.youtubeTags),
          status: "ready_for_review",
        }).where(eq(videoJobs.id, jobId));

        console.log(`${jobLabel} [HeyGen-Only] ✅ Ready for review. S3 URL: ${s3Url}`);
      }

      return;
    }

    // ════════════════════════════════════════════════════════════════════════
    // AVATAR PIPELINE (heygen_then_descript — HeyGen → Descript B-roll)
    // ════════════════════════════════════════════════════════════════════════
    if (effectivePath === "heygen_then_descript" || job.videoType === "avatar") {

      // ── Step A0: Start HeyGen render ──────────────────────────────────────
      if (!job.heygenVideoId) {
        console.log(`${jobLabel} [Avatar] Starting HeyGen render...`);
        const heygenVideoId = await startHeyGenRender(job.scriptText);
        console.log(`${jobLabel} [Avatar] HeyGen video_id: ${heygenVideoId}`);
        await db.update(videoJobs).set({
          heygenVideoId,
          status: "rendering",
          errorMessage: null,
        }).where(eq(videoJobs.id, jobId));
        job = { ...job, heygenVideoId, status: "rendering" };
        // Return here — cron will poll for HeyGen completion on next tick
        return;
      }

      // ── Step A1: Poll HeyGen until completed → download → S3 ─────────────
      // Also handles "pending" with a heygenVideoId — this covers the edge case where
      // HeyGen was called successfully but the DB update to "rendering" failed silently.
      if ((job.status === "rendering" || (job.status === "pending" && job.heygenVideoId)) && job.heygenVideoId && !job.descriptImportJobId) {
        // Ensure status is "rendering" in DB if we got here via the pending+heygenVideoId path
        if (job.status === "pending") {
          console.log(`${jobLabel} [Avatar] Recovering: job has heygenVideoId but status=pending — advancing to rendering`);
          await db.update(videoJobs).set({ status: "rendering", errorMessage: null }).where(eq(videoJobs.id, jobId));
          job = { ...job, status: "rendering" };
        }
        const heygenStatus = await pollHeyGenStatus(job.heygenVideoId!);
        console.log(`${jobLabel} [Avatar] HeyGen status: ${heygenStatus.status}`);

        if (heygenStatus.status === "failed") {
          const detail = heygenStatus.error?.detail ?? "unknown error";
          throw new Error(`HeyGen render failed: ${detail}`);
        }

        if (heygenStatus.status !== "completed") {
          // Still rendering — come back next cron tick
          return;
        }

        // HeyGen done — pass the CDN URL directly to Descript (no S3 download needed).
        // Descript's import API accepts any public URL, so we skip the expensive
        // download-to-memory step entirely. This avoids OOM on large videos.
        const heygenVideoUrl = heygenStatus.video_url!;
        console.log(`${jobLabel} [Avatar] HeyGen video ready. Skipping S3 — importing directly into Descript from CDN URL.`);

        // ── Step A2: Generate B-roll prompt + YouTube metadata ──────────────
        const brollResult = await generateBrollPrompt({
          scriptTitle: job.youtubeTitle ?? "Urban Monk Video",
          scriptText: job.scriptText,
          topic: job.youtubeTitle ?? "Urban Monk Video",
          keywords: job.youtubeTags ? JSON.parse(job.youtubeTags) : [],
          blogUrl: job.blogUrl ?? undefined,
        });

        // ── Step A3: Import avatar video into Descript directly from HeyGen CDN ──
        const projectName = (brollResult.youtubeTitle ?? job.youtubeTitle ?? "Urban Monk Video").substring(0, 100);
        console.log(`${jobLabel} [Avatar] Importing HeyGen CDN video into Descript project: ${projectName}`);
        const importResult = await importVideoFromUrl({
          projectName,
          videoUrl: heygenVideoUrl,
          compositionName: projectName,
        });

        await db.update(videoJobs).set({
          // s3VideoKey/s3VideoUrl left null — Descript imports directly from HeyGen CDN
          brollPrompt: brollResult.underlordPrompt,
          youtubeTitle: (brollResult.youtubeTitle ?? job.youtubeTitle ?? "Urban Monk Video").substring(0, 512),
          youtubeDescription: brollResult.youtubeDescription,
          youtubeTags: JSON.stringify(brollResult.youtubeTags),
          descriptImportJobId: importResult.job_id,
          descriptProjectId: importResult.project_id,
          descriptShareUrl: importResult.project_url,
          status: "importing",
        }).where(eq(videoJobs.id, jobId));

        job = await fetchJobRow(jobId) ?? job;
        // Return — cron will poll for import completion
        return;
      }

      // ── Step A4: Poll Descript import job ─────────────────────────────────
      if (job.status === "importing" && job.descriptImportJobId && !job.descriptAgentJobId) {
        const importStatus = await getJobStatus(job.descriptImportJobId);
        console.log(`${jobLabel} [Avatar] Descript import status: ${importStatus.job_state}`);

        if (importStatus.job_state === "running") return;
        if (importStatus.job_state === "cancelled" || importStatus.result?.status === "failed") {
          throw new Error(`Descript import failed: ${importStatus.result?.agent_response ?? "unknown"}`);
        }

        // Import done — run Underlord B-roll agent on the avatar video
        const ctaSuffix = job.ctaText
          ? `\n\nEND SCREEN CTA (last 5 seconds): Add a title card at the very end of the video with this exact text: "${job.ctaText}" and the URL: "${job.ctaUrl ?? 'theurbanmonk.com'}". White text on dark background, visible for 5 seconds.`
          : "";

        const brollPrompt = (job.brollPrompt ??
          "MANDATORY B-ROLL RULE: Place a new B-roll clip at EVERY 5 to 8 seconds throughout the ENTIRE video. No single shot may stay on screen longer than 8 seconds. Also: remove filler words and long pauses, add auto-captions with Studio Sound, use stock footage that matches the content being discussed.") + ctaSuffix;

        console.log(`${jobLabel} [Avatar] Running Underlord B-roll agent...`);
        const editResult = await runUnderlordAgent({
          projectId: job.descriptProjectId!,
          prompt: brollPrompt,
        });

        await db.update(videoJobs).set({
          descriptAgentJobId: editResult.job_id,
          status: "editing",
        }).where(eq(videoJobs.id, jobId));

        job = { ...job, descriptAgentJobId: editResult.job_id, status: "editing" };
      }

      // ── Step A5: Poll editing agent job ───────────────────────────────────
      if (job.status === "editing" && job.descriptAgentJobId && !job.descriptPublishJobId) {
        const agentStatus = await getJobStatus(job.descriptAgentJobId);
        console.log(`${jobLabel} [Avatar] Underlord edit status: ${agentStatus.job_state}`);

        if (agentStatus.job_state === "running") return;
        if (agentStatus.job_state === "cancelled" || agentStatus.result?.status === "failed") {
          throw new Error(`Underlord editing failed: ${agentStatus.result?.agent_response ?? "unknown"}`);
        }

        // Editing done — export
        console.log(`${jobLabel} [Avatar] Starting Descript export...`);
        const exportResult = await exportProject({ projectId: job.descriptProjectId! });
        await db.update(videoJobs).set({
          descriptPublishJobId: exportResult.job_id,
          status: "rendering",
        }).where(eq(videoJobs.id, jobId));

        job = { ...job, descriptPublishJobId: exportResult.job_id, status: "rendering" };
      }

      // ── Step A6: Poll export job → ready_for_review ───────────────────────
      if (job.status === "rendering" && job.descriptPublishJobId) {
        const exportStatus = await getJobStatus(job.descriptPublishJobId);
        console.log(`${jobLabel} [Avatar] Export status: ${exportStatus.job_state}`);

        if (exportStatus.job_state === "running") return;
        if (exportStatus.job_state === "cancelled" || exportStatus.result?.status === "failed") {
          throw new Error(`Export failed: ${exportStatus.result?.agent_response ?? "unknown"}`);
        }

        const shareUrl = exportStatus.result?.share_url ?? job.descriptShareUrl ?? "";
        const downloadUrl = exportStatus.result?.download_url ?? "";

        await db.update(videoJobs).set({
          s3VideoUrl: shareUrl,
          descriptDownloadUrl: downloadUrl,
          descriptShareUrl: shareUrl,
          status: "ready_for_review",
        }).where(eq(videoJobs.id, jobId));

        console.log(`${jobLabel} [Avatar] ✅ Ready for review. Descript share URL: ${shareUrl}`);
      }

      return; // Avatar pipeline done for this cron tick
    }

    // ════════════════════════════════════════════════════════════════════════
    // STANDARD PIPELINE (videoType = 'standard' or null — AI voice + B-roll)
    // ════════════════════════════════════════════════════════════════════════

    // ── Step 1: Generate B-roll prompt + seed YouTube metadata ───────────────
    if (!job.brollPrompt) {
      const brollResult = await generateBrollPrompt({
        scriptTitle: job.youtubeTitle ?? "Urban Monk Video",
        scriptText: job.scriptText,
        topic: job.youtubeTitle ?? "Urban Monk Video",
        keywords: job.youtubeTags ? JSON.parse(job.youtubeTags) : [],
        blogUrl: job.blogUrl ?? undefined,
      });

      await db.update(videoJobs).set({
        brollPrompt: brollResult.underlordPrompt,
        youtubeTitle: (brollResult.youtubeTitle ?? job.youtubeTitle ?? "Urban Monk Video").substring(0, 512),
        youtubeDescription: brollResult.youtubeDescription,
        youtubeTags: JSON.stringify(brollResult.youtubeTags),
        status: "importing",
      }).where(eq(videoJobs.id, jobId));

      job = await fetchJobRow(jobId) ?? job;
    }

    // ── Step 2: Create Descript project via agent (Pedram AI voice) ──────────
    if (!job.descriptImportJobId) {
      const projectName = (job.youtubeTitle ?? "Urban Monk Video").substring(0, 100);
      const agentResult = await createProjectWithVoice({
        projectName,
        scriptText: job.scriptText,
        voiceName: "Pedram FOR GUT COURSE READ",
        ctaText: job.ctaText ?? undefined,
        ctaUrl: job.ctaUrl ?? undefined,
      });

      await db.update(videoJobs).set({
        descriptImportJobId: agentResult.job_id,
        descriptProjectId: agentResult.project_id,
        descriptShareUrl: agentResult.project_url,
        status: "importing",
      }).where(eq(videoJobs.id, jobId));

      job = {
        ...job,
        descriptImportJobId: agentResult.job_id,
        descriptProjectId: agentResult.project_id,
        descriptShareUrl: agentResult.project_url,
        status: "importing",
      };
    }

    // ── Step 3: Poll creation agent job ──────────────────────────────────────
    if (job.status === "importing" && job.descriptImportJobId && !job.descriptAgentJobId) {
      const jobStatus = await getJobStatus(job.descriptImportJobId);

      if (jobStatus.job_state === "running") return;
      if (jobStatus.job_state === "cancelled" || (jobStatus.result && jobStatus.result.status === "failed")) {
        throw new Error(`Descript project creation failed: ${jobStatus.result?.agent_response ?? "unknown"}`);
      }

      const ctaSuffix = job.ctaText
        ? `\n\nEND SCREEN CTA (last 5 seconds): Add a title card at the very end of the video with this exact text: "${job.ctaText}" and the URL: "${job.ctaUrl ?? 'theurbanmonk.com'}". The card should be white text on a dark background and stay visible for 5 seconds.`
        : "";

      const brollPrompt = (job.brollPrompt ??
        "MANDATORY B-ROLL RULE: Place a new B-roll clip at EVERY 5 to 8 seconds — non-negotiable. No single shot may stay on screen longer than 8 seconds. Cut to a new clip immediately at the 8-second mark throughout the ENTIRE video from start to finish with zero gaps. Also: remove filler words and long pauses, add auto-captions, use stock footage that matches the content being discussed.") + ctaSuffix;

      const editResult = await runUnderlordAgent({
        projectId: job.descriptProjectId!,
        prompt: brollPrompt,
      });

      await db.update(videoJobs).set({
        descriptAgentJobId: editResult.job_id,
        status: "editing",
      }).where(eq(videoJobs.id, jobId));

      job = { ...job, descriptAgentJobId: editResult.job_id, status: "editing" };
    }

    // ── Step 4: Poll editing agent job ───────────────────────────────────────
    if (job.status === "editing" && job.descriptAgentJobId && !job.descriptPublishJobId) {
      const agentStatus = await getJobStatus(job.descriptAgentJobId);

      if (agentStatus.job_state === "running") return;
      if (agentStatus.job_state === "cancelled" || (agentStatus.result && agentStatus.result.status === "failed")) {
        throw new Error(`Underlord editing failed: ${agentStatus.result?.agent_response ?? "unknown"}`);
      }

      const exportResult = await exportProject({ projectId: job.descriptProjectId! });

      await db.update(videoJobs).set({
        descriptPublishJobId: exportResult.job_id,
        status: "rendering",
      }).where(eq(videoJobs.id, jobId));

      job = { ...job, descriptPublishJobId: exportResult.job_id, status: "rendering" };
    }

    // ── Step 5: Poll export job — store share URL, mark ready_for_review ─────
    if (job.status === "rendering" && job.descriptPublishJobId) {
      const exportStatus = await getJobStatus(job.descriptPublishJobId);

      if (exportStatus.job_state === "running") return;
      if (exportStatus.job_state === "cancelled" || (exportStatus.result && exportStatus.result.status === "failed")) {
        throw new Error(`Export failed: ${exportStatus.result?.agent_response ?? "unknown"}`);
      }

      const shareUrl = exportStatus.result?.share_url ?? job.descriptShareUrl ?? "";
      const downloadUrl = exportStatus.result?.download_url ?? "";

      await db.update(videoJobs).set({
        s3VideoUrl: shareUrl,
        descriptDownloadUrl: downloadUrl,
        descriptShareUrl: shareUrl,
        status: "ready_for_review",
      }).where(eq(videoJobs.id, jobId));
    }

  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await db.update(videoJobs).set({ status: "failed", errorMessage: message }).where(eq(videoJobs.id, jobId));
    throw err;
  }
}

export async function processScheduledVideoJobs(): Promise<{ processed: number; errors: string[] }> {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");

  // ── Crash recovery: reset orphaned jobs ───────────────────────────────────
  const stuckJobs = await db
    .select({ id: videoJobs.id, status: videoJobs.status, descriptProjectId: videoJobs.descriptProjectId, descriptImportJobId: videoJobs.descriptImportJobId })
    .from(videoJobs)
    .where(
      or(
        eq(videoJobs.status, "importing"),
        eq(videoJobs.status, "editing"),
        eq(videoJobs.status, "rendering")
      )
    );

  for (const stuckJob of stuckJobs) {
    if (stuckJob.descriptImportJobId && !stuckJob.descriptProjectId) {
      console.log(`[descriptPipeline] Crash recovery: resetting orphaned job #${stuckJob.id} → pending`);
      await db.update(videoJobs).set({
        status: "pending",
        descriptProjectId: null,
        descriptImportJobId: null,
        descriptAgentJobId: null,
        descriptPublishJobId: null,
        descriptShareUrl: null,
        descriptDownloadUrl: null,
        s3VideoUrl: null,
        errorMessage: null,
      }).where(eq(videoJobs.id, stuckJob.id));
    }
  }

  const pendingJobs = await db
    .select({ id: videoJobs.id })
    .from(videoJobs)
    .where(
      or(
        eq(videoJobs.status, "pending"),
        eq(videoJobs.status, "rendering"),
        eq(videoJobs.status, "importing"),
        eq(videoJobs.status, "editing"),
      )
    );

  let processed = 0;
  const errors: string[] = [];

  for (const { id } of pendingJobs) {
    try {
      await processVideoJob(id);
      processed++;
    } catch (err) {
      errors.push(`Job ${id}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return { processed, errors };
}
