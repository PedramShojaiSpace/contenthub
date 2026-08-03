/**
 * PART 3B tests — offer binding.
 *
 * The central invariant under test is PARTIAL IS WORSE THAN ABSENT. A profile
 * with a blank offerName would put a hole in the prompt ("name the offer: ''")
 * and the model fills holes by inventing. So every incomplete extraction must
 * collapse to null rather than degrade gracefully.
 */
import { describe, it, expect } from "vitest";
import {
  validateOfferProfile,
  buildOfferBlock,
  buildCtaOverrideBlock,
  parseStoredOfferProfile,
  OFFER_EXTRACTION_PROMPT,
  MAX_FREE_TIPS,
  type OfferProfile,
} from "./offerProfile";

const FULL: OfferProfile = {
  offerName: "The 90-Day Gut Reset",
  offerType: "program",
  deliverables: ["12 weekly live calls", "the full lab panel", "a private community"],
  guarantee: "Full refund within 30 days if you complete the first module",
  timeline: "90 days",
  pricePoint: "$1,997 or 3 payments of $699",
  primaryCtaUrl: "https://theurbanmonk.com/gut-reset",
  targetAction: "enroll in the 90-Day Gut Reset",
};

describe("3B validation is all-or-nothing", () => {
  it("accepts a complete profile", () => {
    expect(validateOfferProfile(FULL)).toEqual(FULL);
  });

  it("returns null when offerName is blank — never a partial object", () => {
    expect(validateOfferProfile({ ...FULL, offerName: "   " })).toBeNull();
  });

  it("returns null when offerName is missing entirely", () => {
    const { offerName, ...rest } = FULL;
    expect(validateOfferProfile(rest)).toBeNull();
  });

  it("returns null when targetAction is missing", () => {
    const { targetAction, ...rest } = FULL;
    expect(validateOfferProfile(rest)).toBeNull();
  });

  it("returns null when deliverables is empty", () => {
    expect(validateOfferProfile({ ...FULL, deliverables: [] })).toBeNull();
  });

  it("returns null when deliverables contains only blanks", () => {
    expect(validateOfferProfile({ ...FULL, deliverables: ["", "  "] })).toBeNull();
  });

  it("returns null for the literal string 'null' the model may emit", () => {
    expect(validateOfferProfile("null")).toBeNull();
    expect(validateOfferProfile(null)).toBeNull();
    expect(validateOfferProfile(undefined)).toBeNull();
  });

  it("returns null for unparseable output rather than throwing", () => {
    expect(validateOfferProfile("{not json at all")).toBeNull();
    expect(validateOfferProfile("Sure! Here is the offer:")).toBeNull();
  });

  it("returns null for an array or scalar", () => {
    expect(validateOfferProfile([FULL])).toBeNull();
    expect(validateOfferProfile(42)).toBeNull();
  });

  it("parses a JSON string payload", () => {
    expect(validateOfferProfile(JSON.stringify(FULL))).toEqual(FULL);
  });
});

describe("3B unstated fields become null, never empty string", () => {
  it("normalises blank optionals to null", () => {
    const p = validateOfferProfile({
      ...FULL, guarantee: "  ", timeline: "", pricePoint: "null", primaryCtaUrl: "none",
    });
    expect(p).not.toBeNull();
    expect(p!.guarantee).toBeNull();
    expect(p!.timeline).toBeNull();
    expect(p!.pricePoint).toBeNull();
    expect(p!.primaryCtaUrl).toBeNull();
  });

  it("a page stating no duration yields timeline null and stays valid", () => {
    const p = validateOfferProfile({ ...FULL, timeline: null });
    expect(p).not.toBeNull();
    expect(p!.timeline).toBeNull();
  });

  it("falls back to 'other' for an unrecognised offerType", () => {
    const p = validateOfferProfile({ ...FULL, offerType: "membership" });
    expect(p!.offerType).toBe("other");
  });

  it("trims deliverables and drops non-strings", () => {
    const p = validateOfferProfile({ ...FULL, deliverables: ["  a  ", 7, null, "b"] });
    expect(p!.deliverables).toEqual(["a", "b"]);
  });
});

describe("3B offer block binds the CTA", () => {
  const block = buildOfferBlock(FULL);

  it("injects the offer header and names the offer", () => {
    expect(block).toContain("=== THE OFFER (what this script ultimately sells) ===");
    expect(block).toContain("The 90-Day Gut Reset");
  });

  it("requires at least two deliverables be cited", () => {
    expect(block).toContain("at least TWO of the concrete deliverables");
    expect(block).toContain("12 weekly live calls");
  });

  it("states the guarantee when one exists", () => {
    expect(block).toContain("Full refund within 30 days");
  });

  it("drives the target action", () => {
    expect(block).toContain("enroll in the 90-Day Gut Reset");
  });

  it("caps free tips and forbids framing them as sufficient", () => {
    expect(block).toContain(`at most ${MAX_FREE_TIPS} practical tips`);
    expect(block).toContain("NEVER frame a tip as sufficient");
  });
});

describe("3B guarantee is conditional — the invented-refund guard", () => {
  const noGuarantee = buildOfferBlock({ ...FULL, guarantee: null });

  it("never instructs the model to state a guarantee that does not exist", () => {
    expect(noGuarantee).not.toContain("State the guarantee");
  });

  it("actively forbids inventing refund or risk-free framing", () => {
    expect(noGuarantee).toContain("NO stated guarantee");
    expect(noGuarantee).toContain("Do NOT mention, imply, or invent any");
  });

  it("omits optional lines that are null", () => {
    const bare = buildOfferBlock({
      ...FULL, guarantee: null, timeline: null, pricePoint: null, primaryCtaUrl: null,
    });
    expect(bare).not.toContain("Timeline:");
    expect(bare).not.toContain("Price framing:");
    expect(bare).not.toContain("Action URL:");
    // But the mandatory parts survive.
    expect(bare).toContain("TARGET ACTION:");
  });
});

describe("3B ctaOverride replaces rather than coexists", () => {
  const ov = buildCtaOverrideBlock("  Book a 15-minute call with my team  ");

  it("is authoritative and trims input", () => {
    expect(ov).toContain("=== CTA OVERRIDE (authoritative) ===");
    expect(ov).toContain("Book a 15-minute call with my team");
  });

  it("explicitly forbids a second competing offer", () => {
    expect(ov).toContain("This REPLACES any other offer");
    expect(ov).toContain("Do not introduce a second");
  });
});

/**
 * v2.3 Part 0 — fact fidelity.
 *
 * Regression cover for the FIT 176 incident. The root cause was wrong DATA in
 * the seeded offer profile, not a prompt defect, so no prompt test could have
 * caught it. What these tests DO cover is the second half of the failure: once
 * a specific reaches the prompt, nothing previously told the model that numbers
 * and product names were untouchable. The fixture below uses deliberately
 * distinctive, unroundable numbers so a drifted assertion is unmistakable.
 */
describe("3B fact fidelity locks offer specifics verbatim", () => {
  const DISTINCTIVE: OfferProfile = {
    offerName: "Meridian FIT 37 & Barrier Integrity Panel",
    offerType: "service",
    deliverables: [
      "Screens 37 primary inflammatory food triggers",
      "Measures Zonulin/Occludin across 4 barrier sites",
      "1-Hour private clinical review session",
    ],
    guarantee: null,
    timeline: "Results in 3–5 Weeks",
    pricePoint: "$399",
    primaryCtaUrl: null,
    targetAction: "order the Meridian panel and book the review session",
  };

  const block = buildOfferBlock(DISTINCTIVE);

  it("emits every distinctive specific verbatim, digits intact", () => {
    expect(block).toContain("Meridian FIT 37 & Barrier Integrity Panel");
    expect(block).toContain("Screens 37 primary inflammatory food triggers");
    expect(block).toContain("Measures Zonulin/Occludin across 4 barrier sites");
    expect(block).toContain("Results in 3–5 Weeks");
    expect(block).toContain("$399");
  });

  it("carries an explicit fact-fidelity instruction, not just a bullet list", () => {
    expect(block).toContain("FACT FIDELITY");
    expect(block).toContain("VERBATIM FACT");
    expect(block).toContain("reproduce them exactly as written");
  });

  it("forbids each drift mode that produced FIT 176", () => {
    // rounding / approximating a count
    expect(block).toContain("NEVER change a number");
    // substituting a different model or variant number from outside knowledge
    expect(block).toContain("never a different model number or variant");
    // adding specifics the profile never stated
    expect(block).toContain("NEVER add a specific that is absent above");
    // elaborating a deliverable into a bigger claim
    expect(block).toContain("NEVER elaborate a deliverable");
  });

  it("names the model's own background knowledge as a non-source", () => {
    // This is the exact failure mode: a plausible product number recalled from
    // outside the page and stated as fact.
    expect(block).toContain("background knowledge");
    expect(block).toContain("is NOT a");
    expect(block).toContain("the only source");
  });

  it("prefers omitting a number over guessing it", () => {
    expect(block).toContain("WITHOUT the number rather than guessing");
  });

  it("keeps the fidelity rule even when there is no guarantee to protect", () => {
    // The guarantee line was previously the ONLY verbatim-protected field.
    // Fidelity must not be coupled to a guarantee existing.
    expect(block).not.toContain("State the guarantee as written");
    expect(block).toContain("FACT FIDELITY");
  });
});

describe("3B extraction prompt forbids invention", () => {
  it("instructs null over fabrication for guarantee and timeline", () => {
    expect(OFFER_EXTRACTION_PROMPT).toContain("NEVER invent a fact that is not in the copy");
    expect(OFFER_EXTRACTION_PROMPT).toContain("states no guarantee");
    expect(OFFER_EXTRACTION_PROMPT).toContain("states no duration");
  });

  it("allows a clean empty result for copy with no offer", () => {
    // Multi-tier changed the contract from a bare `null` to `{ "tiers": [] }`.
    expect(OFFER_EXTRACTION_PROMPT).toContain('return: { "tiers": [] }');
  });

  it("instructs the model to return EVERY purchasable tier", () => {
    expect(OFFER_EXTRACTION_PROMPT).toContain("Return EVERY distinct tier");
    // Tiers must be purchases, not features — otherwise a bonus list becomes
    // three fake offers the operator is asked to choose between.
    expect(OFFER_EXTRACTION_PROMPT).toContain("NOT features, bonuses, or");
  });
});

describe("3B stored column parsing", () => {
  it("round-trips a stored JSON object", () => {
    expect(parseStoredOfferProfile(FULL)).toEqual(FULL);
  });

  it("round-trips a stored JSON string", () => {
    expect(parseStoredOfferProfile(JSON.stringify(FULL))).toEqual(FULL);
  });

  it("treats a NULL column as no profile", () => {
    expect(parseStoredOfferProfile(null)).toBeNull();
  });

  it("treats a corrupt stored value as no profile rather than throwing", () => {
    expect(parseStoredOfferProfile("{broken")).toBeNull();
  });
});
