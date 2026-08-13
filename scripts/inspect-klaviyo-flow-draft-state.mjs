const apiKey = process.env.KLAVIYO_PRIVATE_KEY;
const flowId = process.argv[2];
if (!apiKey) throw new Error("KLAVIYO_PRIVATE_KEY is not available");
if (!flowId) throw new Error("Usage: node inspect-klaviyo-flow-draft-state.mjs <flow-id>");

const response = await fetch(
  `https://a.klaviyo.com/api/flows/${encodeURIComponent(flowId)}/?additional-fields%5Bflow%5D=definition`,
  {
    headers: {
      Authorization: `Klaviyo-API-Key ${apiKey}`,
      Accept: "application/vnd.api+json",
      revision: "2026-07-15",
    },
  }
);
const text = await response.text();
if (!response.ok) throw new Error(`${response.status} ${text.slice(0, 1000)}`);

const flow = JSON.parse(text).data;
const actions = flow.attributes?.definition?.actions ?? [];
const messages = actions
  .filter((action) => action.type === "send-email" || action.type === "send-sms")
  .map((action) => ({
    actionId: action.id,
    type: action.type,
    status: action.data?.status ?? null,
    messageId: action.data?.message?.id ?? null,
    messageName: action.data?.message?.name ?? null,
    templateId: action.data?.message?.template_id ?? null,
  }));

process.stdout.write(
  `${JSON.stringify(
    {
      flowId: flow.id,
      flowName: flow.attributes?.name,
      flowStatus: flow.attributes?.status,
      actionCount: actions.length,
      messageCount: messages.length,
      messageStatusCounts: messages.reduce((counts, message) => {
        counts[message.status ?? "null"] = (counts[message.status ?? "null"] ?? 0) + 1;
        return counts;
      }, {}),
      day0Candidates: messages.filter((message) => message.messageName === "Day 0 opt in EG sp26"),
      day0Matches: messages.filter((message) => message.templateId === "Smbiqi"),
      nonDraftMessages: messages.filter((message) => message.status !== "draft"),
    },
    null,
    2
  )}\n`
);
