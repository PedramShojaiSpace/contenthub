const apiKey = process.env.KLAVIYO_PRIVATE_KEY;
if (!apiKey) throw new Error("KLAVIYO_PRIVATE_KEY is required");

const ACTION_ID = "114303072";
const EXPECTED_MESSAGE_NAME = "Day 0 opt in EG sp26";
const GENERIC_OFFER_URL = "https://content.theurbanmonk.com/interconnected/offer?utm_source=klaviyo&amp;utm_medium=email&amp;utm_campaign=interconnected_14day&amp;utm_content=day0_67_offer_email";
const KO_OFFER_URL = "https://content.theurbanmonk.com/interconnected/offer-ko?utm_source=klaviyo&amp;utm_medium=email&amp;utm_campaign=interconnected_14day&amp;utm_content=day0_67_offer_email";
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
  const responseText = await response.text();
  const body = responseText ? JSON.parse(responseText) : {};
  if (!response.ok) throw new Error(`${options.method ?? "GET"} ${path} failed (${response.status}): ${responseText.slice(0, 1000)}`);
  return body;
}

const count = (value, needle) => value.split(needle).length - 1;
const replaceUrl = (value = "") => value.replaceAll(GENERIC_OFFER_URL, KO_OFFER_URL);

const actionResponse = await request(`/flow-actions/${ACTION_ID}`);
const definition = actionResponse.data?.attributes?.definition;
if (definition?.data?.status !== "live") throw new Error(`Safety guard: expected live Day 0 action, found ${definition?.data?.status ?? "unknown"}`);
if (definition?.data?.message?.name !== EXPECTED_MESSAGE_NAME) throw new Error("Safety guard: expected the live Interconnected Day 0 message");

const message = (await request(`/flow-actions/${ACTION_ID}/flow-messages`)).data?.[0];
if (!message) throw new Error("Safety guard: no flow message found for live Day 0");
const template = (await request(`/flow-messages/${message.id}/template`)).data;
const html = template.attributes?.html ?? "";
const text = template.attributes?.text ?? "";

if (template.attributes?.editor_type !== "CODE") throw new Error(`Safety guard: expected CODE template, found ${template.attributes?.editor_type ?? "unknown"}`);
if (count(html, GENERIC_OFFER_URL) !== 1 || count(html, KO_OFFER_URL) !== 0) {
  throw new Error("Safety guard: expected exactly one generic contextual CTA and no KO-route CTA");
}
if (!html.includes("One optional choice before the series begins")) {
  throw new Error("Safety guard: approved contextual offer copy is missing");
}

const updatedHtml = replaceUrl(html);
const updatedText = replaceUrl(text);
if (count(updatedHtml, GENERIC_OFFER_URL) !== 0 || count(updatedHtml, KO_OFFER_URL) !== 1) {
  throw new Error("Safety guard: CTA URL replacement did not produce exactly one KO route");
}

if (!apply) {
  console.log(JSON.stringify({
    mode: "dry-run",
    actionId: ACTION_ID,
    messageId: message.id,
    templateId: template.id,
    sender: definition.data?.message?.from_email,
    trackingEnabled: definition.data?.message?.add_tracking_params,
    genericOfferLinks: count(html, GENERIC_OFFER_URL),
    koOfferLinks: count(html, KO_OFFER_URL),
  }, null, 2));
  process.exit(0);
}

const newTemplate = await request("/templates", {
  method: "POST",
  headers: { "content-type": "application/vnd.api+json" },
  body: JSON.stringify({
    data: {
      type: "template",
      attributes: {
        name: "[LIVE] Interconnected Day 0 — KO/Shopify Contextual $67 Offer",
        editor_type: "CODE",
        html: updatedHtml,
        text: updatedText,
      },
    },
  }),
});

const replacementDefinition = structuredClone(definition);
replacementDefinition.data.message.template_id = newTemplate.data.id;
await request(`/flow-actions/${ACTION_ID}`, {
  method: "PATCH",
  headers: { "content-type": "application/vnd.api+json" },
  body: JSON.stringify({
    data: { type: "flow-action", id: ACTION_ID, attributes: { definition: replacementDefinition } },
  }),
});

const verifyAction = (await request(`/flow-actions/${ACTION_ID}`)).data?.attributes?.definition;
const verifyMessage = (await request(`/flow-actions/${ACTION_ID}/flow-messages`)).data?.[0];
const verifyTemplate = (await request(`/flow-messages/${verifyMessage.id}/template`)).data;
const verifyHtml = verifyTemplate.attributes?.html ?? "";
if (
  verifyAction?.data?.status !== "live" ||
  verifyAction?.data?.message?.name !== EXPECTED_MESSAGE_NAME ||
  count(verifyHtml, GENERIC_OFFER_URL) !== 0 ||
  count(verifyHtml, KO_OFFER_URL) !== 1 ||
  !verifyHtml.includes("One optional choice before the series begins")
) {
  throw new Error("Post-update verification failed: the live Day 0 action or KO CTA did not match the approved state");
}

console.log(JSON.stringify({
  mode: "applied",
  actionId: ACTION_ID,
  actionStatus: verifyAction.data?.status,
  messageId: verifyMessage.id,
  sender: verifyAction.data?.message?.from_email,
  trackingEnabled: verifyAction.data?.message?.add_tracking_params,
  replacementTemplateId: verifyTemplate.id,
  koOfferLinks: count(verifyHtml, KO_OFFER_URL),
}, null, 2));
