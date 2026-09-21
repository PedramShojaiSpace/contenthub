import { getMetaAdsConfig } from "../server/metaAdsClient";
import {
  canonicalMetaCheckoutCount,
  canonicalMetaLeadCount,
  canonicalMetaPurchaseCount,
  canonicalMetaPurchaseValue,
} from "../server/metaActionMetrics";

const since = process.env.START_DATE ?? "2026-09-20";
const until = process.env.END_DATE ?? "2026-09-21";
const config = getMetaAdsConfig();
const actId = `act_${config.adAccountId}`;

type Action = { action_type?: string; value?: string | number };
type InsightRow = {
  campaign_id?: string;
  campaign_name?: string;
  adset_id?: string;
  adset_name?: string;
  spend?: string;
  impressions?: string;
  clicks?: string;
  actions?: Action[];
  action_values?: Action[];
  date_start?: string;
  date_stop?: string;
};

type Bucket = {
  destination: "kajabi_control" | "klaviyo_shopify_challenger" | "excluded";
  rows: number;
  spend: number;
  impressions: number;
  clicks: number;
  metaLeads: number;
  metaCheckouts: number;
  metaPurchases: number;
  metaPurchaseValue: number;
  campaigns: Map<string, { campaignId: string; campaignName: string; spend: number; metaLeads: number; metaPurchases: number; metaPurchaseValue: number }>;
};

function destinationFor(row: InsightRow): Bucket["destination"] {
  const combined = `${row.campaign_name ?? ""} ${row.adset_name ?? ""}`.toLowerCase();
  if (combined.includes("interconnected-lp-3") || /\b(ko|klaviyo|shopify)\b/.test(combined)) return "klaviyo_shopify_challenger";
  if (combined.includes("ic-interconnected-free-screening-meta")) return "kajabi_control";
  return "excluded";
}

function createBucket(destination: Bucket["destination"]): Bucket {
  return {
    destination,
    rows: 0,
    spend: 0,
    impressions: 0,
    clicks: 0,
    metaLeads: 0,
    metaCheckouts: 0,
    metaPurchases: 0,
    metaPurchaseValue: 0,
    campaigns: new Map(),
  };
}

function finalized(bucket: Bucket) {
  return {
    destination: bucket.destination,
    adSetRows: bucket.rows,
    spend: Math.round(bucket.spend * 100) / 100,
    impressions: bucket.impressions,
    clicks: bucket.clicks,
    metaLeads: bucket.metaLeads,
    metaCheckouts: bucket.metaCheckouts,
    metaPurchases: bucket.metaPurchases,
    metaPurchaseValue: Math.round(bucket.metaPurchaseValue * 100) / 100,
    campaigns: [...bucket.campaigns.values()]
      .map((campaign) => ({
        ...campaign,
        spend: Math.round(campaign.spend * 100) / 100,
        cpl: campaign.metaLeads ? Math.round((campaign.spend / campaign.metaLeads) * 100) / 100 : null,
      }))
      .sort((a, b) => b.spend - a.spend),
  };
}

async function main() {
  const fields = [
    "campaign_id",
    "campaign_name",
    "adset_id",
    "adset_name",
    "spend",
    "impressions",
    "clicks",
    "actions",
    "action_values",
    "date_start",
    "date_stop",
  ].join(",");
  const url = new URL(`https://graph.facebook.com/v21.0/${actId}/insights`);
  url.searchParams.set("access_token", config.accessToken);
  url.searchParams.set("fields", fields);
  url.searchParams.set("time_range", JSON.stringify({ since, until }));
  url.searchParams.set("level", "adset");
  url.searchParams.set("limit", "500");

  const response = await fetch(url);
  const body = await response.json() as { data?: InsightRow[]; error?: { message?: string } };
  if (!response.ok || body.error) {
    throw new Error(body.error?.message ?? `Meta Insights HTTP ${response.status}`);
  }

  const buckets = new Map<Bucket["destination"], Bucket>([
    ["kajabi_control", createBucket("kajabi_control")],
    ["klaviyo_shopify_challenger", createBucket("klaviyo_shopify_challenger")],
    ["excluded", createBucket("excluded")],
  ]);

  for (const row of body.data ?? []) {
    const destination = destinationFor(row);
    const bucket = buckets.get(destination)!;
    const spend = Number(row.spend ?? 0) || 0;
    const leads = canonicalMetaLeadCount(row.actions);
    const checkouts = canonicalMetaCheckoutCount(row.actions);
    const purchases = canonicalMetaPurchaseCount(row.actions);
    const value = canonicalMetaPurchaseValue(row.action_values);
    const campaignName = row.campaign_name ?? "(missing)";
    const campaignId = row.campaign_id ?? "";

    bucket.rows += 1;
    bucket.spend += spend;
    bucket.impressions += Number(row.impressions ?? 0) || 0;
    bucket.clicks += Number(row.clicks ?? 0) || 0;
    bucket.metaLeads += leads;
    bucket.metaCheckouts += checkouts;
    bucket.metaPurchases += purchases;
    bucket.metaPurchaseValue += value;

    const campaign = bucket.campaigns.get(campaignId || campaignName) ?? {
      campaignId,
      campaignName,
      spend: 0,
      metaLeads: 0,
      metaPurchases: 0,
      metaPurchaseValue: 0,
    };
    campaign.spend += spend;
    campaign.metaLeads += leads;
    campaign.metaPurchases += purchases;
    campaign.metaPurchaseValue += value;
    bucket.campaigns.set(campaignId || campaignName, campaign);
  }

  console.log(JSON.stringify({
    checkedAt: new Date().toISOString(),
    reportingWindow: { since, until, timeZone: "Meta account calendar-day reporting" },
    classification: {
      kajabiControl: "Campaign or ad set contains ic-interconnected-free-screening-Meta.",
      klaviyoShopifyChallenger: "Campaign or ad set contains interconnected-lp-3, or a whole-word KO/Klaviyo/Shopify destination marker.",
      excluded: "Spending rows that do not contain either known current destination marker; excluded from the two-arm comparison.",
    },
    arms: {
      kajabiControl: finalized(buckets.get("kajabi_control")!),
      klaviyoShopifyChallenger: finalized(buckets.get("klaviyo_shopify_challenger")!),
      excluded: finalized(buckets.get("excluded")!),
    },
    note: "Meta actions are diagnostics only. Uses one canonical action type per funnel stage and never sums overlapping Meta action families.",
  }, null, 2));
}

await main();
