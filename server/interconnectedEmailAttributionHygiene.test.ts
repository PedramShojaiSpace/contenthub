import { describe, expect, it } from "vitest";
import { canonicalKoKlaviyoMessageKey, isIsolatedEmailAttribution } from "./interconnectedEmailAttributionHygiene";

describe("Interconnected email attribution hygiene", () => {
  it("accepts the two authorized payment-path and sender combinations", () => {
    expect(isIsolatedEmailAttribution({ funnelPath: "kajabi", messageKey: "kajabi_d00_offer", utmSource: "kajabi" })).toBe(true);
    expect(isIsolatedEmailAttribution({ funnelPath: "ko_klaviyo", messageKey: "ko_d00_offer", utmSource: "klaviyo" })).toBe(true);
  });

  it("rejects cross-path source credit and missing message keys", () => {
    expect(isIsolatedEmailAttribution({ funnelPath: "kajabi", messageKey: "kajabi_d00_offer", utmSource: "klaviyo" })).toBe(false);
    expect(isIsolatedEmailAttribution({ funnelPath: "ko_klaviyo", messageKey: "ko_d00_offer", utmSource: "kajabi" })).toBe(false);
    expect(isIsolatedEmailAttribution({ funnelPath: "kajabi", messageKey: "", utmSource: "kajabi" })).toBe(false);
  });

  it("maps only the verified Day 0 Klaviyo message to the KO offer key", () => {
    expect(canonicalKoKlaviyoMessageKey("XzP5hq")).toBe("ko_d00_offer");
    expect(canonicalKoKlaviyoMessageKey("unverified-message")).toBeNull();
  });
});
