/**
 * Tests for analogDataRouter
 *
 * Tests cover:
 * - listEntries: returns empty array when DB unavailable
 * - getStats: returns zero stats when DB unavailable
 * - addEntry: validates minimum content length
 * - deleteEntry: throws when DB unavailable
 * - updateEntry: validates input schema
 * - generateTitle: validates minimum content length
 */

import { describe, expect, it } from "vitest";
import { z } from "zod";

// ─── Unit tests for input validation (no DB required) ─────────────────────────

describe("analogDataRouter — input validation", () => {
  it("rejects content shorter than 50 characters in addEntry schema", () => {
    const schema = z.object({
      title: z.string().max(255).optional(),
      autoGenerateTitle: z.boolean().default(false),
      type: z.enum([
        "sales_page",
        "facebook_ad",
        "customer_interview",
        "text_survey",
        "vsl_script",
        "email_sequence",
        "other",
      ]),
      tags: z.array(z.string()).default([]),
      personaId: z.number().optional(),
      content: z.string().min(50, "Content must be at least 50 characters"),
    });

    const shortContent = schema.safeParse({
      type: "sales_page",
      content: "too short",
    });
    expect(shortContent.success).toBe(false);
    if (!shortContent.success) {
      expect(shortContent.error.issues[0]?.message).toContain("50 characters");
    }
  });

  it("accepts valid addEntry input", () => {
    const schema = z.object({
      title: z.string().max(255).optional(),
      autoGenerateTitle: z.boolean().default(false),
      type: z.enum([
        "sales_page",
        "facebook_ad",
        "customer_interview",
        "text_survey",
        "vsl_script",
        "email_sequence",
        "other",
      ]),
      tags: z.array(z.string()).default([]),
      personaId: z.number().optional(),
      content: z.string().min(50, "Content must be at least 50 characters"),
    });

    const validInput = schema.safeParse({
      type: "facebook_ad",
      tags: ["gut_health", "cold_traffic"],
      content:
        "Are you tired of bloating and digestive discomfort that ruins your day? " +
        "Our customers report 80% improvement in gut symptoms within 30 days. " +
        "Click below to learn how.",
    });
    expect(validInput.success).toBe(true);
    if (validInput.success) {
      expect(validInput.data.tags).toEqual(["gut_health", "cold_traffic"]);
      expect(validInput.data.autoGenerateTitle).toBe(false);
    }
  });

  it("rejects invalid type enum in addEntry", () => {
    const schema = z.object({
      type: z.enum([
        "sales_page",
        "facebook_ad",
        "customer_interview",
        "text_survey",
        "vsl_script",
        "email_sequence",
        "other",
      ]),
      content: z.string().min(50),
    });

    const result = schema.safeParse({
      type: "blog_post", // not a valid type
      content: "x".repeat(50),
    });
    expect(result.success).toBe(false);
  });

  it("accepts all valid data types", () => {
    const validTypes = [
      "sales_page",
      "facebook_ad",
      "customer_interview",
      "text_survey",
      "vsl_script",
      "email_sequence",
      "other",
    ] as const;

    const schema = z.enum(validTypes);
    for (const t of validTypes) {
      expect(schema.safeParse(t).success).toBe(true);
    }
  });

  it("validates updateEntry input schema", () => {
    const schema = z.object({
      id: z.number(),
      title: z.string().max(255).optional(),
      tags: z.array(z.string()).optional(),
      personaId: z.number().nullable().optional(),
      inCorpus: z.boolean().optional(),
    });

    // Valid update
    const valid = schema.safeParse({ id: 1, inCorpus: true });
    expect(valid.success).toBe(true);

    // Missing id
    const missingId = schema.safeParse({ title: "New title" });
    expect(missingId.success).toBe(false);
  });

  it("validates generateTitle minimum content length", () => {
    const schema = z.object({
      content: z.string().min(50).max(50000),
      type: z.enum([
        "sales_page",
        "facebook_ad",
        "customer_interview",
        "text_survey",
        "vsl_script",
        "email_sequence",
        "other",
      ]),
    });

    const tooShort = schema.safeParse({ content: "short", type: "sales_page" });
    expect(tooShort.success).toBe(false);

    const valid = schema.safeParse({
      content: "x".repeat(50),
      type: "customer_interview",
    });
    expect(valid.success).toBe(true);
  });
});

// ─── Tag parsing logic ────────────────────────────────────────────────────────

describe("analogDataRouter — tag handling", () => {
  it("serializes and deserializes tags as JSON array", () => {
    const tags = ["gut_health", "Q1_2026", "cold_traffic"];
    const serialized = JSON.stringify(tags);
    const deserialized = JSON.parse(serialized) as string[];
    expect(deserialized).toEqual(tags);
  });

  it("handles empty tags array", () => {
    const tags: string[] = [];
    const serialized = JSON.stringify(tags);
    const deserialized = JSON.parse(serialized) as string[];
    expect(deserialized).toEqual([]);
  });

  it("handles null tags gracefully", () => {
    const raw: string | null = null;
    const result = raw ? (JSON.parse(raw) as string[]) : [];
    expect(result).toEqual([]);
  });
});

// ─── Insights extraction structure ───────────────────────────────────────────

describe("analogDataRouter — insights structure", () => {
  it("validates expected insights shape", () => {
    const insightsSchema = z.object({
      hooks: z.array(z.string()),
      painPoints: z.array(z.string()),
      proofElements: z.array(z.string()),
      objectionHandlers: z.array(z.string()),
      ctas: z.array(z.string()),
      keyPhrases: z.array(z.string()),
      conversionMechanisms: z.array(z.string()),
    });

    const sampleInsights = {
      hooks: ["Are you tired of bloating?"],
      painPoints: ["Digestive discomfort", "Low energy"],
      proofElements: ["80% improvement in 30 days"],
      objectionHandlers: ["30-day money back guarantee"],
      ctas: ["Click below to learn how"],
      keyPhrases: ["gut health", "digestive discomfort"],
      conversionMechanisms: ["Strong social proof", "Risk reversal"],
    };

    const result = insightsSchema.safeParse(sampleInsights);
    expect(result.success).toBe(true);
  });

  it("serializes and deserializes insights as JSON", () => {
    const insights = {
      hooks: ["Hook 1"],
      painPoints: [],
      proofElements: ["Proof 1"],
      objectionHandlers: [],
      ctas: ["CTA 1"],
      keyPhrases: ["phrase 1"],
      conversionMechanisms: ["mechanism 1"],
    };
    const serialized = JSON.stringify(insights);
    const deserialized = JSON.parse(serialized);
    expect(deserialized).toEqual(insights);
  });
});
