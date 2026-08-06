/**
 * PART 3C tests — hook references, structure summary, relevance filtering.
 *
 * The relevance fixtures are REAL titles captured from live vidIQ calls
 * (docs/build-reports/v22r/proof_discovery_sources.txt), not invented ones.
 * Part 1 taught that hand-written fixtures are kinder than reality: the vidIQ
 * field-name bug survived a full unit suite because every fixture used the
 * field names I expected rather than the ones the wire actually sends.
 */
import { describe, it, expect } from "vitest";
import {
  extractOpening,
  classifyHookStructure,
  scoreTopicalRelevance,
  partitionByRelevance,
  validateStructureSummary,
  buildHookReferenceBlock,
  buildStructureSummaryBlock,
  HOOK_OPENING_WORDS,
  MAX_HOOK_REFERENCES,
  MIN_TOPICAL_RELEVANCE,
} from "./researchGrounding";

describe("extractOpening", () => {
  it("takes the first 200 words and collapses whitespace", () => {
    const text = Array.from({ length: 500 }, (_, i) => `word${i}`).join("\n  ");
    const opening = extractOpening(text);
    const words = opening.split(" ");
    expect(words).toHaveLength(HOOK_OPENING_WORDS);
    expect(words[0]).toBe("word0");
    expect(opening).not.toMatch(/\n/);
  });

  it("handles short and empty transcripts without throwing", () => {
    expect(extractOpening("just three words")).toBe("just three words");
    expect(extractOpening("")).toBe("");
    expect(extractOpening(null as any)).toBe("");
  });
});

describe("classifyHookStructure", () => {
  it("labels a contradiction opening", () => {
    expect(
      classifyHookStructure("Everything your doctor told you about fiber is wrong, and I can prove it.")
    ).toBe("contradiction");
  });

  it("labels enumeration", () => {
    expect(
      classifyHookStructure("There are three signs your gut lining is failing, and most people miss all of them.")
    ).toBe("enumeration");
  });

  it("labels stakes escalation", () => {
    expect(
      classifyHookStructure("That afternoon fatigue you shrug off is the same process that ends in autoimmune disease.")
    ).toBe("stakes_escalation");
  });

  it("labels a credential pivot", () => {
    expect(
      classifyHookStructure("I'm a board-certified gastroenterologist with twenty years in practice, but what I didn't understand about the gut barrier changed everything.")
    ).toBe("credential_pivot");
  });

  it("labels mechanism tease and direct address", () => {
    expect(classifyHookStructure("Here's why your energy collapses at 3pm every single day.")).toBe("mechanism_tease");
    expect(classifyHookStructure("If you're waking up at 3am with your heart racing, this is for you.")).toBe("direct_address");
  });

  it("abstains rather than guessing when no structure is evident", () => {
    // A wrong label teaches the model the wrong shape, so "unlabeled" is the
    // correct answer for ambiguous material.
    expect(classifyHookStructure("Welcome back to the channel, let's get started.")).toBe("unlabeled");
    expect(classifyHookStructure("")).toBe("unlabeled");
  });
});

describe("scoreTopicalRelevance — real captured titles", () => {
  it("scores genuinely on-topic health titles high", () => {
    // Real trending results for "leaky gut fatigue".
    expect(scoreTopicalRelevance("leaky gut fatigue", "How To Heal 20 Years of Gut Damage in 30 Days")).toBeGreaterThanOrEqual(MIN_TOPICAL_RELEVANCE);
    expect(scoreTopicalRelevance("vagus nerve anxiety", "The Vagus Nerve: Your Body's Anxiety Switch")).toBeGreaterThanOrEqual(MIN_TOPICAL_RELEVANCE);
  });

  it("scores the REAL off-topic outlier results below threshold", () => {
    // These are the actual titles vidiq_outliers returned for health keywords.
    // They were mined into content_patterns at effectiveness 0.9.
    expect(scoreTopicalRelevance("leaky gut fatigue", "Brud Sprunki EATS EVERYTHING, Then throws up")).toBeLessThan(MIN_TOPICAL_RELEVANCE);
    expect(scoreTopicalRelevance("leaky gut fatigue", "A billion year old water supply may help save Corpus Christi")).toBeLessThan(MIN_TOPICAL_RELEVANCE);
    expect(scoreTopicalRelevance("vagus nerve anxiety", "Creepy Medical Museum | Roblox Horror")).toBeLessThan(MIN_TOPICAL_RELEVANCE);
  });

  it("is honest about over-accepting on a shared word", () => {
    // Documents a KNOWN limitation rather than pretending precision: this title
    // is about superhero movies but shares "fatigue". The filter is a noise
    // guard, not a semantic ranker, and over-accepting is the safe direction.
    const s = scoreTopicalRelevance("leaky gut fatigue", "Spider-Man PROVES Superhero Fatigue is Real");
    expect(s).toBeGreaterThan(0);
  });

  it("connects simple stems", () => {
    expect(scoreTopicalRelevance("gut inflammation", "Inflammatory Foods Wrecking Your Guts")).toBeGreaterThan(0);
  });

  it("returns 0 for an empty or stopword-only seed instead of dividing by zero", () => {
    expect(scoreTopicalRelevance("", "anything")).toBe(0);
    expect(scoreTopicalRelevance("the and of", "anything")).toBe(0);
  });
});

describe("partitionByRelevance", () => {
  it("separates the real mixed outlier set and keeps order", () => {
    const items = [
      { title: "Brud Sprunki EATS EVERYTHING, Then throws up" },
      { title: "How To Heal 20 Years of Gut Damage in 30 Days" },
      { title: "A billion year old water supply may help save Corpus Christi" },
      { title: "You Don't Need Fiber To Fix Your Gut" },
    ];
    const { relevant, offTopic } = partitionByRelevance("leaky gut fatigue", items);
    expect(relevant.map((r) => r.title)).toEqual([
      "How To Heal 20 Years of Gut Damage in 30 Days",
      "You Don't Need Fiber To Fix Your Gut",
    ]);
    expect(offTopic).toHaveLength(2);
  });

  it("never silently drops everything without reporting it", () => {
    const { relevant, offTopic } = partitionByRelevance("gut health", [{ title: "Roblox Horror Game" }]);
    expect(relevant).toHaveLength(0);
    expect(offTopic).toHaveLength(1);
  });
});

describe("validateStructureSummary", () => {
  it("accepts a well-formed summary and records its sources", () => {
    const s = validateStructureSummary(
      {
        sectionFlow: ["cold open contradiction", "credential", "mechanism", "protocol", "cta"],
        pacingNotes: "Fast first 90 seconds, slows through the mechanism.",
        firstPayoffPoint: "around 2:10",
        reHookPlacement: "midpoint, restating the stakes",
        ctaPlacement: "final 45 seconds only",
      },
      ["vid1", "vid2", "vid3"]
    );
    expect(s?.sectionFlow).toHaveLength(5);
    expect(s?.sourceCount).toBe(3);
  });

  it("parses a JSON string", () => {
    const s = validateStructureSummary(JSON.stringify({ sectionFlow: ["a"], pacingNotes: "b" }), ["v"]);
    expect(s?.sectionFlow).toEqual(["a"]);
  });

  it("returns null for empty guidance rather than persisting a hollow object", () => {
    // An empty summary in the DB looks like real analysis to every later reader.
    expect(validateStructureSummary({ sectionFlow: [], pacingNotes: "" }, ["v"])).toBeNull();
    expect(validateStructureSummary(null, ["v"])).toBeNull();
    expect(validateStructureSummary("not json", ["v"])).toBeNull();
    expect(validateStructureSummary({ sectionFlow: [1, 2] }, ["v"])).toBeNull();
  });
});

describe("buildHookReferenceBlock", () => {
  const ref = (title: string, structure: string) => ({
    videoId: "abc",
    title,
    views: 1234567,
    structureLabel: structure,
    openingText: "Everything you were told about fiber is wrong.",
  });

  it("includes each reference with its structure label and view count", () => {
    const block = buildHookReferenceBlock([ref("Heal Your Gut", "contradiction")]);
    expect(block).toContain("HOOK REFERENCES");
    expect(block).toContain("structure: contradiction");
    expect(block).toContain("Heal Your Gut");
    expect(block).toContain("1,234,567 views");
  });

  it("caps at MAX_HOOK_REFERENCES", () => {
    const refs = Array.from({ length: 12 }, (_, i) => ref(`Video ${i}`, "contradiction"));
    const block = buildHookReferenceBlock(refs);
    expect((block.match(/--- Reference /g) ?? [])).toHaveLength(MAX_HOOK_REFERENCES);
    expect(block).not.toContain("Video 7");
  });

  it("bans soft rhetorical openings by name, with counter-examples", () => {
    const block = buildHookReferenceBlock([ref("X", "contradiction")]);
    expect(block).toContain("pattern interrupt");
    expect(block).toContain("soft rhetorical question is NOT an acceptable opening");
    expect(block).toContain("Have you ever felt tired for no reason?");
  });

  it("demands originality so the opening is never lifted verbatim", () => {
    const block = buildHookReferenceBlock([ref("X", "contradiction")]);
    expect(block).toContain("COMPLETELY ORIGINAL");
    expect(block).toContain("borrowing shape, not sentences");
  });

  it("with no research, still offers structures and keeps the 15-second rule", () => {
    const block = buildHookReferenceBlock([]);
    expect(block).toContain("No competitor openings were secured");
    expect(block).toContain("contradiction");
    expect(block).toContain("pattern interrupt");
    expect(block).not.toContain("--- Reference ");
  });
});

describe("buildStructureSummaryBlock", () => {
  it("renders the flow and stays explicitly subordinate", () => {
    const block = buildStructureSummaryBlock({
      sectionFlow: ["cold open", "mechanism"],
      pacingNotes: "fast open",
      firstPayoffPoint: "2:10",
      reHookPlacement: "midpoint",
      ctaPlacement: "final 45s",
      sourceVideoIds: ["a", "b"],
      sourceCount: 2,
    });
    expect(block).toContain("PROVEN STRUCTURE (advisory)");
    expect(block).toContain("Aggregated from 2 winning videos");
    expect(block).toContain("1. cold open");
    // Precedence must be explicit or advisory guidance overrides hard rules.
    expect(block).toContain("GUIDANCE, not instruction");
    expect(block).toMatch(/Northstar/);
  });

  it("uses the singular for a single source", () => {
    const block = buildStructureSummaryBlock({
      sectionFlow: ["a"], pacingNotes: "", firstPayoffPoint: "", reHookPlacement: "",
      ctaPlacement: "", sourceVideoIds: ["x"], sourceCount: 1,
    });
    expect(block).toContain("1 winning video on this topic");
  });
});
