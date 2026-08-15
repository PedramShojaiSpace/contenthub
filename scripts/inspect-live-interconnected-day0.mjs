const apiKey = process.env.KLAVIYO_PRIVATE_KEY;
if (!apiKey) throw new Error("KLAVIYO_PRIVATE_KEY is not available");

const FLOW_ID = "VMpbLV";

const headers = {
  Authorization: `Klaviyo-API-Key ${apiKey}`,
  Accept: "application/vnd.api+json",
  revision: "2026-07-15",
};

async function request(path) {
  const response = await fetch(`https://a.klaviyo.com/api${path}`, { headers });
  const text = await response.text();
  if (!response.ok) throw new Error(`${response.status} ${text.slice(0, 800)}`);
  return text ? JSON.parse(text) : {};
}

const flow = await request(`/flows/${FLOW_ID}/?additional-fields%5Bflow%5D=definition`);
const action = (flow.data?.attributes?.definition?.actions ?? []).find(
  (item) => item.type === "send-email"
);
if (!action) throw new Error("No Day 0 send-email action was found");

const message = action.data?.message ?? action.data?.main_action?.data?.message;
if (!message?.template_id) throw new Error("Day 0 message does not have a template ID");

const template = await request(`/templates/${message.template_id}/`);
const html = template.data?.attributes?.html ?? "";
const links = Array.from(html.matchAll(/href=["']([^"']+)["']/gi)).map((match) => match[1]);

process.stdout.write(JSON.stringify({
  flow: { id: flow.data?.id, name: flow.data?.attributes?.name, status: flow.data?.attributes?.status },
  action: { id: action.id, type: action.type, status: action.data?.status ?? action.data?.main_action?.data?.status ?? null },
  message: {
    id: message.id,
    name: message.name,
    subjectLine: message.subject_line,
    previewText: message.preview_text,
    templateId: message.template_id,
  },
  template: {
    id: template.data?.id,
    name: template.data?.attributes?.name,
    editorType: template.data?.attributes?.editor_type,
    htmlLength: html.length,
    links,
  },
}, null, 2));
