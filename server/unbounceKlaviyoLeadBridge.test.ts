import { describe, expect, it } from "vitest";
import {
  buildExistingLeadAttributionUpdate,
  isAllowedUnbounceOrigin,
  isAllowedUnbouncePageUrl,
  parseUnbounceBridgeBody,
  shouldSuppressBridgeCapiForExistingLead,
  UNBOUNCE_INTERCONNECTED_FORM_ID,
  UNBOUNCE_LEAD_BRIDGE_PATH,
} from "./unbounceKlaviyoLeadBridge";

describe("Unbounce/Klaviyo Lead bridge boundaries", () => {
  it("only allows browser calls from the designated Unbounce origin", () => {
    expect(isAllowedUnbounceOrigin("https://try.theurbanmonk.com")).toBe(true);
    expect(isAllowedUnbounceOrigin("https://content.theurbanmonk.com")).toBe(false);
    expect(isAllowedUnbounceOrigin("https://evil.example")).toBe(false);
  });

  it("only accepts the dedicated Interconnected landing-page URL", () => {
    expect(isAllowedUnbouncePageUrl("https://try.theurbanmonk.com/interconnected-lp/")).toBe(true);
    expect(isAllowedUnbouncePageUrl("https://try.theurbanmonk.com/interconnected-lp/?utm_source=meta")).toBe(true);
    expect(isAllowedUnbouncePageUrl("https://try.theurbanmonk.com/interconnected-lp-3/")).toBe(true);
    expect(isAllowedUnbouncePageUrl("https://try.theurbanmonk.com/interconnected-lp-3/?utm_source=meta")).toBe(true);
    expect(isAllowedUnbouncePageUrl("https://try.theurbanmonk.com/another-page/")).toBe(false);
  });

  it("uses the one intended form and public bridge path", () => {
    expect(UNBOUNCE_INTERCONNECTED_FORM_ID).toBe("SJAKDW");
    expect(UNBOUNCE_LEAD_BRIDGE_PATH).toBe("/api/interconnected/unbounce-lead");
  });

  it("accepts a redirect-safe text/plain beacon payload without weakening validation", () => {
    expect(parseUnbounceBridgeBody('{"formId":"SJAKDW"}')).toEqual({ formId: "SJAKDW" });
    expect(parseUnbounceBridgeBody("not-json")).toBeUndefined();
    expect(parseUnbounceBridgeBody({ formId: "SJAKDW" })).toEqual({ formId: "SJAKDW" });
  });

  it("enriches an existing native lead with browser UTMs without inventing absent values", () => {
    expect(buildExistingLeadAttributionUpdate({
      pageUrl: "https://try.theurbanmonk.com/interconnected-lp-3/?utm_source=meta&utm_campaign=interconnected_ko",
      utmSource: "meta",
      utmCampaign: "interconnected_ko",
      clientIp: "203.0.113.1",
      userAgent: "test-agent",
    })).toEqual({
      utmSource: "meta",
      utmCampaign: "interconnected_ko",
      clientIp: "203.0.113.1",
      userAgent: "test-agent",
      referrer: "https://try.theurbanmonk.com/interconnected-lp-3/?utm_source=meta&utm_campaign=interconnected_ko",
    });
  });

  it("suppresses a second CAPI Lead when the native webhook already delivered it", () => {
    expect(shouldSuppressBridgeCapiForExistingLead(true)).toBe(true);
    expect(shouldSuppressBridgeCapiForExistingLead(false)).toBe(false);
  });
});
