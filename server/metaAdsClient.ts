/**
 * Meta Ads API Client
 * Wraps the Meta Marketing API (Graph API v21.0) for campaign management,
 * performance insights, creative management, and pixel diagnostics.
 *
 * Required environment variables:
 *   META_AD_ACCESS_TOKEN  — System User token with ads_management + ads_read
 *   META_AD_ACCOUNT_ID    — Ad account ID (numeric, no "act_" prefix)
 *   META_APP_ID           — Meta App ID
 *   META_APP_SECRET       — Meta App Secret
 */

const API_VERSION = "v21.0";
const BASE_URL = `https://graph.facebook.com/${API_VERSION}`;

export interface MetaAdsConfig {
  accessToken: string;
  adAccountId: string;
  appId: string;
  appSecret: string;
}

export function getMetaAdsConfig(): MetaAdsConfig {
  const accessToken = process.env.META_AD_ACCESS_TOKEN;
  const adAccountId = process.env.META_AD_ACCOUNT_ID;
  const appId = process.env.META_APP_ID;
  const appSecret = process.env.META_APP_SECRET;

  if (!accessToken) throw new Error("META_AD_ACCESS_TOKEN is not set");
  if (!adAccountId) throw new Error("META_AD_ACCOUNT_ID is not set");
  if (!appId) throw new Error("META_APP_ID is not set");
  if (!appSecret) throw new Error("META_APP_SECRET is not set");

  return { accessToken, adAccountId, appId, appSecret };
}

async function metaGet<T = any>(
  endpoint: string,
  params: Record<string, string>,
  accessToken: string
): Promise<T> {
  const url = new URL(`${BASE_URL}/${endpoint}`);
  url.searchParams.set("access_token", accessToken);
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }

  const res = await fetch(url.toString());
  const json = await res.json() as any;

  if (!res.ok || json.error) {
    const msg = json.error?.message ?? `HTTP ${res.status}`;
    throw new Error(`Meta API error on GET /${endpoint}: ${msg}`);
  }

  return json as T;
}

async function metaPost<T = any>(
  endpoint: string,
  params: Record<string, string>,
  accessToken: string
): Promise<T> {
  const url = `${BASE_URL}/${endpoint}`;
  const body = new URLSearchParams({ ...params, access_token: accessToken });

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  const json = await res.json() as any;

  if (!res.ok || json.error) {
    const msg = json.error?.message ?? `HTTP ${res.status}`;
    throw new Error(`Meta API error on POST /${endpoint}: ${msg}`);
  }

  return json as T;
}

// ─── Types ───────────────────────────────────────────────────────────────────

export interface MetaCampaign {
  id: string;
  name: string;
  status: string;
  effective_status: string;
  objective: string;
  daily_budget?: string;
  lifetime_budget?: string;
  start_time?: string;
  stop_time?: string;
  created_time: string;
  updated_time: string;
}

export interface MetaAdSet {
  id: string;
  name: string;
  status: string;
  effective_status: string;
  daily_budget?: string;
  lifetime_budget?: string;
  optimization_goal: string;
  billing_event: string;
  campaign_id: string;
  created_time: string;
}

export interface MetaAd {
  id: string;
  name: string;
  status: string;
  effective_status: string;
  adset_id: string;
  campaign_id: string;
  created_time: string;
}

export interface MetaInsights {
  campaign_id?: string;
  campaign_name?: string;
  adset_id?: string;
  adset_name?: string;
  ad_id?: string;
  ad_name?: string;
  spend: string;
  impressions: string;
  clicks: string;
  reach: string;
  frequency: string;
  ctr: string;
  cpc?: string;
  cpm?: string;
  cpp?: string;
  actions?: Array<{ action_type: string; value: string }>;
  date_start: string;
  date_stop: string;
}

export interface MetaPixel {
  id: string;
  name: string;
  creation_time: string;
  last_fired_time?: string;
  is_unavailable?: boolean;
}

// ─── Campaigns ───────────────────────────────────────────────────────────────

export async function getCampaigns(config: MetaAdsConfig): Promise<MetaCampaign[]> {
  const actId = `act_${config.adAccountId}`;
  const fields = "id,name,status,effective_status,objective,daily_budget,lifetime_budget,start_time,stop_time,created_time,updated_time";

  const data = await metaGet<{ data: MetaCampaign[] }>(
    `${actId}/campaigns`,
    { fields, limit: "100" },
    config.accessToken
  );

  return data.data ?? [];
}

export async function getCampaignInsights(
  config: MetaAdsConfig,
  campaignId: string,
  datePreset: string = "last_30d"
): Promise<MetaInsights[]> {
  const fields = "campaign_id,campaign_name,spend,impressions,clicks,reach,frequency,ctr,cpc,cpm,cpp,actions";

  const data = await metaGet<{ data: MetaInsights[] }>(
    `${campaignId}/insights`,
    { fields, date_preset: datePreset, level: "campaign" },
    config.accessToken
  );

  return data.data ?? [];
}

// ─── Ad Sets ─────────────────────────────────────────────────────────────────

export async function getAdSets(
  config: MetaAdsConfig,
  campaignId: string
): Promise<MetaAdSet[]> {
  const fields = "id,name,status,effective_status,daily_budget,lifetime_budget,optimization_goal,billing_event,campaign_id,created_time";

  const data = await metaGet<{ data: MetaAdSet[] }>(
    `${campaignId}/adsets`,
    { fields, limit: "100" },
    config.accessToken
  );

  return data.data ?? [];
}

export async function getAdSetInsights(
  config: MetaAdsConfig,
  adSetId: string,
  datePreset: string = "last_30d"
): Promise<MetaInsights[]> {
  const fields = "adset_id,adset_name,spend,impressions,clicks,reach,frequency,ctr,cpc,cpm,actions";

  const data = await metaGet<{ data: MetaInsights[] }>(
    `${adSetId}/insights`,
    { fields, date_preset: datePreset, level: "adset" },
    config.accessToken
  );

  return data.data ?? [];
}

// ─── Ads ─────────────────────────────────────────────────────────────────────

export async function getAds(
  config: MetaAdsConfig,
  adSetId: string
): Promise<MetaAd[]> {
  const fields = "id,name,status,effective_status,adset_id,campaign_id,created_time";

  const data = await metaGet<{ data: MetaAd[] }>(
    `${adSetId}/ads`,
    { fields, limit: "100" },
    config.accessToken
  );

  return data.data ?? [];
}

export async function getAdInsights(
  config: MetaAdsConfig,
  adId: string,
  datePreset: string = "last_30d"
): Promise<MetaInsights[]> {
  const fields = "ad_id,ad_name,spend,impressions,clicks,reach,frequency,ctr,cpc,cpm,actions";

  const data = await metaGet<{ data: MetaInsights[] }>(
    `${adId}/insights`,
    { fields, date_preset: datePreset, level: "ad" },
    config.accessToken
  );

  return data.data ?? [];
}

// ─── Account-level insights (all campaigns) ──────────────────────────────────

export async function getAccountInsights(
  config: MetaAdsConfig,
  datePreset: string = "last_30d"
): Promise<MetaInsights[]> {
  const actId = `act_${config.adAccountId}`;
  const fields = "campaign_id,campaign_name,spend,impressions,clicks,reach,frequency,ctr,cpc,cpm,cpp,actions";

  const data = await metaGet<{ data: MetaInsights[] }>(
    `${actId}/insights`,
    { fields, date_preset: datePreset, level: "campaign", limit: "100" },
    config.accessToken
  );

  return data.data ?? [];
}

// ─── Creative fatigue detection ───────────────────────────────────────────────

export interface FatigueAlert {
  adId: string;
  adName: string;
  adSetId: string;
  campaignId: string;
  frequency: number;
  ctr: number;
  spend: number;
  impressions: number;
  alertType: "high_frequency" | "low_ctr" | "both";
  severity: "warning" | "critical";
}

export async function detectCreativeFatigue(
  config: MetaAdsConfig,
  datePreset: string = "last_14d"
): Promise<FatigueAlert[]> {
  const actId = `act_${config.adAccountId}`;
  const fields = "ad_id,ad_name,adset_id,campaign_id,spend,impressions,clicks,reach,frequency,ctr";

  const data = await metaGet<{ data: MetaInsights[] }>(
    `${actId}/insights`,
    { fields, date_preset: datePreset, level: "ad", limit: "200" },
    config.accessToken
  );

  const alerts: FatigueAlert[] = [];

  for (const row of data.data ?? []) {
    const frequency = parseFloat(row.frequency ?? "0");
    const ctr = parseFloat(row.ctr ?? "0");
    const spend = parseFloat(row.spend ?? "0");
    const impressions = parseInt(row.impressions ?? "0", 10);

    // Only flag ads with meaningful spend (>$5) to avoid noise
    if (spend < 5) continue;

    const highFreq = frequency >= 3.5;
    const lowCtr = ctr < 0.5 && impressions > 1000; // CTR below 0.5% with sufficient impressions

    if (!highFreq && !lowCtr) continue;

    const alertType = highFreq && lowCtr ? "both" : highFreq ? "high_frequency" : "low_ctr";
    const severity = frequency >= 5 || ctr < 0.3 ? "critical" : "warning";

    alerts.push({
      adId: row.ad_id ?? "",
      adName: row.ad_name ?? "",
      adSetId: row.adset_id ?? "",
      campaignId: row.campaign_id ?? "",
      frequency,
      ctr,
      spend,
      impressions,
      alertType,
      severity,
    });
  }

  return alerts.sort((a, b) => {
    // Critical first, then by frequency descending
    if (a.severity !== b.severity) return a.severity === "critical" ? -1 : 1;
    return b.frequency - a.frequency;
  });
}

// ─── Pixel / Signal diagnostics ──────────────────────────────────────────────

export async function getPixels(config: MetaAdsConfig): Promise<MetaPixel[]> {
  const actId = `act_${config.adAccountId}`;
  const fields = "id,name,creation_time,last_fired_time,is_unavailable";

  const data = await metaGet<{ data: MetaPixel[] }>(
    `${actId}/adspixels`,
    { fields },
    config.accessToken
  );

  return data.data ?? [];
}

export interface PixelDiagnostic {
  pixelId: string;
  pixelName: string;
  lastFiredTime?: string;
  isHealthy: boolean;
  daysSinceLastFire?: number;
  issues: string[];
}

export async function getPixelDiagnostics(config: MetaAdsConfig): Promise<PixelDiagnostic[]> {
  const pixels = await getPixels(config);
  const now = Date.now();

  return pixels.map((pixel) => {
    const issues: string[] = [];
    let isHealthy = true;
    let daysSinceLastFire: number | undefined;

    if (pixel.is_unavailable) {
      issues.push("Pixel is unavailable");
      isHealthy = false;
    }

    if (pixel.last_fired_time) {
      const lastFired = new Date(pixel.last_fired_time).getTime();
      daysSinceLastFire = Math.floor((now - lastFired) / (1000 * 60 * 60 * 24));

      if (daysSinceLastFire > 7) {
        issues.push(`No pixel events in ${daysSinceLastFire} days`);
        isHealthy = false;
      } else if (daysSinceLastFire > 3) {
        issues.push(`Pixel quiet for ${daysSinceLastFire} days — check integration`);
      }
    } else {
      issues.push("Pixel has never fired — not installed or not receiving events");
      isHealthy = false;
    }

    return {
      pixelId: pixel.id,
      pixelName: pixel.name,
      lastFiredTime: pixel.last_fired_time,
      isHealthy,
      daysSinceLastFire,
      issues,
    };
  });
}

// ─── Campaign status controls ─────────────────────────────────────────────────

export async function updateCampaignStatus(
  config: MetaAdsConfig,
  campaignId: string,
  status: "ACTIVE" | "PAUSED"
): Promise<boolean> {
  const result = await metaPost<{ success: boolean }>(
    campaignId,
    { status },
    config.accessToken
  );
  return result.success === true;
}

// ─── Token validation ─────────────────────────────────────────────────────────

export async function validateToken(config: MetaAdsConfig): Promise<{
  valid: boolean;
  userId?: string;
  scopes?: string[];
  expiresAt?: string;
  error?: string;
}> {
  try {
    const data = await metaGet<any>(
      "debug_token",
      {
        input_token: config.accessToken,
        access_token: `${config.appId}|${config.appSecret}`,
      },
      config.accessToken
    );

    const tokenData = data.data;
    if (!tokenData?.is_valid) {
      return { valid: false, error: tokenData?.error?.message ?? "Token is invalid" };
    }

    return {
      valid: true,
      userId: tokenData.user_id,
      scopes: tokenData.scopes ?? [],
      expiresAt: tokenData.expires_at
        ? new Date(tokenData.expires_at * 1000).toISOString()
        : undefined,
    };
  } catch (err: any) {
    return { valid: false, error: err.message };
  }
}

// ─── Ad Set budget update ─────────────────────────────────────────────────────

export async function updateAdSetBudget(
  config: MetaAdsConfig,
  adSetId: string,
  dailyBudgetCents: number // Meta stores budgets in cents
): Promise<boolean> {
  const result = await metaPost<{ success: boolean }>(
    adSetId,
    { daily_budget: dailyBudgetCents.toString() },
    config.accessToken
  );
  return result.success === true;
}
