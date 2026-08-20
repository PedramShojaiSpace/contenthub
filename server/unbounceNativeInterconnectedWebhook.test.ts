import express from "express";
import type { Server } from "node:http";
import { afterEach, describe, expect, it } from "vitest";
import {
  isExplicitSmsConsent,
  registerUnbounceNativeInterconnectedWebhook,
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
});
