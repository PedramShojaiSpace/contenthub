const apiKey = process.env.KLAVIYO_PRIVATE_KEY;
if (!apiKey) throw new Error("KLAVIYO_PRIVATE_KEY is not available");

const FLOW_ID = "VMpbLV";
const EXPECTED_NAME = "[EG] Interconnected Free Screening - KO";

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

const payload = await request(
  `/flows/${FLOW_ID}/?additional-fields%5Bflow%5D=definition`
);
const flow = payload.data;
if (flow?.attributes?.name !== EXPECTED_NAME || flow?.attributes?.status !== "live") {
  throw new Error(
    `Safety guard: expected live flow "${EXPECTED_NAME}", found "${flow?.attributes?.name}" (${flow?.attributes?.status}).`
  );
}

const actions = flow.attributes.definition?.actions ?? [];
const summary = actions.map((action, index) => {
  const message = action.data?.message ?? action.data?.main_action?.data?.message ?? {};
  return {
    position: index + 1,
    actionId: action.id,
    actionType: action.type,
    actionStatus: action.data?.status ?? action.data?.main_action?.data?.status ?? null,
    messageId: message.id ?? null,
    messageName: message.name ?? null,
    templateId: message.template_id ?? null,
    subjectLine: message.subject_line ?? null,
    previewText: message.preview_text ?? null,
  };
});

process.stdout.write(
  `${JSON.stringify(
    {
      flow: {
        id: flow.id,
        name: flow.attributes?.name,
        status: flow.attributes?.status,
        trigger: flow.attributes?.definition?.triggers?.[0] ?? null,
      },
      actionCount: summary.length,
      emailActions: summary.filter((action) => action.actionType === "send-email"),
      smsActions: summary.filter((action) => action.actionType === "send-sms"),
    },
    null,
    2
  )}\n`
);
