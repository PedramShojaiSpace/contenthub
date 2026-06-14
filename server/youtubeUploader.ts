/**
 * YouTube Data API v3 Uploader
 *
 * Uploads a video from an S3 URL to YouTube using the owner's stored OAuth refresh token.
 * Reuses the existing youtubeOAuth.ts pattern (Gmail OAuth client = YouTube OAuth client).
 *
 * Resilience improvements:
 * - 45-minute hard timeout on the upload (AbortController)
 * - Progress logging every 30 seconds so you can see it's moving
 * - Detailed error messages distinguishing auth failures from network stalls
 */

import { google } from "googleapis";
import { Readable, PassThrough } from "stream";
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
  // First try env var (set during OAuth flow)
  if (process.env.YOUTUBE_REFRESH_TOKEN) {
    return process.env.YOUTUBE_REFRESH_TOKEN;
  }

  // Fall back to DB (user_credentials table, owner row)
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

// ── Upload function ───────────────────────────────────────────────────────────

export interface YouTubeUploadParams {
  videoUrl: string;       // S3 URL or any direct video URL
  title: string;
  description: string;
  tags?: string[];
  categoryId?: string;    // Default: 26 (Howto & Style)
  privacyStatus?: "public" | "private" | "unlisted";
  jobId?: number;         // For progress logging
}

export interface YouTubeUploadResult {
  videoId: string;
  videoUrl: string;
  title: string;
}

const UPLOAD_TIMEOUT_MS = 45 * 60 * 1000; // 45 minutes hard limit
const PROGRESS_LOG_INTERVAL_MS = 30 * 1000; // log every 30 seconds

export async function uploadToYouTube(
  params: YouTubeUploadParams
): Promise<YouTubeUploadResult> {
  const jobLabel = params.jobId ? `[Job #${params.jobId}]` : "[YouTube Upload]";
  console.log(`${jobLabel} Starting YouTube upload: "${params.title}"`);
  console.log(`${jobLabel} Source URL: ${params.videoUrl.substring(0, 80)}...`);

  const refreshToken = await getYouTubeRefreshToken();
  const oauth2Client = getYouTubeOAuthClient();
  oauth2Client.setCredentials({ refresh_token: refreshToken });

  // ── Step 1: Download video from S3 ──────────────────────────────────────────
  console.log(`${jobLabel} Fetching video from S3...`);
  const downloadAbort = new AbortController();
  const downloadTimer = setTimeout(() => {
    downloadAbort.abort();
  }, 10 * 60 * 1000); // 10 min to download

  let videoResponse: Response;
  try {
    videoResponse = await fetch(params.videoUrl, { signal: downloadAbort.signal });
  } catch (err) {
    clearTimeout(downloadTimer);
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`Failed to fetch video from S3 (timeout or network error): ${msg}`);
  }
  clearTimeout(downloadTimer);

  if (!videoResponse.ok) {
    throw new Error(
      `Failed to fetch video from S3: ${videoResponse.status} ${videoResponse.statusText}`
    );
  }

  const contentLength = videoResponse.headers.get("content-length");
  const totalBytes = contentLength ? parseInt(contentLength, 10) : null;
  if (totalBytes) {
    console.log(`${jobLabel} Video size: ${(totalBytes / 1024 / 1024).toFixed(1)} MB`);
  } else {
    console.log(`${jobLabel} Video size: unknown (no Content-Length header)`);
  }

  // ── Step 2: Set up progress tracking stream ──────────────────────────────────
  const webStream = videoResponse.body;
  if (!webStream) throw new Error("No response body from video URL");

  let bytesTransferred = 0;
  const progressPassThrough = new PassThrough();
  const nodeSourceStream = Readable.fromWeb(webStream as any);

  nodeSourceStream.on("data", (chunk: Buffer) => {
    bytesTransferred += chunk.length;
  });
  nodeSourceStream.pipe(progressPassThrough);
  nodeSourceStream.on("error", (err) => progressPassThrough.destroy(err));

  // Log progress every 30 seconds
  const progressInterval = setInterval(() => {
    if (totalBytes) {
      const pct = ((bytesTransferred / totalBytes) * 100).toFixed(1);
      console.log(`${jobLabel} Upload progress: ${(bytesTransferred / 1024 / 1024).toFixed(1)} MB / ${(totalBytes / 1024 / 1024).toFixed(1)} MB (${pct}%)`);
    } else {
      console.log(`${jobLabel} Upload progress: ${(bytesTransferred / 1024 / 1024).toFixed(1)} MB transferred`);
    }
  }, PROGRESS_LOG_INTERVAL_MS);

  // ── Step 3: Upload to YouTube with hard timeout ───────────────────────────────
  console.log(`${jobLabel} Starting YouTube API upload (timeout: 45 min)...`);
  const uploadStartTime = Date.now();

  const youtube = google.youtube({ version: "v3", auth: oauth2Client });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let uploadResponse: any;
  try {
    const uploadPromise = youtube.videos.insert({
      part: ["snippet", "status"],
      requestBody: {
        snippet: {
          title: params.title.substring(0, 100),
          description: params.description,
          tags: params.tags ?? [],
          categoryId: params.categoryId ?? "26",
          defaultLanguage: "en",
          defaultAudioLanguage: "en",
        },
        status: {
          privacyStatus: params.privacyStatus ?? "unlisted",
          selfDeclaredMadeForKids: false,
        },
      },
      media: {
        mimeType: "video/mp4",
        body: progressPassThrough,
      },
    } as any);

    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        progressPassThrough.destroy(new Error("Upload timeout"));
        reject(new Error(
          `YouTube upload timed out after 45 minutes. The video may be very large or the connection stalled. ` +
          `Check YouTube Studio — the upload may have partially completed.`
        ));
      }, UPLOAD_TIMEOUT_MS);
    });

    uploadResponse = await Promise.race([uploadPromise, timeoutPromise]);
  } finally {
    clearInterval(progressInterval);
    const elapsed = ((Date.now() - uploadStartTime) / 1000 / 60).toFixed(1);
    console.log(`${jobLabel} Upload finished in ${elapsed} minutes. Bytes transferred: ${(bytesTransferred / 1024 / 1024).toFixed(1)} MB`);
  }

  const videoId = uploadResponse.data.id;
  if (!videoId) {
    throw new Error("YouTube upload succeeded but no video ID returned");
  }

  console.log(`${jobLabel} ✅ Upload complete! YouTube video ID: ${videoId}`);

  return {
    videoId,
    videoUrl: `https://www.youtube.com/watch?v=${videoId}`,
    title: params.title,
  };
}
