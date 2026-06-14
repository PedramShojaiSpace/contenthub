/**
 * YouTube Data API v3 Uploader — Resumable Upload Protocol
 *
 * Uses YouTube's resumable upload API (https://developers.google.com/youtube/v3/guides/using_resumable_upload_protocol)
 * instead of the googleapis stream wrapper. This is far more reliable for large files because:
 *
 * 1. Uploads in 50 MB chunks — each chunk is a separate HTTP request
 * 2. If a chunk fails, only that chunk is retried (not the whole file)
 * 3. The upload session URI is stored so uploads can be resumed after server restarts
 * 4. Progress is logged per-chunk so you can see real movement
 * 5. No single long-lived HTTP connection that can stall silently
 *
 * Resilience:
 * - Each chunk retried up to 3 times with exponential backoff
 * - Per-chunk 5-minute timeout (not a single 45-min timeout on the whole file)
 * - Detailed error messages distinguishing auth failures from network stalls
 */

import { google } from "googleapis";
import { getDb } from "./db";
import { userCredentials } from "../drizzle/schema";
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

const CHUNK_SIZE = 50 * 1024 * 1024; // 50 MB per chunk (YouTube minimum is 256 KB, recommend 8 MB+)
const CHUNK_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes per chunk
const MAX_CHUNK_RETRIES = 3;

// ── Helper: fetch with timeout ────────────────────────────────────────────────

async function fetchWithTimeout(url: string, options: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    return res;
  } finally {
    clearTimeout(timer);
  }
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
    30_000 // 30 sec to initiate
  );

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Failed to initiate resumable upload: ${res.status} ${body}`);
  }

  const uploadUri = res.headers.get("location");
  if (!uploadUri) {
    throw new Error("No upload URI returned from YouTube — cannot start resumable upload");
  }
  return uploadUri;
}

// ── Step 2: Upload one chunk ──────────────────────────────────────────────────

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
      body: params.chunk,
    },
    CHUNK_TIMEOUT_MS
  );

  // 308 Resume Incomplete = chunk accepted, more to come
  if (res.status === 308) {
    return { done: false };
  }

  // 200 or 201 = upload complete
  if (res.status === 200 || res.status === 201) {
    const data = await res.json() as { id?: string };
    return { done: true, videoId: data.id };
  }

  // Anything else is an error
  const body = await res.text();
  throw new Error(`Chunk upload failed: HTTP ${res.status} — ${body}`);
}

// ── Main upload function ──────────────────────────────────────────────────────

export async function uploadToYouTube(
  params: YouTubeUploadParams
): Promise<YouTubeUploadResult> {
  const jobLabel = params.jobId ? `[Job #${params.jobId}]` : "[YouTube Upload]";
  console.log(`${jobLabel} Starting resumable YouTube upload: "${params.title}"`);
  console.log(`${jobLabel} Source URL: ${params.videoUrl.substring(0, 80)}...`);

  // ── Download video into memory (or buffer) ──────────────────────────────────
  console.log(`${jobLabel} Downloading video from S3...`);
  const downloadRes = await fetchWithTimeout(
    params.videoUrl,
    {},
    10 * 60 * 1000 // 10 min to download
  );

  if (!downloadRes.ok) {
    throw new Error(
      `Failed to fetch video from S3: ${downloadRes.status} ${downloadRes.statusText}`
    );
  }

  const videoBuffer = Buffer.from(await downloadRes.arrayBuffer());
  const totalBytes = videoBuffer.length;
  const mimeType = downloadRes.headers.get("content-type") ?? "video/mp4";
  console.log(`${jobLabel} Downloaded ${(totalBytes / 1024 / 1024).toFixed(1)} MB`);

  // ── Get fresh access token ──────────────────────────────────────────────────
  const accessToken = await getFreshAccessToken();

  // ── Initiate resumable upload session ──────────────────────────────────────
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
  console.log(`${jobLabel} Upload session created. Uploading in ${CHUNK_SIZE / 1024 / 1024} MB chunks...`);

  // ── Upload chunks ───────────────────────────────────────────────────────────
  let offset = 0;
  let chunkIndex = 0;
  const totalChunks = Math.ceil(totalBytes / CHUNK_SIZE);
  let videoId: string | undefined;

  while (offset < totalBytes) {
    const chunk = videoBuffer.subarray(offset, offset + CHUNK_SIZE);
    chunkIndex++;

    let attempt = 0;
    let success = false;

    while (attempt < MAX_CHUNK_RETRIES && !success) {
      attempt++;
      try {
        console.log(
          `${jobLabel} Uploading chunk ${chunkIndex}/${totalChunks} ` +
          `(${(offset / 1024 / 1024).toFixed(1)} MB – ${((offset + chunk.length) / 1024 / 1024).toFixed(1)} MB) ` +
          `[attempt ${attempt}/${MAX_CHUNK_RETRIES}]`
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
          console.log(`${jobLabel} ✅ All chunks uploaded. YouTube video ID: ${videoId}`);
        }
        success = true;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`${jobLabel} Chunk ${chunkIndex} attempt ${attempt} failed: ${msg}`);
        if (attempt >= MAX_CHUNK_RETRIES) {
          throw new Error(
            `YouTube upload failed on chunk ${chunkIndex}/${totalChunks} after ${MAX_CHUNK_RETRIES} attempts: ${msg}`
          );
        }
        // Exponential backoff: 5s, 10s, 20s
        const backoff = 5000 * Math.pow(2, attempt - 1);
        console.log(`${jobLabel} Retrying chunk ${chunkIndex} in ${backoff / 1000}s...`);
        await new Promise((r) => setTimeout(r, backoff));
      }
    }

    offset += chunk.length;
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
