/**
 * PART 3B MULTI-TIER — regression tests.
 *
 * These exist because the single-offer version of 3B silently bound NOTHING on
 * the only real sales page in the corpus ("Beyond Normal Labs", which ladders a
 * course, a $499 bundle and a $299 app tier). The unit tests passed at the time
 * because the fixtures were hand-written single-offer copy — kinder than reality.
 * So every fixture below is shaped like the real page.
 */
import { describe, it, expect } from "vitest";
import {
  validateOfferLadder,
  selectOfferTier,
  parseStoredOfferLadder,
  parseStoredOfferProfile,
} from "./offerProfile";

const tier = (name: string, extra: Record<string, unknown> = {}) => ({
  offerName: name,
  offerType: "program",
  deliverables: ["6 recorded modules", "daily practice library"],
  targetAction: `purchase ${name}`,
  ...extra,
});

describe("validateOfferLadder — shape tolerance", () => {
  it("accepts the wrapped { tiers: [...] } form", () => {
    const l = validateOfferLadder({ tiers: [tier("Upstream Bundle"), tier("Upstream Course")] });
    expect(l.tiers.map((t) => t.offerName)).toEqual(["Upstream Bundle", "Upstream Course"]);
  });

  it("accepts a bare array (model ignored the wrapper)", () => {
    const l = validateOfferLadder([tier("Bundle"), tier("App")]);
    expect(l.tiers).toHaveLength(2);
  });

  it("accepts a single bare object — legacy rows must keep working", () => {
    const l = validateOfferLadder(tier("90-Day Gut Reset"));
    expect(l.tiers).toHaveLength(1);
    expect(l.tiers[0].offerName).toBe("90-Day Gut Reset");
  });

  it("accepts a JSON string", () => {
    const l = validateOfferLadder(JSON.stringify({ tiers: [tier("Bundle")] }));
    expect(l.tiers).toHaveLength(1);
  });

  it("returns an empty ladder for null / 'null' / garbage, never throws", () => {
    expect(validateOfferLadder(null).tiers).toEqual([]);
    expect(validateOfferLadder("null").tiers).toEqual([]);
    expect(validateOfferLadder("{not json").tiers).toEqual([]);
    expect(validateOfferLadder({ tiers: [] }).tiers).toEqual([]);
    expect(validateOfferLadder(undefined).tiers).toEqual([]);
  });
});

describe("validateOfferLadder — all-or-nothing stays PER TIER", () => {
  it("drops only the invalid tier, keeping the valid ones", () => {
    // THE core regression: one malformed tier must not discard the whole page,
    // which is exactly how the real sales page came back binding nothing.
    const l = validateOfferLadder({
      tiers: [
        tier("Upstream Bundle"),
        { offerName: "", offerType: "program", deliverables: [], targetAction: "" },
        { offerName: "App Only", deliverables: [], targetAction: "buy the app" }, // no deliverables
        tier("Upstream Course"),
      ],
    });
    expect(l.tiers.map((t) => t.offerName)).toEqual(["Upstream Bundle", "Upstream Course"]);
  });

  it("still refuses a tier missing deliverables — partial is worse than absent", () => {
    const l = validateOfferLadder({
      tiers: [{ offerName: "Bundle", offerType: "program", deliverables: [], targetAction: "buy" }],
    });
    expect(l.tiers).toEqual([]);
  });

  it("never invents a guarantee for a tier that states none", () => {
    const l = validateOfferLadder({ tiers: [tier("App Only", { pricePoint: "$299" })] });
    expect(l.tiers[0].guarantee).toBeNull();
    expect(l.tiers[0].pricePoint).toBe("$299");
  });

  it("collapses duplicate offer names, keeping the first occurrence", () => {
    const l = validateOfferLadder({
      tiers: [
        tier("Upstream Bundle", { pricePoint: "$499" }),
        tier("upstream bundle", { pricePoint: "$599" }),
      ],
    });
    expect(l.tiers).toHaveLength(1);
    expect(l.tiers[0].pricePoint).toBe("$499");
  });
});

describe("selectOfferTier — no silent price-point choices", () => {
  const ladder = validateOfferLadder({
    tiers: [
      tier("Upstream Bundle", { pricePoint: "$499", guarantee: "30-Day Gut Reset Promise" }),
      tier("Upstream Course", { pricePoint: "$399" }),
      tier("Upstream App", { pricePoint: "from $299" }),
    ],
  });

  it("refuses to auto-pick when several tiers exist", () => {
    const r = selectOfferTier(ladder);
    expect(r.profile).toBeNull();
    expect(r.reason).toBe("tier_not_chosen");
  });

  it("binds the explicitly requested tier", () => {
    const r = selectOfferTier(ladder, "Upstream Bundle");
    expect(r.profile?.pricePoint).toBe("$499");
    expect(r.profile?.guarantee).toBe("30-Day Gut Reset Promise");
    expect(r.reason).toBe("explicit_tier");
  });

  it("matches the requested tier case-insensitively", () => {
    expect(selectOfferTier(ladder, "upstream app")?.profile?.offerName).toBe("Upstream App");
  });

  it("does NOT fall back to another tier when the requested one is absent", () => {
    // Falling back would sell a different price than the operator asked for.
    const r = selectOfferTier(ladder, "Nonexistent Tier");
    expect(r.profile).toBeNull();
    expect(r.reason).toBe("requested_tier_not_found");
  });

  it("binds directly when there is exactly one tier — no ambiguity to resolve", () => {
    const single = validateOfferLadder({ tiers: [tier("90-Day Gut Reset")] });
    const r = selectOfferTier(single);
    expect(r.profile?.offerName).toBe("90-Day Gut Reset");
    expect(r.reason).toBe("single_tier");
  });

  it("reports no_offer for an empty ladder", () => {
    expect(selectOfferTier({ tiers: [] }).reason).toBe("no_offer");
  });
});

describe("stored-column back compatibility", () => {
  it("reads a legacy single-object row as a one-tier ladder", () => {
    const stored = JSON.stringify(tier("90-Day Gut Reset"));
    expect(parseStoredOfferLadder(stored).tiers).toHaveLength(1);
    expect(parseStoredOfferProfile(stored)?.offerName).toBe("90-Day Gut Reset");
  });

  it("parseStoredOfferProfile returns null for an ambiguous ladder", () => {
    // Callers that want one profile must not silently receive tier #1.
    const stored = JSON.stringify({ tiers: [tier("Bundle"), tier("Course")] });
    expect(parseStoredOfferLadder(stored).tiers).toHaveLength(2);
    expect(parseStoredOfferProfile(stored)).toBeNull();
  });

  it("treats a NULL column as no offer", () => {
    expect(parseStoredOfferLadder(null).tiers).toEqual([]);
    expect(parseStoredOfferProfile(null)).toBeNull();
  });
});
