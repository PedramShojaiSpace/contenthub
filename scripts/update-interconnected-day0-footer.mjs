const apiKey = process.env.KLAVIYO_PRIVATE_KEY;
if (!apiKey) throw new Error("KLAVIYO_PRIVATE_KEY is required");

const ACTION_ID = "114441634";
const apply = process.argv.includes("--apply");
const headers = {
  Authorization: `Klaviyo-API-Key ${apiKey}`,
  accept: "application/vnd.api+json",
  revision: "2026-07-15",
};

async function request(path, options = {}) {
  const response = await fetch(`https://a.klaviyo.com/api${path}`, {
    ...options,
    headers: { ...headers, ...(options.headers ?? {}) },
  });
  const body = await response.json();
  if (!response.ok) throw new Error(`${options.method ?? "GET"} ${path} failed (${response.status}): ${JSON.stringify(body)}`);
  return body;
}

function footerOnly(html = "", text = "") {
  const address = "{{ organization.name }} {{ organization.full_address }}";
  const nextHtml = /organization\.full_address/i.test(html)
    ? html
    : html.replace(/\{%\s*unsubscribe\s*%\}/i, `<p style="margin:0 0 8px;">${address}</p>\n{% unsubscribe %}`);
  const nextText = /organization\.full_address/i.test(text)
    ? text
    : text.replace(/\{%\s*unsubscribe\s*%\}/i, `${address}\n\n{% unsubscribe %}`);
  if (nextHtml === html || nextText === text) throw new Error("Could not find the expected unsubscribe token in both Day 0 content versions");
  return { html: nextHtml, text: nextText };
}

const actionResponse = await request(`/flow-actions/${ACTION_ID}`);
const action = actionResponse.data.attributes.definition;
if (action.data?.status !== "live") throw new Error(`Expected a live Day 0 action; found ${action.data?.status ?? "unknown"}`);
const message = (await request(`/flow-actions/${ACTION_ID}/flow-messages`)).data?.[0];
if (!message) throw new Error("No flow message found for Day 0");
const template = (await request(`/flow-messages/${message.id}/template`)).data;

if (!apply) {
  console.log(JSON.stringify({
    mode: "dry-run",
    actionId: ACTION_ID,
    messageName: action.data?.message?.name,
    status: action.data?.status,
    sender: action.data?.message?.from_email,
    tracking: action.data?.message?.add_tracking_params,
    templateId: template.id,
    hasAddress: /organization\.full_address/i.test(template.attributes.html ?? ""),
    hasUnsubscribe: /\{%\s*unsubscribe\s*%\}/i.test(template.attributes.html ?? ""),
  }, null, 2));
  process.exit(0);
}

const updated = footerOnly(template.attributes.html, template.attributes.text);
const newTemplate = await request("/templates", {
  method: "POST",
  headers: { "content-type": "application/vnd.api+json" },
  body: JSON.stringify({
    data: {
      type: "template",
      attributes: {
        name: `[LAUNCH FOOTER] ${template.attributes.name}`,
        editor_type: "CODE",
        html: updated.html,
        text: updated.text,
      },
    },
  }),
});

const replacement = structuredClone(action);
replacement.data.message.template_id = newTemplate.data.id;
await request(`/flow-actions/${ACTION_ID}`, {
  method: "PATCH",
  headers: { "content-type": "application/vnd.api+json" },
  body: JSON.stringify({
    data: { type: "flow-action", id: ACTION_ID, attributes: { definition: replacement } },
  }),
});

const verifyMessage = (await request(`/flow-actions/${ACTION_ID}/flow-messages`)).data?.[0];
const verifyTemplate = (await request(`/flow-messages/${verifyMessage.id}/template`)).data;
const verifyAction = (await request(`/flow-actions/${ACTION_ID}`)).data.attributes.definition;
console.log(JSON.stringify({
  mode: "applied",
  actionId: ACTION_ID,
  statusBefore: action.data?.status,
  statusAfter: verifyAction.data?.status,
  senderBefore: action.data?.message?.from_email,
  senderAfter: verifyAction.data?.message?.from_email,
  trackingBefore: action.data?.message?.add_tracking_params,
  trackingAfter: verifyAction.data?.message?.add_tracking_params,
  newTemplateId: verifyTemplate.id,
  addressInHtml: /organization\.full_address/i.test(verifyTemplate.attributes.html ?? ""),
  unsubscribeInHtml: /\{%\s*unsubscribe\s*%\}/i.test(verifyTemplate.attributes.html ?? ""),
}, null, 2));
