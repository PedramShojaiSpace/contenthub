export type KajabiWebhookPayload = {
  rawBody: string;
  payload: Record<string, unknown>;
};

export type NormalizedKajabiPurchase = {
  email: string;
  name: string;
  amount: number;
  orderId: string;
  offerName: string;
  offerId: string;
  upsellId: string;
  hasMultipleOffers: boolean;
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function stringValue(...values: unknown[]): string {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }
  return "";
}

function amountValue(...values: unknown[]): number {
  for (const value of values) {
    const parsed = typeof value === "number" ? value : Number.parseFloat(String(value ?? ""));
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  return 0;
}

export function getKajabiWebhookRawBody(body: unknown): string {
  return Buffer.isBuffer(body)
    ? body.toString("utf8")
    : typeof body === "string"
      ? body
      : JSON.stringify(body ?? {});
}

/**
 * Preserves original webhook bytes for HMAC verification before exposing a parsed
 * top-level payload. Re-serializing parsed JSON can invalidate a signature.
 */
export function parseKajabiWebhookPayload(body: unknown): KajabiWebhookPayload {
  const rawBody = getKajabiWebhookRawBody(body);
  const payload = Buffer.isBuffer(body) || typeof body === "string"
    ? JSON.parse(rawBody)
    : body;

  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new Error("Kajabi webhook payload must be a JSON object.");
  }
  return { rawBody, payload: payload as Record<string, unknown> };
}

/**
 * Normalizes both the legacy flat fields and Kajabi's current nested
 * payment.succeeded payload. Amount fields expressed in cents are converted to
 * dollars only when no decimal field is available.
 */
export function normalizeKajabiPurchase(payload: Record<string, unknown>): NormalizedKajabiPurchase {
  const member = asRecord(payload.member);
  const offer = asRecord(payload.offer);
  const paymentTransaction = asRecord(payload.payment_transaction);
  const transaction = asRecord(payload.transaction);
  const upsell = asRecord(payload.upsell);

  const offerId = stringValue(payload.offer_id, payload.product_id, offer.id);
  const offerName = stringValue(payload.offer_name, payload.product_name, payload.title, offer.title, offer.internal_title, "Kajabi Purchase");
  const decimalAmount = amountValue(
    payload.amount,
    payload.total,
    payload.price,
    paymentTransaction.amount_paid_decimal,
    transaction.amount_paid_decimal,
    offer.total_amount_decimal,
    offer.unit_cost_decimal,
  );
  const centsAmount = amountValue(
    paymentTransaction.amount_paid,
    transaction.amount_paid,
    offer.total_amount,
    offer.unit_cost,
  );

  return {
    email: stringValue(payload.email, member.email).toLowerCase(),
    name: stringValue(payload.name, member.name, [member.first_name, member.last_name].filter(Boolean).join(" ")),
    amount: decimalAmount || (centsAmount > 0 ? centsAmount / 100 : 0),
    orderId: stringValue(
      payload.id,
      payload.order_id,
      payload.purchase_id,
      paymentTransaction.id,
      transaction.transaction_id,
    ),
    offerName,
    offerId,
    upsellId: stringValue(payload.upsell_id, upsell.id),
    hasMultipleOffers: offerId.includes(",") || offerName.includes(","),
  };
}
