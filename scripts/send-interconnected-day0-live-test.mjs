const apiKey = process.env.KLAVIYO_PRIVATE_KEY;
const recipient = process.env.TEST_RECIPIENT;
if (!apiKey) throw new Error("KLAVIYO_PRIVATE_KEY is not available");
if (recipient !== "pedram@theurbanmonk.com") {
  throw new Error("Safety guard: TEST_RECIPIENT must be the owner-authorized inbox.");
}

const FLOW_ID = "YyFZPu";
const FLOW_NAME = "[DRAFT — VA REVIEW] Interconnected Free Screening - KO — Single-Link $67";
const DAY0_EMAIL_NAME = "Day 0 opt in EG sp26";
const FROM_EMAIL = "support@theurbanmonk.com";
const FROM_NAME = "Interconnected Series by The Urban Monk";

const headers = {
  Authorization: `Klaviyo-API-Key ${apiKey}`,
  Accept: "application/vnd.api+json",
  "Content-Type": "application/vnd.api+json",
  revision: "2026-07-15",
};

async function apiRequest(path, init = {}) {
  const response = await fetch(`https://a.klaviyo.com/api${path}`, {
    ...init,
    headers: { ...headers, ...(init.headers ?? {}) },
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`${response.status} ${text.slice(0, 1200)}`);
  return text ? JSON.parse(text) : {};
}

const flowPayload = await apiRequest(
  `/flows/${FLOW_ID}/?additional-fields%5Bflow%5D=definition`
);
const flow = flowPayload.data;
if (flow?.attributes?.name !== FLOW_NAME || flow?.attributes?.status !== "live") {
  throw new Error("Safety guard: expected the owner-enabled live review flow.");
}

const day0Action = (flow.attributes?.definition?.actions ?? []).find(
  (action) => action.type === "send-email" && action.data?.message?.name === DAY0_EMAIL_NAME
);
if (!day0Action?.data?.message?.id || day0Action.data?.status !== "live") {
  throw new Error("Safety guard: the first email is not currently Live.");
}

const embeddedTemplatePayload = await apiRequest(
  `/flow-messages/${day0Action.data.message.id}/template`
);
const embeddedTemplate = embeddedTemplatePayload.data;
const html = embeddedTemplate?.attributes?.html ?? "";
if (
  !html.includes("Redeem your one-time $67 offer") ||
  !html.includes("Host of the Interconnected Series") ||
  !html.includes("{% unsubscribe %}")
) {
  throw new Error("Safety guard: the currently live Day 0 email does not contain the approved reviewed HTML.");
}

const testTemplatePayload = await apiRequest("/templates", {
  method: "POST",
  body: JSON.stringify({
    data: {
      type: "template",
      attributes: {
        name: `[TEST ONLY] Live Interconnected Day 0 HTML — ${new Date().toISOString()}`,
        editor_type: "CODE",
        html,
        text: embeddedTemplate?.attributes?.text ?? "",
      },
    },
  }),
});
const testTemplateId = testTemplatePayload.data?.id;
if (!testTemplateId) throw new Error("Unable to create the temporary test template.");

const legacyBody = new URLSearchParams({
  from_email: FROM_EMAIL,
  from_name: FROM_NAME,
  subject: day0Action.data?.message?.subject_line || "You’re in — Interconnected starts tomorrow",
  to: JSON.stringify([{ email: recipient, name: "Dr. Pedram Shojai" }]),
  context: JSON.stringify({
    person: { first_name: "Pedram", email: recipient },
  }),
});
const sendResponse = await fetch(
  `https://a.klaviyo.com/api/v1/email-template/${encodeURIComponent(testTemplateId)}/send?api_key=${encodeURIComponent(apiKey)}`,
  {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: legacyBody.toString(),
  }
);
const sendText = await sendResponse.text();
if (!sendResponse.ok) {
  throw new Error(`Klaviyo test send failed: ${sendResponse.status} ${sendText.slice(0, 1200)}`);
}

let sendPayload = {};
try {
  sendPayload = sendText ? JSON.parse(sendText) : {};
} catch {
  sendPayload = { response: sendText.slice(0, 500) };
}

process.stdout.write(`${JSON.stringify({
  status: "queued_owner_authorized_live_day0_test",
  recipient,
  sender: `${FROM_NAME} <${FROM_EMAIL}>`,
  flowId: flow.id,
  actionId: day0Action.id,
  temporaryTestTemplateId: testTemplateId,
  testResponse: sendPayload,
  liveFlowChanged: false,
}, null, 2)}\n`);
