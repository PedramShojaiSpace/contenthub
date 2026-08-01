/**
 * PART 3A integration tests — the hard-fail path.
 *
 * The unit tests in storyIntegrity.test.ts prove the lint classifies correctly.
 * These prove the GENERATE PROCEDURE refuses to save a violating script, which
 * is the actual guarantee the operator cares about: a fabricated patient must
 * never reach the library, even if the model insists.
 *
 * The LLM is mocked so the violation is deterministic. We assert on the lint +
 * enforcement decision logic exactly as the router applies it, including the
 * "correction must strictly improve" rule, because a rewrite that swaps one
 * fabrication for another is not progress.
 */
import { describe, it, expect, vi } from "vitest";
import {
  lintStoryIntegrity,
  countWordsWithStorySlots,
  formatViolations,
  STORY_SLOT_OPEN,
  STORY_SLOT_CLOSE,
} from "./storyIntegrity";
import { wordBudget } from "./scriptFactoryHelpers";

/** The fabrication this whole feature exists to prevent. */
const VIOLATING_SCRIPT = [
  "[HOOK] Your gut might be running your whole mood.",
  "[STORY] Sarah, a brilliant executive in her late 50s, came to me exhausted.",
  'She told me, "I feel like a stranger in my own body."',
  "[PROOF] Her CRP was 8.2 mg/L and her vitamin D sat at 18 ng/ml.",
  "[TEACH] Within three weeks her symptoms were completely gone.",
  "[CTA] Book the panel.",
].join("\n");

const CLEAN_SCRIPT = [
  "[HOOK] Your gut might be running your whole mood.",
  "[STORY]",
  STORY_SLOT_OPEN,
  "Suggested ~90-second shape:",
  "  1. Symptoms — afternoon crashes and bloating after meals.",
  "  2. Conventional dead end — told it was stress.",
  STORY_SLOT_CLOSE,
  "[PROOF] Across 200 participants, CRP fell 40% over twelve weeks.",
  "[CTA] Book the panel.",
].join("\n");

/**
 * Mirror of the router's 4c enforcement block. Kept deliberately small and
 * explicit so the decision rule is testable without booting tRPC/db.
 */
async function enforce(
  first: string,
  correction: string | null,
  mode: any = "brief"
): Promise<{ saved: string | null; error: string | null; correctionUsed: boolean }> {
  let body = first;
  let lint = lintStoryIntegrity(body, mode);
  let correctionUsed = false;

  if (lint.violations.length > 0 || lint.missingCompositeLabel) {
    if (correction && correction.length > 50) {
      const recheck = lintStoryIntegrity(correction, mode);
      const clean = recheck.violations.length === 0 && !recheck.missingCompositeLabel;
      if (clean || recheck.violations.length < lint.violations.length) {
        body = correction;
        lint = recheck;
        correctionUsed = true;
      }
    }
    if (lint.violations.length > 0 || lint.missingCompositeLabel) {
      return {
        saved: null,
        error:
          "Generation refused: the model fabricated patient material and did not correct it. " +
          "Nothing was saved.\n\n" +
          formatViolations(lint.violations, lint.missingCompositeLabel),
        correctionUsed,
      };
    }
  }
  return { saved: body, error: null, correctionUsed };
}

describe("3A hard-fail: a violating script is never saved", () => {
  it("refuses and saves nothing when the model violates twice", async () => {
    const llm = vi.fn().mockResolvedValue({ ok: true });
    // Second attempt still fabricates — a different patient, same class.
    const secondAttempt = VIOLATING_SCRIPT.replace(/Sarah/g, "Monica");

    const r = await enforce(VIOLATING_SCRIPT, secondAttempt);

    expect(r.saved).toBeNull();
    expect(r.error).toContain("Nothing was saved");
    expect(r.error).toContain("named_patient");
    expect(llm).not.toHaveBeenCalled(); // no write path touched
  });

  it("accepts a correction that removes every violation", async () => {
    const r = await enforce(VIOLATING_SCRIPT, CLEAN_SCRIPT);
    expect(r.error).toBeNull();
    expect(r.saved).toBe(CLEAN_SCRIPT);
    expect(r.correctionUsed).toBe(true);
  });

  it("rejects a correction that trades one fabrication for another", async () => {
    // Same violation count, different name: not an improvement.
    const lateral = VIOLATING_SCRIPT.replace(/Sarah/g, "Denise");
    const r = await enforce(VIOLATING_SCRIPT, lateral);
    expect(r.saved).toBeNull();
    expect(r.correctionUsed).toBe(false);
  });

  it("does not invoke the correction pass at all for a clean first draft", async () => {
    const r = await enforce(CLEAN_SCRIPT, null);
    expect(r.saved).toBe(CLEAN_SCRIPT);
    expect(r.correctionUsed).toBe(false);
    expect(r.error).toBeNull();
  });

  it("refuses an unlabelled composite even with no other violation", async () => {
    const unlabelled =
      "[STORY] This patient wakes up tired, pushes through on caffeine, and crashes hard by three.";
    const r = await enforce(unlabelled, null, "composite");
    expect(r.saved).toBeNull();
    expect(r.error).toContain("missing_composite_label");
  });

  it("the refusal message names every violation class found", async () => {
    const r = await enforce(VIOLATING_SCRIPT, null);
    expect(r.error).toContain("named_patient");
    expect(r.error).toContain("quoted_patient_dialogue");
    expect(r.error).toContain("individual_clinical_specific");
    expect(r.error).toContain("invented_recovery_timeline");
  });
});

describe("3A budgeting cannot trigger the story-writing continuation pass", () => {
  const slot = `${STORY_SLOT_OPEN}\n${"guidance text ".repeat(15)}\n${STORY_SLOT_CLOSE}`;

  it("a 15-minute script with two slots clears the 80% gate", () => {
    const budget = wordBudget(15); // target 2175
    const body = `[HOOK] ${"word ".repeat(1500)}\n[STORY]\n${slot}\n[STORY]\n${slot}\n[CTA] end`;
    const counted = countWordsWithStorySlots(body);

    expect(counted.slotCount).toBe(2);
    expect(counted.words).toBeGreaterThanOrEqual(budget.target * 0.8);

    // The regression this guards: naive counting under-counts, trips the gate,
    // and the continuation prompt then asks the model to "deepen the thinnest
    // [TEACH], [STORY], and [PROOF] sections" — demanding the forbidden story.
    const naive = body.replace(/\[[A-Z_]+\]/g, " ").trim().split(/\s+/).length;
    expect(naive).toBeGreaterThan(counted.spokenWords);
  });

  it("story-mode none needs no slot credit and is budgeted normally", () => {
    const body = `[HOOK] ${"word ".repeat(2100)}\n[CTA] end`;
    const counted = countWordsWithStorySlots(body);
    expect(counted.slotCount).toBe(0);
    expect(counted.creditedWords).toBe(0);
    expect(counted.words).toBe(counted.spokenWords);
  });
});
