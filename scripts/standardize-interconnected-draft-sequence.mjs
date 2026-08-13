const apiKey = process.env.KLAVIYO_PRIVATE_KEY;
if (!apiKey) throw new Error("KLAVIYO_PRIVATE_KEY is not available");

const DRAFT_FLOW_ID = "YyFZPu";
const DRAFT_FLOW_NAME = "[DRAFT — VA REVIEW] Interconnected Free Screening - KO — Single-Link $67";
const DAY0_EMAIL_NAME = "Day 0 opt in EG sp26";
const DAY0_SMS_NAME = "Day - 0";
const SMS_OFFER_URL = "https://content.theurbanmonk.com/r/ic67";
const FALLBACK_DESTINATION = "https://theurbanmonk.com/";
const STANDARDIZED_MARKER = "data-um-standardized-draft=\"true\"";

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
  if (!response.ok) throw new Error(`${response.status} ${text.slice(0, 1200)}`);
  return text ? JSON.parse(text) : {};
}

function decodeEntities(value) {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}

function textFromLegacyHtml(html, fallback) {
  const visible = decodeEntities(
    html
      .replace(/<!--[\s\S]*?-->/g, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<(br|\/p|\/div|\/h[1-6]|\/li|\/tr|\/td)>/gi, "\n")
      .replace(/<[^>]+>/g, " ")
  );

  const blocked = /^(view (this )?email|view in browser|unsubscribe|privacy|copyright|facebook|instagram|youtube|tiktok|twitter|podcasts?|the urban monk podcast|www\.|https?:\/\/)/i;
  const lines = visible
    .split(/\n+/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter((line) => line.length > 24 && !blocked.test(line));

  const distinct = [...new Set(lines)];
  const selected = [];
  let characterCount = 0;
  for (const line of distinct) {
    if (characterCount + line.length > 3200 || selected.length >= 16) break;
    selected.push(line);
    characterCount += line.length;
  }
  return selected.length ? selected : [fallback];
}

function extractPrimaryLink(html) {
  const hrefs = [...new Set([...html.matchAll(/href=["']([^"']+)["']/gi)].map((match) => match[1]))]
    .filter((href) => href.startsWith("http"))
    .filter((href) => !/facebook|instagram|youtube|tiktok|twitter|podcasts\.apple|typeform/i.test(href))
    .filter((href) => !/^https?:\/\/(www\.)?theurbanmonk\.com\/?$/i.test(href));

  const episode = hrefs.find((href) => /episode-view-page|\/episode[-/]/i.test(href));
  const priority = hrefs.find((href) => /theacademy\.theurbanmonk\.com|interconnected\.theurbanmonk\.com|upstream\.theurbanmonk\.com|shop\.theurbanmonk\.com|mykajabi\.com/i.test(href));
  return episode ?? priority ?? hrefs[0] ?? null;
}

function buttonLabel(url) {
  if (/episode-view-page|\/episode[-/]/i.test(url)) return "Watch today’s episode";
  if (/upstream/i.test(url)) return "Watch the replay";
  if (/shop\.theurbanmonk\.com|mykajabi\.com|ICPackages|IC2tier/i.test(url)) return "Explore the next step";
  if (url === FALLBACK_DESTINATION) return "Visit The Urban Monk";
  return "Continue";
}

function escapeHtml(value) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function buildEmailHtml({ subject, preview, paragraphs, destination, cta }) {
  const body = paragraphs
    .map(
      (paragraph) =>
        `<p style="margin:0 0 18px;font-size:17px;line-height:1.7;color:#26323a;">${escapeHtml(paragraph)}</p>`
    )
    .join("\n");
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escapeHtml(subject)}</title><style>@media only screen and (max-width:620px){.shell{padding:18px 12px!important}.header{padding:24px 24px 12px!important}.content{padding:10px 24px 26px!important}.card{border-radius:10px!important}}</style></head>
<body data-um-standardized-draft="true" style="margin:0;padding:0;background:#f3f0e9;color:#26323a;font-family:Arial,Helvetica,sans-serif;"><div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${escapeHtml(preview)}</div><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;background:#f3f0e9;"><tr><td class="shell" align="center" style="padding:34px 18px;"><table class="card" role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:640px;background:#fffdf9;border:1px solid #dfd8ca;border-radius:14px;overflow:hidden;box-shadow:0 8px 28px rgba(53,45,33,0.08);"><tr><td class="header" style="padding:28px 34px 14px;border-top:5px solid #b88a32;"><p style="margin:0;font-size:12px;line-height:1.2;letter-spacing:1.7px;text-transform:uppercase;font-weight:700;color:#8a6726;">The Urban Monk</p></td></tr><tr><td class="content" style="padding:10px 34px 30px;"><h1 style="margin:0 0 20px;font-family:Georgia,Times New Roman,serif;font-size:30px;line-height:1.25;font-weight:700;color:#203239;">${escapeHtml(subject)}</h1>${body}<p style="margin:4px 0 24px;"><a href="${escapeHtml(destination)}" style="display:inline-block;background:#203239;border:1px solid #203239;border-radius:4px;color:#ffffff;font-size:16px;font-weight:700;line-height:1.2;padding:14px 20px;text-decoration:none;">${escapeHtml(cta)}</a></p><p style="margin:0;font-size:17px;line-height:1.65;color:#26323a;">Warmly,<br><strong>Dr. Pedram Shojai</strong></p></td></tr><tr><td style="padding:18px 34px 24px;border-top:1px solid #e5dfd3;font-size:12px;line-height:1.55;color:#6c716c;">You are receiving this because you requested the Interconnected series from The Urban Monk.<br>{% unsubscribe %}</td></tr></table></td></tr></table></body></html>`;
}

function buildText(paragraphs, destination, cta) {
  return `${paragraphs.join("\n\n")}\n\n${cta}:\n${destination}\n\nWarmly,\nDr. Pedram Shojai\n\n{% unsubscribe %}`;
}

async function updateDraftAction(action, templateId) {
  const definition = structuredClone(action);
  definition.data.status = "draft";
  if (templateId) definition.data.message.template_id = templateId;
  await request(`/flow-actions/${action.id}`, {
    method: "PATCH",
    body: JSON.stringify({
      data: { type: "flow-action", id: action.id, attributes: { definition } },
    }),
  });
}

const flowPayload = await request(
  `/flows/${DRAFT_FLOW_ID}/?additional-fields%5Bflow%5D=definition`
);
const flow = flowPayload.data;
if (flow?.attributes?.name !== DRAFT_FLOW_NAME || flow?.attributes?.status !== "draft") {
  throw new Error("Safety guard: only the named Draft review flow may be standardized.");
}

const actions = flow.attributes?.definition?.actions ?? [];
const emailActions = actions.filter((action) => action.type === "send-email");
const day0SmsAction = actions.find(
  (action) => action.type === "send-sms" && action.data?.message?.name === DAY0_SMS_NAME
);
if (emailActions.length !== 27 || !day0SmsAction || day0SmsAction.data?.status !== "draft") {
  throw new Error("Safety guard: expected the complete 27-email sequence and a draft Day 0 SMS.");
}

const standardized = [];
for (const action of emailActions) {
  if (action.data?.status !== "draft") {
    throw new Error(`Safety guard: ${action.data?.message?.name ?? action.id} is not Draft.`);
  }
  if (action.data?.message?.name === DAY0_EMAIL_NAME) continue;

  const existingTemplate = await request(`/templates/${action.data.message.template_id}/`);
  const existingHtml = existingTemplate.data?.attributes?.html ?? "";
  if (existingHtml.includes(STANDARDIZED_MARKER)) {
    standardized.push({ messageName: action.data.message.name, skipped: true });
    continue;
  }

  const subject = action.data.message?.subject_line || action.data.message?.name || "Interconnected";
  const destination = extractPrimaryLink(existingHtml) ?? FALLBACK_DESTINATION;
  const paragraphs = textFromLegacyHtml(existingHtml, subject);
  const cta = buttonLabel(destination);
  const newTemplate = await request("/templates", {
    method: "POST",
    body: JSON.stringify({
      data: {
        type: "template",
        attributes: {
          name: `[DRAFT — VA REVIEW] ${action.data.message?.name} — Clean single-link`,
          editor_type: "CODE",
          html: buildEmailHtml({ subject, preview: subject, paragraphs, destination, cta }),
          text: buildText(paragraphs, destination, cta),
        },
      },
    }),
  });
  await updateDraftAction(action, newTemplate.data?.id);
  standardized.push({
    messageName: action.data.message?.name,
    sourceTemplateId: existingTemplate.data?.id,
    draftTemplateId: newTemplate.data?.id,
    primaryDestination: destination,
  });
}

const smsBody = `Interconnected starts tomorrow. Daily episode links are on the way. One-time $67 all-access offer: ${SMS_OFFER_URL}`;
const updatedSmsAction = structuredClone(day0SmsAction);
updatedSmsAction.data.status = "draft";
updatedSmsAction.data.message.body = smsBody;
await updateDraftAction(updatedSmsAction);

const verification = await request(
  `/flows/${DRAFT_FLOW_ID}/?additional-fields%5Bflow%5D=definition`
);
const verificationActions = verification.data?.attributes?.definition?.actions ?? [];
const verificationEmails = verificationActions.filter((action) => action.type === "send-email");
const verificationSms = verificationActions.find(
  (action) => action.type === "send-sms" && action.data?.message?.name === DAY0_SMS_NAME
);
const nonDay0Emails = verificationEmails.filter(
  (action) => action.data?.message?.name !== DAY0_EMAIL_NAME
);
const verificationResults = [];
for (const action of nonDay0Emails) {
  const template = await request(`/templates/${action.data?.message?.template_id}/`);
  const html = template.data?.attributes?.html ?? "";
  verificationResults.push({
    messageName: action.data?.message?.name,
    status: action.data?.status,
    isStandardized: html.includes(STANDARDIZED_MARKER),
    linkCount: (html.match(/<a\b/gi) ?? []).length,
    hasLegacyCoralBackground: /#e97268/i.test(html),
  });
}

const everyEmailVerified = verificationResults.every(
  (result) =>
    result.status === "draft" &&
    result.isStandardized &&
    result.linkCount === 1 &&
    !result.hasLegacyCoralBackground
);
const smsVerified =
  verificationSms?.data?.status === "draft" &&
  verificationSms?.data?.message?.body === smsBody;

if (
  verification.data?.attributes?.status !== "draft" ||
  verificationEmails.length !== 27 ||
  !everyEmailVerified ||
  !smsVerified
) {
  throw new Error("Safety guard: draft sequence standardization did not verify cleanly.");
}

process.stdout.write(
  `${JSON.stringify(
    {
      status: "standardized_draft_sequence",
      flowId: verification.data?.id,
      flowStatus: verification.data?.attributes?.status,
      standardizedEmailCount: standardized.length,
      everyNonDay0EmailDraftCleanAndSingleLinked: everyEmailVerified,
      day0SmsStatus: verificationSms.data?.status,
      day0SmsBody: verificationSms.data?.message?.body,
      liveFlowChanged: false,
    },
    null,
    2
  )}\n`
);
