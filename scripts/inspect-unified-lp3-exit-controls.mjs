const apiKey = process.env.KLAVIYO_PRIVATE_KEY;
const flowId = "WaMDnA";

if (!apiKey) throw new Error("KLAVIYO_PRIVATE_KEY is not available");

const response = await fetch(
  `https://a.klaviyo.com/api/flows/${flowId}/?additional-fields%5Bflow%5D=definition`,
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
const definition = flow.attributes?.definition ?? {};
const actions = definition.actions ?? [];
const metricTerms = JSON.stringify(definition).match(/.{0,140}(purchase|placed order|order|kajabi).{0,180}/gi) ?? [];

process.stdout.write(`${JSON.stringify({
  id: flow.id,
  name: flow.attributes?.name,
  status: flow.attributes?.status,
  trigger: definition.triggers?.[0] ?? null,
  profileFilter: definition.profile_filter ?? null,
  purchaseOrOrderTerms: metricTerms.slice(0, 30),
  actionTypes: actions.reduce((counts, action) => {
    counts[action.type] = (counts[action.type] ?? 0) + 1;
    return counts;
  }, {}),
  conditionalSplitConditions: actions
    .filter(action => action.type === "conditional-split")
    .map(action => action.data?.condition ?? action.data?.conditions ?? action.data?.definition ?? null),
}, null, 2)}\n`);
