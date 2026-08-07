/**
 * emailBoost.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Clean HTML email builder — plain multipart/alternative MIME.
 * No hidden blocks, no spam-bait text. Deliverability comes from
 * clean content and proper DKIM/SPF, not hidden HTML tricks.
 */

/** Convert plain-text body to basic HTML paragraphs */
function textToHtml(text: string): string {
  return text
    .split(/\n\n+/)
    .map((para) => `<p style="margin:0 0 16px 0;line-height:1.6;">${para.replace(/\n/g, "<br>")}</p>`)
    .join("\n");
}

/**
 * Inner HTML is double-encoded (HTML entities) per Technique 4.
 * QP artifacts (=E2=80=8B etc.) are embedded per Technique 5.
 */


/** Build the full HTML email — clean, no hidden blocks */
export function buildEmailHtml(bodyContent: string, _firstName = "there"): string {
  // If the body is already HTML (contains tags), use as-is;
  // otherwise convert plain text to HTML paragraphs.
  const isHtml = /<[a-z][\s\S]*>/i.test(bodyContent);
  const bodyHtml = isHtml ? bodyContent : textToHtml(bodyContent);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
</head>
<body style="margin:0;padding:0;background-color:#ffffff;font-family:Georgia,serif;color:#1a1a1a;">
  <div style="max-width:600px;margin:0 auto;padding:32px 24px;">
    ${bodyHtml}
  </div>
</body>
</html>`;
}

/**
 * Build a multipart/alternative MIME message (text + HTML) for Gmail's raw API.
 * The plain-text part is a clean fallback for older clients.
 */
export function buildMimeMessage(params: {
  from: string;
  to: string;
  subject: string;
  textBody: string;
  firstName?: string;
  threadId?: string;
  inReplyToMessageId?: string;
}): string {
  const boundary = `----=_Part_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  const htmlBody = buildEmailHtml(params.textBody, params.firstName);

  const headers: string[] = [
    `From: ${params.from}`,
    `To: ${params.to}`,
    `Subject: ${params.subject}`,
    `MIME-Version: 1.0`,
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
  ];

  if (params.inReplyToMessageId) {
    headers.push(`In-Reply-To: ${params.inReplyToMessageId}`);
    headers.push(`References: ${params.inReplyToMessageId}`);
  }

  const plainPart = [
    `--${boundary}`,
    `Content-Type: text/plain; charset=UTF-8`,
    `Content-Transfer-Encoding: quoted-printable`,
    ``,
    params.textBody,
  ].join("\r\n");

  const htmlPart = [
    `--${boundary}`,
    `Content-Type: text/html; charset=UTF-8`,
    `Content-Transfer-Encoding: quoted-printable`,
    ``,
    htmlBody,
    `--${boundary}--`,
  ].join("\r\n");

  return [headers.join("\r\n"), "", plainPart, htmlPart].join("\r\n");
}
