/**
 * klaviyo.test.ts
 * Validates that the KLAVIYO_PRIVATE_KEY is set and the API connection works.
 */

import { describe, it, expect } from "vitest";
import { testKlaviyoConnection } from "./klaviyo";

describe("Klaviyo API connection", () => {
  it("should connect to Klaviyo with the configured API key", async () => {
    const result = await testKlaviyoConnection();
    console.log("[Klaviyo test] result:", result);
    expect(result.ok).toBe(true);
    expect(result.accountName).toBeDefined();
  }, 15_000); // 15s timeout for network call
});
