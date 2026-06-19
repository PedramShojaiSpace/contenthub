/**
 * Gmail helper for Backlink Outreach Engine
 *
 * Sends outreach emails from alyzza@theurbanmonk.com on behalf of
 * Dr. Pedram Shojai using Gmail OAuth2.
 *
 * Setup:
 *  1. Create a Google Cloud project with Gmail API enabled
 *  2. Create OAuth2 credentials (Desktop app or Web app)
 *  3. Add GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET to secrets
 *  4. Alyzza authorizes once via /api/gmail/auth → refresh token stored as GMAIL_REFRESH_TOKEN
 *
 * Scopes required:
 *  - https://www.googleapis.com/auth/gmail.send
 *  - https://www.googleapis.com/auth/gmail.readonly (for thread tracking)
 */

import { google } from "googleapis";

const GMAIL_SCOPES = [
  "https://www.googleapis.com/auth/gmail.send",
  "https://www.googleapis.com/auth/gmail.readonly",
];

function getGmailOAuthClient() {
  const clientId = process.env.GMAIL_CLIENT_ID;
  const clientSecret = process.env.GMAIL_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error(
      "GMAIL_CLIENT_ID and GMAIL_CLIENT_SECRET must be set in secrets. " +
      "Create a Google Cloud project, enable Gmail API, and add OAuth2 credentials."
    );
  }

  const redirectUri = process.env.NODE_ENV === "production"
    ? "https://content.theurbanmonk.com/api/gmail/callback"
    : "http://localhost:3000/api/gmail/callback";

  return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
}

/** Generate the OAuth authorization URL for Alyzza to authorize */
export function getGmailAuthUrl(): string {
  const oauth2Client = getGmailOAuthClient();
  return oauth2Client.generateAuthUrl({
    access_type: "offline",
    scope: GMAIL_SCOPES,
    prompt: "consent", // Force consent to always get refresh_token
  });
}

/** Exchange authorization code for tokens and return the refresh token */
export async function exchangeGmailCode(code: string): Promise<{
  refreshToken: string;
  email: string;
}> {
  const oauth2Client = getGmailOAuthClient();
  const { tokens } = await oauth2Client.getToken(code);

  if (!tokens.refresh_token) {
    throw new Error(
      "No refresh token received. Make sure prompt=consent is set and the account hasn't already authorized this app."
    );
  }

  // Get the email address of the authorized account
  oauth2Client.setCredentials(tokens);
  const gmail = google.gmail({ version: "v1", auth: oauth2Client });
  const profile = await gmail.users.getProfile({ userId: "me" });

  return {
    refreshToken: tokens.refresh_token,
    email: profile.data.emailAddress ?? "unknown",
  };
}

/** Get an authenticated Gmail client using the stored refresh token */
function getGmailClient() {
  const refreshToken = process.env.GMAIL_REFRESH_TOKEN;
  if (!refreshToken) {
    throw new Error(
      "Gmail is not authorized. Go to Backlink Outreach → Settings and click 'Authorize Gmail' to connect Alyzza's account."
    );
  }

  const oauth2Client = getGmailOAuthClient();
  oauth2Client.setCredentials({ refresh_token: refreshToken });
  return google.gmail({ version: "v1", auth: oauth2Client });
}

/** Check if Gmail is authorized (refresh token present) */
export function isGmailAuthorized(): boolean {
  return !!process.env.GMAIL_REFRESH_TOKEN;
}

export interface SendEmailParams {
  to: string;
  toName?: string;
  subject: string;
  body: string;
  /** If replying to an existing thread, provide the thread ID */
  threadId?: string;
  /** If replying, provide the message ID to set In-Reply-To header */
  inReplyToMessageId?: string;
}

export interface SendEmailResult {
  messageId: string;
  threadId: string;
}

/**
 * Send an outreach email from alyzza@theurbanmonk.com on behalf of Dr. Pedram Shojai.
 * The From header shows "Dr. Pedram Shojai <alyzza@theurbanmonk.com>" so the name
 * appears as Dr. Pedram Shojai and replies come back to Alyzza's inbox.
 */
export async function sendGmailOutreach(params: SendEmailParams): Promise<SendEmailResult> {
  const gmail = getGmailClient();

  const fromName = "Dr. Pedram Shojai";
  const fromEmail = "alyzza@theurbanmonk.com";

  // Build RFC 2822 email
  const toHeader = params.toName
    ? `"${params.toName}" <${params.to}>`
    : params.to;

  const headers: Record<string, string> = {
    "From": `"${fromName}" <${fromEmail}>`,
    "To": toHeader,
    "Subject": params.subject,
    "Content-Type": "text/plain; charset=utf-8",
    "MIME-Version": "1.0",
  };

  if (params.inReplyToMessageId) {
    headers["In-Reply-To"] = params.inReplyToMessageId;
    headers["References"] = params.inReplyToMessageId;
  }

  const headerString = Object.entries(headers)
    .map(([k, v]) => `${k}: ${v}`)
    .join("\r\n");

  const rawEmail = `${headerString}\r\n\r\n${params.body}`;

  // Base64url encode
  const encodedEmail = Buffer.from(rawEmail)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  const requestBody: { raw: string; threadId?: string } = { raw: encodedEmail };
  if (params.threadId) {
    requestBody.threadId = params.threadId;
  }

  const response = await gmail.users.messages.send({
    userId: "me",
    requestBody,
  } as any);

  return {
    messageId: (response as any).data?.id ?? "",
    threadId: (response as any).data?.threadId ?? "",
  };
}
