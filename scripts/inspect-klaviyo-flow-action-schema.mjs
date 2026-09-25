const apiKey = process.env.KLAVIYO_PRIVATE_KEY;
const actionId = process.argv[2];
if (!apiKey || !actionId) throw new Error("Usage: node inspect-klaviyo-flow-action-schema.mjs <action-id>");

const response = await fetch(`https://a.klaviyo.com/api/flow-actions/${encodeURIComponent(actionId)}/`, {
  headers: {
    Authorization: `Klaviyo-API-Key ${apiKey}`,
    Accept: "application/vnd.api+json",
    revision: "2026-07-15",
  },
});
const text = await response.text();
if (!response.ok) throw new Error(`${response.status} ${text.slice(0, 1000)}`);
const action = JSON.parse(text).data;
process.stdout.write(`${JSON.stringify({
  id: action.id,
  actionType: action.attributes?.action_type,
  status: action.attributes?.status,
  definition: action.attributes?.definition,
}, null, 2)}\n`);
