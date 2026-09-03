const META_API_VERSION = "v21.0";
const META_AD_ACCOUNT_ID = process.env.META_SCAN_AD_ACCOUNT_ID || "1153114224705920";
const accessToken = process.env.META_AD_ACCESS_TOKEN;
const skipCreativeLookup = process.env.META_SKIP_CREATIVE_LOOKUP === "1";

if (!accessToken) {
  throw new Error("META_AD_ACCESS_TOKEN is required for this read-only creative inventory.");
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
    throw new Error(`Meta creative inventory returned a non-JSON response (${response.status}).`);
  }
  if (!response.ok || payload.error) {
    throw new Error(`Meta creative inventory failed (${response.status}; code ${payload.error?.code ?? "unknown"}).`);
  }
  return payload;
}

const campaignPayload = await metaGet(`act_${META_AD_ACCOUNT_ID}/campaigns`, {
  fields: "id,name,status,effective_status",
  limit: "250",
});
const campaignsById = new Map((campaignPayload.data ?? []).map(campaign => [campaign.id, campaign]));

const centralToday = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Chicago",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
}).format(new Date());
const currentDayInsights = await metaGet(`act_${META_AD_ACCOUNT_ID}/insights`, {
  fields: "ad_id,ad_name,spend,impressions,inline_link_clicks,date_start",
  time_range: JSON.stringify({ since: centralToday, until: centralToday }),
  level: "ad",
  limit: "500",
});
const spendByAdId = new Map((currentDayInsights.data ?? []).map(row => [row.ad_id, {
  spend: Number(row.spend ?? 0),
  impressions: Number(row.impressions ?? 0),
  linkClicks: Number(row.inline_link_clicks ?? 0),
}]));

const activeCampaigns = (campaignPayload.data ?? []).filter(campaign => campaign.effective_status === "ACTIVE");
const adSetsById = new Map();
const ads = [];

for (const campaign of activeCampaigns) {
  const adSetPayload = await metaGet(`${campaign.id}/adsets`, {
    fields: "id,name,status,effective_status,campaign_id",
    limit: "100",
  });
  for (const adSet of adSetPayload.data ?? []) {
    adSetsById.set(adSet.id, adSet);
    if (adSet.effective_status !== "ACTIVE") continue;
    const adsPayload = await metaGet(`${adSet.id}/ads`, {
      fields: "id,name,status,effective_status,adset_id,campaign_id,created_time,updated_time,creative",
      limit: "100",
    });
    ads.push(...(adsPayload.data ?? []));
  }
}

for (const ad of ads.filter(row => row.effective_status === "ACTIVE")) {
  if (skipCreativeLookup) continue;
  const creativeId = ad.creative?.id;
  if (!creativeId) continue;
  const creativePayload = await metaGet(creativeId, {
    fields: "id,name,thumbnail_url",
  });
  ad.creative = creativePayload;
}

function stringifyCreative(creative = {}) {
  return JSON.stringify({
    name: creative.name,
  }).toLowerCase();
}

const rows = ads.map(ad => {
  const creative = ad.creative ?? {};
  const creativeText = stringifyCreative(creative);
  const parent = adSetsById.get(ad.adset_id) ?? {};
  const campaign = campaignsById.get(ad.campaign_id ?? parent.campaign_id) ?? {};
  const current = spendByAdId.get(ad.id) ?? { spend: 0, impressions: 0, linkClicks: 0 };
  const hasContentHubDestination = creativeText.includes("content.theurbanmonk.com");
  const hasScreenshotTerms = /(content hub|command center|dashboard|screenshot|green squares|hub\/analytics)/.test(
    `${ad.name ?? ""} ${creativeText}`.toLowerCase(),
  );
  return {
    adId: ad.id,
    adName: ad.name,
    adStatus: ad.status,
    adEffectiveStatus: ad.effective_status,
    createdTime: ad.created_time ?? null,
    updatedTime: ad.updated_time ?? null,
    adSetId: parent.id ?? null,
    adSetName: parent.name ?? null,
    adSetStatus: parent.effective_status ?? null,
    campaignId: campaign.id ?? null,
    campaignName: campaign.name ?? null,
    campaignStatus: campaign.effective_status ?? null,
    creativeId: creative.id ?? null,
    creativeName: creative.name ?? null,
    thumbnailUrl: creative.thumbnail_url ?? null,
    imageUrl: null,
    currentDaySpend: current.spend,
    currentDayImpressions: current.impressions,
    currentDayLinkClicks: current.linkClicks,
    hasContentHubDestination,
    hasScreenshotTerms,
  };
});

const activeRows = rows.filter(row => row.adEffectiveStatus === "ACTIVE");
const candidateRows = activeRows.filter(row => row.hasContentHubDestination || row.hasScreenshotTerms);
const spendingRows = activeRows.filter(row => row.currentDaySpend > 0);

console.log(JSON.stringify({
  readOnly: true,
  generatedAt: new Date().toISOString(),
  centralToday,
  adAccountId: META_AD_ACCOUNT_ID,
  totalAdsRetrieved: rows.length,
  activeAdsRetrieved: activeRows.length,
  candidateCount: candidateRows.length,
  spendingActiveAdCount: spendingRows.length,
  candidates: candidateRows,
  spendingActiveAds: spendingRows,
  activeCreativeInventory: activeRows,
}, null, 2));
