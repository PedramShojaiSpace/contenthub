import { sql } from "drizzle-orm";
import { getDb } from "../server/db";
import { getCampaignInsights, getCampaigns, getMetaAdsConfig } from "../server/metaAdsClient";

const now = Date.now();
const sinceMinutes = Number(process.env.SINCE_MINUTES ?? "90");
const sinceMs = now - sinceMinutes * 60_000;

function unwrapRows(value: unknown): Array<Record<string, unknown>> {
  const outer = Array.isArray(value) ? value[0] : value;
  if (Array.isArray(outer)) return outer as Array<Record<string, unknown>>;
  return outer ? [outer as Record<string, unknown>] : [];
}

function toNumber(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

async function main() {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");

  const aggregateRaw = await db.execute(sql`
    SELECT
      COUNT(*) AS total,
      SUM(CASE WHEN klaviyo_synced = 1 THEN 1 ELSE 0 END) AS klaviyo_synced,
      SUM(CASE WHEN capi_lead_sent = 1 THEN 1 ELSE 0 END) AS capi_sent,
      SUM(CASE WHEN sms_consent = 1 THEN 1 ELSE 0 END) AS sms_consented,
      SUM(CASE WHEN phone IS NOT NULL AND phone <> '' THEN 1 ELSE 0 END) AS phone_provided,
      SUM(CASE WHEN utm_source IS NOT NULL AND utm_medium IS NOT NULL AND utm_campaign IS NOT NULL THEN 1 ELSE 0 END) AS complete_utm,
      MIN(created_at) AS first_created_at,
      MAX(created_at) AS last_created_at
    FROM interconnected_leads
    WHERE funnel_path = 'ko_klaviyo' AND created_at >= ${sinceMs}
  `);

  const groupedRaw = await db.execute(sql`
    SELECT
      COALESCE(NULLIF(utm_campaign, ''), '(missing)') AS utm_campaign,
      COALESCE(NULLIF(utm_content, ''), '(missing)') AS utm_content,
      COALESCE(NULLIF(meta_campaign_key, ''), '(missing)') AS meta_campaign_key,
      COUNT(*) AS leads,
      SUM(CASE WHEN klaviyo_synced = 1 THEN 1 ELSE 0 END) AS klaviyo_synced,
      SUM(CASE WHEN capi_lead_sent = 1 THEN 1 ELSE 0 END) AS capi_sent,
      MAX(created_at) AS latest_created_at
    FROM interconnected_leads
    WHERE funnel_path = 'ko_klaviyo' AND created_at >= ${sinceMs}
    GROUP BY utm_campaign, utm_content, meta_campaign_key
    ORDER BY latest_created_at DESC
    LIMIT 20
  `);

  let meta: unknown = { available: false, skipped: process.env.SKIP_META === "1" };
  if (process.env.SKIP_META !== "1") try {
    const config = getMetaAdsConfig();
    const campaigns = await getCampaigns(config);
    const koCampaigns = campaigns
      .filter((campaign) => /interconnected\s*(ko|klaviyo|shopify)|interconnected[_-]ko/i.test(campaign.name ?? ""))
      .map((campaign) => ({ id: campaign.id, name: campaign.name, status: campaign.status, effectiveStatus: campaign.effective_status }));
    const koInsights = (await Promise.all(
      koCampaigns.map(async (campaign) => ({
        campaignId: campaign.id,
        rows: await getCampaignInsights(config, campaign.id, "today"),
      })),
    )).flatMap(({ campaignId, rows }) => rows.map((row) => ({ campaignId, ...row })));
    meta = { available: true, koCampaigns, koInsights };
  } catch (error) {
    meta = { available: false, error: error instanceof Error ? error.message : "unknown Meta read error" };
  }

  const aggregate = unwrapRows(aggregateRaw)[0] ?? {};
  const groups = unwrapRows(groupedRaw).map((row) => ({
    utmCampaign: String(row.utm_campaign ?? "(missing)"),
    utmContent: String(row.utm_content ?? "(missing)"),
    metaCampaignKey: String(row.meta_campaign_key ?? "(missing)"),
    leads: toNumber(row.leads),
    klaviyoSynced: toNumber(row.klaviyo_synced),
    capiSent: toNumber(row.capi_sent),
    latestCreatedAt: row.latest_created_at ? new Date(toNumber(row.latest_created_at)).toISOString() : null,
  }));

  console.log(JSON.stringify({
    checkedAt: new Date(now).toISOString(),
    sinceMinutes,
    koLeadHealth: {
      total: toNumber(aggregate.total),
      klaviyoSynced: toNumber(aggregate.klaviyo_synced),
      capiSent: toNumber(aggregate.capi_sent),
      smsConsented: toNumber(aggregate.sms_consented),
      phoneProvided: toNumber(aggregate.phone_provided),
      completeUtm: toNumber(aggregate.complete_utm),
      firstCreatedAt: aggregate.first_created_at ? new Date(toNumber(aggregate.first_created_at)).toISOString() : null,
      lastCreatedAt: aggregate.last_created_at ? new Date(toNumber(aggregate.last_created_at)).toISOString() : null,
      groupedCampaigns: groups,
    },
    meta,
  }, null, 2));
}

await main();
