const apiKey = process.env.KLAVIYO_PRIVATE_KEY;
if (!apiKey) throw new Error("KLAVIYO_PRIVATE_KEY is not available");

const DRAFT_FLOW_ID = "YyFZPu";
const DRAFT_FLOW_NAME = "[DRAFT — VA REVIEW] Interconnected Free Screening - KO — Single-Link $67";
const SENDER_NAME = "Interconnected Series by The Urban Monk";
const SIGNATURE_NAME = "Dr. Pedram Shojai";
const SIGNATURE_TITLE = "Host of the Interconnected Series";

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

async function getFlowMessageTemplate(messageId) {
  if (!messageId) throw new Error("Flow email message ID is required.");
  return request(`/flow-messages/${messageId}/template`);
}

function refineHtml(html) {
  const signature = `Warmly,<br><strong>${SIGNATURE_NAME}</strong><br><span style="font-size:15px;color:#6c716c;">${SIGNATURE_TITLE}</span>`;
  const withSignature = html.replace(
    /Warmly,\s*<br\s*\/?>\s*<strong>\s*Dr\. Pedram Shojai\s*<\/strong>(?:\s*<br\s*\/?>\s*<span[^>]*>\s*Host of the Interconnected Series\s*<\/span>)?/gi,
    signature
  );

  // Retain the required unsubscribe merge tag, but remove visible address / mailing-list boilerplate
  // that was accidentally copied into the email body during the first draft conversion.
  return withSignature
    .replace(/You are receiving this because you requested the Interconnected series from The Urban Monk\.\s*<br\s*\/?>/gi, "")
    .replace(/(?:The Urban Monk|Urban Monk Productions)[^<]{0,180}(?:Street|St\.?|Avenue|Ave\.?|Road|Rd\.?|Boulevard|Blvd\.?|Suite|Ste\.?|P\.?O\.?\s*Box)[^<]{0,220}<br\s*\/?>/gi, "");
}

async function updateAction(action, templateId) {
  const definition = structuredClone(action);
  definition.data.status = "draft";
  definition.data.message.from_label = SENDER_NAME;
  definition.data.message.template_id = templateId;
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
  throw new Error("Safety guard: only the named Draft review flow may be refined.");
}

const emailActions = (flow.attributes?.definition?.actions ?? []).filter(
  (action) => action.type === "send-email"
);
if (emailActions.length !== 27 || emailActions.some((action) => action.data?.status !== "draft")) {
  throw new Error("Safety guard: expected 27 Draft email actions in the review flow.");
}

for (const action of emailActions) {
  const messageId = action.data?.message?.id;
  const template = await getFlowMessageTemplate(messageId);
  const templateId = template.data?.id;
  if (!templateId) throw new Error(`No embedded template found for ${action.data?.message?.name}.`);
  const html = template.data?.attributes?.html ?? "";
  const refinedHtml = refineHtml(html);
  const refinedTemplate = await request("/templates", {
    method: "POST",
    body: JSON.stringify({
      data: {
        type: "template",
        attributes: {
          name: `[DRAFT — VA REVIEW] ${action.data?.message?.name} — Refined identity`,
          editor_type: "CODE",
          html: refinedHtml,
          text: (template.data?.attributes?.text ?? "")
            .replace(/Warmly,\s*\nDr\. Pedram Shojai(?:\s*\nHost of the Interconnected Series)?/gi, `Warmly,\n${SIGNATURE_NAME}\n${SIGNATURE_TITLE}`)
            .replace(/You are receiving this because you requested the Interconnected series from The Urban Monk\.\s*/gi, ""),
        },
      },
    }),
  });
  const refinedTemplateId = refinedTemplate.data?.id;
  if (!refinedTemplateId) throw new Error(`Unable to create a refined draft template for ${action.data?.message?.name}.`);
  await updateAction(action, refinedTemplateId);
}

const verification = await request(
  `/flows/${DRAFT_FLOW_ID}/?additional-fields%5Bflow%5D=definition`
);
const verificationEmails = (verification.data?.attributes?.definition?.actions ?? []).filter(
  (action) => action.type === "send-email"
);
const checks = [];
for (const action of verificationEmails) {
  const template = await getFlowMessageTemplate(action.data?.message?.id);
  const html = template.data?.attributes?.html ?? "";
  checks.push({
    messageName: action.data?.message?.name,
    draft: action.data?.status === "draft",
    senderMatches: action.data?.message?.from_label === SENDER_NAME,
    signatureMatches: html.includes(SIGNATURE_NAME) && html.includes(SIGNATURE_TITLE),
    bodyFooterRemoved: !html.includes("You are receiving this because you requested the Interconnected series"),
    unsubscribePreserved: html.includes("{% unsubscribe %}"),
  });
}

const allVerified = checks.length === 27 && checks.every((check) =>
  check.draft &&
  check.senderMatches &&
  check.signatureMatches &&
  check.bodyFooterRemoved &&
  check.unsubscribePreserved
);
if (verification.data?.attributes?.status !== "draft" || !allVerified) {
  throw new Error("Safety guard: the draft-only identity cleanup did not verify cleanly.");
}

process.stdout.write(`${JSON.stringify({
  status: "refined_draft_email_identity",
  flowId: verification.data?.id,
  flowStatus: verification.data?.attributes?.status,
  emailCount: checks.length,
  allDraftsVerified: allVerified,
  senderName: SENDER_NAME,
  signatureTitle: SIGNATURE_TITLE,
  liveFlowChanged: false,
}, null, 2)}\n`);
