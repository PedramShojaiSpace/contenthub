const META_API_VERSION = "v21.0";
const META_AD_ACCOUNT_ID = "1153114224705920";
const KAJABI_SITE_ID = "2148432935";
const TIME_RANGE = { since: "2026-09-01", until: "2026-09-02" };
const CURRENT_INTERCONNECTED_OFFERS = {
  "2151314475": { tier: "67", amountCents: 6700 },
  "2151333044": { tier: "199", amountCents: 19900 },
};

const metaAccessToken = process.env.META_AD_ACCESS_TOKEN;
const kajabiClientId = process.env.KAJABI_CLIENT_ID;
const kajabiClientSecret = process.env.KAJABI_CLIENT_SECRET;

if (!metaAccessToken || !kajabiClientId || !kajabiClientSecret) {
  throw new Error("Required Meta or Kajabi credentials are unavailable for this read-only report.");
}

function ctDate(value) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Chicago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(value));
}

function inWindow(value) {
  const day = ctDate(value);
  return day >= TIME_RANGE.since && day <= TIME_RANGE.until;
}

function actionValue(rows = [], actionType) {
  return Number(rows.find(row => row.action_type === actionType)?.value ?? 0);
}

function summarizeMeta(rows) {
  const totals = rows.reduce((acc, row) => ({
    spend: acc.spend + Number(row.spend ?? 0),
    impressions: acc.impressions + Number(row.impressions ?? 0),
    clicks: acc.clicks + Number(row.inline_link_clicks ?? 0),
    leads: acc.leads + actionValue(row.actions, "lead"),
    checkouts: acc.checkouts + actionValue(row.actions, "initiate_checkout"),
    purchases: acc.purchases + actionValue(row.actions, "purchase"),
    purchaseValue: acc.purchaseValue + actionValue(row.action_values, "purchase"),
  }), { spend: 0, impressions: 0, clicks: 0, leads: 0, checkouts: 0, purchases: 0, purchaseValue: 0 });

  return {
    ...totals,
    cpl: totals.leads ? totals.spend / totals.leads : null,
    metaRoas: totals.spend ? totals.purchaseValue / totals.spend : null,
  };
}

async function metaGet(path, params) {
  const url = new URL(`https://graph.facebook.com/${META_API_VERSION}/${path}`);
  url.searchParams.set("access_token", metaAccessToken);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, String(value));
  const response = await fetch(url, { signal: AbortSignal.timeout(30_000) });
  const payload = await response.json();
  if (!response.ok || payload.error) throw new Error(`Meta read failed (${response.status}).`);
  return payload;
}

const campaignPayload = await metaGet(`act_${META_AD_ACCOUNT_ID}/campaigns`, {
  fields: "id,name,effective_status,objective",
  limit: "250",
});

const agoraCampaigns = (campaignPayload.data ?? []).filter(campaign => {
  const name = String(campaign.name ?? "").toLowerCase();
  return name.includes("agora") && name.includes("interconnected");
});

const campaignRows = [];
for (const campaign of agoraCampaigns) {
  const payload = await metaGet(`${campaign.id}/insights`, {
    fields: "date_start,campaign_id,campaign_name,spend,impressions,inline_link_clicks,actions,action_values",
    time_range: JSON.stringify(TIME_RANGE),
    time_increment: "1",
    level: "campaign",
  });
  campaignRows.push(...(payload.data ?? []).map(row => ({ ...row, effectiveStatus: campaign.effective_status })));
}

const tokenResponse = await fetch("https://api.kajabi.com/v1/oauth/token", {
  method: "POST",
  headers: { "Content-Type": "application/x-www-form-urlencoded" },
  body: new URLSearchParams({
    grant_type: "client_credentials",
    client_id: kajabiClientId,
    client_secret: kajabiClientSecret,
  }),
});
const tokenPayload = await tokenResponse.json();
if (!tokenResponse.ok || !tokenPayload.access_token) throw new Error("Kajabi read-only authentication failed.");

const kajabiSummary = { allSuccessfulRevenue: 0, allSuccessfulOrders: 0, offer67Revenue: 0, offer67Orders: 0, offer199Revenue: 0, offer199Orders: 0 };
for (let page = 1; page <= 10; page += 1) {
  const response = await fetch(
    `https://api.kajabi.com/v1/transactions?filter[site_id]=${KAJABI_SITE_ID}&page[size]=100&page[number]=${page}`,
    { headers: { Authorization: `Bearer ${tokenPayload.access_token}`, Accept: "application/json" }, signal: AbortSignal.timeout(30_000) },
  );
  const payload = await response.json();
  if (!response.ok) throw new Error(`Kajabi transactions read failed (${response.status}).`);
  for (const item of payload.data ?? []) {
    const attributes = item.attributes ?? {};
    const amountCents = Number(attributes.amount_in_cents ?? 0);
    const state = String(attributes.state ?? "").toLowerCase();
    const action = String(attributes.action ?? "").toLowerCase();
    if (!inWindow(attributes.created_at) || state === "failed" || state === "refunded" || action === "refund") continue;
    const offerId = item.relationships?.offer?.data?.id ?? "";
    const offer = CURRENT_INTERCONNECTED_OFFERS[offerId];
    if (!offer || amountCents !== offer.amountCents) continue;
    kajabiSummary.allSuccessfulOrders += 1;
    kajabiSummary.allSuccessfulRevenue += amountCents / 100;
    if (offer.tier === "67") {
      kajabiSummary.offer67Orders += 1;
      kajabiSummary.offer67Revenue += 67;
    }
    if (offer.tier === "199") {
      kajabiSummary.offer199Orders += 1;
      kajabiSummary.offer199Revenue += 199;
    }
  }
  if (!payload.links?.next) break;
}

const daily = Object.entries(Object.groupBy(campaignRows, row => row.date_start))
  .sort(([left], [right]) => left.localeCompare(right))
  .map(([date, rows]) => ({ date, ...summarizeMeta(rows) }));

const meta = summarizeMeta(campaignRows);
console.log(JSON.stringify({
  readOnly: true,
  generatedAt: new Date().toISOString(),
  accountId: META_AD_ACCOUNT_ID,
  campaignSelection: "Campaign names containing both 'agora' and 'interconnected'",
  timeRangeCentral: TIME_RANGE,
  selectedCampaigns: agoraCampaigns.map(({ id, name, effective_status, objective }) => ({ id, name, effectiveStatus: effective_status, objective })),
  meta: { ...meta, daily },
  kajabi: {
    ...kajabiSummary,
    revenuePerMetaSpend: meta.spend ? kajabiSummary.allSuccessfulRevenue / meta.spend : null,
  },
  caveat: "Meta platform purchase value and first-party Kajabi successful transaction revenue are separate measurement systems and are not additive.",
}, null, 2));
