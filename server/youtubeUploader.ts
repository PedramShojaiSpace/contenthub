/**
 * YouTube Data API v3 Uploader — Resumable Upload with Restart Recovery
 *
 * Upload strategy:
 *   1. HEAD the source URL to get Content-Length (no download yet)
 *   2. Initiate a YouTube resumable upload session → get upload URI
 *   3. PERSIST the upload URI and current offset to the DB immediately
 *   4. For each 50 MB chunk:
 *        a. Fetch ONLY that byte range from GCS (Range: bytes=X-Y)
 *        b. PUT that chunk to YouTube
 *        c. Persist the new offset to DB
 *        d. Discard the buffer — memory stays flat (~50 MB peak)
 *
 * Restart Recovery:
 *   - If the server restarts mid-upload, the watchdog finds the job in 'uploading'
 *   - The watchdog calls resumeUpload() which checks the persisted URI
 *   - YouTube's "query upload status" endpoint returns the last confirmed byte offset
 *   - Upload resumes from that offset — no re-downloading already-sent chunks
 *   - YouTube resumable URIs are valid for 7 days
 *
 * Why this matters:
 *   - A 20-min 1080p video is 500 MB – 1.5 GB and takes 15–30 min to upload
 *   - Any server restart during that window previously killed the upload permanently
 *   - Now the upload survives server restarts and resumes automatically
 */

import { google } from "googleapis";
import { getDb } from "./db";
import { userCredentials, videoJobs } from "../drizzle/schema";
import { eq } from "drizzle-orm";

// ── OAuth client ──────────────────────────────────────────────────────────────

function getYouTubeOAuthClient() {
  const clientId = process.env.GMAIL_CLIENT_ID;
  const clientSecret = process.env.GMAIL_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("GMAIL_CLIENT_ID and GMAIL_CLIENT_SECRET must be set");
  }
  const redirectUri =
    process.env.YOUTUBE_REDIRECT_URI ??
    "https://content.theurbanmonk.com/api/youtube/callback";
  return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
}

// ── Get stored refresh token ──────────────────────────────────────────────────

async function getYouTubeRefreshToken(): Promise<string> {
  // Always read from DB first — the env var is a startup cache and goes stale
  // after the user reconnects YouTube via the OAuth popup.
  const db = await getDb();
  if (db) {
    const rows = await db
      .select({ youtubeRefreshToken: userCredentials.youtubeRefreshToken })
      .from(userCredentials)
      .limit(1);
    const token = rows[0]?.youtubeRefreshToken;
    if (token) {
      console.log("[YouTube] Using refresh token from database.");
      return token;
    }
  }
  // Fall back to env var (e.g. local dev without DB)
  if (process.env.YOUTUBE_REFRESH_TOKEN) {
    console.log("[YouTube] Using refresh token from environment variable.");
    return process.env.YOUTUBE_REFRESH_TOKEN;
  }
  throw new Error(
    "YouTube refresh token not found. Please authorize YouTube via /api/youtube/auth-url first."
  );
}

// ── Get fresh access token ────────────────────────────────────────────────────

async function getFreshAccessToken(): Promise<string> {
  const refreshToken = await getYouTubeRefreshToken();
  const oauth2Client = getYouTubeOAuthClient();
  oauth2Client.setCredentials({ refresh_token: refreshToken });
  const { credentials } = await oauth2Client.refreshAccessToken();
  if (!credentials.access_token) {
    throw new Error("Failed to obtain YouTube access token");
  }
  return credentials.access_token;
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface YouTubeUploadParams {
  videoUrl: string;
  title: string;
  description: string;
  tags?: string[];
  categoryId?: string;
  privacyStatus?: "public" | "private" | "unlisted";
  jobId?: number;
}

export interface YouTubeUploadResult {
  videoId: string;
  videoUrl: string;
  title: string;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const CHUNK_SIZE = 50 * 1024 * 1024; // 50 MB per chunk
const CHUNK_TIMEOUT_MS = 8 * 60 * 1000; // 8 minutes per chunk
const MAX_CHUNK_RETRIES = 5;

// ── Helper: fetch with timeout ────────────────────────────────────────────────

async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs: number
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

// ── Step 0: HEAD the source to get file size ──────────────────────────────────

async function getRemoteFileSize(
  url: string
): Promise<{ size: number; mimeType: string }> {
  const res = await fetchWithTimeout(url, { method: "HEAD" }, 30_000);
  if (!res.ok) {
    throw new Error(
      `HEAD request to source URL failed: ${res.status} ${res.statusText}`
    );
  }
  const sizeStr = res.headers.get("content-length");
  if (!sizeStr) {
    throw new Error(
      "Source URL did not return Content-Length. Cannot use streaming upload. " +
        "This URL may be a redirect or a viewer page rather than a direct file URL."
    );
  }
  const size = parseInt(sizeStr, 10);
  const rawMime = res.headers.get("content-type") ?? "video/mp4";
  const mimeType = rawMime.split(";")[0].trim();
  return { size, mimeType };
}

// ── Step 1: Initiate resumable upload session ─────────────────────────────────

async function initiateResumableUpload(params: {
  accessToken: string;
  title: string;
  description: string;
  tags: string[];
  categoryId: string;
  privacyStatus: string;
  contentLength: number;
  mimeType: string;
}): Promise<string> {
  const metadata = {
    snippet: {
      title: params.title.substring(0, 100),
      description: params.description,
      tags: params.tags,
      categoryId: params.categoryId,
      defaultLanguage: "en",
      defaultAudioLanguage: "en",
    },
    status: {
      privacyStatus: params.privacyStatus,
      selfDeclaredMadeForKids: false,
    },
  };

  const res = await fetchWithTimeout(
    "https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${params.accessToken}`,
        "Content-Type": "application/json; charset=UTF-8",
        "X-Upload-Content-Type": params.mimeType,
        "X-Upload-Content-Length": String(params.contentLength),
      },
      body: JSON.stringify(metadata),
    },
    30_000
  );

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Failed to initiate resumable upload: ${res.status} ${body}`);
  }

  const uploadUri = res.headers.get("location");
  if (!uploadUri) {
    throw new Error(
      "No upload URI returned from YouTube — cannot start resumable upload"
    );
  }
  return uploadUri;
}

// ── Query upload status to find resume offset ─────────────────────────────────
// Returns the number of bytes YouTube has confirmed receiving, or 0 if none yet.
// Returns -1 if the upload is already complete (shouldn't happen on resume, but handle it).

async function queryUploadStatus(
  uploadUri: string,
  totalSize: number
): Promise<{ resumeOffset: number; videoId?: string }> {
  const res = await fetchWithTimeout(
    uploadUri,
    {
      method: "PUT",
      headers: {
        "Content-Length": "0",
        "Content-Range": `bytes */${totalSize}`,
      },
    },
    30_000
  );

  // 308 Resume Incomplete — normal response, Range header tells us the offset
  if (res.status === 308) {
    const rangeHeader = res.headers.get("range");
    if (!rangeHeader) {
      // No Range header = YouTube has received 0 bytes
      return { resumeOffset: 0 };
    }
    // Range: bytes=0-{lastByte}
    const match = rangeHeader.match(/bytes=0-(\d+)/);
    const lastByte = match ? parseInt(match[1], 10) : 0;
    return { resumeOffset: lastByte + 1 };
  }

  // 200/201 = upload already complete
  if (res.status === 200 || res.status === 201) {
    const data = (await res.json()) as { id?: string };
    return { resumeOffset: totalSize, videoId: data.id };
  }

  // 404 = upload URI expired (after 7 days) — need to start fresh
  if (res.status === 404) {
    throw new Error("YouTube upload URI has expired (404). A new upload session must be initiated.");
  }

  const body = await res.text();
  throw new Error(`Unexpected status querying upload: ${res.status} — ${body}`);
}

// ── Step 2: Fetch one byte range from source ──────────────────────────────────

async function fetchByteRange(
  url: string,
  start: number,
  end: number
): Promise<Buffer> {
  const res = await fetchWithTimeout(
    url,
    { headers: { Range: `bytes=${start}-${end}` } },
    CHUNK_TIMEOUT_MS
  );

  // 206 Partial Content is expected; 200 is acceptable if server ignores Range
  if (res.status !== 206 && res.status !== 200) {
    throw new Error(
      `Range request for bytes ${start}-${end} failed: ${res.status} ${res.statusText}`
    );
  }

  return Buffer.from(await res.arrayBuffer());
}

// ── Step 3: Upload one chunk to YouTube ──────────────────────────────────────

async function uploadChunk(params: {
  uploadUri: string;
  chunk: Buffer;
  start: number;
  totalSize: number;
  mimeType: string;
}): Promise<{ done: boolean; videoId?: string }> {
  const end = params.start + params.chunk.length - 1;
  const contentRange = `bytes ${params.start}-${end}/${params.totalSize}`;

  const res = await fetchWithTimeout(
    params.uploadUri,
    {
      method: "PUT",
      headers: {
        "Content-Length": String(params.chunk.length),
        "Content-Range": contentRange,
        "Content-Type": params.mimeType,
      },
      body: new Uint8Array(params.chunk),
    },
    CHUNK_TIMEOUT_MS
  );

  if (res.status === 308) return { done: false };

  if (res.status === 200 || res.status === 201) {
    const data = (await res.json()) as { id?: string };
    return { done: true, videoId: data.id };
  }

  const body = await res.text();
  throw new Error(`Chunk upload failed: HTTP ${res.status} — ${body}`);
}

// ── Persist upload progress to DB ─────────────────────────────────────────────

async function persistUploadProgress(jobId: number, uploadUri: string, offset: number) {
  try {
    const db = await getDb();
    if (!db) return;
    await db.update(videoJobs).set({
      ytUploadUri: uploadUri,
      ytUploadOffset: offset,
    }).where(eq(videoJobs.id, jobId));
  } catch (err) {
    // Non-fatal — just log it, don't interrupt the upload
    console.warn(`[Job #${jobId}] Failed to persist upload progress: ${err}`);
  }
}

// ── Core upload loop (shared by fresh upload and resume) ──────────────────────

async function runUploadLoop(params: {
  jobId: number;
  uploadUri: string;
  videoUrl: string;
  totalBytes: number;
  mimeType: string;
  startOffset: number;
  jobLabel: string;
}): Promise<string> {
  const { jobId, uploadUri, videoUrl, totalBytes, mimeType, startOffset, jobLabel } = params;
  const totalChunks = Math.ceil(totalBytes / CHUNK_SIZE);

  let offset = startOffset;
  let videoId: string | undefined;

  while (offset < totalBytes) {
    const chunkEnd = Math.min(offset + CHUNK_SIZE - 1, totalBytes - 1);
    const chunkIndex = Math.floor(offset / CHUNK_SIZE) + 1;

    let attempt = 0;
    let success = false;

    while (attempt < MAX_CHUNK_RETRIES && !success) {
      attempt++;
      try {
        console.log(
          `${jobLabel} Chunk ${chunkIndex}/${totalChunks}: ` +
            `fetching bytes ${offset}–${chunkEnd} from source [attempt ${attempt}]`
        );

        const chunk = await fetchByteRange(videoUrl, offset, chunkEnd);

        console.log(
          `${jobLabel} Chunk ${chunkIndex}/${totalChunks}: ` +
            `uploading ${(chunk.length / 1024 / 1024).toFixed(1)} MB to YouTube...`
        );

        const result = await uploadChunk({
          uploadUri,
          chunk,
          start: offset,
          totalSize: totalBytes,
          mimeType,
        });

        if (result.done) {
          videoId = result.videoId;
          console.log(
            `${jobLabel} ✅ All chunks uploaded. YouTube video ID: ${videoId}`
          );
        } else {
          const newOffset = chunkEnd + 1;
          const pct = ((newOffset / totalBytes) * 100).toFixed(0);
          console.log(
            `${jobLabel} Chunk ${chunkIndex}/${totalChunks} accepted (${pct}% complete)`
          );
          // Persist progress after each successful chunk
          await persistUploadProgress(jobId, uploadUri, newOffset);
        }

        success = true;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(
          `${jobLabel} Chunk ${chunkIndex} attempt ${attempt} failed: ${msg}`
        );
        if (attempt >= MAX_CHUNK_RETRIES) {
          throw new Error(
            `YouTube upload failed on chunk ${chunkIndex}/${totalChunks} after ${MAX_CHUNK_RETRIES} attempts: ${msg}`
          );
        }
        const backoff = 5000 * Math.pow(2, attempt - 1);
        console.log(
          `${jobLabel} Retrying chunk ${chunkIndex} in ${backoff / 1000}s...`
        );
        await new Promise((r) => setTimeout(r, backoff));
      }
    }

    offset = chunkEnd + 1;
  }

  if (!videoId) {
    throw new Error("Upload completed but no video ID was returned by YouTube");
  }

  // Clear the upload URI from DB now that upload is complete
  try {
    const db = await getDb();
    if (db) {
      await db.update(videoJobs).set({ ytUploadUri: null, ytUploadOffset: null }).where(eq(videoJobs.id, jobId));
    }
  } catch (_) { /* non-fatal */ }

  return videoId;
}

// ── Main upload function (fresh start) ───────────────────────────────────────

export async function uploadToYouTube(
  params: YouTubeUploadParams
): Promise<YouTubeUploadResult> {
  const jobLabel = params.jobId ? `[Job #${params.jobId}]` : "[YouTube Upload]";
  console.log(`${jobLabel} Starting streaming YouTube upload: "${params.title}"`);
  console.log(`${jobLabel} Source URL: ${params.videoUrl.substring(0, 80)}...`);

  // Guard: never try to upload a Descript viewer page
  if (params.videoUrl.includes("share.descript.com")) {
    throw new Error(
      "videoUrl points to a Descript share viewer page, not a downloadable MP4. " +
        "Use descriptDownloadUrl (the signed GCS URL) instead."
    );
  }

  // ── Step 0: Get file size via HEAD (no download) ────────────────────────────
  console.log(`${jobLabel} Checking source file size via HEAD...`);
  const { size: totalBytes, mimeType } = await getRemoteFileSize(params.videoUrl);
  console.log(
    `${jobLabel} Source: ${(totalBytes / 1024 / 1024).toFixed(1)} MB, type: ${mimeType}`
  );

  // ── Step 1: Get fresh access token ─────────────────────────────────────────
  const accessToken = await getFreshAccessToken();
  console.log(`${jobLabel} YouTube OAuth token obtained.`);

  // ── Step 2: Initiate resumable upload session ───────────────────────────────
  console.log(`${jobLabel} Initiating resumable upload session with YouTube...`);
  const uploadUri = await initiateResumableUpload({
    accessToken,
    title: params.title,
    description: params.description,
    tags: params.tags ?? [],
    categoryId: params.categoryId ?? "26",
    privacyStatus: params.privacyStatus ?? "unlisted",
    contentLength: totalBytes,
    mimeType,
  });

  const totalChunks = Math.ceil(totalBytes / CHUNK_SIZE);
  console.log(
    `${jobLabel} Upload session created. ` +
      `${totalChunks} chunks × ${CHUNK_SIZE / 1024 / 1024} MB each (streaming — no full file in memory)`
  );

  // ── Step 3: Persist the upload URI immediately so we can resume on restart ──
  if (params.jobId) {
    await persistUploadProgress(params.jobId, uploadUri, 0);
    console.log(`${jobLabel} Upload URI persisted to DB for restart recovery.`);
  }

  // ── Step 4: Stream chunks ──────────────────────────────────────────────────
  const videoId = await runUploadLoop({
    jobId: params.jobId ?? 0,
    uploadUri,
    videoUrl: params.videoUrl,
    totalBytes,
    mimeType,
    startOffset: 0,
    jobLabel,
  });

  return {
    videoId,
    videoUrl: `https://www.youtube.com/watch?v=${videoId}`,
    title: params.title,
  };
}

// ── Resume upload after server restart ───────────────────────────────────────
// Called by the watchdog when it finds a job stuck in 'uploading' with a persisted ytUploadUri.

export async function resumeYouTubeUpload(params: {
  jobId: number;
  uploadUri: string;
  videoUrl: string;
  title: string;
}): Promise<YouTubeUploadResult> {
  const jobLabel = `[Resume Job #${params.jobId}]`;
  console.log(`${jobLabel} Attempting to resume interrupted upload: "${params.title}"`);

  // Guard: never try to upload a Descript viewer page
  if (params.videoUrl.includes("share.descript.com")) {
    throw new Error("videoUrl points to a Descript share viewer page, not a downloadable MP4.");
  }

  // Get current file size
  console.log(`${jobLabel} Checking source file size...`);
  const { size: totalBytes, mimeType } = await getRemoteFileSize(params.videoUrl);
  console.log(`${jobLabel} Source: ${(totalBytes / 1024 / 1024).toFixed(1)} MB`);

  // Query YouTube to find out how many bytes it already has
  console.log(`${jobLabel} Querying YouTube upload status to find resume offset...`);
  let resumeOffset: number;
  let existingVideoId: string | undefined;

  try {
    const status = await queryUploadStatus(params.uploadUri, totalBytes);
    resumeOffset = status.resumeOffset;
    existingVideoId = status.videoId;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("expired") || msg.includes("404")) {
      // URI expired — throw so the caller can start fresh
      throw new Error(`UPLOAD_URI_EXPIRED: ${msg}`);
    }
    throw err;
  }

  // If already complete
  if (existingVideoId) {
    console.log(`${jobLabel} Upload was already complete! Video ID: ${existingVideoId}`);
    return {
      videoId: existingVideoId,
      videoUrl: `https://www.youtube.com/watch?v=${existingVideoId}`,
      title: params.title,
    };
  }

  const pct = ((resumeOffset / totalBytes) * 100).toFixed(0);
  console.log(`${jobLabel} Resuming from byte ${resumeOffset} (${pct}% already uploaded)`);

  // Resume from where YouTube left off
  const videoId = await runUploadLoop({
    jobId: params.jobId,
    uploadUri: params.uploadUri,
    videoUrl: params.videoUrl,
    totalBytes,
    mimeType,
    startOffset: resumeOffset,
    jobLabel,
  });

  return {
    videoId,
    videoUrl: `https://www.youtube.com/watch?v=${videoId}`,
    title: params.title,
  };
}
