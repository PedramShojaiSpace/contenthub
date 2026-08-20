import mysql from "mysql2/promise";

const since = "2026-08-01 00:00:00";
const databaseUrl = process.env.DATABASE_URL;
const apiKey = process.env.KLAVIYO_PRIVATE_KEY;
const strictAgoraOnly = process.argv.includes("--strict-agora");

if (!databaseUrl) throw new Error("DATABASE_URL is required");
if (!apiKey) throw new Error("KLAVIYO_PRIVATE_KEY is required");

const db = await mysql.createConnection(databaseUrl);
const [rows] = await db.execute(
  `WITH aug_leads AS (
     SELECT
       LOWER(TRIM(email)) AS email_key,
       phone,
       sms_consent
     FROM interconnected_leads
     WHERE created_at >= UNIX_TIMESTAMP(?) * 1000
       AND ${strictAgoraOnly
         ? "LOWER(COALESCE(utm_campaign, '')) LIKE '%agora%'"
         : "(LOWER(COALESCE(utm_source, '')) IN ('meta', 'facebook') OR LOWER(COALESCE(utm_campaign, '')) LIKE '%agora%' OR COALESCE(fbclid, '') <> '')"}
   )
   SELECT
     email_key,
     MAX(CASE WHEN phone IS NOT NULL AND TRIM(phone) <> '' THEN 1 ELSE 0 END) AS local_has_phone,
     MAX(CASE WHEN sms_consent = 1 THEN 1 ELSE 0 END) AS local_sms_consent
   FROM aug_leads
   GROUP BY email_key
   ORDER BY email_key`,
  [since],
);
await db.end();

async function lookupProfile(email) {
  const url = new URL("https://a.klaviyo.com/api/profiles/");
  url.searchParams.set("filter", `equals(email,\"${email.replaceAll("\\", "\\\\").replaceAll('"', '\\"')}\")`);
  url.searchParams.set("fields[profile]", "email,phone_number,properties");
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const response = await fetch(url, {
      headers: {
        Authorization: `Klaviyo-API-Key ${apiKey}`,
        accept: "application/vnd.api+json",
        revision: "2024-10-15",
      },
    });
    if (response.ok) {
      const payload = await response.json();
      const profile = payload?.data?.[0]?.attributes;
      if (!profile) return { matched: false, hasPhone: false, consent: false };
      const phone = String(profile.phone_number ?? "").trim();
      const properties = profile.properties ?? {};
      return {
        matched: true,
        hasPhone: phone.length > 0,
        consent: properties.sms_consent === true,
      };
    }
    if (response.status !== 429 || attempt === 3) {
      throw new Error(`Klaviyo lookup failed (${response.status})`);
    }
    const retryAfter = Number(response.headers.get("retry-after") ?? "1");
    await new Promise(resolve => setTimeout(resolve, Math.max(1, retryAfter) * 1000));
  }
  throw new Error("Klaviyo lookup exhausted retries");
}

const outcomes = [];
for (const { email_key, local_has_phone, local_sms_consent } of rows) {
    try {
      outcomes.push({ localHasPhone: Boolean(local_has_phone), localConsent: Boolean(local_sms_consent), ...(await lookupProfile(email_key)) });
    } catch (error) {
      outcomes.push({ localHasPhone: Boolean(local_has_phone), localConsent: Boolean(local_sms_consent), matched: false, hasPhone: false, consent: false, error: error instanceof Error ? error.message : "lookup failed" });
    }
    await new Promise(resolve => setTimeout(resolve, 120));
}

const summary = outcomes.reduce(
  (acc, row) => {
    acc.queried += 1;
    if (row.matched) acc.matched += 1;
    if (row.localHasPhone) acc.localPhone += 1;
    if (row.hasPhone) acc.klaviyoPhone += 1;
    if (row.localHasPhone || row.hasPhone) acc.anyPhone += 1;
    if (row.localHasPhone && !row.hasPhone) acc.localOnlyPhone += 1;
    if (!row.localHasPhone && row.hasPhone) acc.klaviyoOnlyPhone += 1;
    if (row.localConsent) acc.localConsent += 1;
    if (row.consent) acc.klaviyoConsent += 1;
    if (row.localConsent || row.consent) acc.anyConsent += 1;
    if (row.localConsent && !row.consent) acc.localOnlyConsent += 1;
    if (!row.localConsent && row.consent) acc.klaviyoOnlyConsent += 1;
    if (row.error) acc.errors += 1;
    return acc;
  },
  {
    queried: 0,
    matched: 0,
    localPhone: 0,
    klaviyoPhone: 0,
    anyPhone: 0,
    localOnlyPhone: 0,
    klaviyoOnlyPhone: 0,
    localConsent: 0,
    klaviyoConsent: 0,
    anyConsent: 0,
    localOnlyConsent: 0,
    klaviyoOnlyConsent: 0,
    errors: 0,
  },
);

console.log(JSON.stringify({ since, strictAgoraOnly, ...summary }, null, 2));
