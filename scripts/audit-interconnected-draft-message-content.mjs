const apiKey = process.env.KLAVIYO_PRIVATE_KEY;
if (!apiKey) throw new Error("KLAVIYO_PRIVATE_KEY is not available");

const DRAFT_FLOW_ID = "YyFZPu";
const DRAFT_FLOW_NAME = "[DRAFT — VA REVIEW] Interconnected Free Screening - KO — Single-Link $67";

const headers = {
  Authorization: `Klaviyo-API-Key ${apiKey}`,
  Accept: "application/vnd.api+json",
  revision: "2026-07-15",
};

async function request(path) {
  const response = await fetch(`https://a.klaviyo.com/api${path}`, { headers });
  const text = await response.text();
  if (!response.ok) throw new Error(`${response.status} ${text.slice(0, 1000)}`);
  return text ? JSON.parse(text) : {};
}

function countLinks(html) {
  return (html.match(/<a\b/gi) ?? []).length;
}

function extractHrefs(html) {
  return [...new Set([...html.matchAll(/href=["']([^"']+)["']/gi)].map((match) => match[1]))];
}

const flowPayload = await request(
  `/flows/${DRAFT_FLOW_ID}/?additional-fields%5Bflow%5D=definition`
);
const flow = flowPayload.data;
if (flow?.attributes?.name !== DRAFT_FLOW_NAME || flow?.attributes?.status !== "draft") {
  throw new Error("Safety guard: expected the named review flow in Draft status.");
}

const actions = flow.attributes?.definition?.actions ?? [];
const emails = actions.filter((action) => action.type === "send-email");
const sms = actions.filter((action) => action.type === "send-sms");
const day0Sms = sms.find((action) => action.data?.message?.name === "Day - 0");

const emailAudit = [];
for (const action of emails) {
  const templateId = action.data?.message?.template_id;
  const template = await request(`/templates/${templateId}/`);
  const html = template.data?.attributes?.html ?? "";
  const text = template.data?.attributes?.text ?? "";
  emailAudit.push({
    actionId: action.id,
    messageName: action.data?.message?.name ?? null,
    templateId,
    editorType: template.data?.attributes?.editor_type ?? null,
    status: action.data?.status ?? null,
    linkCount: countLinks(html),
    hasLegacyCoralBackground: /#e97268|background(?:-color)?:\s*rgb\(233,\s*114,\s*104\)/i.test(html),
    hasCleanDay0Frame: html.includes("background:#f3f0e9") && html.includes("The Urban Monk"),
    uniqueHrefs: extractHrefs(html),
    textPreview: text.replace(/\s+/g, " ").trim().slice(0, 500),
  });
}

process.stdout.write(
  `${JSON.stringify(
    {
      flowId: flow.id,
      flowName: flow.attributes?.name,
      flowStatus: flow.attributes?.status,
      emailCount: emailAudit.length,
      emailAudit,
      day0Sms: day0Sms
        ? {
            actionId: day0Sms.id,
            status: day0Sms.data?.status ?? null,
            messageName: day0Sms.data?.message?.name ?? null,
            body: day0Sms.data?.message?.body ?? null,
          }
        : null,
    },
    null,
    2
  )}\n`
);
