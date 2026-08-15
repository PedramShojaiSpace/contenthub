import { describe, expect, it } from "vitest";
import {
  isAllowedUnbounceOrigin,
  isAllowedUnbouncePageUrl,
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
    expect(isAllowedUnbouncePageUrl("https://try.theurbanmonk.com/another-page/")).toBe(false);
  });

  it("uses the one intended form and public bridge path", () => {
    expect(UNBOUNCE_INTERCONNECTED_FORM_ID).toBe("SJAKDW");
    expect(UNBOUNCE_LEAD_BRIDGE_PATH).toBe("/api/interconnected/unbounce-lead");
  });
});
