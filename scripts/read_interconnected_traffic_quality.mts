import { sql } from "drizzle-orm";
import { getDb } from "../server/db";
import { getMetaAdsConfig } from "../server/metaAdsClient";
import { canonicalMetaLeadCount } from "../server/metaActionMetrics";

const startIso = process.env.START_ISO ?? "2026-09-20T16:07:00.000Z";
const endIso = process.env.END_ISO ?? new Date().toISOString();
const startMs = Date.parse(startIso);
const endMs = Date.parse(endIso);
const startDate = process.env.START_DATE ?? "2026-09-20";
const endDate = process.env.END_DATE ?? "2026-09-21";

if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) {
  throw new Error("Invalid diagnostic window");
}

type InsightRow = {
  campaign_name?: string;
  adset_name?: string;
  publisher_platform?: string;
  platform_position?: string;
  spend?: string;
  impressions?: string;
  clicks?: string;
  actions?: Array<{ action_type?: string; value?: string | number }>;
};

type Bucket = {
  path: "kajabi" | "ko_klaviyo" | "excluded";
  spend: number;
  impressions: number;
  clicks: number;
  metaLeads: number;
  rows: number;
};

function classifyMetaPath(row: InsightRow): Bucket["path"] {
  const combined = `${row.campaign_name ?? ""} ${row.adset_name ?? ""}`.toLowerCase();
  if (combined.includes("interconnected-lp-3") || /\b(ko|klaviyo|shopify)\b/.test(combined)) return "ko_klaviyo";
  if (combined.includes("ic-interconnected-free-screening-meta")) return "kajabi";
  return "excluded";
}

function newBucket(path: Bucket["path"]): Bucket {
  return { path, spend: 0, impressions: 0, clicks: 0, metaLeads: 0, rows: 0 };
}

async function metaQualityRead() {
  const config = getMetaAdsConfig();
  const url = new URL(`https://graph.facebook.com/v21.0/act_${config.adAccountId}/insights`);
  url.searchParams.set("access_token", config.accessToken);
  url.searchParams.set("fields", "campaign_name,adset_name,spend,impressions,clicks,actions");
  url.searchParams.set("time_range", JSON.stringify({ since: startDate, until: endDate }));
  url.searchParams.set("level", "adset");
  url.searchParams.set("breakdowns", "publisher_platform,platform_position");
  url.searchParams.set("limit", "500");

  const response = await fetch(url);
  const body = await response.json() as { data?: InsightRow[]; error?: { message?: string } };
  if (!response.ok || body.error) throw new Error(body.error?.message ?? `Meta Insights HTTP ${response.status}`);

  const byPathAndPlacement = new Map<string, Bucket & { publisherPlatform: string; platformPosition: string }>();
  const totals = new Map<Bucket["path"], Bucket>([
    ["kajabi", newBucket("kajabi")],
    ["ko_klaviyo", newBucket("ko_klaviyo")],
    ["excluded", newBucket("excluded")],
  ]);

  for (const row of body.data ?? []) {
    const path = classifyMetaPath(row);
    const key = `${path}\u0000${row.publisher_platform ?? "(missing)"}\u0000${row.platform_position ?? "(missing)"}`;
    const bucket = byPathAndPlacement.get(key) ?? {
      ...newBucket(path),
      publisherPlatform: row.publisher_platform ?? "(missing)",
      platformPosition: row.platform_position ?? "(missing)",
    };
    const spend = Number(row.spend ?? 0) || 0;
    const impressions = Number(row.impressions ?? 0) || 0;
    const clicks = Number(row.clicks ?? 0) || 0;
    const metaLeads = canonicalMetaLeadCount(row.actions);
    for (const target of [bucket, totals.get(path)!]) {
      target.spend += spend;
      target.impressions += impressions;
      target.clicks += clicks;
      target.metaLeads += metaLeads;
      target.rows += 1;
    }
    byPathAndPlacement.set(key, bucket);
  }

  return {
    timeRange: { startDate, endDate, granularity: "Meta calendar day" },
    totals: [...totals.values()].map((bucket) => ({
      ...bucket,
      spend: Math.round(bucket.spend * 100) / 100,
      cpc: bucket.clicks ? Math.round((bucket.spend / bucket.clicks) * 100) / 100 : null,
      metaCpl: bucket.metaLeads ? Math.round((bucket.spend / bucket.metaLeads) * 100) / 100 : null,
    })),
    placements: [...byPathAndPlacement.values()]
      .filter((bucket) => bucket.path !== "excluded")
      .map((bucket) => ({
        ...bucket,
        spend: Math.round(bucket.spend * 100) / 100,
        cpc: bucket.clicks ? Math.round((bucket.spend / bucket.clicks) * 100) / 100 : null,
      }))
      .sort((a, b) => b.spend - a.spend),
  };
}

async function main() {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");

  const [firstPartyRaw, repeatIpRaw, burstRaw, meta] = await Promise.all([
    db.execute(sql`
      SELECT
        funnel_path AS funnelPath,
        COUNT(*) AS leadRows,
        COUNT(DISTINCT LOWER(TRIM(email))) AS uniqueEmails,
        SUM(CASE WHEN COALESCE(fbp, '') <> '' THEN 1 ELSE 0 END) AS leadsWithFbp,
        SUM(CASE WHEN COALESCE(fbc, '') <> '' THEN 1 ELSE 0 END) AS leadsWithFbc,
        SUM(CASE WHEN COALESCE(fbclid, '') <> '' THEN 1 ELSE 0 END) AS leadsWithFbclid,
        SUM(CASE WHEN COALESCE(client_ip, '') <> '' THEN 1 ELSE 0 END) AS leadsWithClientIp,
        SUM(CASE WHEN COALESCE(user_agent, '') <> '' THEN 1 ELSE 0 END) AS leadsWithUserAgent,
        SUM(CASE WHEN LOWER(COALESCE(user_agent, '')) REGEXP 'bot|spider|crawler|headless|phantom|selenium|curl|wget|python-requests|httpclient' THEN 1 ELSE 0 END) AS obviousAutomatedUserAgents,
        COUNT(DISTINCT NULLIF(client_ip, '')) AS distinctClientIps,
        SUM(CASE WHEN COALESCE(referrer, '') <> '' THEN 1 ELSE 0 END) AS leadsWithReferrer
      FROM interconnected_leads
      WHERE created_at >= ${startMs} AND created_at <= ${endMs}
      GROUP BY funnel_path
      ORDER BY funnel_path
    `),
    db.execute(sql`
      WITH per_ip AS (
        SELECT funnel_path, client_ip, COUNT(*) AS leadsOnIp
        FROM interconnected_leads
        WHERE created_at >= ${startMs} AND created_at <= ${endMs} AND COALESCE(client_ip, '') <> ''
        GROUP BY funnel_path, client_ip
      )
      SELECT
        funnel_path AS funnelPath,
        SUM(CASE WHEN leadsOnIp >= 2 THEN 1 ELSE 0 END) AS repeatedIpGroups,
        SUM(CASE WHEN leadsOnIp >= 2 THEN leadsOnIp ELSE 0 END) AS leadsOnRepeatedIps,
        MAX(leadsOnIp) AS maxLeadsOnSingleIp
      FROM per_ip
      GROUP BY funnel_path
      ORDER BY funnel_path
    `),
    db.execute(sql`
      WITH per_minute AS (
        SELECT funnel_path, FLOOR(created_at / 60000) AS minuteBucket, COUNT(*) AS leadsInMinute
        FROM interconnected_leads
        WHERE created_at >= ${startMs} AND created_at <= ${endMs}
        GROUP BY funnel_path, FLOOR(created_at / 60000)
      )
      SELECT funnel_path AS funnelPath, MAX(leadsInMinute) AS maxLeadsInOneMinute
      FROM per_minute
      GROUP BY funnel_path
      ORDER BY funnel_path
    `),
    metaQualityRead(),
  ]);

  const toRows = (value: unknown) => {
    const outer = Array.isArray(value) ? value[0] : value;
    return Array.isArray(outer) ? outer : outer ? [outer] : [];
  };
  const asNumber = (value: unknown) => Number(value ?? 0) || 0;
  const firstParty = toRows(firstPartyRaw).map((row: Record<string, unknown>) => ({
    funnelPath: String(row.funnelPath ?? "(missing)"),
    leadRows: asNumber(row.leadRows),
    uniqueEmails: asNumber(row.uniqueEmails),
    duplicateRows: Math.max(0, asNumber(row.leadRows) - asNumber(row.uniqueEmails)),
    leadsWithFbp: asNumber(row.leadsWithFbp),
    leadsWithFbc: asNumber(row.leadsWithFbc),
    leadsWithFbclid: asNumber(row.leadsWithFbclid),
    leadsWithClientIp: asNumber(row.leadsWithClientIp),
    leadsWithUserAgent: asNumber(row.leadsWithUserAgent),
    obviousAutomatedUserAgents: asNumber(row.obviousAutomatedUserAgents),
    distinctClientIps: asNumber(row.distinctClientIps),
    leadsWithReferrer: asNumber(row.leadsWithReferrer),
  }));

  console.log(JSON.stringify({
    checkedAt: new Date().toISOString(),
    window: { startIso, endIso, firstPartyGranularity: "exact timestamp", metaGranularity: "calendar day" },
    firstPartySignals: {
      byPath: firstParty,
      repeatedIpSignals: toRows(repeatIpRaw),
      burstSignals: toRows(burstRaw),
      interpretation: "These are screening signals, not a bot verdict. A genuine shared network can produce repeat IPs; missing browser identifiers can be caused by privacy controls.",
    },
    metaDelivery: meta,
    interpretation: "No raw emails, IPs, referrers, or user agents are emitted. The output supports aggregate traffic-quality comparison only.",
  }, null, 2));
}

await main();
