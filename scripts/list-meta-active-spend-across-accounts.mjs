const META_API_VERSION = "v21.0";
const BUSINESS_ID = process.env.META_BUSINESS_ID || "1153112761372733";
const EXTRA_META_ACCOUNT_IDS = (process.env.META_EXTRA_ACCOUNT_IDS || "10207858653523297")
  .split(",")
  .map(value => value.trim().replace(/^act_/, ""))
  .filter(Boolean);
const accessToken = process.env.META_AD_ACCESS_TOKEN;

if (!accessToken) {
  throw new Error("META_AD_ACCESS_TOKEN is required for this read-only Meta spend inventory.");
}

function centralDate(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Chicago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

async function metaGet(path, params = {}) {
  const url = new URL(`https://graph.facebook.com/${META_API_VERSION}/${path}`);
  url.searchParams.set("access_token", accessToken);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, String(value));

  const response = await fetch(url, { signal: AbortSignal.timeout(30_000) });
  const text = await response.text();
  let payload;
  try {
    payload = JSON.parse(text);
  } catch {
    throw new Error(`Meta returned a non-JSON response (${response.status}) for ${path}.`);
  }
  if (!response.ok || payload.error) {
    throw new Error(`Meta request failed for ${path} (${response.status}; code ${payload.error?.code ?? "unknown"}).`);
  }
  return payload;
}

const todayCentral = centralDate();
const business = await metaGet(`${BUSINESS_ID}/owned_ad_accounts`, {
  fields: "id,name,account_status,currency,timezone_name",
  limit: "100",
});
const tokenAccounts = await metaGet("me/adaccounts", {
  fields: "id,name,account_status,currency,timezone_name",
  limit: "100",
}).catch(() => ({ data: [] }));

const accountsById = new Map();
function registerAccounts(accounts, discoverySource) {
  for (const sourceAccount of accounts) {
    const accountId = String(sourceAccount.id).replace(/^act_/, "");
    const existing = accountsById.get(accountId);
    accountsById.set(accountId, {
      ...(existing ?? {}),
      ...sourceAccount,
      id: accountId,
      discoverySources: [...new Set([...(existing?.discoverySources ?? []), discoverySource])],
    });
  }
}

registerAccounts(business.data ?? [], "business-owned");
registerAccounts(tokenAccounts.data ?? [], "token-accessible");
for (const accountId of EXTRA_META_ACCOUNT_IDS) {
  if (accountsById.has(accountId)) continue;
  try {
    const account = await metaGet(`act_${accountId}`, { fields: "id,name,account_status,currency,timezone_name" });
    registerAccounts([account], "explicit-known-account");
  } catch (error) {
    accountsById.set(accountId, {
      id: accountId,
      name: "Known Urban Monk account (metadata unreadable)",
      account_status: null,
      timezone_name: null,
      discoverySources: ["explicit-known-account"],
      discoveryError: error instanceof Error ? error.message : String(error),
    });
  }
}

const accountResults = [];
const spendingAds = [];

for (const account of accountsById.values()) {
  const accountId = String(account.id).replace(/^act_/, "");
  try {
    const insights = await metaGet(`act_${accountId}/insights`, {
      fields: "ad_id,ad_name,adset_id,adset_name,campaign_id,campaign_name,spend,impressions,inline_link_clicks,date_start",
      level: "ad",
      time_range: JSON.stringify({ since: todayCentral, until: todayCentral }),
      limit: "500",
    });
    const spendRows = (insights.data ?? []).filter(row => Number(row.spend ?? 0) > 0);
    const rowsWithStatus = [];

    for (const row of spendRows) {
      const ad = await metaGet(row.ad_id, { fields: "id,name,status,effective_status,adset_id,campaign_id" });
      const normalized = {
        accountId,
        accountName: account.name ?? null,
        accountStatus: account.account_status ?? null,
        accountTimezone: account.timezone_name ?? null,
        discoverySources: account.discoverySources ?? [],
        campaignId: row.campaign_id ?? null,
        campaignName: row.campaign_name ?? null,
        adSetId: row.adset_id ?? null,
        adSetName: row.adset_name ?? null,
        adId: ad.id ?? row.ad_id,
        adName: ad.name ?? row.ad_name ?? null,
        adStatus: ad.status ?? null,
        adEffectiveStatus: ad.effective_status ?? null,
        currentDaySpend: Number(row.spend ?? 0),
        currentDayImpressions: Number(row.impressions ?? 0),
        currentDayLinkClicks: Number(row.inline_link_clicks ?? 0),
      };
      rowsWithStatus.push(normalized);
      if (normalized.adEffectiveStatus === "ACTIVE") spendingAds.push(normalized);
    }

    accountResults.push({
      accountId,
      accountName: account.name ?? null,
      accountStatus: account.account_status ?? null,
      accountTimezone: account.timezone_name ?? null,
      discoverySources: account.discoverySources ?? [],
      insightRowsWithSpend: spendRows.length,
      activeSpendRows: rowsWithStatus.filter(row => row.adEffectiveStatus === "ACTIVE").length,
      inactiveOrPausedSpendRows: rowsWithStatus.filter(row => row.adEffectiveStatus !== "ACTIVE").length,
      insightsMayHaveAdditionalPages: Boolean(insights.paging?.next),
      error: null,
    });
  } catch (error) {
    accountResults.push({
      accountId,
      accountName: account.name ?? null,
      accountStatus: account.account_status ?? null,
      accountTimezone: account.timezone_name ?? null,
      discoverySources: account.discoverySources ?? [],
      insightRowsWithSpend: null,
      activeSpendRows: null,
      inactiveOrPausedSpendRows: null,
      insightsMayHaveAdditionalPages: null,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

spendingAds.sort((left, right) => right.currentDaySpend - left.currentDaySpend);

console.log(JSON.stringify({
  readOnly: true,
  generatedAt: new Date().toISOString(),
  timeZone: "America/Chicago",
  currentDay: todayCentral,
  businessId: BUSINESS_ID,
  explicitKnownAccountIds: EXTRA_META_ACCOUNT_IDS,
  accountsDiscovered: accountResults.length,
  activeSpendingAdCount: spendingAds.length,
  activeSpendingTotal: spendingAds.reduce((sum, ad) => sum + ad.currentDaySpend, 0),
  accounts: accountResults,
  activeSpendingAds: spendingAds,
}, null, 2));
