import { describe, expect, it } from "vitest";
import { isIsolatedEmailAttribution } from "./interconnectedEmailAttributionHygiene";

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
});
