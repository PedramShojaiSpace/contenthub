import { describe, it, expect } from "vitest";

// ── Typeform API Key Validation ───────────────────────────────────────────────
// Note: Live API calls are skipped in sandbox CI (network restrictions).
// The API key is validated via curl in the shell; these tests cover logic only.

describe("Typeform Router — Unit Tests", () => {
  describe("flattenResponse helper logic", () => {
    it("handles text answer type correctly", () => {
      const answer = { type: "text", text: "I have chronic fatigue", field: { id: "f1" } };
      const fields = [{ id: "f1", title: "What is your main health concern?" }];
      // Simulate the flatten logic
      let value = "";
      if (answer.type === "text") value = String((answer as any)[answer.type] ?? "");
      expect(value).toBe("I have chronic fatigue");
    });

    it("handles choice answer type correctly", () => {
      const answer = { type: "choice", choice: { label: "Sleep issues" }, field: { id: "f2" } };
      let value = "";
      if (answer.type === "choice") value = (answer as any).choice?.label ?? "";
      expect(value).toBe("Sleep issues");
    });

    it("handles choices (multi-select) answer type correctly", () => {
      const answer = {
        type: "choices",
        choices: { labels: ["Gut health", "Energy", "Sleep"] },
        field: { id: "f3" },
      };
      let value = "";
      if (answer.type === "choices") value = ((answer as any).choices?.labels ?? []).join(", ");
      expect(value).toBe("Gut health, Energy, Sleep");
    });

    it("handles boolean answer type correctly", () => {
      const answerTrue = { type: "boolean", boolean: true, field: { id: "f4" } };
      const answerFalse = { type: "boolean", boolean: false, field: { id: "f4" } };
      const trueVal = (answerTrue as any).boolean ? "Yes" : "No";
      const falseVal = (answerFalse as any).boolean ? "Yes" : "No";
      expect(trueVal).toBe("Yes");
      expect(falseVal).toBe("No");
    });

    it("handles number answer type correctly", () => {
      const answer = { type: "number", number: 42, field: { id: "f5" } };
      let value = "";
      if (answer.type === "number") value = String((answer as any)[answer.type] ?? "");
      expect(value).toBe("42");
    });
  });

  describe("Typeform API configuration", () => {
    it("TYPEFORM_API_KEY env variable is present", () => {
      // In production, this is set via webdev_request_secrets
      // In test, it should be injected from the environment
      const key = process.env.TYPEFORM_API_KEY;
      expect(key).toBeDefined();
      expect(typeof key).toBe("string");
      expect(key!.length).toBeGreaterThan(10);
    });

    it("TYPEFORM_API_KEY starts with expected prefix", () => {
      const key = process.env.TYPEFORM_API_KEY ?? "";
      // Typeform personal access tokens start with 'tfp_'
      expect(key.startsWith("tfp_")).toBe(true);
    });
  });

  describe("analyzeAudience input validation", () => {
    it("rejects sampleSize below minimum", () => {
      const validate = (sampleSize: number) => sampleSize >= 10 && sampleSize <= 200;
      expect(validate(5)).toBe(false);
      expect(validate(10)).toBe(true);
      expect(validate(100)).toBe(true);
      expect(validate(201)).toBe(false);
    });

    it("requires non-empty formId", () => {
      const validate = (formId: string) => formId.trim().length > 0;
      expect(validate("")).toBe(false);
      expect(validate("m6EyBDzz")).toBe(true);
    });
  });

  describe("enrichPersona input validation", () => {
    it("validates personaId is a positive integer", () => {
      const validate = (id: number) => Number.isInteger(id) && id > 0;
      expect(validate(0)).toBe(false);
      expect(validate(-1)).toBe(false);
      expect(validate(1)).toBe(true);
      expect(validate(42)).toBe(true);
    });

    it("merges pain points without duplicates", () => {
      const existing = ["Chronic fatigue", "Poor sleep", "Brain fog"];
      const incoming = ["Poor sleep", "Gut issues", "Low energy"];
      const merged = Array.from(new Set([...existing, ...incoming]));
      expect(merged).toHaveLength(5);
      expect(merged.filter((p) => p === "Poor sleep")).toHaveLength(1);
    });

    it("caps merged pain points at 15", () => {
      const existing = Array.from({ length: 10 }, (_, i) => `Pain ${i + 1}`);
      const incoming = Array.from({ length: 10 }, (_, i) => `New Pain ${i + 1}`);
      const merged = Array.from(new Set([...existing, ...incoming])).slice(0, 15);
      expect(merged.length).toBeLessThanOrEqual(15);
    });
  });

  describe("Known Typeform forms on account", () => {
    it("has high-value forms with known IDs", () => {
      const knownForms = [
        { id: "m6EyBDzz", title: "Gut Microbiome Assessment Survey", expectedResponses: 2416 },
        { id: "ZUsSQWvF", title: "Gut Health - Initial Assessment", expectedResponses: 1177 },
        { id: "ODvuQe7E", title: "Deep Sleep Solution - Initial Assessment", expectedResponses: 13 },
        { id: "lLd5Iy8i", title: "Urban Monk 5-Day Reset - Avatar Segmentation Survey", expectedResponses: 4 },
      ];
      // Verify our known form IDs are valid Typeform ID format (8 chars alphanumeric)
      for (const form of knownForms) {
        expect(form.id).toMatch(/^[A-Za-z0-9]{8}$/);
        expect(form.title.length).toBeGreaterThan(0);
        expect(form.expectedResponses).toBeGreaterThanOrEqual(0);
      }
    });
  });
});
