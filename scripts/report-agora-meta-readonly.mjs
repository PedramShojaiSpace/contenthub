import fs from "node:fs/promises";

const API_VERSION = "v21.0";
const GRAPH_BASE = `https://graph.facebook.com/${API_VERSION}`;
const AD_ACCOUNT_ID = "1153114224705920";
const TIME_RANGE = { since: "2026-08-01", until: "2026-08-30" };
const OUTPUT_PATH = "/tmp/agora-interconnected-meta-2026-08-01-to-2026-08-30.json";

if (!process.env.META_AD_ACCESS_TOKEN) {
  throw new Error("META_AD_ACCESS_TOKEN is required for this read-only report.");
}

function isAgoraInterconnectedCampaign(name = "") {
  const normalized = name.toLowerCase();
  return normalized.includes("agora") && normalized.includes("interconnected");
}

async function graphGet(endpoint, params = {}) {
  const url = new URL(`${GRAPH_BASE}/${endpoint}`);
  url.searchParams.set("access_token", process.env.META_AD_ACCESS_TOKEN);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, String(value));
  }

  const response = await fetch(url, { signal: AbortSignal.timeout(30_000) });
  const payload = await response.json();
  if (!response.ok || payload.error) {
    throw new Error(`Meta read-only GET failed (${response.status}): ${payload.error?.message ?? "unknown error"}`);
  }
  return payload;
}

async function getAllCampaigns() {
  const campaigns = [];
  let next = new URL(`${GRAPH_BASE}/act_${AD_ACCOUNT_ID}/campaigns`);
  next.searchParams.set("fields", "id,name,effective_status,objective,created_time,updated_time");
  next.searchParams.set("limit", "250");
  next.searchParams.set("access_token", process.env.META_AD_ACCESS_TOKEN);

  while (next) {
    const response = await fetch(next, { signal: AbortSignal.timeout(30_000) });
    const payload = await response.json();
    if (!response.ok || payload.error) {
      throw new Error(`Meta campaign read failed (${response.status}): ${payload.error?.message ?? "unknown error"}`);
    }
    campaigns.push(...(payload.data ?? []));
    next = payload.paging?.next ? new URL(payload.paging.next) : null;
  }
  return campaigns;
}

function getActionValue(actions = [], actionType) {
  const exact = actions.find(action => action.action_type === actionType)?.value;
  return Number(exact ?? 0);
}

function summarize(rows) {
  const totals = rows.reduce((result, row) => {
    result.spend += Number(row.spend ?? 0);
    result.impressions += Number(row.impressions ?? 0);
    result.clicks += Number(row.clicks ?? 0);
    result.inlineLinkClicks += Number(row.inline_link_clicks ?? 0);
    result.leads += getActionValue(row.actions, "lead");
    result.checkouts += getActionValue(row.actions, "initiate_checkout");
    result.purchases += getActionValue(row.actions, "purchase");
    result.purchaseValue += getActionValue(row.action_values, "purchase");
    return result;
  }, { spend: 0, impressions: 0, clicks: 0, inlineLinkClicks: 0, leads: 0, checkouts: 0, purchases: 0, purchaseValue: 0 });

  return {
    ...totals,
    roas: totals.spend > 0 ? totals.purchaseValue / totals.spend : null,
    cpl: totals.leads > 0 ? totals.spend / totals.leads : null,
    costPerPurchase: totals.purchases > 0 ? totals.spend / totals.purchases : null,
    ctr: totals.impressions > 0 ? (totals.inlineLinkClicks / totals.impressions) * 100 : null,
    checkoutRate: totals.leads > 0 ? totals.checkouts / totals.leads : null,
    purchaseRate: totals.leads > 0 ? totals.purchases / totals.leads : null,
  };
}

async function mapWithConcurrency(items, maxConcurrent, fn) {
  const results = [];
  const pending = new Set();
  for (const item of items) {
    const task = Promise.resolve().then(() => fn(item));
    results.push(task);
    pending.add(task);
    task.finally(() => pending.delete(task));
    if (pending.size >= maxConcurrent) await Promise.race(pending);
  }
  return Promise.all(results);
}

const allCampaigns = await getAllCampaigns();
const selectedCampaigns = allCampaigns.filter(campaign => isAgoraInterconnectedCampaign(campaign.name));

const campaignReports = await mapWithConcurrency(selectedCampaigns, 4, async campaign => {
  const aggregate = await graphGet(`${campaign.id}/insights`, {
    fields: "campaign_id,campaign_name,spend,impressions,clicks,inline_link_clicks,actions,action_values",
    time_range: JSON.stringify(TIME_RANGE),
    level: "campaign",
  });
  const daily = await graphGet(`${campaign.id}/insights`, {
    fields: "campaign_id,campaign_name,spend,impressions,clicks,inline_link_clicks,actions,action_values,date_start,date_stop",
    time_range: JSON.stringify(TIME_RANGE),
    time_increment: "1",
    level: "campaign",
  });
  return { campaign, aggregate: aggregate.data?.[0] ?? null, daily: daily.data ?? [] };
});

const aggregateRows = campaignReports.flatMap(report => report.aggregate ? [report.aggregate] : []);
const dailyRows = campaignReports.flatMap(report => report.daily);
const dailyByDate = new Map();
for (const row of dailyRows) {
  const date = row.date_start;
  const bucket = dailyByDate.get(date) ?? [];
  bucket.push(row);
  dailyByDate.set(date, bucket);
}

const daily = [...dailyByDate.entries()]
  .sort(([left], [right]) => left.localeCompare(right))
  .map(([date, rows]) => ({ date, ...summarize(rows) }));

const report = {
  reportGeneratedAt: new Date().toISOString(),
  readOnly: true,
  noMetaMutationOccurred: true,
  accountId: AD_ACCOUNT_ID,
  timeRange: TIME_RANGE,
  campaignSelectionRule: "Campaign name contains both 'agora' and 'interconnected' (case-insensitive).",
  selectedCampaignCount: selectedCampaigns.length,
  selectedCampaigns: selectedCampaigns.map(({ id, name, effective_status, objective, created_time, updated_time }) => ({ id, name, effective_status, objective, created_time, updated_time })),
  total: summarize(aggregateRows),
  daily,
  campaignTotals: campaignReports.map(({ campaign, aggregate }) => ({
    id: campaign.id,
    name: campaign.name,
    effectiveStatus: campaign.effective_status,
    objective: campaign.objective,
    total: summarize(aggregate ? [aggregate] : []),
  })),
};

await fs.writeFile(OUTPUT_PATH, `${JSON.stringify(report, null, 2)}\n`, { mode: 0o600 });
console.log(JSON.stringify({
  status: "complete",
  accountId: AD_ACCOUNT_ID,
  selectedCampaignCount: report.selectedCampaignCount,
  timeRange: TIME_RANGE,
  outputPath: OUTPUT_PATH,
  total: report.total,
  dailyDateCount: daily.length,
  noMetaMutationOccurred: true,
}));
