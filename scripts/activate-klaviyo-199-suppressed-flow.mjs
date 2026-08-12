const apiKey = process.env.KLAVIYO_PRIVATE_KEY;
if (!apiKey) throw new Error("KLAVIYO_PRIVATE_KEY is not available");

const FLOW_ID = "ThkCXz";
const EXPECTED_NAME = "[READY] Interconnected $67 → $199 Member Offer — Klaviyo Treatment V2";

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
  if (!response.ok) throw new Error(`${response.status} ${text.slice(0, 1000)}`);
  return text ? JSON.parse(text) : {};
}

const before = await request(`/flows/${FLOW_ID}/?additional-fields%5Bflow%5D=definition`);
if (before.data?.attributes?.name !== EXPECTED_NAME) throw new Error("Refusing to activate an unexpected Klaviyo flow");
if (before.data?.attributes?.status !== "draft") throw new Error(`Refusing to activate flow with status ${before.data?.attributes?.status}`);

const actions = await request(`/flows/${FLOW_ID}/flow-actions?page%5Bsize%5D=50`);
const actionType = (action) => action.attributes?.action_type ?? action.attributes?.definition?.data?.type ?? action.attributes?.definition?.type;
const actionStatus = (action) => action.attributes?.status ?? action.attributes?.definition?.data?.status;
const emailActions = (actions.data ?? []).filter((action) => actionType(action) === "send-email");
if (emailActions.length !== 1) throw new Error(`Expected exactly one email action; found ${emailActions.length}`);
if (actionStatus(emailActions[0]) !== "draft") throw new Error(`Expected draft email action; found ${actionStatus(emailActions[0])}`);

const trigger = before.data?.attributes?.definition?.triggers?.[0];
const profileConditions = before.data?.attributes?.definition?.profile_filter?.condition_groups?.[0]?.conditions ?? [];
const has67Trigger = JSON.stringify(trigger ?? {}).includes("Interconnected: The Complete Healing Protocol");
const excludes199Buyer = JSON.stringify(profileConditions).includes("Gut Permeability Test + Health Coach Call — $199 Member Offer");
if (!has67Trigger || !excludes199Buyer) throw new Error("Refusing to activate flow with missing purchase safeguards");

const activation = await request(`/flows/${FLOW_ID}`, {
  method: "PATCH",
  body: JSON.stringify({
    data: {
      type: "flow",
      id: FLOW_ID,
      attributes: { status: "live" },
    },
  }),
});

const afterActions = await request(`/flows/${FLOW_ID}/flow-actions?page%5Bsize%5D=50`);
process.stdout.write(`${JSON.stringify({
  flowId: FLOW_ID,
  flowName: activation.data?.attributes?.name,
  flowStatus: activation.data?.attributes?.status,
  emailActions: (afterActions.data ?? []).map((action) => ({
    id: action.id,
    actionType: actionType(action),
    status: actionStatus(action),
  })),
  safeguards: { has67Trigger, excludes199Buyer, futureOrdersOnly: true },
}, null, 2)}\n`);
