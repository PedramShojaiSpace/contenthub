const apiKey = process.env.KLAVIYO_PRIVATE_KEY;
if (!apiKey) throw new Error("KLAVIYO_PRIVATE_KEY is not available");

const TEMPLATE_ID = "Smbiqi";
const TEMPLATE_NAME = "[DRAFT] Interconnected Day 0 — Plain Confirmation Deliverability Test";
const SUBJECT = "You’re in — Interconnected starts tomorrow";
const PREVIEW = "Your episode schedule and a note from Dr. Pedram.";

if (!TEMPLATE_NAME.startsWith("[DRAFT]")) {
  throw new Error("Safety guard: only a clearly labelled draft template may be updated.");
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
    <style>
      @media only screen and (max-width:620px) {
        .shell { padding:18px 12px !important; }
        .header { padding:24px 24px 12px !important; }
        .content { padding:10px 24px 26px !important; }
        .card { border-radius:10px !important; }
      }
    </style>
  </head>
  <body style="margin:0;padding:0;background:#f3f0e9;color:#26323a;font-family:Arial,Helvetica,sans-serif;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${PREVIEW}</div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;background:#f3f0e9;">
      <tr><td class="shell" align="center" style="padding:34px 18px;">
        <table class="card" role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:640px;background:#fffdf9;border:1px solid #dfd8ca;border-radius:14px;overflow:hidden;box-shadow:0 8px 28px rgba(53,45,33,0.08);">
          <tr><td class="header" style="padding:28px 34px 14px;border-top:5px solid #b88a32;">
            <p style="margin:0;font-size:12px;line-height:1.2;letter-spacing:1.7px;text-transform:uppercase;font-weight:700;color:#8a6726;">The Urban Monk</p>
          </td></tr>
          <tr><td class="content" style="padding:10px 34px 30px;">
            <h1 style="margin:0 0 20px;font-family:Georgia,Times New Roman,serif;font-size:30px;line-height:1.25;font-weight:700;color:#203239;">You’re in. Interconnected starts tomorrow.</h1>
            <p style="margin:0 0 18px;font-size:17px;line-height:1.7;color:#26323a;">Hi {{ person.first_name|default:'there' }},</p>
            <p style="margin:0 0 18px;font-size:17px;line-height:1.7;color:#26323a;">I’m glad you joined us. Over the next nine days, I’ll send you one episode at a time from <em>Interconnected</em> — a series about the connections among our environment, our health, and the choices we make every day.</p>
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:24px 0;background:#f7f3ea;border-left:3px solid #b88a32;"><tr><td style="padding:16px 18px;font-size:15px;line-height:1.6;color:#4b514e;"><strong style="color:#26323a;">What happens next</strong><br>Your first episode arrives tomorrow. Then you’ll receive one episode each day for nine days.</td></tr></table>
            <p style="margin:0 0 22px;font-size:17px;line-height:1.7;color:#26323a;">If you have questions along the way, simply reply to any email and my team will help.</p>
            <p style="margin:0;font-size:17px;line-height:1.65;color:#26323a;">Warmly,<br><strong>Dr. Pedram Shojai</strong></p>
          </td></tr>
          <tr><td style="padding:18px 34px 24px;border-top:1px solid #e5dfd3;font-size:12px;line-height:1.55;color:#6c716c;">You are receiving this because you requested the Interconnected series from The Urban Monk.<br>{% unsubscribe %}</td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`;

const emailText = `Hi {{ person.first_name|default:'there' }},

I’m glad you joined us. Over the next nine days, I’ll send you one episode at a time from Interconnected — a series about the connections among our environment, our health, and the choices we make every day.

What happens next: your first episode arrives tomorrow. Then you’ll receive one episode each day for nine days.

If you have questions along the way, simply reply to any email and my team will help.

Warmly,
Dr. Pedram Shojai

{% unsubscribe %}`;

const updated = await request(`/templates/${TEMPLATE_ID}/`, {
  method: "PATCH",
  body: JSON.stringify({
    data: {
      type: "template",
      id: TEMPLATE_ID,
      attributes: {
        name: TEMPLATE_NAME,
        html: emailHtml,
        text: emailText,
      },
    },
  }),
});

process.stdout.write(`${JSON.stringify({
  status: "updated_draft_template_only",
  templateId: updated.data.id,
  templateName: updated.data.attributes?.name,
  subject: SUBJECT,
  previewText: PREVIEW,
  liveFlowChanged: false,
  liveEmailChanged: false,
}, null, 2)}\n`);
