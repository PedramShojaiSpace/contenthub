import mysql from "mysql2/promise";

const databaseUrl = process.env.DATABASE_URL;
const token = process.env.META_AD_ACCESS_TOKEN;
const accountId = process.env.META_AD_ACCOUNT_ID;
const historicalEarlyWindow = process.argv.includes("--aug-1-9");
if (!databaseUrl || !token || !accountId) throw new Error("Required runtime credentials are unavailable");

const db = await mysql.createConnection(databaseUrl);
const [utmRows] = await db.execute(
  `SELECT
     utm_campaign,
     COUNT(DISTINCT LOWER(TRIM(email))) AS unique_leads,
     SUM(CASE WHEN phone IS NOT NULL AND TRIM(phone) <> '' THEN 1 ELSE 0 END) AS phone_records,
     SUM(CASE WHEN sms_consent = 1 THEN 1 ELSE 0 END) AS consent_records
   FROM interconnected_leads
   WHERE created_at >= UNIX_TIMESTAMP('2026-08-01 00:00:00') * 1000
     AND utm_campaign IS NOT NULL
     AND TRIM(utm_campaign) <> ''
   GROUP BY utm_campaign
   ORDER BY unique_leads DESC, utm_campaign ASC`,
);
await db.end();

const range = encodeURIComponent(JSON.stringify({ since: "2026-08-01", until: historicalEarlyWindow ? "2026-08-09" : "2026-08-16" }));
const url = `https://graph.facebook.com/v19.0/act_${accountId}/insights?fields=campaign_name,spend,actions&time_range=${range}&level=campaign&limit=500&access_token=${token}`;
const response = await fetch(url);
if (!response.ok) throw new Error(`Meta insights request failed (${response.status})`);
const payload = await response.json();

function canon(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/^fb_\d+_/, "")
    .replace(/[^a-z0-9]+/g, "")
    .replace(/2026/g, "")
    .trim();
}

const agoraCampaigns = (payload.data ?? [])
  .map(row => String(row.campaign_name ?? "").trim())
  .filter(name => name.toLowerCase().includes("agora"));
const canonicalAgora = new Set(agoraCampaigns.map(canon));

const matched = utmRows
  .map(row => ({
    utmCampaign: row.utm_campaign,
    uniqueLeads: Number(row.unique_leads),
    phoneRecords: Number(row.phone_records),
    consentRecords: Number(row.consent_records),
    canonicalUtm: canon(row.utm_campaign),
  }))
  .filter(row => canonicalAgora.has(row.canonicalUtm));

console.log(JSON.stringify({
  metaApiCalls: 1,
  range: historicalEarlyWindow ? "2026-08-01 through 2026-08-09" : "2026-08-01 through 2026-08-16",
  agoraCampaignCount: agoraCampaigns.length,
  exactMatchedUtmCampaigns: matched.map(({ canonicalUtm, ...row }) => row),
  totals: {
    uniqueLeads: matched.reduce((sum, row) => sum + row.uniqueLeads, 0),
    phoneRecords: matched.reduce((sum, row) => sum + row.phoneRecords, 0),
    consentRecords: matched.reduce((sum, row) => sum + row.consentRecords, 0),
  },
}, null, 2));
