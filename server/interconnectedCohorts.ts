export type InterconnectedCohortPath = "kajabi_page" | "klaviyo_sms" | "meta_paid" | "other";

export function classifyInterconnectedCohortPath(params: {
  utmSource?: string | null;
  utmMedium?: string | null;
  utmCampaign?: string | null;
  fbclid?: string | null;
}): InterconnectedCohortPath {
  const source = (params.utmSource || "").toLowerCase();
  const medium = (params.utmMedium || "").toLowerCase();
  const campaign = (params.utmCampaign || "").toLowerCase();
  const combined = `${source} ${medium} ${campaign}`;

  if (source === "kajabi_page" || combined.includes("kajabi")) return "kajabi_page";
  if (combined.includes("klaviyo") || medium === "sms" || source === "sms") return "klaviyo_sms";
  if (params.fbclid || /\b(meta|facebook|instagram|agora)\b/.test(combined)) return "meta_paid";
  return "other";
}

export type FacebookAgoraAttributionTier =
  | "ad_id_confirmed"
  | "campaign_id_confirmed"
  | "campaign_key_confirmed"
  | "cohort_confirmed";

export function classifyFacebookAgoraAttributionTier(params: {
  utmSource?: string | null;
  utmMedium?: string | null;
  utmCampaign?: string | null;
  fbclid?: string | null;
  metaCampaignId?: string | null;
  metaAdsetId?: string | null;
  metaAdId?: string | null;
  metaCampaignKey?: string | null;
}): FacebookAgoraAttributionTier | null {
  if (classifyInterconnectedCohortPath(params) !== "meta_paid") return null;
  if (params.metaCampaignId && params.metaAdsetId && params.metaAdId) return "ad_id_confirmed";
  if (params.metaCampaignId) return "campaign_id_confirmed";
  if (params.metaCampaignKey) return "campaign_key_confirmed";
  return "cohort_confirmed";
}

export function getFacebookAgoraCampaignLabel(params: {
  metaCampaignId?: string | null;
  metaCampaignKey?: string | null;
  utmCampaign?: string | null;
}): string {
  if (params.metaCampaignId && params.metaCampaignKey) {
    return `${params.metaCampaignKey} (${params.metaCampaignId})`;
  }
  if (params.metaCampaignId) return `Meta campaign ${params.metaCampaignId}`;
  if (params.metaCampaignKey) return params.metaCampaignKey;
  if (params.utmCampaign) return params.utmCampaign;
  return "Facebook / Agora cohort — campaign ID unavailable";
}

export function dayOffsetFromLead(leadCreatedAt: number, purchasedAt: number): number | null {
  const delta = purchasedAt - leadCreatedAt;
  if (delta < 0) return null;
  return Math.floor(delta / 86_400_000);
}

export function isWithinFourteenDayWindow(leadCreatedAt: number, purchasedAt: number): boolean {
  const offset = dayOffsetFromLead(leadCreatedAt, purchasedAt);
  return offset !== null && offset <= 14;
}

export function toUtcDateKey(timestamp: number): string {
  return new Date(timestamp).toISOString().slice(0, 10);
}
