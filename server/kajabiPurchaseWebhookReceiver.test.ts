import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const source = readFileSync(
  fileURLToPath(new URL("./_core/index.ts", import.meta.url)),
  "utf8"
);

describe("Kajabi purchase webhook receiver", () => {
  it("preserves raw bytes before JSON parsing and verifies an HMAC against those bytes", () => {
    expect(source).toContain("rawKajabiBody?: Buffer");
    expect(source).toContain("req.originalUrl === \"/api/kajabi/purchase\"");
    expect(source).toContain("parseKajabiWebhookPayload(");
    expect(source).toContain("update(rawBody)");
  });

  it("uses normalized current Kajabi payload fields and a deterministic transaction fallback", () => {
    expect(source).toContain("normalizeKajabiPurchase(payload)");
    expect(source).toContain("payment_transaction.id");
    expect(source).toContain("kajabi_${createHash");
    expect(source).toContain("const db = await getDb();");
  });

  it("skips duplicate local captures and duplicate CAPI sends for an existing Kajabi order", () => {
    expect(source).toContain("eq(kajabiPurchases.kajabiOrderId, orderId)");
    expect(source).toContain("duplicateWebhookPurchase = true");
    expect(source).toContain("if (duplicateWebhookPurchase) {");
    expect(source).toContain("duplicate: true, capiSent: false");
  });
});
