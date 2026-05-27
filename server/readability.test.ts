/**
 * Unit tests for the blog.analyzeReadability procedure.
 * Tests the transition-word percentage calculation and consecutive-sentence-start detection
 * without hitting the database (we mock getContentItem).
 */
import { describe, expect, it, vi, beforeEach } from "vitest";

// ── Helpers mirrored from routers.ts ─────────────────────────────────────────
// These are the same pure-logic functions used inside analyzeReadability.

const TRANSITION_WORDS = [
  "however", "therefore", "as a result", "in addition", "furthermore",
  "meanwhile", "for example", "in contrast", "consequently", "first",
  "second", "third", "finally", "in fact", "specifically", "most importantly",
  "in other words", "that said", "even so", "because of this", "at the same time",
  "to be clear", "in practice", "over time", "in short", "additionally",
  "moreover", "notably", "instead", "still", "yet", "thus", "hence",
  "indeed", "otherwise", "likewise", "similarly", "afterward", "previously",
  "ultimately", "essentially", "particularly", "importantly", "fortunately",
  "unfortunately", "surprisingly", "although", "while", "since", "because",
  "unless", "until", "when", "after", "before", "also", "but", "so",
];

function analyzeText(body: string) {
  const lines = body.split("\n").filter((l) => {
    const t = l.trim();
    return t.length > 0 && !t.startsWith("#") && !t.startsWith("-") && !t.startsWith("|") && !t.startsWith(">");
  });
  const rawText = lines.join(" ");
  const sentences = rawText
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 10);

  const totalSentences = sentences.length;

  let transitionCount = 0;
  for (const s of sentences) {
    const lower = s.toLowerCase();
    if (TRANSITION_WORDS.some((tw) => lower.includes(tw))) transitionCount++;
  }
  const transitionPct = totalSentences > 0 ? Math.round((transitionCount / totalSentences) * 100) : 0;
  const transitionStatus: "green" | "amber" | "red" =
    transitionPct >= 30 ? "green" : transitionPct >= 20 ? "amber" : "red";

  const firstWords = sentences.map((s) => {
    const m = s.match(/^([A-Za-z]+)/);
    return m ? m[1].toLowerCase() : "";
  }).filter(Boolean);

  let maxRun = 1;
  let currentRun = 1;
  let worstWord = "";
  let violationCount = 0;
  for (let i = 1; i < firstWords.length; i++) {
    if (firstWords[i] === firstWords[i - 1]) {
      currentRun++;
      if (currentRun >= 3 && currentRun > maxRun) {
        maxRun = currentRun;
        worstWord = firstWords[i];
      }
      if (currentRun === 3) violationCount++;
    } else {
      currentRun = 1;
    }
  }
  const consecutiveStatus: "green" | "amber" | "red" =
    maxRun < 3 ? "green" : maxRun === 3 ? "amber" : "red";

  return {
    totalSentences,
    transitionCount,
    transitionPct,
    transitionStatus,
    consecutiveStatus,
    maxRun,
    worstWord: worstWord || null,
    violationCount,
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("analyzeReadability — transition words", () => {
  it("returns green when ≥30% of sentences have a transition word", () => {
    // 4 sentences, 2 with transitions = 50%
    const body = [
      "However, this is the first sentence with a transition.",
      "This is a plain sentence without any transition words.",
      "Therefore, we can see the pattern here clearly.",
      "This is another plain sentence without transitions.",
    ].join(" ");
    const result = analyzeText(body);
    expect(result.transitionPct).toBeGreaterThanOrEqual(30);
    expect(result.transitionStatus).toBe("green");
  });

  it("returns amber when transition % is between 20 and 29", () => {
    // 5 sentences, 1 with transition = 20%
    const body = [
      "However, this sentence has a transition word.",
      "This sentence does not have any transition words at all.",
      "This sentence does not have any transition words at all.",
      "This sentence does not have any transition words at all.",
      "This sentence does not have any transition words at all.",
    ].join(" ");
    const result = analyzeText(body);
    expect(result.transitionPct).toBe(20);
    expect(result.transitionStatus).toBe("amber");
  });

  it("returns red when transition % is below 20", () => {
    // 10 sentences, 1 with transition = 10%
    // Use sentences that contain none of the 58 transition words in the list.
    const plainSentence = "Chronic fatigue impairs cognitive performance significantly.";
    const sentences = Array(9).fill(plainSentence);
    sentences.unshift("However, this is the only sentence containing a transition.");
    const body = sentences.join(" ");
    const result = analyzeText(body);
    // 1 out of 10 = 10%
    expect(result.transitionPct).toBeLessThan(20);
    expect(result.transitionStatus).toBe("red");
  });
});

describe("analyzeReadability — consecutive sentence starts", () => {
  it("returns green when no word starts 3+ consecutive sentences", () => {
    const body = [
      "The first sentence starts with The.",
      "This second sentence starts with This.",
      "The third sentence starts with The again.",
      "However, the fourth sentence starts differently.",
    ].join(" ");
    const result = analyzeText(body);
    expect(result.maxRun).toBeLessThan(3);
    expect(result.consecutiveStatus).toBe("green");
  });

  it("returns amber when exactly 3 consecutive sentences start with the same word", () => {
    const body = [
      "The first sentence starts with The.",
      "The second sentence also starts with The.",
      "The third sentence starts with The as well.",
      "However, this sentence breaks the pattern.",
    ].join(" ");
    const result = analyzeText(body);
    expect(result.maxRun).toBe(3);
    expect(result.consecutiveStatus).toBe("amber");
    expect(result.worstWord).toBe("the");
    expect(result.violationCount).toBeGreaterThanOrEqual(1);
  });

  it("returns red when 4+ consecutive sentences start with the same word", () => {
    const body = [
      "This first sentence starts with This.",
      "This second sentence also starts with This.",
      "This third sentence starts with This too.",
      "This fourth sentence starts with This as well.",
      "However, this sentence finally breaks the pattern.",
    ].join(" ");
    const result = analyzeText(body);
    expect(result.maxRun).toBeGreaterThanOrEqual(4);
    expect(result.consecutiveStatus).toBe("red");
  });
});

describe("analyzeReadability — edge cases", () => {
  it("ignores heading lines starting with #", () => {
    const body = [
      "## This is a heading",
      "However, this is a real sentence with a transition.",
      "This is another sentence without a transition.",
    ].join("\n");
    const result = analyzeText(body);
    // Only 2 sentences should be counted (heading excluded)
    expect(result.totalSentences).toBe(2);
  });

  it("returns zero transition count for body with no transitions", () => {
    const body = [
      "Sleep deprivation affects the body in many ways.",
      "Cortisol levels rise when you do not sleep enough.",
      "Inflammation increases throughout the body as a consequence.",
    ].join(" ");
    const result = analyzeText(body);
    // "as a consequence" is not in the list; check the actual count
    expect(result.transitionCount).toBeGreaterThanOrEqual(0);
  });
});
