import { ENV } from "../server/_core/env";

const FLOW_ID = "YyFZPu";
const headers = {
  Authorization: `Klaviyo-API-Key ${ENV.klaviyoPrivateKey}`,
  "Content-Type": "application/json",
  revision: "2026-07-15",
};

async function api(path: string) {
  const response = await fetch(`https://a.klaviyo.com/api${path}`, { headers });
  const text = await response.text();
  let body: any;
  try { body = JSON.parse(text); } catch { body = {}; }
  return { ok: response.ok, status: response.status, body };
}

if (!ENV.klaviyoPrivateKey) throw new Error("Klaviyo API key unavailable");
const flow = await api(`/flows/${FLOW_ID}/?additional-fields%5Bflow%5D=definition`);
const actions = await api(`/flow-actions/?filter=${encodeURIComponent(`equals(flow_id,"${FLOW_ID}")`)}&page%5Bsize%5D=100`);
const definitionActions = flow.body?.data?.attributes?.definition?.actions ?? [];
const day0 = definitionActions.filter((action: any) => action.type === "send-email").slice(0, 3).map((action: any) => ({
  id: action.id,
  name: action.data?.message?.name ?? null,
  status: action.data?.status ?? null,
  delay: action.data?.delay ?? action.data?.timing ?? null,
  smartSending: action.data?.message?.smart_sending_enabled ?? null,
}));
console.log(JSON.stringify({
  flowId: FLOW_ID,
  flowOk: flow.ok,
  flowStatus: flow.body?.data?.attributes?.status ?? null,
  trigger: flow.body?.data?.attributes?.definition?.triggers ?? null,
  initialEmailActions: day0,
  flowActionsOk: actions.ok,
  actionCount: actions.body?.data?.length ?? 0,
  liveEmailActionCount: (actions.body?.data ?? []).filter((entry: any) => (entry.attributes?.action_type ?? entry.attributes?.type) === "SEND_EMAIL" && (entry.attributes?.status ?? "").toUpperCase() === "LIVE").length,
}, null, 2));
