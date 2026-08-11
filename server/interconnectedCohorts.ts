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
