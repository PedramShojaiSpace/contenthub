const apiKey = process.env.KLAVIYO_PRIVATE_KEY;
if (!apiKey) throw new Error("KLAVIYO_PRIVATE_KEY is not available");

const DRAFT_FLOW_ID = "YyFZPu";
const DRAFT_FLOW_NAME = "[DRAFT — VA REVIEW] Interconnected Free Screening - KO — Single-Link $67";
const DAY0_MESSAGE_NAME = "Day 0 opt in EG sp26";
const APPROVED_DAY0_DRAFT_TEMPLATE_ID = "Smbiqi";

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

async function hasApprovedDay0Content(templateId) {
  if (!templateId) return false;
  const template = await request(`/templates/${templateId}/`);
  const html = template.data?.attributes?.html ?? "";
  return (
    html.includes("day0_one_time_67_offer") &&
    html.includes("Redeem your one-time $67 offer") &&
    html.includes("This is the only time this price is available.")
  );
}

const before = await request(
  `/flows/${DRAFT_FLOW_ID}/?additional-fields%5Bflow%5D=definition`
);
const draftFlow = before.data;
if (
  draftFlow?.attributes?.name !== DRAFT_FLOW_NAME ||
  draftFlow?.attributes?.status !== "draft"
) {
  throw new Error(
    `Safety guard: expected draft review flow "${DRAFT_FLOW_NAME}", found "${draftFlow?.attributes?.name}" (${draftFlow?.attributes?.status}).`
  );
}

const day0Action = (draftFlow.attributes?.definition?.actions ?? []).find(
  (action) =>
    action.type === "send-email" &&
    action.data?.message?.name === DAY0_MESSAGE_NAME
);
if (!day0Action?.id || day0Action.data?.status !== "draft") {
  throw new Error("Safety guard: could not find the draft Day 0 email action.");
}

const day0AlreadyUsesApprovedContent = await hasApprovedDay0Content(
  day0Action.data.message.template_id
);

if (!day0AlreadyUsesApprovedContent) {
  const updatedDefinition = structuredClone(day0Action);
  updatedDefinition.data.status = "draft";
  updatedDefinition.data.message.template_id = APPROVED_DAY0_DRAFT_TEMPLATE_ID;

  await request(`/flow-actions/${day0Action.id}`, {
    method: "PATCH",
    body: JSON.stringify({
      data: {
        type: "flow-action",
        id: day0Action.id,
        attributes: { definition: updatedDefinition },
      },
    }),
  });
}

const after = await request(
  `/flows/${DRAFT_FLOW_ID}/?additional-fields%5Bflow%5D=definition`
);
const updatedDay0Action = (after.data?.attributes?.definition?.actions ?? []).find(
  (action) =>
    action.type === "send-email" &&
    action.data?.message?.name === DAY0_MESSAGE_NAME
);
const approvedContentApplied = await hasApprovedDay0Content(
  updatedDay0Action?.data?.message?.template_id
);

if (
  after.data?.attributes?.status !== "draft" ||
  updatedDay0Action?.data?.status !== "draft" ||
  !approvedContentApplied
) {
  throw new Error("Safety guard: approved Day 0 draft template was not applied to the review flow.");
}

process.stdout.write(
  `${JSON.stringify(
    {
      status: "verified_draft_day0_template",
      flowId: after.data?.id,
      flowName: after.data?.attributes?.name,
      flowStatus: after.data?.attributes?.status,
      day0ActionId: updatedDay0Action.id,
      day0ActionStatus: updatedDay0Action.data?.status,
      day0FlowMessageTemplateId: updatedDay0Action.data?.message?.template_id,
      day0TemplateContentApproved: approvedContentApplied,
      liveFlowChanged: false,
    },
    null,
    2
  )}\n`
);
