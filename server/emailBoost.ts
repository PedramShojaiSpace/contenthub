/**
 * emailBoost.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Clean HTML email builder — plain multipart/alternative MIME.
 * No hidden blocks, no spam-bait text. Deliverability comes from
 * clean content and proper DKIM/SPF, not hidden HTML tricks.
 */

/** Convert plain-text body to readable email paragraphs. */
function textToHtml(text: string): string {
  return text
    .split(/\n\n+/)
    .map((para) => `<p style="margin:0 0 18px;font-size:17px;line-height:1.7;color:#26323a;">${para.replace(/\n/g, "<br>")}</p>`)
    .join("\n");
}

/**
 * Inner HTML is double-encoded (HTML entities) per Technique 4.
 * QP artifacts (=E2=80=8B etc.) are embedded per Technique 5.
 */


/** Build the full HTML email — clean, readable, and safe for broad client support. */
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
  <style>
    @media only screen and (max-width: 620px) {
      .email-shell { padding: 18px 12px !important; }
      .email-card { border-radius: 10px !important; }
      .email-header { padding: 24px 24px 12px !important; }
      .email-content { padding: 20px 24px 26px !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background-color:#f3f0e9;font-family:Arial,Helvetica,sans-serif;color:#26323a;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;background-color:#f3f0e9;">
    <tr>
      <td class="email-shell" align="center" style="padding:34px 18px;">
        <table class="email-card" role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:640px;background-color:#fffdf9;border:1px solid #dfd8ca;border-radius:14px;overflow:hidden;box-shadow:0 8px 28px rgba(53,45,33,0.08);">
          <tr>
            <td class="email-header" style="padding:28px 34px 14px;border-top:5px solid #b88a32;">
              <p style="margin:0;font-size:12px;line-height:1.2;letter-spacing:1.7px;text-transform:uppercase;font-weight:700;color:#8a6726;">The Urban Monk</p>
            </td>
          </tr>
          <tr>
            <td class="email-content" style="padding:10px 34px 30px;">
              ${bodyHtml}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
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
