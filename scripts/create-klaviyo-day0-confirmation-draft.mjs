const apiKey = process.env.KLAVIYO_PRIVATE_KEY;
if (!apiKey) throw new Error("KLAVIYO_PRIVATE_KEY is not available");

const TEMPLATE_NAME = "[DRAFT] Interconnected Day 0 — Plain Confirmation Deliverability Test";
const SUBJECT = "You’re in — Interconnected starts tomorrow";
const PREVIEW = "Your episode schedule and a note from Dr. Pedram.";

if (!TEMPLATE_NAME.startsWith("[DRAFT]")) {
  throw new Error("Safety guard: this script may only create a clearly labelled draft template.");
}

const headers = {
  Authorization: `Klaviyo-API-Key ${apiKey}`,
  Accept: "application/vnd.api+json",
  "Content-Type": "application/vnd.api+json",
  revision: "2026-07-15",
};

async function request(path, init = {}) {
  const response = await fetch(`https://a.klaviyo.com/api${path}`, {
    ...init,
    headers: { ...headers, ...(init.headers ?? {}) },
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`${response.status} ${text.slice(0, 1000)}`);
  return text ? JSON.parse(text) : {};
}

const emailHtml = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${SUBJECT}</title>
  </head>
  <body style="margin:0;padding:0;background:#ffffff;color:#222222;font-family:Arial,Helvetica,sans-serif;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${PREVIEW}</div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#ffffff;">
      <tr>
        <td align="center" style="padding:40px 20px;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:620px;">
            <tr><td style="padding:0 0 22px;font-size:13px;letter-spacing:1.5px;text-transform:uppercase;color:#8d6f26;">The Urban Monk</td></tr>
            <tr><td style="font-family:Georgia,Times New Roman,serif;font-size:31px;line-height:1.25;color:#1b1b1b;padding:0 0 20px;">You’re in. Interconnected starts tomorrow.</td></tr>
            <tr><td style="font-size:17px;line-height:1.65;color:#333333;padding:0 0 18px;">Hi {{ person.first_name|default:'there' }},</td></tr>
            <tr><td style="font-size:17px;line-height:1.65;color:#333333;padding:0 0 18px;">I’m glad you joined us. Over the next nine days, I’ll send you one episode at a time from <em>Interconnected</em> — a series about the connections among our environment, our health, and the choices we make every day.</td></tr>
            <tr><td style="font-size:17px;line-height:1.65;color:#333333;padding:0 0 18px;">Your first episode will arrive tomorrow. If you have questions along the way, simply reply to any email and my team will help.</td></tr>
            <tr><td style="font-size:17px;line-height:1.65;color:#333333;padding:0 0 28px;">Warmly,<br><strong>Dr. Pedram Shojai</strong></td></tr>
            <tr><td style="border-top:1px solid #e6e6e6;padding-top:20px;font-size:12px;line-height:1.55;color:#777777;">You are receiving this because you requested the Interconnected series from The Urban Monk.<br>{% unsubscribe %}</td></tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

const emailText = `Hi {{ person.first_name|default:'there' }},

I’m glad you joined us. Over the next nine days, I’ll send you one episode at a time from Interconnected — a series about the connections among our environment, our health, and the choices we make every day.

Your first episode will arrive tomorrow. If you have questions along the way, simply reply to any email and my team will help.

Warmly,
Dr. Pedram Shojai

{% unsubscribe %}`;

const existing = await request("/templates/?page%5Bsize%5D=10");
const found = (existing.data ?? []).find((template) => template.attributes?.name === TEMPLATE_NAME);
if (found) {
  process.stdout.write(`${JSON.stringify({ status: "already_exists", templateId: found.id, templateName: TEMPLATE_NAME }, null, 2)}\n`);
  process.exit(0);
}

const created = await request("/templates/", {
  method: "POST",
  body: JSON.stringify({
    data: {
      type: "template",
      attributes: {
        name: TEMPLATE_NAME,
        editor_type: "CODE",
        html: emailHtml,
        text: emailText,
      },
    },
  }),
});

process.stdout.write(`${JSON.stringify({
  status: "created_draft_template_only",
  templateId: created.data.id,
  templateName: TEMPLATE_NAME,
  subject: SUBJECT,
  previewText: PREVIEW,
  liveFlowChanged: false,
  liveEmailChanged: false,
}, null, 2)}\n`);
