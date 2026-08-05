/**
 * v2.4 acceptance tests — value-first sell density.
 *
 * Every test here is pure: the lint, the style resolver and the prompt builder are
 * all string-in/string-out, so none of this needs a database or an LLM. That is
 * deliberate — the 33 failing suites in this repo all fail for want of an API key,
 * and adding a 34th would bury a real regression in expected noise.
 *
 * The fixtures mirror the LIVE seeded offer (KBMO Clinical Ecosystem — Diagnostic
 * Intake, FIT 22, $399, two guarantees) rather than an invented one, so a test
 * passing here means the same thing it means against the sandbox row.
 */
import { describe, it, expect } from "vitest";
import {
  lintSellDensity,
  brandTokens,
  buildSellDensityRewriteInstruction,
  STATIC_URGENCY_PHRASES,
} from "./sellDensity";
import {
  resolveCtaStyle,
  ctaStyleFromParams,
  buildValueFirstOfferBlock,
  CTA_STYLES,
} from "./scriptFactoryRouter";
import { buildOfferBlock } from "./offerProfile";
import type { OfferProfile } from "./offerProfile";

/** The live seeded offer, copied from the verified `offer_profile` row. */
const PROFILE: OfferProfile = {
  offerName: "KBMO Clinical Ecosystem — Diagnostic Intake",
  offerType: "diagnostic_intake",
  deliverables: [
    "KBMO FIT 22 & Gut Barrier Permeability Panel, shipped directly to your door",
    "Clinical-Grade Gut Biome Test Kit — a simple, painless at-home collection kit",
    "Full Lab Analysis & Detailed Report — colour-coded red, yellow and green",
    "1-Hour Private 1-on-1 Clinical Health Coach Session reviewing YOUR specific results",
    "Personalized Upstream Action Plan detailing your exact food sensitivity triggers",
  ],
  guarantee:
    "100% Money-Back Guarantee. Plus the No-Rejection Guarantee: regardless of whether you qualify, you walk away with your complete food sensitivity report.",
  pricePoint: "$399",
  timeline: null,
  primaryCtaUrl: "https://theurbanmonk.com/upstream",
  targetAction: "book the diagnostic intake",
};

/** A profile with NO guarantee — the branch that must produce a prohibition. */
const NO_GUARANTEE: OfferProfile = { ...PROFILE, guarantee: null, pricePoint: null };

// ─── The lint ────────────────────────────────────────────────────────────────

describe("lintSellDensity — budgets", () => {
  it("passes a clean value-first body: one mid-roll mention, everything else in the CTA", () => {
    const body = [
      "[HOOK]",
      "Your labs came back normal and you still feel like you are running on a dead battery.",
      "[TEACH]",
      "Inflammation from food is measured by immune complexes, not by IgE alone.",
      "That distinction is why an allergy test can be clean while you still react daily.",
      "[TEACH]",
      "The panel I use with patients for exactly this is called KBMO FIT 22 — I will walk you through it at the end.",
      "Back to the mechanism: zonulin rises when the barrier loosens.",
      "[TEACH]",
      "A structured reintroduction protocol beats permanent elimination in almost every case.",
      "[CTA]",
      "That is the KBMO Clinical Ecosystem — Diagnostic Intake. It is $399, it includes the",
      "KBMO FIT 22 & Gut Barrier Permeability Panel and a 1-Hour Private 1-on-1 Clinical Health Coach Session,",
      "and it carries a 100% Money-Back Guarantee. Book the diagnostic intake at https://theurbanmonk.com/upstream.",
    ].join("\n");

    const r = lintSellDensity(body, PROFILE);
    expect(r.brandedMentions).toBe(1);
    expect(r.deliverablesLists).toBe(0);
    expect(r.priceMentions).toBe(0);
    expect(r.urgencyPhrases).toBe(0);
    expect(r.withinBudget).toBe(true);
  });

  it("does NOT scan the CTA or CLOSE — selling there is the point, not a defect", () => {
    const body = [
      "[TEACH]",
      "Immune complexes are the mechanism that matters here.",
      "[CTA]",
      "The KBMO Clinical Ecosystem — Diagnostic Intake is $399 and includes the KBMO FIT 22 panel.",
      "Slots are limited this month, so do not wait.",
      "[CLOSE]",
      "Again: KBMO FIT 22, $399, book today.",
    ].join("\n");

    const r = lintSellDensity(body, PROFILE);
    expect(r.brandedMentions).toBe(0);
    expect(r.priceMentions).toBe(0);
    expect(r.urgencyPhrases).toBe(0);
    expect(r.withinBudget).toBe(true);
  });

  it("flags a price stated mid-teach", () => {
    const body = [
      "[TEACH]",
      "For $399 you could simply measure this instead of guessing for another year.",
      "[CTA]",
      "Book the diagnostic intake.",
    ].join("\n");

    const r = lintSellDensity(body, PROFILE);
    expect(r.priceMentions).toBe(1);
    expect(r.withinBudget).toBe(false);
    expect(r.findings.some((f) => f.kind === "price_mention")).toBe(true);
  });

  it("flags urgency mid-script, which is the infomercial tell", () => {
    const body = [
      "[TEACH]",
      "Zonulin is the tight-junction signal worth knowing about.",
      "[PAIN]",
      "You cannot go on living this way, and slots are limited.",
      "[CTA]",
      "Book the diagnostic intake.",
    ].join("\n");

    const r = lintSellDensity(body, PROFILE);
    expect(r.urgencyPhrases).toBeGreaterThanOrEqual(1);
    expect(r.withinBudget).toBe(false);
  });

  it("flags a second branded mention — the budget is exactly one", () => {
    const body = [
      "[TEACH]",
      "The KBMO FIT 22 panel measures immune complexes.",
      "[TEACH]",
      "Again, KBMO is what I reach for when the picture is unclear.",
      "[CTA]",
      "Book the diagnostic intake.",
    ].join("\n");

    const r = lintSellDensity(body, PROFILE);
    expect(r.brandedMentions).toBe(2);
    expect(r.withinBudget).toBe(false);
    expect(r.summary).toContain("OVER BUDGET");
  });

  it("scores a restated deliverables list only when TWO deliverables share a sentence", () => {
    const oneDeliverable = [
      "[TEACH]",
      "A full lab analysis & detailed report is what turns raw data into a decision.",
      "[CTA]",
      "Book the diagnostic intake.",
    ].join("\n");
    expect(lintSellDensity(oneDeliverable, PROFILE).deliverablesLists).toBe(0);

    const twoDeliverables = [
      "[TEACH]",
      "You get the kbmo fit 22 & gut barrier permeability panel and the clinical-grade gut biome test kit together.",
      "[CTA]",
      "Book the diagnostic intake.",
    ].join("\n");
    expect(lintSellDensity(twoDeliverables, PROFILE).deliverablesLists).toBeGreaterThanOrEqual(1);
  });

  it("reports zero mentions as within budget but says the signpost is missing", () => {
    const body = [
      "[TEACH]",
      "Immune complexes, not IgE, are the mechanism.",
      "[CTA]",
      "Book the diagnostic intake.",
    ].join("\n");

    const r = lintSellDensity(body, PROFILE);
    expect(r.withinBudget).toBe(true);
    expect(r.midRollPercent).toBeNull();
    expect(r.summary).toContain("No mid-roll mention");
  });
});

describe("lintSellDensity — placement reporting", () => {
  it("reports mid-roll position and never fails a script for placement alone", () => {
    // One mention, deliberately early (~10%).
    const early = [
      "[HOOK]",
      "The KBMO FIT 22 is what I use, and I will explain it at the end.",
      ...Array.from({ length: 40 }, () => "[TEACH]\nMechanism detail that carries the teaching forward without product presence."),
      "[CTA]",
      "Book the diagnostic intake.",
    ].join("\n");

    const r = lintSellDensity(early, PROFILE);
    expect(r.brandedMentions).toBe(1);
    // Placement is REPORTED, not enforced: still within budget.
    expect(r.withinBudget).toBe(true);
    expect(r.midRollPercent).not.toBeNull();
    expect(r.midRollInWindow).toBe(false);
  });
});

describe("brandTokens", () => {
  it("extracts distinctive brand and product-code tokens", () => {
    const t = brandTokens(PROFILE);
    expect(t).toContain("kbmo");
    /*
     * The product-code token is "fit 22", WITH the number — the regex captures
     * `[A-Z]{2,}(\s?\d{1,3})?`. That matters beyond naming: a bare "fit" token
     * would match the ordinary English word in "a diet that fits your life" and
     * flag legitimate teaching as a branded pitch. Pinned so a later "simplify
     * the regex" edit cannot reintroduce that false positive silently.
     */
    expect(t).toContain("fit 22");
    expect(t).not.toContain("fit");
  });

  it("does not flag the ordinary English word 'fit' as a branded mention", () => {
    const body = [
      "[TEACH]",
      "Build a protocol that fits the life you actually live, not the one on paper.",
      "[CTA]",
      "Book the diagnostic intake.",
    ].join("\n");
    expect(lintSellDensity(body, PROFILE).brandedMentions).toBe(0);
  });

  it("excludes generic category vocabulary, because rule 3 permits category references", () => {
    const t = brandTokens(PROFILE);
    for (const generic of ["clinical", "panel", "test", "gut", "report", "session", "ecosystem"]) {
      expect(t).not.toContain(generic);
    }
  });

  it("lets a category-level sentence pass the lint unflagged", () => {
    const body = [
      "[TEACH]",
      "Proper food-inflammation testing and a structured reintroduction protocol are what actually move the needle.",
      "[CTA]",
      "Book the diagnostic intake.",
    ].join("\n");
    expect(lintSellDensity(body, PROFILE).brandedMentions).toBe(0);
  });
});

describe("buildSellDensityRewriteInstruction", () => {
  it("quotes the offending sentences and demands the rest stay byte-for-byte", () => {
    const body = [
      "[TEACH]",
      "For $399 you could stop guessing.",
      "[CTA]",
      "Book the diagnostic intake.",
    ].join("\n");
    const instruction = buildSellDensityRewriteInstruction(lintSellDensity(body, PROFILE));

    expect(instruction).toContain("Rewrite ONLY those");
    expect(instruction).toContain("byte-for-byte unchanged");
    expect(instruction).toContain("For $399 you could stop guessing.");
    // It must not invite a general rewrite — that would void the story/cadence guarantees
    // the pipeline has already verified on this body.
    expect(instruction).not.toMatch(/rewrite the (whole|entire) script/i);
  });
});

// ─── Style resolution ────────────────────────────────────────────────────────

describe("resolveCtaStyle — per-format defaults", () => {
  it("defaults the two long-form spoken formats to value_first", () => {
    expect(resolveCtaStyle("youtube_script").style).toBe("value_first");
    expect(resolveCtaStyle("podcast_outline").style).toBe("value_first");
  });

  it("leaves every direct-response format on balanced — v2.4 changes nothing there", () => {
    for (const f of ["email", "ad_copy", "sales_page_section", "short_form"] as const) {
      const r = resolveCtaStyle(f);
      expect(r.style).toBe("balanced");
      expect(r.overridden).toBe(false);
      expect(r.warning).toBeNull();
    }
  });

  it("honours an explicit balanced request on youtube_script", () => {
    const r = resolveCtaStyle("youtube_script", "balanced");
    expect(r.style).toBe("balanced");
    expect(r.overridden).toBe(false);
  });

  it("REFUSES value_first on a direct-response format, loudly rather than silently", () => {
    const r = resolveCtaStyle("ad_copy", "value_first");
    expect(r.style).toBe("balanced");
    expect(r.overridden).toBe(true);
    expect(r.warning).toBeTruthy();
    expect(r.warning).toContain("ad_copy");
  });

  it("exposes exactly two styles", () => {
    expect(CTA_STYLES).toEqual(["value_first", "balanced"]);
  });
});

describe("ctaStyleFromParams — reading pre-v2.4 rows", () => {
  it("reads a frozen value_first back", () => {
    expect(ctaStyleFromParams({ ctaStyle: "value_first" })).toBe("value_first");
  });

  it("reads pre-v2.4 rows as balanced, NOT as the format default", () => {
    // A pre-v2.4 youtube_script was generated under the old offer-pressure rules.
    // Reporting it as value_first would retroactively relabel a salesy script.
    expect(ctaStyleFromParams({ storyMode: "brief" })).toBe("balanced");
    expect(ctaStyleFromParams(null)).toBe("balanced");
    expect(ctaStyleFromParams(undefined)).toBe("balanced");
    expect(ctaStyleFromParams({ ctaStyle: "nonsense" })).toBe("balanced");
  });
});

// ─── The prompt block ────────────────────────────────────────────────────────

describe("buildValueFirstOfferBlock", () => {
  const block = buildValueFirstOfferBlock(PROFILE);

  it("emits all seven rules", () => {
    for (let n = 1; n <= 7; n++) expect(block).toContain(`RULE ${n} —`);
  });

  it("drops the two offer-pressure instructions that buildOfferBlock emits", () => {
    const balanced = buildOfferBlock(PROFILE);
    // Proof the old rules really are in the balanced block...
    expect(balanced).toContain("FREE-VALUE LIMIT");
    expect(balanced).toMatch(/necessary rather than optional/);
    // ...and really are absent from the value-first one.
    expect(block).not.toContain("FREE-VALUE LIMIT");
    expect(block).not.toMatch(/necessary rather than optional/);
  });

  it("PRESERVES fact fidelity — the v2.3 Part 0 fix must survive the new block", () => {
    expect(block).toContain("FACT FIDELITY");
    expect(block).toContain(PROFILE.offerName);
    expect(block).toContain("$399");
    // Both guarantees, verbatim from the profile.
    expect(block).toContain("100% Money-Back Guarantee");
    expect(block).toContain("No-Rejection Guarantee");
  });

  it("prohibits inventing a guarantee when the offer has none", () => {
    const b = buildValueFirstOfferBlock(NO_GUARANTEE);
    expect(b).toContain("NO stated guarantee");
    expect(b).toMatch(/Do NOT mention, imply, or invent/);
  });

  it("confines urgency to the CTA", () => {
    expect(block).toContain("RULE 6");
    expect(block).toMatch(/URGENCY AND SCARCITY LIVE ONLY IN \[CTA\]/);
  });

  it("asks for exactly one mid-roll mention — not zero, not two", () => {
    expect(block).toMatch(/EXACTLY ONE MID-SCRIPT SOFT MENTION/);
    expect(block).toMatch(/Not zero, not two/);
  });
});

describe("STATIC_URGENCY_PHRASES", () => {
  it("is non-empty and lowercase, since the lint compares against a lowercased sentence", () => {
    expect(STATIC_URGENCY_PHRASES.length).toBeGreaterThan(0);
    for (const p of STATIC_URGENCY_PHRASES) expect(p).toBe(p.toLowerCase());
  });
});
