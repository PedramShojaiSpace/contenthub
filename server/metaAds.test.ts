/**
 * Meta Ads credentials validation test
 * Verifies that the META_AD_ACCESS_TOKEN, META_APP_ID, META_APP_SECRET,
 * and META_AD_ACCOUNT_ID are set and the token is valid.
 */
import { describe, it, expect } from "vitest";
import { getMetaAdsConfig, validateToken } from "./metaAdsClient";

describe("Meta Ads credentials", () => {
  it("should have all required env vars set", () => {
    expect(process.env.META_AD_ACCESS_TOKEN, "META_AD_ACCESS_TOKEN must be set").toBeTruthy();
    expect(process.env.META_AD_ACCOUNT_ID, "META_AD_ACCOUNT_ID must be set").toBeTruthy();
    expect(process.env.META_APP_ID, "META_APP_ID must be set").toBeTruthy();
    expect(process.env.META_APP_SECRET, "META_APP_SECRET must be set").toBeTruthy();
  });

  it("should build config without throwing", () => {
    expect(() => getMetaAdsConfig()).not.toThrow();
    const config = getMetaAdsConfig();
    expect(config.adAccountId).toBe("1153114224705920");
    expect(config.appId).toBe("2150724875769823");
  });

  it("should validate the access token against Meta API", async () => {
    const config = getMetaAdsConfig();
    const result = await validateToken(config);
    expect(result.valid, `Token validation failed: ${result.error}`).toBe(true);
    expect(result.scopes).toBeDefined();
    console.log("✅ Token valid. Scopes:", result.scopes?.join(", "));
    console.log("   Expires:", result.expiresAt ?? "never (system user token)");
  }, 15000);
});
