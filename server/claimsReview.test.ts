import { describe, it, expect } from "vitest";
import {
  RUBRIC_RULES,
  buildRubricSystemPrompt,
  getActiveRules,
  getBlockingRules,
  getMetaOnlyRules,
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

  it("should NOT include Meta-only rules by default", () => {
    const active = getActiveRules();
    const metaRuleIds = active.filter((r) => r.metaOnly);
    expect(metaRuleIds.length).toBe(0);
  });

  it("should include Meta-only rules when includeMetaRules=true", () => {
    const active = getActiveRules(true);
    const metaRuleIds = active.filter((r) => r.metaOnly);
    expect(metaRuleIds.length).toBeGreaterThanOrEqual(3);
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

  it("should NOT include Meta-only blocking rules by default", () => {
    const ids = getBlockingRules().map((r) => r.ruleId);
    expect(ids).not.toContain("meta_personal_attributes");
    expect(ids).not.toContain("meta_disease_treatment_language");
  });

  it("should include Meta-only blocking rules when includeMetaRules=true", () => {
    const ids = getBlockingRules(true).map((r) => r.ruleId);
    expect(ids).toContain("meta_personal_attributes");
    expect(ids).toContain("meta_disease_treatment_language");
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

  it("should NOT include Meta-only rule IDs by default", () => {
    const prompt = buildRubricSystemPrompt();
    expect(prompt).not.toContain("meta_personal_attributes");
    expect(prompt).not.toContain("meta_disease_treatment_language");
  });

  it("should include Meta-only rule IDs when includeMetaRules=true", () => {
    const prompt = buildRubricSystemPrompt(true);
    expect(prompt).toContain("meta_personal_attributes");
    expect(prompt).toContain("meta_disease_treatment_language");
    expect(prompt).toContain("meta_physician_endorsement_risk");
  });

  it("should include Meta policy context when includeMetaRules=true", () => {
    const prompt = buildRubricSystemPrompt(true);
    expect(prompt).toContain("META AD POLICY CONTEXT");
    expect(prompt).toContain("Personal Attributes Policy");
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

// ─── getMetaOnlyRules ────────────────────────────────────────────────────

describe("getMetaOnlyRules", () => {
  it("should return only rules with metaOnly=true", () => {
    const metaRules = getMetaOnlyRules();
    for (const rule of metaRules) {
      expect(rule.metaOnly).toBe(true);
    }
  });

  it("should return exactly 3 Meta-specific rules", () => {
    const metaRules = getMetaOnlyRules();
    expect(metaRules.length).toBe(3);
  });

  it("should include meta_personal_attributes rule", () => {
    const ids = getMetaOnlyRules().map((r) => r.ruleId);
    expect(ids).toContain("meta_personal_attributes");
  });

  it("should include meta_disease_treatment_language rule", () => {
    const ids = getMetaOnlyRules().map((r) => r.ruleId);
    expect(ids).toContain("meta_disease_treatment_language");
  });

  it("should include meta_physician_endorsement_risk rule", () => {
    const ids = getMetaOnlyRules().map((r) => r.ruleId);
    expect(ids).toContain("meta_physician_endorsement_risk");
  });

  it("meta_personal_attributes should be block severity", () => {
    const rule = getMetaOnlyRules().find((r) => r.ruleId === "meta_personal_attributes");
    expect(rule?.severity).toBe("block");
  });

  it("meta_disease_treatment_language should be block severity", () => {
    const rule = getMetaOnlyRules().find((r) => r.ruleId === "meta_disease_treatment_language");
    expect(rule?.severity).toBe("block");
  });

  it("meta_physician_endorsement_risk should be warn severity", () => {
    const rule = getMetaOnlyRules().find((r) => r.ruleId === "meta_physician_endorsement_risk");
    expect(rule?.severity).toBe("warn");
  });

  it("each Meta rule should have at least 3 examples", () => {
    for (const rule of getMetaOnlyRules()) {
      expect(rule.examples.length).toBeGreaterThanOrEqual(3);
    }
  });
});
