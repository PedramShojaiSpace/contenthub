/**
 * YouTube Data API v3 Uploader
 *
 * Uploads a video from an S3 URL to YouTube using the owner's stored OAuth refresh token.
 * Reuses the existing youtubeOAuth.ts pattern (Gmail OAuth client = YouTube OAuth client).
 */

import { google } from "googleapis";
import { Readable } from "stream";
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
}

export interface YouTubeUploadResult {
  videoId: string;
  videoUrl: string;
  title: string;
}

export async function uploadToYouTube(
  params: YouTubeUploadParams
): Promise<YouTubeUploadResult> {
  const refreshToken = await getYouTubeRefreshToken();

  const oauth2Client = getYouTubeOAuthClient();
  oauth2Client.setCredentials({ refresh_token: refreshToken });

  const youtube = google.youtube({ version: "v3", auth: oauth2Client });

  // Download video from S3 URL as a stream
  const videoResponse = await fetch(params.videoUrl);
  if (!videoResponse.ok) {
    throw new Error(
      `Failed to fetch video from S3: ${videoResponse.status} ${videoResponse.statusText}`
    );
  }

  // Convert Web ReadableStream to Node.js Readable
  const webStream = videoResponse.body;
  if (!webStream) throw new Error("No response body from video URL");

  const nodeStream = Readable.fromWeb(webStream as any);

  const contentLength = videoResponse.headers.get("content-length");

  // Upload to YouTube
  const uploadResponse = await youtube.videos.insert({
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
        privacyStatus: params.privacyStatus ?? "private", // VA reviews before making public
        selfDeclaredMadeForKids: false,
      },
    },
    media: {
      mimeType: "video/mp4",
      body: nodeStream,
    },
  } as any);

  const videoId = uploadResponse.data.id;
  if (!videoId) {
    throw new Error("YouTube upload succeeded but no video ID returned");
  }

  return {
    videoId,
    videoUrl: `https://www.youtube.com/watch?v=${videoId}`,
    title: params.title,
  };
}
