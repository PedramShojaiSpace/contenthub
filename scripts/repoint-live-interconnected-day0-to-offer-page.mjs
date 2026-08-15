const apiKey = process.env.KLAVIYO_PRIVATE_KEY;
if (!apiKey) throw new Error("KLAVIYO_PRIVATE_KEY is required");

const ACTION_ID = "114303072";
const EXPECTED_MESSAGE_NAME = "Day 0 opt in EG sp26";
const OLD_CHECKOUT_URL = "https://theacademy.theurbanmonk.com/offers/57E3XFtT/checkout";
const DAY0_OFFER_URL = "https://content.theurbanmonk.com/interconnected/offer?utm_source=klaviyo&amp;utm_medium=email&amp;utm_campaign=interconnected_14day&amp;utm_content=day0_67_offer_email";
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
  const text = await response.text();
  const body = text ? JSON.parse(text) : {};
  if (!response.ok) throw new Error(`${options.method ?? "GET"} ${path} failed (${response.status}): ${text.slice(0, 1000)}`);
  return body;
}

function countOccurrences(value, needle) {
  return value.split(needle).length - 1;
}

function replaceUrl(value = "") {
  return value.replaceAll(OLD_CHECKOUT_URL, DAY0_OFFER_URL);
}

const actionResponse = await request(`/flow-actions/${ACTION_ID}`);
const definition = actionResponse.data?.attributes?.definition;
if (definition?.data?.status !== "live") throw new Error(`Safety guard: expected live Day 0 action, found ${definition?.data?.status ?? "unknown"}`);
if (definition?.data?.message?.name !== EXPECTED_MESSAGE_NAME) throw new Error("Safety guard: expected the live Interconnected Day 0 message");

const message = (await request(`/flow-actions/${ACTION_ID}/flow-messages`)).data?.[0];
if (!message) throw new Error("Safety guard: no flow message found for live Day 0");
const template = (await request(`/flow-messages/${message.id}/template`)).data;
const html = template.attributes?.html ?? "";
const text = template.attributes?.text ?? "";
const htmlOldCount = countOccurrences(html, OLD_CHECKOUT_URL);
const htmlNewCount = countOccurrences(html, DAY0_OFFER_URL);

if (template.attributes?.editor_type !== "CODE") throw new Error(`Safety guard: expected CODE template, found ${template.attributes?.editor_type ?? "unknown"}`);
if (htmlOldCount !== 1 || htmlNewCount !== 0) throw new Error("Safety guard: expected one direct checkout URL and no existing Day 0 offer-page URL");

if (!apply) {
  console.log(JSON.stringify({
    mode: "dry-run",
    actionId: ACTION_ID,
    actionStatus: definition.data?.status,
    messageId: message.id,
    messageName: definition.data?.message?.name,
    embeddedTemplateId: template.id,
    htmlOldCheckoutReferences: htmlOldCount,
    htmlOfferPageReferences: htmlNewCount,
    textOldCheckoutReferences: countOccurrences(text, OLD_CHECKOUT_URL),
    sender: definition.data?.message?.from_email,
    trackingEnabled: definition.data?.message?.add_tracking_params,
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
        name: `[LIVE] Interconnected Day 0 — Contextual $67 Offer Page`,
        editor_type: "CODE",
        html: replaceUrl(html),
        text: replaceUrl(text),
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
  countOccurrences(verifyHtml, OLD_CHECKOUT_URL) !== 0 ||
  countOccurrences(verifyHtml, DAY0_OFFER_URL) !== 1
) {
  throw new Error("Post-update verification failed: the Day 0 action or CTA replacement did not match the approved state");
}

console.log(JSON.stringify({
  mode: "applied",
  actionId: ACTION_ID,
  actionStatus: verifyAction.data?.status,
  messageId: verifyMessage.id,
  sender: verifyAction.data?.message?.from_email,
  trackingEnabled: verifyAction.data?.message?.add_tracking_params,
  replacementTemplateId: verifyTemplate.id,
  oldCheckoutReferencesRemaining: countOccurrences(verifyHtml, OLD_CHECKOUT_URL),
  offerPageReferences: countOccurrences(verifyHtml, DAY0_OFFER_URL),
}, null, 2));
