import crypto from "crypto";

function safeEquals(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

export function isAuthorizedShopifyWebhook(params: {
  hmacHeader?: string;
  rawBody: string;
  shopifyAppSecret?: string;
  ingestKey?: string;
  ingestSecret?: string;
}): boolean {
  if (params.shopifyAppSecret && params.hmacHeader) {
    const expected = crypto
      .createHmac("sha256", params.shopifyAppSecret)
      .update(params.rawBody, "utf8")
      .digest("base64");
    if (safeEquals(expected, params.hmacHeader)) return true;
  }

  // The managed Shopify integration can use this signed callback URL when its
  // app-secret is not exposed to this project runtime.
  if (params.ingestSecret && params.ingestKey && safeEquals(params.ingestSecret, params.ingestKey)) {
    return true;
  }

  return false;
}
