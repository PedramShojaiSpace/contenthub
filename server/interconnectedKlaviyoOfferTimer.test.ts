import { describe, expect, it } from "vitest";
import {
  KLAVIYO_OFFER_TIMER_STORAGE_KEY,
  resolveKlaviyoOfferEndTime,
} from "../client/src/lib/interconnectedKlaviyoOfferTimer";

describe("Interconnected Klaviyo thank-you offer timer", () => {
  const now = 1_700_000_000_000;
  const durationMs = 15 * 60 * 1000;

  it("uses an isolated storage key rather than inheriting legacy thank-you expiry state", () => {
    expect(KLAVIYO_OFFER_TIMER_STORAGE_KEY).toBe("ic_klaviyo_offer_end_time_v2");
    expect(KLAVIYO_OFFER_TIMER_STORAGE_KEY).not.toBe("ty_offer_end_time");
  });

  it("keeps a valid active Klaviyo timer", () => {
    expect(resolveKlaviyoOfferEndTime({
      storedValue: String(now + 5_000),
      now,
      durationMs,
    })).toBe(now + 5_000);
  });

  it("replaces expired or malformed timer values with a fresh active window", () => {
    expect(resolveKlaviyoOfferEndTime({
      storedValue: String(now - 1),
      now,
      durationMs,
    })).toBe(now + durationMs);

    expect(resolveKlaviyoOfferEndTime({
      storedValue: "not-a-timestamp",
      now,
      durationMs,
    })).toBe(now + durationMs);
  });
});
