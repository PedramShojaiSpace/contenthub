import { describe, expect, it } from "vitest";
import { getShopifyWebhookRawBody, parseShopifyWebhookPayload } from "./shopifyWebhookPayload";

describe("parseShopifyWebhookPayload", () => {
  it("preserves the exact raw JSON body needed for Shopify HMAC verification", () => {
    const raw = '{"id":123,"total_price":"67.00","line_items":[]}';

    const payload = parseShopifyWebhookPayload(Buffer.from(raw, "utf8"));

    expect(payload.rawBody).toBe(raw);
    expect(payload.order).toMatchObject({ id: 123, total_price: "67.00" });
  });

  it("extracts raw request bytes without parsing them", () => {
    const raw = "not-json";

    expect(getShopifyWebhookRawBody(Buffer.from(raw, "utf8"))).toBe(raw);
  });

  it("rejects a raw payload that is not valid JSON", () => {
    expect(() => parseShopifyWebhookPayload(Buffer.from("not-json", "utf8"))).toThrow(
      "Unexpected token"
    );
  });
});
