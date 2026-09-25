const apiKey = process.env.KLAVIYO_PRIVATE_KEY;
const unifiedFlowId = "WaMDnA";
const legacyFlowIds = ["YyFZPu", "TvXwNj"];
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

async function getFlow(flowId) {
  return (await request(`/flows/${encodeURIComponent(flowId)}/?additional-fields%5Bflow%5D=definition`)).data;
}

async function setStatus(flowId, status) {
  return request(`/flows/${encodeURIComponent(flowId)}/`, {
    method: "PATCH",
    body: JSON.stringify({
      data: { type: "flow", id: flowId, attributes: { status } },
    }),
  });
}

async function setActionStatus(action, status) {
  const definition = structuredClone(action);
  definition.data.status = status;
  return request(`/flow-actions/${encodeURIComponent(action.id)}/`, {
    method: "PATCH",
    body: JSON.stringify({
      data: {
        type: "flow-action",
        id: action.id,
        attributes: { definition },
      },
    }),
  });
}

function sleep(milliseconds) {
  return new Promise(resolve => setTimeout(resolve, milliseconds));
}

function summarize(flow) {
  const actions = flow.attributes?.definition?.actions ?? [];
  const messages = actions.filter(action => action.type === "send-email" || action.type === "send-sms");
  return {
    id: flow.id,
    name: flow.attributes?.name,
    status: flow.attributes?.status,
    emailMessages: messages.filter(action => action.type === "send-email").length,
    smsMessages: messages.filter(action => action.type === "send-sms").length,
    messageStatusCounts: messages.reduce((counts, action) => {
      const status = action.data?.status ?? "null";
      counts[status] = (counts[status] ?? 0) + 1;
      return counts;
    }, {}),
  };
}

const [unified, ...legacy] = await Promise.all([getFlow(unifiedFlowId), ...legacyFlowIds.map(getFlow)]);
const unifiedSummary = summarize(unified);
const legacySummaries = legacy.map(summarize);
const trigger = unified.attributes?.definition?.triggers?.[0];
const messages = (unified.attributes?.definition?.actions ?? []).filter(
  action => action.type === "send-email" || action.type === "send-sms"
);
const buyerFilter = JSON.stringify({
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

if (unified.attributes?.status !== "draft") throw new Error(`Unified flow must be draft immediately before cutover; found ${unified.attributes?.status}`);
if (legacy.some(flow => flow.attributes?.status !== "live")) throw new Error(`Both legacy flows must be live immediately before cutover; found ${legacy.map(flow => `${flow.id}:${flow.attributes?.status}`).join(", ")}`);
if (messages.length !== 22 || messages.some(action => action.data?.status !== "draft")) throw new Error("Unified flow must contain exactly 22 draft message actions before cutover");
if (messages.some(action => JSON.stringify(action.data?.message?.additional_filters ?? null) !== buyerFilter)) throw new Error("Every unified message must have the buyer suppression filter before cutover");
if (trigger?.id !== "Tm5ejE") throw new Error("Unified flow trigger must remain the restricted LP-3 list-add metric");

const summary = {
  mode: apply ? "apply" : "dry-run",
  unifiedBefore: unifiedSummary,
  legacyBefore: legacySummaries,
  cutoverOrder: [
    "Set former email flow YyFZPu to draft",
    "Set former SMS flow TvXwNj to draft",
    "Set unified flow WaMDnA to live",
    "Set the 22 unified email/SMS actions to live",
  ],
  rollback: "If unified activation fails, return changed unified actions and the unified flow to draft, then restore changed legacy flows to live before reporting failure.",
  final: null,
};

if (apply) {
  const changedLegacy = [];
  const activatedActions = [];
  let unifiedFlowLive = false;
  try {
    for (const flow of legacy) {
      await setStatus(flow.id, "draft");
      changedLegacy.push(flow.id);
    }
    await setStatus(unifiedFlowId, "live");
    unifiedFlowLive = true;
    for (const action of messages) {
      await setActionStatus(action, "live");
      activatedActions.push(action);
      // Klaviyo's documented burst limit is 3 write requests per second.
      await sleep(350);
    }
  } catch (error) {
    await Promise.allSettled(activatedActions.map(action => setActionStatus(action, "draft")));
    if (unifiedFlowLive) await Promise.allSettled([setStatus(unifiedFlowId, "draft")]);
    await Promise.allSettled(changedLegacy.map(flowId => setStatus(flowId, "live")));
    throw error;
  }

  const [unifiedAfter, ...legacyAfter] = await Promise.all([getFlow(unifiedFlowId), ...legacyFlowIds.map(getFlow)]);
  const unifiedAfterSummary = summarize(unifiedAfter);
  const legacyAfterSummaries = legacyAfter.map(summarize);
  if (unifiedAfterSummary.status !== "live" || unifiedAfterSummary.messageStatusCounts.live !== 22) {
    throw new Error(`Unified post-cutover readback failed: ${JSON.stringify(unifiedAfterSummary)}`);
  }
  if (legacyAfterSummaries.some(flow => flow.status !== "draft")) {
    throw new Error(`Legacy post-cutover readback failed: ${JSON.stringify(legacyAfterSummaries)}`);
  }
  summary.final = { unified: unifiedAfterSummary, legacy: legacyAfterSummaries };
}

process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
