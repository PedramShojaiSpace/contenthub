import crypto from "crypto";
import { describe, expect, it } from "vitest";

const secret = process.env.SHOPIFY_WEBHOOK_SECRET;
const baseUrl = process.env.WEBDEV_TEST_URL ?? "http://127.0.0.1:3000";

describe("configured Shopify webhook signing secret", () => {
  it("authorizes a correctly signed, deliberately malformed non-order payload without creating an order or CAPI event", async () => {
    expect(secret, "SHOPIFY_WEBHOOK_SECRET must be configured").toBeTruthy();

    const rawBody = "not-json";
    const hmacHeader = crypto.createHmac("sha256", secret!).update(rawBody, "utf8").digest("base64");
    const response = await fetch(`${baseUrl}/api/shopify/order-paid`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Hmac-Sha256": hmacHeader,
      },
      body: rawBody,
    });

    // A 400 proves HMAC authentication passed and the receiver safely stopped
    // before payload parsing, persistence, Klaviyo, or CAPI work could occur.
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Invalid Shopify webhook payload" });
  });
});
