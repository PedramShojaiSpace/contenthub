const apiKey = process.env.KLAVIYO_PRIVATE_KEY;
const flowId = "WaMDnA";
if (!apiKey) throw new Error("KLAVIYO_PRIVATE_KEY is not available");

async function request(path) {
  const response = await fetch(`https://a.klaviyo.com/api${path}`, {
    headers: {
      Authorization: `Klaviyo-API-Key ${apiKey}`,
      Accept: "application/vnd.api+json",
      revision: "2026-07-15",
    },
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`${response.status} ${text.slice(0, 1000)}`);
  return JSON.parse(text);
}

const flowResponse = await request(`/flows/${flowId}/?additional-fields%5Bflow%5D=definition`);
const flow = flowResponse.data;
const messages = (flow.attributes?.definition?.actions ?? []).filter(
  action => action.type === "send-email" || action.type === "send-sms"
);
const expected = JSON.stringify({
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
});
const checks = [];
for (const action of messages) {
  const actionResponse = await request(`/flow-actions/${encodeURIComponent(action.id)}/`);
  const definition = actionResponse.data?.attributes?.definition ?? {};
  checks.push({
    actionId: action.id,
    type: action.type,
    status: definition.data?.status ?? null,
    filterMatches: JSON.stringify(definition.data?.message?.additional_filters ?? null) === expected,
  });
}
const summary = {
  flowId: flow.id,
  flowStatus: flow.attributes?.status,
  messageCount: checks.length,
  draftMessages: checks.filter(check => check.status === "draft").length,
  emailMessages: checks.filter(check => check.type === "send-email").length,
  smsMessages: checks.filter(check => check.type === "send-sms").length,
  buyerSuppressedMessages: checks.filter(check => check.filterMatches).length,
  allBuyerSuppressed: checks.every(check => check.filterMatches),
};
if (!summary.allBuyerSuppressed || summary.draftMessages !== 22) {
  throw new Error(`Unexpected buyer suppression readback: ${JSON.stringify(summary)}`);
}
process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
