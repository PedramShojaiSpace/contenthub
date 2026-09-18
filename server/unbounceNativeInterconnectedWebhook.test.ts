import express from "express";
import type { Server } from "node:http";
import { afterEach, describe, expect, it } from "vitest";
import {
  isExplicitSmsConsent,
  registerUnbounceNativeInterconnectedWebhook,
  resolveNativeLeadEventId,
  resolveNativeSmsConsent,
  shouldSuppressNativeCapiForExistingLead,
  UNBOUNCE_NATIVE_INTERCONNECTED_PATH,
  UNBOUNCE_NATIVE_SECRET_HEADER,
} from "./unbounceNativeInterconnectedWebhook";

let server: Server | undefined;

afterEach(async () => {
  if (server) {
    await new Promise<void>((resolve, reject) => server?.close(error => error ? reject(error) : resolve()));
    server = undefined;
  }
});

describe("native Unbounce Interconnected webhook secret", () => {
  it("accepts the configured secret before rejecting an intentionally incomplete test payload", async () => {
    const configuredSecret = process.env.UNBOUNCE_INTERCONNECTED_WEBHOOK_SECRET;
    expect(configuredSecret).toBeTruthy();

    const app = express();
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));
    registerUnbounceNativeInterconnectedWebhook(app);

    await new Promise<void>(resolve => {
      server = app.listen(0, "127.0.0.1", resolve);
    });
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("Expected TCP listener address");

    const response = await fetch(`http://127.0.0.1:${address.port}${UNBOUNCE_NATIVE_INTERCONNECTED_PATH}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        [UNBOUNCE_NATIVE_SECRET_HEADER]: configuredSecret!,
      },
      body: JSON.stringify({}),
    });

    // 400 proves the supplied secret passed authentication; a bad/missing secret is 401.
    expect(response.status).toBe(400);
  });

  it("accepts only explicit checkbox-style values as SMS consent", () => {
    expect(isExplicitSmsConsent(true)).toBe(true);
    expect(isExplicitSmsConsent("checked")).toBe(true);
    expect(isExplicitSmsConsent("YES")).toBe(true);
    expect(isExplicitSmsConsent("1")).toBe(true);
    expect(isExplicitSmsConsent(false)).toBe(false);
    expect(isExplicitSmsConsent(undefined)).toBe(false);
    expect(isExplicitSmsConsent("phone number provided")).toBe(false);
  });

  it("accepts the concrete Checkbox Select choice ID only with a phone and affirmative choice", () => {
    expect(resolveNativeSmsConsent({
      phone: "3104208733",
      sms_consent_yes: "Yes",
    })).toBe(true);
    expect(resolveNativeSmsConsent({
      phone: "3104208733",
      sms_consent: "",
      sms_consent_yes: "Yes",
    })).toBe(true);
    expect(resolveNativeSmsConsent({
      phone: "3104208733",
      sms_consent_yes: "",
    })).toBe(false);
    expect(resolveNativeSmsConsent({
      sms_consent_yes: "Yes",
    })).toBe(false);
  });

  it("suppresses a second CAPI Lead when the browser bridge won the delivery race", () => {
    expect(shouldSuppressNativeCapiForExistingLead(true)).toBe(true);
    expect(shouldSuppressNativeCapiForExistingLead(false)).toBe(false);
  });

  it("uses a valid LP-3 browser event ID so browser Lead and CAPI can deduplicate", () => {
    const input = {
      email: "person@example.com",
      pageUuid: "9872b1ca-b228-46f8-b1fe-b3885c254663",
      submittedAt: "2026-09-18 06:00 PM UTC",
    };
    expect(resolveNativeLeadEventId({
      ...input,
      browserEventId: "ub_ic_3f2de9d2b0e8426385ba083cc0dc1a42",
    })).toBe("ub_ic_3f2de9d2b0e8426385ba083cc0dc1a42");
  });

  it("rejects malformed browser event IDs and retains the deterministic native fallback", () => {
    const input = {
      email: "person@example.com",
      pageUuid: "9872b1ca-b228-46f8-b1fe-b3885c254663",
      submittedAt: "2026-09-18 06:00 PM UTC",
    };
    const fallback = resolveNativeLeadEventId({ ...input, browserEventId: "not-a-meta-event-id" });
    expect(fallback).toMatch(/^ubn_ic_[a-f0-9]{48}$/);
  });
});
