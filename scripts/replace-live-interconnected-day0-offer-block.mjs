const apiKey = process.env.KLAVIYO_PRIVATE_KEY;
if (!apiKey) throw new Error("KLAVIYO_PRIVATE_KEY is required");

const ACTION_ID = "114303072";
const EXPECTED_MESSAGE_NAME = "Day 0 opt in EG sp26";
const PRODUCT_URL = "https://shop.theurbanmonk.com/products/interconnected-the-complete-healing-protocol?utm_source=copyToPasteBoard&amp;utm_medium=product-links&amp;utm_content=web";
const OFFER_URL = "https://content.theurbanmonk.com/interconnected/offer?utm_source=klaviyo&amp;utm_medium=email&amp;utm_campaign=interconnected_14day&amp;utm_content=day0_67_offer_email";
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
const bodyDivStart = (html, marker) => {
  const markerIndex = html.indexOf(marker);
  if (markerIndex < 0) throw new Error(`Safety guard: expected marker not found: ${marker}`);
  const divIndex = html.lastIndexOf("<div", markerIndex);
  if (divIndex < 0) throw new Error(`Safety guard: no containing div found for marker: ${marker}`);
  return divIndex;
};

function contextualOfferBlock() {
  const row = (content = "") => `<div style="font-style:normal;text-align:left;letter-spacing:normal;text-transform:none;color:#000;font-family:Inter,sans-serif;font-size:14px">${content}</div>`;
  const paragraph = (content = "") => `<p style="display:block;margin:13px 0;margin-left:0;margin-right:0;margin-top:0;margin-bottom:0;padding-bottom:1em">${content}</p>`;
  return [
    row('<span style="font-weight:600">One optional choice before the series begins</span>'),
    row('<span style="font-weight:400"></span>'),
    row('<span style="font-weight:400">You are already registered for the free daily series. Beginning tomorrow, I will send one Interconnected episode each day, and each episode will be available during its viewing window.</span>'),
    row('<span style="font-weight:400"></span>'),
    row('<span style="font-weight:400">If you would rather keep the entire series and its companion resources available whenever you need them, I have made a Day 0 all-access invitation available.</span>'),
    row('<span style="font-weight:400"></span>'),
    row('<span style="font-weight:400">The <span style="font-weight:600">Interconnected All-Access Bundle</span> includes permanent, on-demand access to all nine episodes, the Companion Guide, the Gut Restoration Starter Protocol, private Healing Community access, and the “5 Root Causes” masterclass bonus.</span>'),
    row('<span style="font-weight:400"></span>'),
    row('<span style="font-weight:400">It is <span style="font-weight:600">$67, one payment, with no recurring charge.</span> It is completely optional; you can still participate in the free series as planned.</span>'),
    row('<span style="font-weight:400"></span>'),
    paragraph(`<span style="font-weight:600"><a href="${OFFER_URL}" style="color:#c12418;text-decoration:underline"><span>SEE WHAT IS INCLUDED IN THE $67 ALL-ACCESS BUNDLE →</span></a></span>`),
    row('<span style="font-weight:400"></span>'),
  ].join("\n");
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

if (template.attributes?.editor_type !== "CODE") throw new Error(`Safety guard: expected CODE template, found ${template.attributes?.editor_type ?? "unknown"}`);
if (count(html, PRODUCT_URL) !== 1 || count(html, OFFER_URL) !== 1) {
  throw new Error("Safety guard: expected one legacy product CTA and one existing contextual offer-page CTA");
}
if (html.includes("One optional choice before the series begins")) {
  throw new Error("Safety guard: contextual Day 0 offer copy is already present");
}

const offerStart = bodyDivStart(html, "There is one way around the 24-hour window:");
const postOfferStart = bodyDivStart(html, "Whether you upgrade or not, you're locked in for all 9 free episodes");
const psStart = bodyDivStart(html, "P.S. The all-access offer I mentioned above is only available for the next 2 hours.");
const supportStart = bodyDivStart(html, "P.P.S. Reply to this email and add ");
if (!(offerStart < postOfferStart && postOfferStart < psStart && psStart < supportStart)) {
  throw new Error("Safety guard: unexpected Day 0 offer-section ordering");
}

const htmlWithContext = `${html.slice(0, offerStart)}${contextualOfferBlock()}${html.slice(postOfferStart, psStart)}${html.slice(supportStart)}`;
const textWithContext = text.replaceAll(PRODUCT_URL, OFFER_URL);

const verification = {
  legacyProductLinks: count(htmlWithContext, PRODUCT_URL),
  contextualOfferLinks: count(htmlWithContext, OFFER_URL),
  oldUrgencyMentions: count(htmlWithContext, "next 2 hours"),
  oldGuaranteeMentions: count(htmlWithContext, "30-day money-back guarantee"),
  contextualHeadingMentions: count(htmlWithContext, "One optional choice before the series begins"),
};
if (
  verification.legacyProductLinks !== 0 ||
  verification.contextualOfferLinks !== 1 ||
  verification.oldUrgencyMentions !== 0 ||
  verification.oldGuaranteeMentions !== 0 ||
  verification.contextualHeadingMentions !== 1
) {
  throw new Error(`Safety guard: contextual replacement failed validation: ${JSON.stringify(verification)}`);
}

if (!apply) {
  console.log(JSON.stringify({
    mode: "dry-run",
    actionId: ACTION_ID,
    messageId: message.id,
    currentTemplateId: template.id,
    sender: definition.data?.message?.from_email,
    trackingEnabled: definition.data?.message?.add_tracking_params,
    verification,
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
        name: "[LIVE] Interconnected Day 0 — Contextual $67 Offer Email",
        editor_type: "CODE",
        html: htmlWithContext,
        text: textWithContext,
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
  count(verifyHtml, PRODUCT_URL) !== 0 ||
  count(verifyHtml, OFFER_URL) !== 1 ||
  !verifyHtml.includes("One optional choice before the series begins") ||
  verifyHtml.includes("30-day money-back guarantee") ||
  verifyHtml.includes("next 2 hours")
) {
  throw new Error("Post-update verification failed: the live Day 0 action or contextual offer block did not match the approved state");
}

console.log(JSON.stringify({
  mode: "applied",
  actionId: ACTION_ID,
  actionStatus: verifyAction.data?.status,
  messageId: verifyMessage.id,
  sender: verifyAction.data?.message?.from_email,
  trackingEnabled: verifyAction.data?.message?.add_tracking_params,
  replacementTemplateId: verifyTemplate.id,
  contextualOfferLinks: count(verifyHtml, OFFER_URL),
}, null, 2));
