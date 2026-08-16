export type ShopifyWebhookPayload = {
  rawBody: string;
  order: Record<string, unknown>;
};

export function getShopifyWebhookRawBody(body: unknown): string {
  return Buffer.isBuffer(body)
    ? body.toString("utf8")
    : typeof body === "string"
      ? body
      : JSON.stringify(body ?? {});
}

/**
 * Converts the raw express webhook body into both the exact signed bytes and
 * the parsed Shopify order payload. The raw string must be retained for HMAC
 * verification; serializing a parsed object can change the signed payload.
 */
export function parseShopifyWebhookPayload(body: unknown): ShopifyWebhookPayload {
  const rawBody = getShopifyWebhookRawBody(body);

  const order = Buffer.isBuffer(body) || typeof body === "string"
    ? JSON.parse(rawBody)
    : body;

  if (!order || typeof order !== "object" || Array.isArray(order)) {
    throw new Error("Shopify webhook payload must be a JSON object.");
  }

  return { rawBody, order: order as Record<string, unknown> };
}
