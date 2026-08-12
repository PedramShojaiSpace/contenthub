import { describe, expect, it } from "vitest";
import { inferKajabiClosingTouch } from "./leadCohortAttribution";

describe("inferKajabiClosingTouch", () => {
  it("uses a direct confidence only when a Kajabi click is explicitly tagged", () => {
    expect(inferKajabiClosingTouch({
      kajabiTagged: true,
      source: "kajabi",
      medium: "email",
      campaign: "interconnected_14day",
      content: "d10_offer",
    })).toMatchObject({ method: "direct_email_click", confidence: "direct", content: "d10_offer" });
  });

  it("keeps untagged Kajabi sequence credit explicitly modeled", () => {
    expect(inferKajabiClosingTouch({ kajabiTagged: true })).toMatchObject({
      method: "modeled_kajabi_sequence",
      confidence: "modeled",
      source: "kajabi",
    });
  });
});
