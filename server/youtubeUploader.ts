/**
 * YouTube Data API v3 Uploader — Streaming Resumable Upload
 *
 * Uses YouTube's resumable upload protocol with STREAMING chunks:
 *
 *   1. HEAD the source URL to get Content-Length (no download yet)
 *   2. Initiate a YouTube resumable upload session → get upload URI
 *   3. For each 50 MB chunk:
 *        a. Fetch ONLY that byte range from GCS (Range: bytes=X-Y)
 *        b. PUT that chunk to YouTube
 *        c. Discard the buffer — memory stays flat (~50 MB peak, not 1 GB)
 *
 * Why this matters:
 *   - A typical 20-min 1080p video is 500 MB – 1.5 GB
 *   - Loading the whole file with arrayBuffer() crashes a 4 GB server
 *   - Range requests keep peak memory under ~100 MB regardless of file size
 *
 * Resilience:
 *   - Each chunk retried up to 5 times with exponential backoff
 *   - Per-chunk 8-minute timeout
 *   - Explicit guard: rejects share.descript.com URLs (viewer pages, not MP4s)
 *   - Logs progress per-chunk so you can see real movement in server logs
 */

import { google } from "googleapis";
import { getDb } from "./db";
import { userCredentials } from "../drizzle/schema";

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
  if (process.env.YOUTUBE_REFRESH_TOKEN) {
    return process.env.YOUTUBE_REFRESH_TOKEN;
  }
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const rows = await db
    .select({ youtubeRefreshToken: userCredentials.youtubeRefreshToken })
    .from(userCredentials)
    .limit(1);
  const token = rows[0]?.youtubeRefreshToken;
  if (!token) {
    throw new Error(
      "YouTube refresh token not found. Please authorize YouTube via /api/youtube/auth-url first."
    );
  }
  return token;
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

// ── Main upload function ──────────────────────────────────────────────────────

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

  // ── Step 3: Stream chunks: fetch range → upload → discard ──────────────────
  let offset = 0;
  let chunkIndex = 0;
  let videoId: string | undefined;

  while (offset < totalBytes) {
    const chunkEnd = Math.min(offset + CHUNK_SIZE - 1, totalBytes - 1);
    chunkIndex++;

    let attempt = 0;
    let success = false;

    while (attempt < MAX_CHUNK_RETRIES && !success) {
      attempt++;
      try {
        console.log(
          `${jobLabel} Chunk ${chunkIndex}/${totalChunks}: ` +
            `fetching bytes ${offset}–${chunkEnd} from source [attempt ${attempt}]`
        );

        const chunk = await fetchByteRange(params.videoUrl, offset, chunkEnd);

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
          const pct = (((chunkEnd + 1) / totalBytes) * 100).toFixed(0);
          console.log(
            `${jobLabel} Chunk ${chunkIndex}/${totalChunks} accepted (${pct}% complete)`
          );
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

  return {
    videoId,
    videoUrl: `https://www.youtube.com/watch?v=${videoId}`,
    title: params.title,
  };
}
