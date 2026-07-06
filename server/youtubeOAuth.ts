/**
 * YouTube Data API OAuth helper
 *
 * Allows the tool to update YouTube video descriptions via the YouTube Data API.
 * Reuses the same Google Cloud project / OAuth credentials as Gmail
 * (GMAIL_CLIENT_ID / GMAIL_CLIENT_SECRET) since both APIs are enabled on the
 * same project.
 *
 * Setup:
 *  1. Make sure the Google Cloud project has YouTube Data API v3 enabled.
 *  2. Authorize once via /api/youtube/auth-url → refresh token stored in
 *     userCredentials.youtubeRefreshToken (userId = 1, the owner).
 *
 * Scopes required:
 *  - https://www.googleapis.com/auth/youtube.force-ssl
 */

import { google } from "googleapis";

const YOUTUBE_SCOPES = [
  "https://www.googleapis.com/auth/youtube.force-ssl",
];

function getYouTubeOAuthClient() {
  // Reuse the Gmail OAuth credentials — same Google Cloud project
  const clientId = process.env.GMAIL_CLIENT_ID;
  const clientSecret = process.env.GMAIL_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error(
      "GMAIL_CLIENT_ID and GMAIL_CLIENT_SECRET must be set in secrets. " +
      "These are reused for YouTube OAuth (same Google Cloud project)."
    );
  }

  // Always use the production callback URL — this OAuth flow is only used in production.
  // Using a dynamic origin would require passing it from the frontend, which adds complexity
  // for a one-time owner-only authorization flow.
  const redirectUri = process.env.YOUTUBE_REDIRECT_URI ?? "https://content.theurbanmonk.com/api/youtube/callback";

  return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
}

/** Generate the OAuth authorization URL for the channel owner to authorize */
export function getYouTubeAuthUrl(): string {
  const oauth2Client = getYouTubeOAuthClient();
  return oauth2Client.generateAuthUrl({
    access_type: "offline",
    scope: YOUTUBE_SCOPES,
    prompt: "consent", // Force consent to always get refresh_token
  });
}

/** Exchange authorization code for tokens and return the refresh token */
export async function exchangeYouTubeCode(code: string): Promise<{
  refreshToken: string;
  channelTitle: string;
  channelId: string;
}> {
  const oauth2Client = getYouTubeOAuthClient();
  const { tokens } = await oauth2Client.getToken(code);

  if (!tokens.refresh_token) {
    throw new Error(
      "No refresh token received. Make sure prompt=consent is set and the account hasn't already authorized this app. " +
      "If it has, revoke access at https://myaccount.google.com/permissions and try again."
    );
  }

  // Get the channel title to confirm which account was authorized
  oauth2Client.setCredentials(tokens);
  let channelTitle = "YouTube Channel";
  let channelId = "";
  try {
    const youtube = google.youtube({ version: "v3", auth: oauth2Client });
    const channelRes = await youtube.channels.list({
      part: ["snippet"],
      mine: true,
    });
    channelTitle = channelRes.data.items?.[0]?.snippet?.title ?? "YouTube Channel";
    channelId = channelRes.data.items?.[0]?.id ?? "";
  } catch {
    // Non-fatal — we still have the refresh token
  }

  return {
    refreshToken: tokens.refresh_token,
    channelTitle,
    channelId,
  };
}

/** Check if YouTube is authorized (refresh token present in env) */
export function isYouTubeAuthorized(): boolean {
  return !!process.env.YOUTUBE_REFRESH_TOKEN;
}

/**
 * Build an authenticated YouTube Data API client from a stored refresh token.
 * Pass the refresh token from userCredentials.youtubeRefreshToken.
 */
export function getYouTubeClient(refreshToken: string) {
  const oauth2Client = getYouTubeOAuthClient();
  oauth2Client.setCredentials({ refresh_token: refreshToken });
  return google.youtube({ version: "v3", auth: oauth2Client });
}
