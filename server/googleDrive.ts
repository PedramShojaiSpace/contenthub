/**
 * Google Drive Integration
 * ─────────────────────────
 * Provides:
 *  1. OAuth 2.0 authorization URL generation (one-time setup)
 *  2. Token exchange and refresh token storage
 *  3. Upload MP4 files to a shared Drive folder
 *
 * Setup flow:
 *  1. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in secrets
 *  2. Visit /api/drive/auth-url to get the authorization link
 *  3. Click the link, authorize, get redirected back to /api/drive/callback
 *  4. GOOGLE_REFRESH_TOKEN is stored automatically
 *  5. Export button now works
 */

import { google } from "googleapis";
import https from "https";
import http from "http";
import fs from "fs";
import { Readable } from "stream";

// ─── OAuth Client ────────────────────────────────────────────────────────────

function getOAuthClient() {
  const clientId = process.env.GOOGLE_DRIVE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_DRIVE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("GOOGLE_DRIVE_CLIENT_ID and GOOGLE_DRIVE_CLIENT_SECRET must be set in secrets");
  }
  return new google.auth.OAuth2(
    clientId,
    clientSecret,
    // Redirect URI — must match what's registered in Google Cloud Console
    process.env.GOOGLE_REDIRECT_URI || "https://content.theurbanmonk.com/api/drive/callback"
  );
}

const DRIVE_SCOPES = [
  "https://www.googleapis.com/auth/drive.file", // create/manage files this app creates
];

/** Generate the one-time authorization URL the owner must visit */
export function getDriveAuthUrl(): string {
  const oauth2Client = getOAuthClient();
  return oauth2Client.generateAuthUrl({
    access_type: "offline",
    scope: DRIVE_SCOPES,
    prompt: "consent", // force consent screen to ensure refresh_token is returned
  });
}

/** Exchange authorization code for tokens and return the refresh token */
export async function exchangeCodeForTokens(code: string): Promise<{
  refreshToken: string;
  accessToken: string;
}> {
  const oauth2Client = getOAuthClient();
  const { tokens } = await oauth2Client.getToken(code);
  if (!tokens.refresh_token) {
    throw new Error(
      "No refresh token returned. Make sure you revoked previous access at " +
      "https://myaccount.google.com/permissions and try again."
    );
  }
  return {
    refreshToken: tokens.refresh_token,
    accessToken: tokens.access_token ?? "",
  };
}

/** Get an authenticated Drive client using the stored refresh token */
function getDriveClient() {
  const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;
  if (!refreshToken) {
    throw new Error(
      "Google Drive is not authorized. Visit /api/drive/auth-url to connect your Google account."
    );
  }
  const oauth2Client = getOAuthClient();
  oauth2Client.setCredentials({ refresh_token: refreshToken });
  return google.drive({ version: "v3", auth: oauth2Client });
}

// ─── Drive Folder Management ─────────────────────────────────────────────────

/** Find or create a folder by name inside a parent folder (or root) */
async function findOrCreateFolder(
  drive: ReturnType<typeof google.drive>,
  name: string,
  parentId?: string
): Promise<string> {
  // Search for existing folder
  const q = [
    `name = ${JSON.stringify(name)}`,
    `mimeType = 'application/vnd.google-apps.folder'`,
    `trashed = false`,
    parentId ? `'${parentId}' in parents` : `'root' in parents`,
  ].join(" and ");

  const res = await drive.files.list({
    q,
    fields: "files(id, name)",
    spaces: "drive",
  });

  if (res.data.files && res.data.files.length > 0) {
    return res.data.files[0].id!;
  }

  // Create new folder
  const created = await drive.files.create({
    requestBody: {
      name,
      mimeType: "application/vnd.google-apps.folder",
      parents: parentId ? [parentId] : undefined,
    },
    fields: "id",
  });
  return created.data.id!;
}

/** Make a folder publicly viewable (anyone with link can view) */
async function makeFolderPublic(
  drive: ReturnType<typeof google.drive>,
  folderId: string
): Promise<void> {
  await drive.permissions.create({
    fileId: folderId,
    requestBody: {
      role: "reader",
      type: "anyone",
    },
  });
}

// ─── Upload ──────────────────────────────────────────────────────────────────

/** Download a URL to a temp buffer for Drive upload */
function downloadToBuffer(url: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const client = url.startsWith("https") ? https : http;
    const chunks: Buffer[] = [];
    client.get(url, (res) => {
      if (res.statusCode !== 200) {
        reject(new Error(`Download failed: HTTP ${res.statusCode} for ${url}`));
        return;
      }
      res.on("data", (chunk: Buffer) => chunks.push(chunk));
      res.on("end", () => resolve(Buffer.concat(chunks)));
      res.on("error", reject);
    }).on("error", reject);
  });
}

/** Upload a single MP4 from a URL to a Drive folder */
async function uploadFileToDrive(
  drive: ReturnType<typeof google.drive>,
  fileUrl: string,
  filename: string,
  folderId: string
): Promise<{ id: string; webViewLink: string }> {
  const buffer = await downloadToBuffer(fileUrl);

  const res = await drive.files.create({
    requestBody: {
      name: filename,
      parents: [folderId],
      mimeType: "video/mp4",
    },
    media: {
      mimeType: "video/mp4",
      body: Readable.from(buffer),
    },
    fields: "id, webViewLink",
  });

  return {
    id: res.data.id!,
    webViewLink: res.data.webViewLink ?? `https://drive.google.com/file/d/${res.data.id}/view`,
  };
}

// ─── Main Export Function ─────────────────────────────────────────────────────

export interface DriveExportResult {
  success: boolean;
  folderUrl?: string;
  folderId?: string;
  uploadedFiles: Array<{ label: string; driveUrl: string }>;
  errors: Array<{ label: string; error: string }>;
}

/**
 * Export all completed variants for a job to Google Drive.
 * Creates a folder named "VVF – {jobTitle} – {date}" inside an
 * "Urban Monk Video Variants" root folder, uploads each MP4, and
 * makes the folder publicly viewable for the editor.
 */
export async function exportVariantsToDrive(params: {
  jobTitle: string;
  variants: Array<{ label: string; s3Url: string }>;
}): Promise<DriveExportResult> {
  const drive = getDriveClient();

  // Find or create root folder
  const rootFolderId = await findOrCreateFolder(drive, "Urban Monk Video Variants");

  // Create job-specific subfolder
  const dateStr = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const folderName = `VVF – ${params.jobTitle} – ${dateStr}`;
  const folderId = await findOrCreateFolder(drive, folderName, rootFolderId);

  // Make folder publicly viewable so editor can access without a Google account
  await makeFolderPublic(drive, folderId);

  const folderUrl = `https://drive.google.com/drive/folders/${folderId}`;
  const uploadedFiles: DriveExportResult["uploadedFiles"] = [];
  const errors: DriveExportResult["errors"] = [];

  // Upload each variant sequentially (avoids parallel memory pressure)
  for (const variant of params.variants) {
    try {
      const filename = `${variant.label.replace(/[^a-zA-Z0-9 +\-]/g, "_")}.mp4`;
      console.log(`[Drive Export] Uploading "${filename}"…`);
      const { webViewLink: driveUrl } = await uploadFileToDrive(drive, variant.s3Url, filename, folderId);
      uploadedFiles.push({ label: variant.label, driveUrl });
      console.log(`[Drive Export] "${filename}" uploaded → ${driveUrl}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[Drive Export] Failed to upload "${variant.label}": ${msg}`);
      errors.push({ label: variant.label, error: msg });
    }
  }

  return {
    success: uploadedFiles.length > 0,
    folderUrl,
    folderId,
    uploadedFiles,
    errors,
  };
}

/** Check if Google Drive is authorized (refresh token present) */
export function isDriveAuthorized(): boolean {
  return !!process.env.GOOGLE_REFRESH_TOKEN;
}
