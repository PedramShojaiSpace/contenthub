import { describe, expect, it } from "vitest";
import { buildTantraCheckoutParams, parseDisplayedPrice } from "../shared/tantraMetaEvents";

describe("Tantra Meta checkout event payloads", () => {
  it("extracts the intended dollar value from a displayed offer price", () => {
    expect(parseDisplayedPrice("$185")).toBe(185);
    expect(parseDisplayedPrice("$199.00 member offer")).toBe(199);
    expect(parseDisplayedPrice("Contact us")).toBeNull();
  });

  it("builds a catalog-safe checkout intent payload", () => {
    expect(buildTantraCheckoutParams({ name: "Tantra Him", price: "$185" })).toEqual({
      content_name: "Tantra Him",
      content_category: "tantra_quiz",
      content_ids: ["tantra-him"],
      currency: "USD",
      value: 185,
    });
  });
});
