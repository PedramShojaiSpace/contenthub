import { describe, it, expect } from "vitest";
import {
  computeGroundingMetric,
  describeGrounding,
  parseSectionInstances,
  insertTimestamps,
  stripTimestamps,
  estimateRuntimeSeconds,
  lintCadence,
  buildCadenceBlock,
  CADENCE_RULES,
  SPEAKING_WPM,
} from "./scriptMetrics";
import { STORY_SLOT_OPEN, STORY_SLOT_CLOSE } from "./storyIntegrity";
import { countVerifiedTags } from "./scriptFactoryRouter";

const words = (n: number) => Array.from({ length: n }, (_, i) => `w${i}`).join(" ");

describe("parseSectionInstances", () => {
  it("counts recurring tags as separate instances", () => {
    const body = "[HOOK] a\n[TEACH] b\n[TEACH] c\n[TEACH] d\n[CTA] e";
    const instances = parseSectionInstances(body);
    expect(instances).toHaveLength(5);
    expect(instances.filter((i) => i.tag === "TEACH")).toHaveLength(3);
  });

  it("ignores [VERIFIED] as a section", () => {
    const instances = parseSectionInstances("[HOOK] one [VERIFIED] two");
    expect(instances).toHaveLength(1);
    expect(instances[0].tag).toBe("HOOK");
  });

  it("returns nothing for an untagged body", () => {
    expect(parseSectionInstances("just prose, no tags")).toEqual([]);
  });
});

describe("computeGroundingMetric — the dishonest-denominator fix", () => {
  /*
   * THE ORIGINAL BUG. countVerifiedTags divided [VERIFIED] count by the count of
   * ALL bracketed tokens, so structure labels sat in the denominator. Adding
   * section labels to a script LOWERED its reported "verified %" without
   * changing how grounded the script was.
   */
  it("is not diluted by structure labels, unlike the legacy metric", () => {
    const body = [
      "[HOOK] opener [VERIFIED]",
      "[PAIN] the pain [VERIFIED]",
      "[PROOF] the proof [VERIFIED]",
      "[CTA] the close [VERIFIED]",
    ].join("\n");

    // Every section is grounded, so the honest answer is 100%.
    expect(computeGroundingMetric(body).pct).toBe(100);
    // The legacy metric reports 50% for the same fully-grounded script:
    // 4 [VERIFIED] over 8 bracketed tokens.
    expect(countVerifiedTags(body).pct).toBe(50);
  });

  it("does not let one grounded TEACH hide five ungrounded ones", () => {
    const body = [
      "[HOOK] opener [VERIFIED]",
      "[TEACH] grounded point [VERIFIED]",
      "[TEACH] ungrounded a",
      "[TEACH] ungrounded b",
      "[TEACH] ungrounded c",
      "[TEACH] ungrounded d",
    ].join("\n");
    const m = computeGroundingMetric(body);
    expect(m.total).toBe(6);
    expect(m.grounded).toBe(2);
    expect(m.pct).toBe(33);
    expect(m.byTag.TEACH).toEqual({ grounded: 1, total: 5 });
  });

  it("excludes slot-only sections from the denominator", () => {
    const body = [
      "[HOOK] opener [VERIFIED]",
      `[STORY] ${STORY_SLOT_OPEN}\nDescribe your real patient case here.\n${STORY_SLOT_CLOSE}`,
      "[CTA] the close [VERIFIED]",
    ].join("\n");
    const m = computeGroundingMetric(body);
    // Compliant story behaviour must not be scored as a defect.
    expect(m.total).toBe(2);
    expect(m.grounded).toBe(2);
    expect(m.pct).toBe(100);
    expect(m.slotOnlySections).toBe(1);
  });

  it("does not count [VERIFIED] inside slot instructional text", () => {
    const body = [
      "[HOOK] opener",
      `[STORY] ${STORY_SLOT_OPEN}\nInclude the starting labs [VERIFIED]\n${STORY_SLOT_CLOSE}`,
      "[CTA] close",
    ].join("\n");
    const m = computeGroundingMetric(body);
    // The slot section is excluded entirely, and nothing else is grounded.
    expect(m.grounded).toBe(0);
    expect(m.total).toBe(2);
  });

  it("still counts a STORY section that has real prose alongside a slot", () => {
    const body = [
      "[HOOK] opener",
      `[STORY] Here is what the mechanism looks like in a real case, and why the timeline matters so much for recovery [VERIFIED]. ${STORY_SLOT_OPEN}\nYour case here.\n${STORY_SLOT_CLOSE}`,
    ].join("\n");
    const m = computeGroundingMetric(body);
    expect(m.slotOnlySections).toBe(0);
    expect(m.total).toBe(2);
    expect(m.grounded).toBe(1);
  });

  it("reports 0 rather than dividing by zero on an untagged body", () => {
    const m = computeGroundingMetric("no tags at all");
    expect(m).toMatchObject({ grounded: 0, total: 0, pct: 0 });
  });

  it("carries a metric version so legacy rows are distinguishable", () => {
    expect(computeGroundingMetric("[HOOK] x").metricVersion).toBe("v2.2-instance");
  });

  it("phrases the disclosure the same way everywhere", () => {
    const m = computeGroundingMetric("[HOOK] a [VERIFIED]\n[CTA] b");
    expect(describeGrounding(m)).toBe("1 of 2 sections grounded");
  });
});

describe("computeGroundingMetric — edit stability", () => {
  /*
   * The spec's warning: two definitions racing on the same columns depending on
   * whether a script was edited is worse than the original bug. `update` calls
   * this same function, so the guarantee to test is that the metric depends only
   * on the body text.
   */
  it("returns identical numbers for an unchanged body on re-save", () => {
    const body = "[HOOK] a [VERIFIED]\n[TEACH] b\n[CTA] c [VERIFIED]";
    expect(computeGroundingMetric(body)).toEqual(computeGroundingMetric(body));
  });

  it("moves in the right direction when an edit removes grounding", () => {
    const before = computeGroundingMetric("[HOOK] a [VERIFIED]\n[CTA] b [VERIFIED]");
    const after = computeGroundingMetric("[HOOK] a\n[CTA] b [VERIFIED]");
    expect(before.pct).toBe(100);
    expect(after.pct).toBe(50);
  });

  it("is unaffected by timestamps added between saves", () => {
    const body = "[HOOK] a [VERIFIED]\n[TEACH] b\n[CTA] c [VERIFIED]";
    expect(computeGroundingMetric(insertTimestamps(body)).pct).toBe(
      computeGroundingMetric(body).pct
    );
  });
});

describe("insertTimestamps", () => {
  it("stamps the first section at 0:00", () => {
    expect(insertTimestamps("[HOOK] hello there")).toContain("[HOOK] (0:00)");
  });

  it("is idempotent — running twice cannot stack stamps", () => {
    const body = `[HOOK] ${words(150)}\n[TEACH] ${words(150)}\n[CTA] ${words(50)}`;
    const once = insertTimestamps(body);
    const twice = insertTimestamps(once);
    expect(twice).toBe(once);
    expect(twice).not.toMatch(/\(\d+:\d\d\)\s*\(\d+:\d\d\)/);
  });

  it("strips LLM-emitted stamps before recomputing", () => {
    // A model that emitted its own wrong stamps must not have them preserved.
    const body = "[HOOK] (3:42) opener\n[CTA] (9:99) close";
    const out = insertTimestamps(body);
    expect(out).not.toContain("(3:42)");
    expect(out).not.toContain("(9:99)");
    expect(out).toContain("[HOOK] (0:00)");
  });

  it("lands a 15-minute script's final stamp near 15:00", () => {
    // 15 min at 145 wpm = 2175 words. Fourteen sections, as a real long-form
    // script has, because [TEACH] recurs.
    const perSection = Math.round(2175 / 14);
    const tags = ["HOOK", "PAIN", "PROOF", "TEACH", "TEACH", "TEACH", "TEACH",
      "TEACH", "TEACH", "TEACH", "OBJECTION", "PROOF", "CTA", "CLOSE"];
    const body = tags.map((t) => `[${t}] ${words(perSection)}`).join("\n");

    const out = insertTimestamps(body);
    const stamps = [...out.matchAll(/\((\d{1,3}):(\d{2})\)/g)]
      .map((m) => Number(m[1]) * 60 + Number(m[2]));
    const last = stamps[stamps.length - 1];

    // The LAST stamp marks the start of the final section, so it lands one
    // section short of the full runtime — around 13:55 for a 15:00 script.
    expect(last).toBeGreaterThan(13 * 60);
    expect(last).toBeLessThan(15 * 60);

    // Total runtime, which includes that last section, is the ~15:00 figure.
    const runtime = estimateRuntimeSeconds(body);
    expect(runtime).toBeGreaterThan(14 * 60);
    expect(runtime).toBeLessThan(16 * 60);
  });

  it("credits a story slot at 200 words instead of its instruction text", () => {
    const withSlot = `[HOOK] ${words(145)}\n[STORY] ${STORY_SLOT_OPEN}\nPaste your case.\n${STORY_SLOT_CLOSE}\n[CTA] ${words(145)}`;
    const stamps = [...insertTimestamps(withSlot).matchAll(/\((\d{1,3}):(\d{2})\)/g)]
      .map((m) => Number(m[1]) * 60 + Number(m[2]));
    // HOOK 0:00 · STORY at 1:00 (145 words) · CTA at 1:00 + 200/145 min ≈ 2:22
    expect(stamps[0]).toBe(0);
    expect(stamps[1]).toBe(60);
    expect(stamps[2]).toBeGreaterThan(130);
    expect(stamps[2]).toBeLessThan(155);
  });

  it("leaves an untagged body untouched", () => {
    expect(insertTimestamps("plain prose")).toBe("plain prose");
  });

  it("stripTimestamps removes stamps without eating content", () => {
    expect(stripTimestamps("[HOOK] (0:00) hello")).toBe("[HOOK] hello");
  });

  it("uses 145 wpm", () => {
    expect(SPEAKING_WPM).toBe(145);
    // 145 words is exactly one minute.
    expect(estimateRuntimeSeconds(`[HOOK] ${words(145)}`)).toBe(60);
  });
});

describe("lintCadence — paraphrase tolerance", () => {
  /*
   * THE POINT OF BOUNDED-GAP MATCHING. A literal matcher catches the form models
   * rarely emit and misses what they actually write. These are the paraphrases.
   */
  it("catches the paraphrased 'I know what you're thinking'", () => {
    const r = lintCadence("Now, I know what some of you might be thinking right now.");
    expect(r.violations.map((v) => v.ruleId)).toContain("know_what_youre_thinking");
  });

  it("catches the literal form too", () => {
    const r = lintCadence("I know what you're thinking.");
    expect(r.violations.map((v) => v.ruleId)).toContain("know_what_youre_thinking");
  });

  it("catches paraphrased 'think about that for a moment'", () => {
    const r = lintCadence("Think about that for just a second.");
    expect(r.violations.map((v) => v.ruleId)).toContain("think_about_that");
  });

  it("catches paraphrased 'what do they tell you'", () => {
    const r = lintCadence("And what do most doctors tell you? Nothing useful.");
    expect(r.violations.map((v) => v.ruleId)).toContain("what_do_they_tell_you");
  });

  it("catches the remaining banned entries", () => {
    const cases: [string, string][] = [
      ["Let's dive right into it.", "lets_dive_in"],
      ["But here's the thing about cortisol.", "heres_the_thing"],
      ["In today's video we cover three things.", "in_todays_video"],
      ["So without further ado, the protocol.", "without_further_ado"],
      ["It's important to note the dosage.", "important_to_note"],
      ["This was a total game changer.", "game_changer"],
    ];
    for (const [text, ruleId] of cases) {
      expect(lintCadence(text).violations.map((v) => v.ruleId)).toContain(ruleId);
    }
  });
});

describe("lintCadence — false positives (must stay clean)", () => {
  /*
   * A lint the operator learns to ignore is worse than none. These are the
   * >= 4 non-flagging cases the spec requires: ordinary health-education prose
   * that shares vocabulary with the banned list.
   */
  it("does not flag ordinary prose about thinking", () => {
    const r = lintCadence(
      "Your gut lining doesn't think in symptoms. It's a barrier, and when it thins you feel it everywhere."
    );
    expect(r.violations).toEqual([]);
  });

  it("does not flag a legitimate use of 'tell you'", () => {
    const r = lintCadence(
      "Your labs tell you where you started. They don't tell you how you got there."
    );
    expect(r.violations).toEqual([]);
  });

  it("does not flag 'dive' in a literal sense", () => {
    const r = lintCadence("Cold water immersion — a genuine dive, not a cold shower — shifts vagal tone.");
    expect(r.violations).toEqual([]);
  });

  it("does not flag ordinary uses of 'thing' or 'note'", () => {
    const r = lintCadence(
      "The thing that changed was her sleep. Note the timing: three weeks in, not three days."
    );
    expect(r.violations).toEqual([]);
  });

  it("does not flag 'video' outside the banned opener", () => {
    const r = lintCadence("I recorded a video of the protocol so you can follow along.");
    expect(r.violations).toEqual([]);
  });

  it("does not flag 'game' unless it is game-changer", () => {
    const r = lintCadence("Recovery is a long game. Treat it like one.");
    expect(r.violations).toEqual([]);
  });

  it("does not lint story slot instructions", () => {
    // Slot text is guidance to the operator, not broadcast copy.
    const body = `[STORY] ${STORY_SLOT_OPEN}\nHere's the thing to include: the starting labs.\n${STORY_SLOT_CLOSE}`;
    expect(lintCadence(body).violations).toEqual([]);
  });
});

describe("lintCadence — advisory signals", () => {
  it("detects uniform sentence length", () => {
    const uniform = Array.from({ length: 8 }, () => "This sentence has exactly seven words here.").join(" ");
    expect(lintCadence(uniform).uniformSentenceRatio).toBe(1);
  });

  it("detects varied sentence length", () => {
    const varied =
      "Short. " +
      "This one runs considerably longer because it deliberately piles clause upon clause to stretch the line well past the mean. " +
      "Then stops. " +
      "And another middling sentence sits here to fill the gap between the extremes.";
    expect(lintCadence(varied).uniformSentenceRatio).toBeLessThan(1);
  });

  it("detects missing contractions", () => {
    const stiff = "You will not feel it immediately. It is a slow process. That is normal.";
    expect(lintCadence(stiff).contractionFreeRatio).toBeGreaterThan(0.9);
  });

  it("returns zeroed ratios for an empty body rather than NaN", () => {
    const r = lintCadence("");
    expect(r.uniformSentenceRatio).toBe(0);
    expect(r.contractionFreeRatio).toBe(0);
  });
});

describe("buildCadenceBlock", () => {
  it("names every banned entry in the prompt", () => {
    const block = buildCadenceBlock();
    expect(block).toContain("=== WRITE LIKE A HUMAN ON CAMERA ===");
    for (const rule of CADENCE_RULES) {
      expect(block).toContain(rule.label);
    }
  });
});
