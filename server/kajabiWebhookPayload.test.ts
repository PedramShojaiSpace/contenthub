import { describe, expect, it } from "vitest";
import {
  getKajabiWebhookRawBody,
  normalizeKajabiPurchase,
  parseKajabiWebhookPayload,
} from "./kajabiWebhookPayload";

describe("Kajabi payment.succeeded payload handling", () => {
  it("preserves exact raw JSON bytes for signature verification", () => {
    const raw = '{"member":{"email":"buyer@example.com"},"payment_transaction":{"id":42,"amount_paid_decimal":199}}';
    const parsed = parseKajabiWebhookPayload(Buffer.from(raw, "utf8"));

    expect(parsed.rawBody).toBe(raw);
    expect(parsed.payload.member).toEqual({ email: "buyer@example.com" });
    expect(getKajabiWebhookRawBody(Buffer.from(raw, "utf8"))).toBe(raw);
  });

  it("normalizes Kajabi's current nested Payment Succeeded payload", () => {
    const normalized = normalizeKajabiPurchase({
      member: { email: "Buyer@Example.com", name: "Jane Smith" },
      offer: { id: "2151333044", title: "Gut Permeability + Food Sensitivity Test" },
      payment_transaction: { id: 777, amount_paid_decimal: 199 },
    });

    expect(normalized).toMatchObject({
      email: "buyer@example.com",
      name: "Jane Smith",
      amount: 199,
      orderId: "777",
      offerId: "2151333044",
      hasMultipleOffers: false,
    });
  });

  it("marks combined offer transactions so the receiver can retain an audit trail without guessing a single offer", () => {
    const normalized = normalizeKajabiPurchase({
      member: { email: "buyer@example.com" },
      offer: { id: "111,222", title: "Primary,Order Bump" },
      payment_transaction: { id: 778, amount_paid: 9000 },
    });

    expect(normalized.amount).toBe(90);
    expect(normalized.hasMultipleOffers).toBe(true);
  });
});
