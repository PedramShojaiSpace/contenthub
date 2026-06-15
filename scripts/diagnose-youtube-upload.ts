/**
 * YouTube Upload Diagnostic Script
 * Tests each step of the upload pipeline and reports the exact failure point.
 * Run: npx tsx scripts/diagnose-youtube-upload.ts
 */

import "dotenv/config";
import { google } from "googleapis";
import { getDb } from "../server/db";
import { userCredentials, videoJobs } from "../drizzle/schema";
import { eq } from "drizzle-orm";

async function diagnose() {
  console.log("=== YouTube Upload Diagnostic ===\n");

  // ── Step 1: Check env vars ──────────────────────────────────────────────────
  console.log("STEP 1: Environment Variables");
  const clientId = process.env.GMAIL_CLIENT_ID;
  const clientSecret = process.env.GMAIL_CLIENT_SECRET;
  console.log("  GMAIL_CLIENT_ID:", clientId ? `✅ set (${clientId.substring(0, 20)}...)` : "❌ MISSING");
  console.log("  GMAIL_CLIENT_SECRET:", clientSecret ? `✅ set (${clientSecret.substring(0, 10)}...)` : "❌ MISSING");
  if (!clientId || !clientSecret) {
    console.error("\n❌ FATAL: Missing OAuth credentials. Cannot proceed.");
    process.exit(1);
  }

  // ── Step 2: Check DB for refresh token ─────────────────────────────────────
  console.log("\nSTEP 2: YouTube Refresh Token in DB");
  const db = await getDb();
  if (!db) { console.error("  ❌ DB unavailable"); process.exit(1); }
  const rows = await db.select({ youtubeRefreshToken: userCredentials.youtubeRefreshToken }).from(userCredentials).limit(1);
  const refreshToken = rows[0]?.youtubeRefreshToken;
  console.log("  Refresh token:", refreshToken ? `✅ found (${refreshToken.substring(0, 20)}...)` : "❌ NOT FOUND — YouTube not authorized");
  if (!refreshToken) {
    console.error("\n❌ FATAL: No YouTube refresh token. Go to /api/youtube/auth-url to authorize.");
    process.exit(1);
  }

  // ── Step 3: Exchange refresh token for access token ─────────────────────────
  console.log("\nSTEP 3: Refresh Token → Access Token");
  const oauth2Client = new google.auth.OAuth2(
    clientId,
    clientSecret,
    "https://content.theurbanmonk.com/api/youtube/callback"
  );
  oauth2Client.setCredentials({ refresh_token: refreshToken });
  let accessToken: string;
  try {
    const { credentials } = await oauth2Client.refreshAccessToken();
    accessToken = credentials.access_token!;
    console.log("  ✅ Access token obtained:", accessToken.substring(0, 20) + "...");
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("  ❌ FAILED to get access token:", msg);
    console.error("\n❌ FATAL: OAuth token refresh failed. The refresh token may be revoked or expired.");
    process.exit(1);
  }

  // ── Step 4: Check job #1 and its download URL ───────────────────────────────
  console.log("\nSTEP 4: Job #1 Download URL");
  const jobs = await db.select().from(videoJobs).where(eq(videoJobs.id, 1)).limit(1);
  const job = jobs[0];
  if (!job) { console.error("  ❌ Job #1 not found"); process.exit(1); }
  console.log("  Job status:", job.status);
  console.log("  descriptDownloadUrl:", job.descriptDownloadUrl ? `✅ set (${job.descriptDownloadUrl.substring(0, 60)}...)` : "❌ NULL");
  console.log("  s3VideoUrl:", job.s3VideoUrl ? `⚠️  set (${job.s3VideoUrl.substring(0, 60)}...)` : "null");

  const downloadUrl = job.descriptDownloadUrl;
  if (!downloadUrl) {
    console.error("\n❌ FATAL: No descriptDownloadUrl. Need to re-export from Descript first.");
    process.exit(1);
  }
  if (downloadUrl.includes("share.descript.com")) {
    console.error("\n❌ FATAL: descriptDownloadUrl is a share viewer page, not a real MP4.");
    process.exit(1);
  }

  // ── Step 5: HEAD check the download URL ────────────────────────────────────
  console.log("\nSTEP 5: HEAD Check Download URL");
  try {
    const headRes = await fetch(downloadUrl, { method: "HEAD", signal: AbortSignal.timeout(20_000) });
    console.log("  HTTP status:", headRes.status, headRes.statusText);
    console.log("  Content-Type:", headRes.headers.get("content-type"));
    const size = headRes.headers.get("content-length");
    console.log("  Content-Length:", size ? `${(parseInt(size) / 1024 / 1024).toFixed(1)} MB` : "NOT RETURNED");
    if (!headRes.ok) {
      console.error(`\n❌ FATAL: Download URL returned ${headRes.status}. URL has expired — need fresh Descript export.`);
      process.exit(1);
    }
    if (!size) {
      console.error("\n❌ FATAL: No Content-Length header. Cannot use streaming upload (need to know total size upfront).");
      process.exit(1);
    }
    console.log("  ✅ Download URL is valid and accessible");
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("  ❌ HEAD request failed:", msg);
    process.exit(1);
  }

  // ── Step 6: Initiate YouTube resumable upload session ──────────────────────
  console.log("\nSTEP 6: Initiate YouTube Resumable Upload Session");
  try {
    const metadata = {
      snippet: {
        title: "DIAGNOSTIC TEST — DELETE ME",
        description: "Test upload from diagnostic script",
        tags: ["test"],
        categoryId: "26",
      },
      status: {
        privacyStatus: "private",
        selfDeclaredMadeForKids: false,
      },
    };

    const headRes = await fetch(downloadUrl, { method: "HEAD", signal: AbortSignal.timeout(20_000) });
    const contentLength = headRes.headers.get("content-length")!;
    const mimeType = (headRes.headers.get("content-type") ?? "video/mp4").split(";")[0].trim();

    const initRes = await fetch(
      "https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json; charset=UTF-8",
          "X-Upload-Content-Type": mimeType,
          "X-Upload-Content-Length": contentLength,
        },
        body: JSON.stringify(metadata),
        signal: AbortSignal.timeout(30_000),
      }
    );

    console.log("  HTTP status:", initRes.status, initRes.statusText);
    if (!initRes.ok) {
      const body = await initRes.text();
      console.error("  ❌ FAILED to initiate upload session:", body);
      console.error("\n❌ FATAL: YouTube API rejected the upload initiation.");
      process.exit(1);
    }

    const uploadUri = initRes.headers.get("location");
    if (!uploadUri) {
      console.error("  ❌ No upload URI in response headers");
      process.exit(1);
    }
    console.log("  ✅ Upload session created:", uploadUri.substring(0, 80) + "...");

    // ── Step 7: Upload first 1 MB chunk as a smoke test ──────────────────────
    console.log("\nSTEP 7: Upload First 1 MB Chunk (Smoke Test)");
    const chunkSize = 1 * 1024 * 1024; // 1 MB
    const rangeRes = await fetch(downloadUrl, {
      headers: { Range: `bytes=0-${chunkSize - 1}` },
      signal: AbortSignal.timeout(60_000),
    });
    console.log("  Range request status:", rangeRes.status, rangeRes.statusText);
    if (rangeRes.status !== 206 && rangeRes.status !== 200) {
      console.error("  ❌ Range request failed");
      process.exit(1);
    }
    const chunk = Buffer.from(await rangeRes.arrayBuffer());
    console.log("  Chunk size:", (chunk.length / 1024 / 1024).toFixed(2), "MB");

    const totalSize = parseInt(contentLength, 10);
    const chunkRes = await fetch(uploadUri, {
      method: "PUT",
      headers: {
        "Content-Length": String(chunk.length),
        "Content-Range": `bytes 0-${chunk.length - 1}/${totalSize}`,
        "Content-Type": mimeType,
      },
      body: new Uint8Array(chunk),
      signal: AbortSignal.timeout(5 * 60 * 1000),
    });

    console.log("  Chunk upload status:", chunkRes.status, chunkRes.statusText);
    if (chunkRes.status === 308) {
      console.log("  ✅ First chunk accepted by YouTube (308 Resume Incomplete — more chunks needed)");
      console.log("\n✅ ALL STEPS PASSED — The upload pipeline is working correctly.");
      console.log("   The full upload will proceed normally when triggered from the dashboard.");
    } else if (chunkRes.status === 200 || chunkRes.status === 201) {
      console.log("  ✅ Upload complete (video was tiny)");
    } else {
      const body = await chunkRes.text();
      console.error("  ❌ Chunk upload failed:", chunkRes.status, body);
      process.exit(1);
    }

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("  ❌ FAILED:", msg);
    process.exit(1);
  }

  process.exit(0);
}

diagnose().catch(err => {
  console.error("Unhandled error:", err);
  process.exit(1);
});
