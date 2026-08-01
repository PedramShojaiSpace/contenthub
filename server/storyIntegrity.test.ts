/**
 * PART 3A tests — story integrity.
 *
 * The fixture in "reproduces the known violation" is modelled on the actual
 * fabrication this feature exists to prevent: a named patient with quoted
 * dialogue and specific clinical findings, inside content selling a health offer.
 *
 * False-positive coverage is mandatory per spec: the slot template's own text,
 * the operator's own name, and population statistics must never flag. Those
 * three cases are the reason this lint targets violation CLASSES rather than
 * literal phrases — a matcher tight enough to avoid them by accident would
 * miss the real violations.
 */
import { describe, it, expect } from "vitest";
import {
  lintStoryIntegrity,
  countWordsWithStorySlots,
  buildStoryIntegrityBlock,
  stripStorySlots,
  formatViolations,
  STORY_SLOT_OPEN,
  STORY_SLOT_CLOSE,
  STORY_SLOT_WORD_CREDIT,
} from "./storyIntegrity";

const classes = (body: string, mode: any = "brief") =>
  lintStoryIntegrity(body, mode).violations.map((v) => v.violationClass);

describe("3A class 1 — named patient introductions", () => {
  it("catches the bare appositive shape the model actually produced", () => {
    const body =
      "[STORY] Sarah, a brilliant executive in her late 50s, came to me last spring exhausted.";
    expect(classes(body)).toContain("named_patient");
  });

  it("catches an explicitly named patient", () => {
    expect(classes("[STORY] I had a patient named Michael who could not sleep.")).toContain(
      "named_patient"
    );
  });

  it("catches 'my client Jennifer'", () => {
    expect(classes("[STORY] My client Jennifer had tried everything.")).toContain("named_patient");
  });

  it("catches 'Take David, for example'", () => {
    expect(classes("[TEACH] Take David, for example. He had the same pattern.")).toContain(
      "named_patient"
    );
  });

  it("catches a named individual presenting for care", () => {
    expect(classes("[STORY] Robert walked into my clinic with a decade of bloating.")).toContain(
      "named_patient"
    );
  });
});

describe("3A class 2 — quoted patient dialogue, both word orders", () => {
  it("catches verb-first order", () => {
    const body = '[STORY] She told me, "I just feel broken all the time."';
    expect(classes(body)).toContain("quoted_patient_dialogue");
  });

  it("catches quote-first order", () => {
    const body = '[STORY] "I have tried every diet on earth," the patient said.';
    expect(classes(body)).toContain("quoted_patient_dialogue");
  });
});

describe("3A class 3 — individual clinical specifics", () => {
  it("flags an individual lab value", () => {
    expect(classes("[PROOF] When we ran the panel, her CRP was 8.2 mg/L.")).toContain(
      "individual_clinical_specific"
    );
  });

  it("flags an individual's vitamin D result", () => {
    expect(classes("[PROOF] His vitamin D came back at 18 ng/ml, which explained the fatigue.")).toContain(
      "individual_clinical_specific"
    );
  });

  it("does NOT flag population statistics — the mandatory contrast case", () => {
    const body =
      "[PROOF] In that trial, CRP dropped 40% across 200 participants over twelve weeks.";
    expect(classes(body)).not.toContain("individual_clinical_specific");
  });

  it("does NOT flag cohort framing with a possessive present", () => {
    const body =
      "[PROOF] Researchers tracked their CRP levels and saw a 30% reduction across the cohort.";
    expect(classes(body)).not.toContain("individual_clinical_specific");
  });
});

describe("3A class 4 — invented recovery timelines", () => {
  it("flags an individual recovery timeline", () => {
    const body = "[STORY] Within three weeks her symptoms were gone completely.";
    expect(classes(body)).toContain("invented_recovery_timeline");
  });

  it("does NOT flag a population-framed timeline", () => {
    const body =
      "[PROOF] In the study, participants resolved their symptoms within eight weeks on average.";
    expect(classes(body)).not.toContain("invented_recovery_timeline");
  });
});

describe("3A false-positive coverage (mandatory)", () => {
  it("does not flag the slot template's own instructional text", () => {
    const slot = buildStoryIntegrityBlock("brief");
    const result = lintStoryIntegrity(slot, "brief");
    expect(result.violations).toEqual([]);
  });

  it("does not flag an emitted story slot inside a real script body", () => {
    const body = [
      "[HOOK] Your gut is running your mood.",
      "[STORY]",
      STORY_SLOT_OPEN,
      "Suggested ~90-second shape:",
      "  1. Symptoms — afternoon crashes and bloating after every meal.",
      "  2. Conventional dead end — told it was stress, given an acid blocker.",
      '  Use a real case; anonymize or say "a composite of patients I\'ve worked with."',
      STORY_SLOT_CLOSE,
      "[CTA] Book the panel.",
    ].join("\n");
    expect(lintStoryIntegrity(body, "brief").violations).toEqual([]);
  });

  it("does not flag the operator's own name", () => {
    const body =
      "[HOOK] I'm Dr. Pedram Shojai, and Pedram, a practitioner in his own clinic, has seen this for decades.";
    expect(classes(body)).not.toContain("named_patient");
  });

  it("does not flag ordinary teaching copy with no story at all", () => {
    const body = [
      "[HOOK] Most fatigue is not a sleep problem.",
      "[TEACH] The gut lining is one cell thick. When it loosens, endotoxin crosses.",
      "[PROOF] Multiple studies link elevated LPS to fatigue in the general population.",
      "[CTA] Get the panel done.",
    ].join("\n");
    expect(lintStoryIntegrity(body, "brief").violations).toEqual([]);
  });
});

describe("3A composite mode", () => {
  const labelled = [
    "[STORY] Let me give you a composite of patients I see all the time.",
    "This person wakes up tired, pushes through on caffeine, and crashes by three.",
    "Their inflammation markers came down once we addressed the barrier.",
  ].join("\n");

  it("accepts a labelled, de-identified composite", () => {
    const r = lintStoryIntegrity(labelled, "composite");
    expect(r.violations).toEqual([]);
    expect(r.missingCompositeLabel).toBe(false);
  });

  it("treats an UNLABELLED composite as a violation", () => {
    const unlabelled =
      "[STORY] This patient wakes up tired, pushes through on caffeine, and crashes by three.";
    expect(lintStoryIntegrity(unlabelled, "composite").missingCompositeLabel).toBe(true);
  });

  it("still forbids proper names in composite mode", () => {
    const named = `${labelled}\nMonica, a teacher in her 40s, is the clearest example.`;
    expect(classes(named, "composite")).toContain("named_patient");
  });
});

describe("3A word budgeting credits story slots", () => {
  const slot = `${STORY_SLOT_OPEN}\n${"instructional text ".repeat(20)}\n${STORY_SLOT_CLOSE}`;

  it("credits each slot at the spec figure and excludes instructional text", () => {
    const body = `[HOOK] ${"word ".repeat(100)}\n${slot}\n[CTA] ${"word ".repeat(50)}`;
    const r = countWordsWithStorySlots(body);
    expect(r.slotCount).toBe(1);
    expect(r.creditedWords).toBe(STORY_SLOT_WORD_CREDIT);
    // 150 spoken words, instructional text excluded entirely.
    expect(r.spokenWords).toBe(150);
    expect(r.words).toBe(150 + STORY_SLOT_WORD_CREDIT);
  });

  it("a 15-minute script with two slots clears the 80% continuation threshold", () => {
    // 15 min * 145 wpm = 2175 target; 80% = 1740.
    const spoken = 1500;
    const body = `[HOOK] ${"word ".repeat(spoken)}\n${slot}\n[STORY]\n${slot}\n[CLOSE] end`;
    const r = countWordsWithStorySlots(body);
    expect(r.slotCount).toBe(2);
    expect(r.words).toBeGreaterThanOrEqual(2175 * 0.8);
    // Naive counting would under-count and trigger the continuation pass, which
    // explicitly asks the model to "deepen the thinnest [STORY] sections".
    expect(r.spokenWords).toBeLessThan(2175 * 0.8);
  });
});

describe("3A prompt block + helpers", () => {
  it("brief mode emits the delimited slot and the shape guidance", () => {
    const b = buildStoryIntegrityBlock("brief");
    expect(b).toContain("=== STORY INTEGRITY (NON-NEGOTIABLE) ===");
    expect(b).toContain(STORY_SLOT_OPEN);
    expect(b).toContain(STORY_SLOT_CLOSE);
    expect(b).toContain("Conventional dead end");
    expect(b).toContain("anonymize");
  });

  it("none mode omits story blocks and redirects the budget to teaching", () => {
    const b = buildStoryIntegrityBlock("none");
    expect(b).toContain("MODE: NONE");
    expect(b).toContain("[TEACH]");
    expect(b).not.toContain(STORY_SLOT_OPEN);
  });

  it("composite mode requires the audible label", () => {
    expect(buildStoryIntegrityBlock("composite")).toContain("UNLABELLED composite is a violation");
  });

  it("stripStorySlots removes slot bodies but keeps surrounding copy", () => {
    const body = `before ${STORY_SLOT_OPEN} inner ${STORY_SLOT_CLOSE} after`;
    const s = stripStorySlots(body);
    expect(s).toContain("before");
    expect(s).toContain("after");
    expect(s).not.toContain("inner");
  });

  it("formatViolations reports class, reason and the matched text", () => {
    const { violations } = lintStoryIntegrity("[STORY] I had a patient named Michael.", "brief");
    const text = formatViolations(violations);
    expect(text).toContain("named_patient");
    expect(text).toContain("Michael");
  });

  it("formatViolations includes the missing composite label", () => {
    expect(formatViolations([], true)).toContain("missing_composite_label");
  });
});
