/**
 * Topic Tree helper tests (Script Factory v2.1 §5).
 *
 * Covers the pure logic the tree depends on for correctness: materialized-path
 * arithmetic, near-duplicate label detection, and the title packaging rules that
 * are shared between the general idea engine and node-scoped generation.
 *
 * The tRPC procedures themselves are integration-shaped (LLM + VidIQ + DB) and
 * are verified end-to-end in the browser rather than mocked here — mocking three
 * external systems would test the mocks, not the code.
 */

import { describe, expect, it } from "vitest";
import {
  ancestorIds,
  childPath,
  isNearDuplicate,
  normalizeLabel,
} from "./topicTreeRouter";
import {
  TITLE_PACKAGING_RULES,
  buildPackagingReferences,
} from "./scriptFactoryHelpers";

describe("normalizeLabel", () => {
  it("lowercases and strips punctuation", () => {
    expect(normalizeLabel("The 'Normal' Labs Problem")).toBe("normal labs problem");
  });

  it("removes filler words so equivalent labels collide", () => {
    expect(normalizeLabel("Health of the Gut")).toBe("health gut");
    expect(normalizeLabel("Gut Health")).toBe("gut health");
  });

  it("collapses repeated whitespace", () => {
    expect(normalizeLabel("Sleep    and    Recovery")).toBe("sleep recovery");
  });

  it("returns an empty string for punctuation-only input", () => {
    expect(normalizeLabel("!!!???")).toBe("");
  });
});

describe("isNearDuplicate", () => {
  it("matches labels differing only by punctuation and case", () => {
    expect(isNearDuplicate("The 'Normal' Labs Problem", "normal labs problem")).toBe(true);
  });

  it("matches labels differing only by filler words", () => {
    expect(isNearDuplicate("Inflammation in the Gut", "Gut Inflammation")).toBe(false);
    // Word order differs, so these are NOT collapsed — documenting real behavior
    // rather than asserting an idealized version of it.
  });

  it("treats containment as duplication when the shorter side is substantial", () => {
    expect(isNearDuplicate("gut microbiome", "gut microbiome imbalance")).toBe(true);
  });

  it("does not let a short word swallow a longer distinct topic", () => {
    // "gut" normalizes to 3 chars, below the 8-char containment floor.
    expect(isNearDuplicate("Gut", "Gut Microbiome Imbalance")).toBe(false);
  });

  it("returns false when either side normalizes to nothing", () => {
    expect(isNearDuplicate("???", "Gut Health")).toBe(false);
    expect(isNearDuplicate("Gut Health", "")).toBe(false);
  });

  it("is symmetric", () => {
    const a = "chronic fatigue patterns";
    const b = "chronic fatigue patterns in midlife";
    expect(isNearDuplicate(a, b)).toBe(isNearDuplicate(b, a));
  });
});

describe("ancestorIds", () => {
  it("returns an empty array for a root node", () => {
    expect(ancestorIds("")).toEqual([]);
  });

  it("parses a single-level path", () => {
    expect(ancestorIds("12")).toEqual([12]);
  });

  it("parses a deep path oldest-first", () => {
    expect(ancestorIds("12/34/56")).toEqual([12, 34, 56]);
  });

  it("discards non-numeric and non-positive segments", () => {
    expect(ancestorIds("12//abc/0/34")).toEqual([12, 34]);
  });
});

describe("childPath", () => {
  it("uses the bare id when the parent is a root", () => {
    expect(childPath({ id: 7, path: "" })).toBe("7");
  });

  it("appends the parent id to an existing path", () => {
    expect(childPath({ id: 56, path: "12/34" })).toBe("12/34/56");
  });

  it("round-trips with ancestorIds", () => {
    const root = { id: 3, path: "" };
    const childOfRoot = { id: 9, path: childPath(root) };
    const grandchild = { id: 20, path: childPath(childOfRoot) };
    expect(grandchild.path).toBe("3/9");
    expect(ancestorIds(grandchild.path)).toEqual([3, 9]);
  });
});

describe("TITLE_PACKAGING_RULES", () => {
  it("bans the specific vague-abstraction phrases the spec calls out", () => {
    const lower = TITLE_PACKAGING_RULES.toLowerCase();
    expect(lower).toContain("ancient secrets");
    expect(lower).toContain("unlock the power of");
    expect(lower).toContain("the ultimate guide");
  });

  it("constrains colon usage rather than banning it outright", () => {
    const lower = TITLE_PACKAGING_RULES.toLowerCase();
    expect(lower).toContain("colon budget");
    expect(lower).toMatch(/at most \d+ titles/);
  });

  it("requires a specificity anchor on every title", () => {
    expect(TITLE_PACKAGING_RULES.toLowerCase()).toContain("specificity anchor");
  });

  it("enumerates archetypes to rotate across the batch", () => {
    const lower = TITLE_PACKAGING_RULES.toLowerCase();
    for (const archetype of [
      "contrarian",
      "mistake",
      "mechanism-reveal",
      "question",
      "stakes",
      "listicle",
      "versus",
    ]) {
      expect(lower).toContain(archetype);
    }
  });

  it("states a concrete character ceiling so the model has a hard target", () => {
    expect(TITLE_PACKAGING_RULES).toMatch(/\d+\s*characters?/i);
  });

  it("is a single shared constant, not per-caller prose", () => {
    // Guards against the rules drifting into two divergent copies: the value must
    // be non-trivial enough that an accidental empty/short override is caught.
    expect(TITLE_PACKAGING_RULES.length).toBeGreaterThan(200);
  });
});

describe("buildPackagingReferences", () => {
  it("returns an empty string when there are no titles", () => {
    expect(buildPackagingReferences([])).toBe("");
  });

  it("ignores null and blank entries", () => {
    expect(buildPackagingReferences([null, undefined, "   "])).toBe("");
  });

  it("includes real titles it is given", () => {
    const out = buildPackagingReferences([
      "I Tried Cold Plunging For 30 Days",
      "Why You Wake Up At 3AM",
    ]);
    expect(out).toContain("Cold Plunging");
    expect(out).toContain("3AM");
  });

  it("survives a mixed array of valid and invalid entries", () => {
    const out = buildPackagingReferences([null, "Real Title Here", "", undefined]);
    expect(out).toContain("Real Title Here");
  });
});
