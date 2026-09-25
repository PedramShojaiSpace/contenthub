const apiKey = process.env.KLAVIYO_PRIVATE_KEY;
const flowId = "WaMDnA";
const apply = process.argv.includes("--apply");

if (!apiKey) throw new Error("KLAVIYO_PRIVATE_KEY is not available");

const headers = {
  Authorization: `Klaviyo-API-Key ${apiKey}`,
  Accept: "application/vnd.api+json",
  "Content-Type": "application/vnd.api+json",
  revision: "2026-07-15",
};

async function request(path, init = {}) {
  const response = await fetch(`https://a.klaviyo.com/api${path}`, { headers, ...init });
  const text = await response.text();
  if (!response.ok) throw new Error(`${response.status} ${text.slice(0, 1000)}`);
  return text ? JSON.parse(text) : {};
}

const flowResponse = await request(`/flows/${flowId}/?additional-fields%5Bflow%5D=definition`);
const flow = flowResponse.data;
if (flow.attributes?.status !== "draft") {
  throw new Error(`Refusing to modify non-draft flow ${flowId}: ${flow.attributes?.status}`);
}

const messages = (flow.attributes?.definition?.actions ?? []).filter(
  action => action.type === "send-email" || action.type === "send-sms"
);
if (messages.length !== 22) {
  throw new Error(`Expected exactly 22 message actions, found ${messages.length}`);
}
if (messages.some(action => action.data?.status !== "draft")) {
  throw new Error("Refusing to modify: all unified message actions must remain draft before activation");
}
if (messages.some(action => action.data?.message?.additional_filters !== null)) {
  throw new Error("Refusing to overwrite existing message filters");
}

const buyerSuppression = {
  condition_groups: [
    {
      conditions: [
        {
          type: "profile-property",
          property: "properties['interconnected_kajabi_buyer']",
          filter: { type: "existence", operator: "not-set" },
        },
      ],
    },
  ],
};

const summary = {
  flowId,
  flowStatus: flow.attributes?.status,
  messageCount: messages.length,
  emailCount: messages.filter(action => action.type === "send-email").length,
  smsCount: messages.filter(action => action.type === "send-sms").length,
  applied: false,
  updatedActionIds: [],
};

if (apply) {
  for (const action of messages) {
    const definition = structuredClone(action);
    definition.data.message.additional_filters = buyerSuppression;
    await request(`/flow-actions/${encodeURIComponent(action.id)}/`, {
      method: "PATCH",
      body: JSON.stringify({
        data: {
          type: "flow-action",
          id: action.id,
          attributes: { definition },
        },
      }),
    });
    summary.updatedActionIds.push(action.id);
  }
  summary.applied = true;
}

process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
