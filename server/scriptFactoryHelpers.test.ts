/**
 * Script Factory v2 — helper unit tests.
 *
 * These cover the pure logic that the v2 features depend on: ISO week labelling
 * (idea batch identity / cron idempotency), seed keyword derivation (what gets
 * sent to VidIQ), word counting, and the target-length budget + instruction
 * block. No DB, no LLM, no network.
 */
import { describe, expect, it } from "vitest";
import {
  buildLengthInstruction,
  countWords,
  deriveSeedKeywords,
  isoWeekLabel,
  LENGTH_STRUCTURE,
  makeBatchId,
  normalizeKeyword,
  parseJsonColumn,
  safeJsonParse,
  WORDS_PER_MINUTE,
  wordBudget,
} from "./scriptFactoryHelpers";

// ─── parseJsonColumn ──────────────────────────────────────────────────────────

/**
 * Regression guard for a real bug found in browser testing: the `mysql2` driver
 * returns MySQL `JSON` columns as raw strings, so a Drizzle column declared
 * `json(...).$type<string[]>()` type-checks as an array but arrives as a string.
 * Passing that string onward produced `expected array, received string` inside
 * the `generate` mutation, far from the actual cause.
 */
describe("parseJsonColumn", () => {
  it("parses a JSON array arriving as a raw string (the driver's actual behavior)", () => {
    const fromDriver = '["pain_point","authority_signal"]';
    expect(parseJsonColumn<string[]>(fromDriver, [])).toEqual(["pain_point", "authority_signal"]);
  });

  it("passes through an already-parsed value untouched", () => {
    const parsed = ["hook", "cta"];
    expect(parseJsonColumn<string[]>(parsed, [])).toBe(parsed);
  });

  it("parses a JSON object arriving as a raw string", () => {
    expect(parseJsonColumn<{ keyword: string }>('{"keyword":"gut health"}', { keyword: "" }))
      .toEqual({ keyword: "gut health" });
  });

  it("returns the fallback for null and undefined rather than throwing", () => {
    expect(parseJsonColumn<string[]>(null, [])).toEqual([]);
    expect(parseJsonColumn<string[]>(undefined, [])).toEqual([]);
  });

  it("returns the fallback for malformed JSON rather than throwing", () => {
    expect(parseJsonColumn<string[]>("{not valid json", [])).toEqual([]);
  });

  it("returns the fallback when the column holds JSON null", () => {
    expect(parseJsonColumn<string[]>("null", [])).toEqual([]);
  });

  it("is idempotent, so double-encoding cannot silently occur", () => {
    // The second bug this fixed: JSON.stringify on an already-stringified value
    // produced `"[\"a\"]"` in idea_feedback. Normalising first makes the round
    // trip stable no matter which form the driver hands back.
    const once = parseJsonColumn<string[]>('["a","b"]', []);
    const twice = parseJsonColumn<string[]>(once, []);
    expect(twice).toEqual(["a", "b"]);
    expect(JSON.stringify(twice)).toBe('["a","b"]');
  });
});

// ─── isoWeekLabel ─────────────────────────────────────────────────────────────

describe("isoWeekLabel", () => {
  it("formats as YYYY-Www with a zero-padded week", () => {
    expect(isoWeekLabel(new Date("2026-01-08T00:00:00Z"))).toMatch(/^\d{4}-W\d{2}$/);
  });

  it("gives every day of the same ISO week the same label", () => {
    // Mon 2026-07-27 through Sun 2026-08-02 is one ISO week.
    const monday = isoWeekLabel(new Date("2026-07-27T00:00:00Z"));
    const sunday = isoWeekLabel(new Date("2026-08-02T23:59:59Z"));
    expect(monday).toBe(sunday);
  });

  it("rolls over to a new label on the next Monday", () => {
    const week31 = isoWeekLabel(new Date("2026-07-27T00:00:00Z"));
    const week32 = isoWeekLabel(new Date("2026-08-03T00:00:00Z"));
    expect(week31).not.toBe(week32);
  });

  it("assigns late-December days to the ISO year that owns the week", () => {
    // 2025-12-29 is a Monday whose Thursday falls in 2026 → ISO week 2026-W01.
    expect(isoWeekLabel(new Date("2025-12-29T00:00:00Z"))).toBe("2026-W01");
  });

  it("is timezone-stable across the day boundary", () => {
    // Same UTC instant expressed with an offset must not shift the week.
    const a = isoWeekLabel(new Date("2026-07-27T00:30:00Z"));
    const b = isoWeekLabel(new Date("2026-07-26T21:30:00-03:00"));
    expect(a).toBe(b);
  });
});

// ─── makeBatchId ──────────────────────────────────────────────────────────────

describe("makeBatchId", () => {
  it("fits the varchar(32) column", () => {
    expect(makeBatchId(new Date("2026-07-31T00:00:00Z")).length).toBeLessThanOrEqual(32);
  });

  it("embeds the date and is unique per call", () => {
    const now = new Date("2026-07-31T00:00:00Z");
    const a = makeBatchId(now);
    const b = makeBatchId(now);
    expect(a).toContain("20260731");
    expect(a).not.toBe(b);
  });
});

// ─── safeJsonParse ────────────────────────────────────────────────────────────

describe("safeJsonParse", () => {
  it("parses valid JSON", () => {
    expect(safeJsonParse<string[]>('["sleep","stress"]')).toEqual(["sleep", "stress"]);
  });

  it("returns null for malformed JSON instead of throwing", () => {
    expect(safeJsonParse("{not json")).toBeNull();
  });

  it("returns null for empty and nullish input", () => {
    expect(safeJsonParse("")).toBeNull();
    expect(safeJsonParse(null)).toBeNull();
    expect(safeJsonParse(undefined)).toBeNull();
  });
});

// ─── normalizeKeyword ─────────────────────────────────────────────────────────

describe("normalizeKeyword", () => {
  it("strips punctuation and lowercases", () => {
    expect(normalizeKeyword("Can't Sleep?! Try This.")).toBe("can t sleep try this");
  });

  it("collapses runs of whitespace", () => {
    expect(normalizeKeyword("gut    health")).toBe("gut health");
  });

  it("caps the number of words", () => {
    const out = normalizeKeyword("one two three four five six seven eight", 6);
    expect(out.split(" ")).toHaveLength(6);
  });

  it("returns an empty string for punctuation-only input", () => {
    expect(normalizeKeyword("!!!???")).toBe("");
  });
});

// ─── deriveSeedKeywords ───────────────────────────────────────────────────────

describe("deriveSeedKeywords", () => {
  it("prefers tags over pain points and persona questions", () => {
    const seeds = deriveSeedKeywords(
      [{ tags: '["sleep optimization"]', extractedInsights: '{"painPoints":["cannot fall asleep"]}' }],
      ["how do I sleep better"],
      1
    );
    expect(seeds).toEqual(["sleep optimization"]);
  });

  it("falls back to pain points when no tags exist", () => {
    const seeds = deriveSeedKeywords(
      [{ tags: null, extractedInsights: '{"painPoints":["chronic fatigue"]}' }],
      [],
      3
    );
    expect(seeds).toContain("chronic fatigue");
  });

  it("falls back to persona questions when analog data is empty", () => {
    const seeds = deriveSeedKeywords([], ["why am I always tired"], 3);
    expect(seeds).toContain("why am i always tired");
  });

  it("deduplicates case-insensitively", () => {
    const seeds = deriveSeedKeywords(
      [
        { tags: '["Sleep"]', extractedInsights: null },
        { tags: '["sleep"]', extractedInsights: null },
      ],
      [],
      5
    );
    expect(seeds).toEqual(["sleep"]);
  });

  it("respects maxSeeds", () => {
    const seeds = deriveSeedKeywords(
      [{ tags: '["one","two","three","four","five","six"]', extractedInsights: null }],
      [],
      3
    );
    expect(seeds).toHaveLength(3);
  });

  it("drops values that are too short or too long", () => {
    const tooLong = "a".repeat(80);
    const seeds = deriveSeedKeywords(
      [{ tags: JSON.stringify(["ab", tooLong, "valid keyword"]), extractedInsights: null }],
      [],
      5
    );
    expect(seeds).toEqual(["valid keyword"]);
  });

  it("survives malformed JSON in either column", () => {
    expect(() =>
      deriveSeedKeywords([{ tags: "{broken", extractedInsights: "also broken" }], [], 3)
    ).not.toThrow();
    expect(deriveSeedKeywords([{ tags: "{broken", extractedInsights: "nope" }], [], 3)).toEqual([]);
  });
});

// ─── countWords ───────────────────────────────────────────────────────────────

describe("countWords", () => {
  it("counts plain words", () => {
    expect(countWords("one two three")).toBe(3);
  });

  it("excludes structure and verification markup from the count", () => {
    // Only the four spoken words should count.
    expect(countWords("[HOOK] sleep is broken [VERIFIED]")).toBe(3);
  });

  it("returns 0 for empty and markup-only input", () => {
    expect(countWords("")).toBe(0);
    expect(countWords("[HOOK] [VERIFIED]")).toBe(0);
  });

  it("treats newlines and repeated spaces as single separators", () => {
    expect(countWords("one\n\ntwo    three")).toBe(3);
  });
});

// ─── wordBudget ───────────────────────────────────────────────────────────────

describe("wordBudget", () => {
  it("uses the spec's 145 words-per-minute figure", () => {
    expect(WORDS_PER_MINUTE).toBe(145);
    expect(wordBudget(10).target).toBe(1450);
    expect(wordBudget(20).target).toBe(2900);
  });

  it("brackets the target with a ±10% band", () => {
    const b = wordBudget(15);
    expect(b.target).toBe(2175);
    expect(b.min).toBe(1958);
    expect(b.max).toBe(2393);
    expect(b.min).toBeLessThan(b.target);
    expect(b.max).toBeGreaterThan(b.target);
  });
});

// ─── buildLengthInstruction ───────────────────────────────────────────────────

describe("buildLengthInstruction", () => {
  it("returns an empty string when no target length is set", () => {
    expect(buildLengthInstruction(undefined)).toBe("");
    expect(buildLengthInstruction(null)).toBe("");
  });

  it("returns an empty string for an unsupported length", () => {
    expect(buildLengthInstruction(7)).toBe("");
  });

  it("states the word target and range for a supported length", () => {
    const out = buildLengthInstruction(10);
    expect(out).toContain("10-minute video");
    expect(out).toContain("1450 words");
    expect(out).toContain("1305-1595");
  });

  it("includes the structure requirements for that length", () => {
    const out = buildLengthInstruction(15);
    expect(out).toContain("Story arcs: 2");
    expect(out).toContain("Teaching blocks ([TEACH]): 4-5");
    expect(out).toContain("Objection blocks ([OBJECTION]): 1");
  });

  it("requires a mid-roll re-hook only at 20 minutes", () => {
    expect(buildLengthInstruction(20)).toContain("Mid-roll re-hook");
    expect(buildLengthInstruction(10)).not.toContain("Mid-roll re-hook");
    expect(buildLengthInstruction(15)).not.toContain("Mid-roll re-hook");
  });

  it("is delimited so it can be concatenated into the prompt safely", () => {
    const out = buildLengthInstruction(20);
    expect(out).toContain("=== TARGET LENGTH (STRICT) ===");
    expect(out).toContain("=== END TARGET LENGTH ===");
  });

  it("scales structure monotonically with length", () => {
    // Guards the spec's intent: longer videos never require less structure.
    expect(LENGTH_STRUCTURE[10].midRollRehook).toBe(false);
    expect(LENGTH_STRUCTURE[20].midRollRehook).toBe(true);
    expect(Number(LENGTH_STRUCTURE[20].objectionBlocks)).toBeGreaterThan(
      Number(LENGTH_STRUCTURE[10].objectionBlocks)
    );
  });
});
