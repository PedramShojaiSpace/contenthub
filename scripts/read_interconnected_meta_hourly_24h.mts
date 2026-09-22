import { getMetaAdsConfig } from "../server/metaAdsClient";
import { canonicalMetaLeadCount } from "../server/metaActionMetrics";

const startIso = process.env.START_ISO ?? new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
const endIso = process.env.END_ISO ?? new Date().toISOString();
const startMs = Date.parse(startIso);
const endMs = Date.parse(endIso);
const startDate = process.env.START_DATE ?? new Intl.DateTimeFormat("en-CA", { timeZone: "America/Chicago" }).format(new Date(startMs));
const endDate = process.env.END_DATE ?? new Intl.DateTimeFormat("en-CA", { timeZone: "America/Chicago" }).format(new Date(endMs));

type Action = { action_type?: string; value?: string | number };
type Row = {
  campaign_name?: string;
  adset_name?: string;
  spend?: string;
  impressions?: string;
  clicks?: string;
  actions?: Action[];
  date_start?: string;
  date_stop?: string;
  hourly_stats_aggregated_by_advertiser_time_zone?: string;
};

type Totals = { spend: number; impressions: number; clicks: number; metaLeads: number; rows: number };

function targetFor(row: Row) {
  const combined = `${row.campaign_name ?? ""} ${row.adset_name ?? ""}`.toLowerCase();
  if (combined.includes("interconnected-lp-3") || /\b(ko|klaviyo|shopify)\b/.test(combined)) return "klaviyoShopify" as const;
  if (combined.includes("ic-interconnected-free-screening-meta")) return "kajabi" as const;
  return "excluded" as const;
}

function parseHourStart(date: string | undefined, value: string | undefined): number | null {
  if (!date || !value) return null;
  const found = value.match(/^(\d{2}:\d{2}:\d{2})/);
  if (!found) return null;
  // The Graph breakdown is expressed in the advertiser's configured Central Time
  // zone. September falls under CDT; whole overlapping hours are included.
  const timestamp = Date.parse(`${date}T${found[1]}-05:00`);
  return Number.isFinite(timestamp) ? timestamp : null;
}

function newTotals(): Totals { return { spend: 0, impressions: 0, clicks: 0, metaLeads: 0, rows: 0 }; }

async function main() {
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || startMs >= endMs) throw new Error("Invalid reporting window");
  const config = getMetaAdsConfig();
  const url = new URL(`https://graph.facebook.com/v21.0/act_${config.adAccountId}/insights`);
  url.searchParams.set("access_token", config.accessToken);
  url.searchParams.set("fields", "campaign_name,adset_name,spend,impressions,clicks,actions,date_start,date_stop");
  url.searchParams.set("time_range", JSON.stringify({ since: startDate, until: endDate }));
  url.searchParams.set("level", "adset");
  url.searchParams.set("breakdowns", "hourly_stats_aggregated_by_advertiser_time_zone");
  url.searchParams.set("limit", "1000");
  const response = await fetch(url);
  const body = await response.json() as { data?: Row[]; error?: { message?: string } };
  if (!response.ok || body.error) throw new Error(body.error?.message ?? `Meta Insights HTTP ${response.status}`);

  const totals = { kajabi: newTotals(), klaviyoShopify: newTotals(), excluded: newTotals() };
  let parseableRows = 0;
  let inWindowRows = 0;
  const unparseableExamples = new Set<string>();
  for (const row of body.data ?? []) {
    const hourStartMs = parseHourStart(row.date_start, row.hourly_stats_aggregated_by_advertiser_time_zone);
    if (hourStartMs === null) {
      if (row.hourly_stats_aggregated_by_advertiser_time_zone) unparseableExamples.add(row.hourly_stats_aggregated_by_advertiser_time_zone);
      continue;
    }
    parseableRows += 1;
    const hourEndMs = hourStartMs + 3_600_000;
    if (hourEndMs <= startMs || hourStartMs >= endMs) continue;
    inWindowRows += 1;
    const bucket = totals[targetFor(row)];
    bucket.spend += Number(row.spend ?? 0) || 0;
    bucket.impressions += Number(row.impressions ?? 0) || 0;
    bucket.clicks += Number(row.clicks ?? 0) || 0;
    bucket.metaLeads += canonicalMetaLeadCount(row.actions);
    bucket.rows += 1;
  }

  const rounded = (value: Totals) => ({
    ...value,
    spend: Math.round(value.spend * 100) / 100,
    cpc: value.clicks ? Math.round((value.spend / value.clicks) * 100) / 100 : null,
    metaCpl: value.metaLeads ? Math.round((value.spend / value.metaLeads) * 100) / 100 : null,
  });
  console.log(JSON.stringify({
    checkedAt: new Date().toISOString(),
    reportingWindow: { startIso, endIso, MetaTimeZone: "advertiser account time zone; whole overlapping hours included" },
    arms: { kajabi: rounded(totals.kajabi), klaviyoShopify: rounded(totals.klaviyoShopify), excluded: rounded(totals.excluded) },
    diagnostics: { sourceRows: body.data?.length ?? 0, parseableRows, inWindowRows, unparseableHourlyValues: [...unparseableExamples].slice(0, 5) },
    note: "Meta results are delivery diagnostics. First-party Kajabi and Shopify records remain the sales authority.",
  }, null, 2));
}

await main();
