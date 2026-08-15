const apiKey = process.env.KLAVIYO_PRIVATE_KEY;
if (!apiKey) throw new Error("KLAVIYO_PRIVATE_KEY is not available");

const FLOW_ID = "VMpbLV";
const EXPECTED_FLOW_NAME = "[EG] Interconnected Free Screening - KO";
const DAY0_ACTION_ID = "114303072";
const TEMPLATE_ID = "XASdst";
const OLD_CHECKOUT_URL = "https://theacademy.theurbanmonk.com/offers/57E3XFtT/checkout";
const DAY0_OFFER_URL = "https://content.theurbanmonk.com/interconnected/offer?utm_source=klaviyo&amp;utm_medium=email&amp;utm_campaign=interconnected_14day&amp;utm_content=day0_67_offer_email";

const headers = {
  Authorization: `Klaviyo-API-Key ${apiKey}`,
  Accept: "application/vnd.api+json",
  revision: "2026-07-15",
};

async function request(path, init = {}) {
  const response = await fetch(`https://a.klaviyo.com/api${path}`, {
    ...init,
    headers: {
      ...headers,
      ...(init.headers ?? {}),
    },
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`${response.status} ${text.slice(0, 1000)}`);
  return text ? JSON.parse(text) : {};
}

function countOccurrences(value, needle) {
  return value.split(needle).length - 1;
}

const flow = await request(`/flows/${FLOW_ID}/?additional-fields%5Bflow%5D=definition`);
if (flow.data?.attributes?.name !== EXPECTED_FLOW_NAME || flow.data?.attributes?.status !== "live") {
  throw new Error("Safety guard: expected the live Interconnected Day 0 flow");
}

const action = (flow.data?.attributes?.definition?.actions ?? []).find(
  (item) => item.id === DAY0_ACTION_ID
);
const message = action?.data?.message ?? action?.data?.main_action?.data?.message;
if (action?.type !== "send-email" || action?.data?.status !== "live" || message?.template_id !== TEMPLATE_ID) {
  throw new Error("Safety guard: the expected live Day 0 action/template relationship changed");
}

const before = await request(`/templates/${TEMPLATE_ID}/`);
const beforeAttributes = before.data?.attributes ?? {};
const beforeHtml = beforeAttributes.html ?? "";
if (beforeAttributes.editor_type !== "CODE") {
  throw new Error(`Safety guard: expected a CODE template, received ${beforeAttributes.editor_type}`);
}
if (countOccurrences(beforeHtml, OLD_CHECKOUT_URL) !== 1 || beforeHtml.includes(DAY0_OFFER_URL)) {
  throw new Error("Safety guard: the expected direct-checkout link state is not present exactly once");
}

const updatedHtml = beforeHtml.replace(OLD_CHECKOUT_URL, DAY0_OFFER_URL);
await request(`/templates/${TEMPLATE_ID}`, {
  method: "PATCH",
  headers: { "Content-Type": "application/vnd.api+json" },
  body: JSON.stringify({
    data: {
      type: "template",
      id: TEMPLATE_ID,
      attributes: { html: updatedHtml },
    },
  }),
});

const after = await request(`/templates/${TEMPLATE_ID}/`);
const afterHtml = after.data?.attributes?.html ?? "";
if (afterHtml.includes(OLD_CHECKOUT_URL) || countOccurrences(afterHtml, DAY0_OFFER_URL) !== 1) {
  throw new Error("Post-update verification failed: the Day 0 offer link was not applied exactly once");
}

process.stdout.write(JSON.stringify({
  flowId: FLOW_ID,
  flowStatus: flow.data?.attributes?.status,
  day0ActionId: action.id,
  day0ActionStatus: action.data?.status,
  templateId: TEMPLATE_ID,
  templateEditor: after.data?.attributes?.editor_type,
  replacedUrl: OLD_CHECKOUT_URL,
  offerPageUrl: DAY0_OFFER_URL,
  oldCheckoutReferencesRemaining: countOccurrences(afterHtml, OLD_CHECKOUT_URL),
  offerPageReferences: countOccurrences(afterHtml, DAY0_OFFER_URL),
}, null, 2));
