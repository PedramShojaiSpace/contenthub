export const KLAVIYO_OFFER_TIMER_STORAGE_KEY = "ic_klaviyo_offer_end_time_v2";

/**
 * Returns a valid timer end time for the isolated Klaviyo thank-you treatment.
 * A timestamp from a different or expired visit must never make the active
 * Shopify handoff appear unavailable when the recipient first arrives.
 */
export function resolveKlaviyoOfferEndTime({
  storedValue,
  now,
  durationMs,
}: {
  storedValue: string | null;
  now: number;
  durationMs: number;
}): number {
  const parsedEnd = storedValue ? Number.parseInt(storedValue, 10) : Number.NaN;

  if (Number.isFinite(parsedEnd) && parsedEnd > now) {
    return parsedEnd;
  }

  return now + durationMs;
}
