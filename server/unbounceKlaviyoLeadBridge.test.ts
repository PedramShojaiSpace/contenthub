import express from "express";
import type { Server } from "node:http";
import { afterEach, describe, expect, it, vi } from "vitest";

const {
  pushInterconnectedEmailLeadMock,
  sendCapiEventMock,
} = vi.hoisted(() => ({
  pushInterconnectedEmailLeadMock: vi.fn(),
  sendCapiEventMock: vi.fn(),
}));

vi.mock("./klaviyo", () => ({
  pushInterconnectedEmailLead: pushInterconnectedEmailLeadMock,
}));

vi.mock("./capiHelper", () => ({
  sendCapiEvent: sendCapiEventMock,
}));

import {
  buildExistingLeadAttributionUpdate,
  isAllowedUnbounceOrigin,
  isAllowedUnbouncePageUrl,
  parseUnbounceBridgeBody,
  registerUnbounceKlaviyoLeadBridge,
  shouldSuppressBridgeCapiForExistingLead,
  UNBOUNCE_INTERCONNECTED_ORIGIN,
  UNBOUNCE_INTERCONNECTED_FORM_ID,
  UNBOUNCE_LEAD_BRIDGE_PATH,
} from "./unbounceKlaviyoLeadBridge";

let server: Server | undefined;

afterEach(async () => {
  if (server) {
    await new Promise<void>((resolve, reject) => server?.close(error => error ? reject(error) : resolve()));
    server = undefined;
  }
  pushInterconnectedEmailLeadMock.mockReset();
  sendCapiEventMock.mockReset();
});

describe("Unbounce/Klaviyo Lead bridge boundaries", () => {
  it("only allows browser calls from the designated Unbounce origin", () => {
    expect(isAllowedUnbounceOrigin("https://try.theurbanmonk.com")).toBe(true);
    expect(isAllowedUnbounceOrigin("https://content.theurbanmonk.com")).toBe(false);
    expect(isAllowedUnbounceOrigin("https://evil.example")).toBe(false);
  });

  it("only accepts the dedicated Interconnected landing-page URL", () => {
    expect(isAllowedUnbouncePageUrl("https://try.theurbanmonk.com/interconnected-lp/")).toBe(true);
    expect(isAllowedUnbouncePageUrl("https://try.theurbanmonk.com/interconnected-lp")).toBe(true);
    expect(isAllowedUnbouncePageUrl("https://try.theurbanmonk.com/interconnected-lp/?utm_source=meta")).toBe(true);
    expect(isAllowedUnbouncePageUrl("https://try.theurbanmonk.com/interconnected-lp-3/")).toBe(true);
    expect(isAllowedUnbouncePageUrl("https://try.theurbanmonk.com/interconnected-lp-3")).toBe(true);
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

  it("enrolls a native Unbounce submission into Klaviyo with explicit SMS consent only", async () => {
    const originalDatabaseUrl = process.env.DATABASE_URL;
    process.env.DATABASE_URL = "";
    pushInterconnectedEmailLeadMock.mockResolvedValue({ profileId: "profile_123", smsSubscribed: true });
    sendCapiEventMock.mockResolvedValue(true);

    const app = express();
    registerUnbounceKlaviyoLeadBridge(app);
    await new Promise<void>(resolve => {
      server = app.listen(0, "127.0.0.1", resolve);
    });
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("Expected TCP listener address");

    const response = await fetch(`http://127.0.0.1:${address.port}${UNBOUNCE_LEAD_BRIDGE_PATH}`, {
      method: "POST",
      headers: {
        Origin: UNBOUNCE_INTERCONNECTED_ORIGIN,
        "Content-Type": "text/plain;charset=UTF-8",
      },
      body: JSON.stringify({
        eventId: "ub_ic_0123456789abcdef",
        formId: UNBOUNCE_INTERCONNECTED_FORM_ID,
        email: "bridge-test@example.com",
        phone: "555 222 1000",
        smsConsent: true,
        pageUrl: "https://try.theurbanmonk.com/interconnected-lp-3/?utm_source=meta",
      }),
    });

    process.env.DATABASE_URL = originalDatabaseUrl;
    expect(response.status).toBe(200);
    expect(pushInterconnectedEmailLeadMock).toHaveBeenCalledWith({
      email: "bridge-test@example.com",
      phone: "555 222 1000",
      smsConsent: true,
    });
  });
});
