import { describe, it, expect } from "vitest";
import {
  RUBRIC_RULES,
  buildRubricSystemPrompt,
  getActiveRules,
  getBlockingRules,
} from "./claimsRubric";

// ─── Rubric structure tests ───────────────────────────────────────────────────

describe("RUBRIC_RULES", () => {
  it("should have at least 5 rules", () => {
    expect(RUBRIC_RULES.length).toBeGreaterThanOrEqual(5);
  });

  it("each rule should have required fields", () => {
    for (const rule of RUBRIC_RULES) {
      expect(rule.ruleId).toBeTruthy();
      expect(rule.ruleName).toBeTruthy();
      expect(rule.description).toBeTruthy();
      expect(["block", "warn"]).toContain(rule.severity);
      expect(typeof rule.enabled).toBe("boolean");
      expect(Array.isArray(rule.examples)).toBe(true);
    }
  });

  it("rule IDs should be unique", () => {
    const ids = RUBRIC_RULES.map((r) => r.ruleId);
    const unique = new Set(ids);
    expect(unique.size).toBe(ids.length);
  });

  it("should include a disease_treatment_claim rule", () => {
    const ids = RUBRIC_RULES.map((r) => r.ruleId);
    expect(ids).toContain("disease_treatment_claim");
  });

  it("should include a guaranteed_outcome rule", () => {
    const ids = RUBRIC_RULES.map((r) => r.ruleId);
    expect(ids).toContain("guaranteed_outcome");
  });

  it("should include a missing_disclaimer rule", () => {
    const ids = RUBRIC_RULES.map((r) => r.ruleId);
    expect(ids).toContain("missing_disclaimer");
  });
});

// ─── getActiveRules ───────────────────────────────────────────────────────────

describe("getActiveRules", () => {
  it("should return only enabled rules", () => {
    const active = getActiveRules();
    for (const rule of active) {
      expect(rule.enabled).toBe(true);
    }
  });

  it("should return at least 5 active rules by default", () => {
    expect(getActiveRules().length).toBeGreaterThanOrEqual(5);
  });
});

// ─── getBlockingRules ─────────────────────────────────────────────────────────

describe("getBlockingRules", () => {
  it("should return only block-severity rules", () => {
    const blocking = getBlockingRules();
    for (const rule of blocking) {
      expect(rule.severity).toBe("block");
      expect(rule.enabled).toBe(true);
    }
  });

  it("should include disease_treatment_claim as a blocking rule", () => {
    const ids = getBlockingRules().map((r) => r.ruleId);
    expect(ids).toContain("disease_treatment_claim");
  });

  it("should include guaranteed_outcome as a blocking rule", () => {
    const ids = getBlockingRules().map((r) => r.ruleId);
    expect(ids).toContain("guaranteed_outcome");
  });
});

// ─── buildRubricSystemPrompt ──────────────────────────────────────────────────

describe("buildRubricSystemPrompt", () => {
  it("should return a non-empty string", () => {
    const prompt = buildRubricSystemPrompt();
    expect(typeof prompt).toBe("string");
    expect(prompt.length).toBeGreaterThan(100);
  });

  it("should include all active rule IDs in the prompt", () => {
    const prompt = buildRubricSystemPrompt();
    for (const rule of getActiveRules()) {
      expect(prompt).toContain(rule.ruleId);
    }
  });

  it("should include the JSON output format instruction", () => {
    const prompt = buildRubricSystemPrompt();
    expect(prompt).toContain('"verdicts"');
    expect(prompt).toContain('"overallFlag"');
    expect(prompt).toContain('"summary"');
  });

  it("should include acceptable vs unacceptable language guidance", () => {
    const prompt = buildRubricSystemPrompt();
    expect(prompt).toContain("Supports");
    expect(prompt).toContain("cures");
  });

  it("should mention Dr. Shojai context", () => {
    const prompt = buildRubricSystemPrompt();
    expect(prompt).toContain("Dr. Pedram Shojai");
  });
});
