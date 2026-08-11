import crypto from "crypto";
import { describe, expect, it } from "vitest";
import { isAuthorizedShopifyWebhook } from "./shopifyWebhookAuth";

describe("isAuthorizedShopifyWebhook", () => {
  it("accepts a correctly signed Shopify HMAC", () => {
    const rawBody = '{"id":123}';
    const secret = "shopify-app-secret";
    const hmacHeader = crypto.createHmac("sha256", secret).update(rawBody, "utf8").digest("base64");

    expect(isAuthorizedShopifyWebhook({ rawBody, hmacHeader, shopifyAppSecret: secret })).toBe(true);
  });

  it("accepts only an exact managed ingest key when no app secret is available", () => {
    expect(isAuthorizedShopifyWebhook({ rawBody: "{}", ingestSecret: "safe-key", ingestKey: "safe-key" })).toBe(true);
    expect(isAuthorizedShopifyWebhook({ rawBody: "{}", ingestSecret: "safe-key", ingestKey: "wrong-key" })).toBe(false);
  });
});
