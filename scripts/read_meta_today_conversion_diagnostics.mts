import { getMetaAdsConfig } from "../server/metaAdsClient";

const config = getMetaAdsConfig();
const actId = `act_${config.adAccountId}`;
const datePreset = process.env.DATE_PRESET ?? "today";
const fields = [
  "campaign_id",
  "campaign_name",
  "spend",
  "impressions",
  "clicks",
  "actions",
  "action_values",
  "cost_per_action_type",
  "website_purchase_roas",
  "purchase_roas",
  "date_start",
  "date_stop",
].join(",");

const conversionType = /(lead|purchase|offsite_conversion|omni|website)/i;

type Action = { action_type?: string; value?: string };
type Insight = {
  campaign_id?: string;
  campaign_name?: string;
  spend?: string;
  impressions?: string;
  clicks?: string;
  actions?: Action[];
  action_values?: Action[];
  cost_per_action_type?: Action[];
  website_purchase_roas?: Array<{ action_type?: string; value?: string }>;
  purchase_roas?: Array<{ action_type?: string; value?: string }>;
  date_start?: string;
  date_stop?: string;
};

function relevant(items?: Action[]) {
  return (items ?? [])
    .filter((item) => conversionType.test(item.action_type ?? ""))
    .map((item) => ({ actionType: item.action_type ?? "", value: Number(item.value ?? 0) }));
}

async function main() {
  const url = new URL(`https://graph.facebook.com/v21.0/${actId}/insights`);
  url.searchParams.set("access_token", config.accessToken);
  url.searchParams.set("fields", fields);
  url.searchParams.set("date_preset", datePreset);
  url.searchParams.set("level", "campaign");
  url.searchParams.set("limit", "250");

  const response = await fetch(url);
  const body = await response.json() as { data?: Insight[]; error?: { message?: string } };
  if (!response.ok || body.error) {
    throw new Error(body.error?.message ?? `Meta Insights HTTP ${response.status}`);
  }

  const campaigns = (body.data ?? [])
    .filter((row) => Number(row.spend ?? 0) > 0)
    .map((row) => ({
      campaignId: row.campaign_id ?? "",
      campaignName: row.campaign_name ?? "",
      spend: Number(row.spend ?? 0),
      impressions: Number(row.impressions ?? 0),
      clicks: Number(row.clicks ?? 0),
      conversionActions: relevant(row.actions),
      conversionValues: relevant(row.action_values),
      costPerConversionAction: relevant(row.cost_per_action_type),
      websitePurchaseRoas: relevant(row.website_purchase_roas),
      purchaseRoas: relevant(row.purchase_roas),
      dateStart: row.date_start ?? null,
      dateStop: row.date_stop ?? null,
    }))
    .sort((a, b) => b.spend - a.spend);

  console.log(JSON.stringify({
    checkedAt: new Date().toISOString(),
    reportingWindow: datePreset,
    campaigns,
    note: "Meta-only diagnostic. Each action family is listed separately and must not be summed across families because a single conversion can appear under more than one Meta action label.",
  }, null, 2));
}

await main();
