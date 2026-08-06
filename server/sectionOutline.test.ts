/**
 * v2.3 Part 1 — section outline tests.
 *
 * The point of these is PARITY, not coverage for its own sake. The outline is
 * a second consumer of `parseSectionInstances`, and the whole reason it lives
 * on the server (Option A) is that a second *parser* would drift. These tests
 * assert the outline agrees with the two functions that already own this
 * arithmetic — `insertTimestamps` for the clock, `parseSectionInstances` for
 * what counts as a section — so a future change to either breaks here loudly.
 */
import { describe, it, expect } from "vitest";
import { buildSectionOutline } from "./scriptFactoryRouter";
import {
  insertTimestamps,
  parseSectionInstances,
  stripTimestamps,
  SECTION_TAGS,
} from "./scriptMetrics";
import { STORY_SLOT_OPEN, STORY_SLOT_CLOSE } from "./storyIntegrity";

/** ~30 words per section so timestamps are comfortably distinguishable. */
function body(words: number, tag: string): string {
  return `[${tag}] ` + Array.from({ length: words }, (_, i) => `w${i}`).join(" ") + "\n\n";
}

describe("buildSectionOutline — basics", () => {
  it("returns an empty array for empty or tagless bodies", () => {
    expect(buildSectionOutline("")).toEqual([]);
    expect(buildSectionOutline("   ")).toEqual([]);
    expect(buildSectionOutline("Just prose with no structure tags at all.")).toEqual([]);
  });

  it("emits one entry per section INSTANCE, not per distinct tag", () => {
    const script = body(20, "HOOK") + body(20, "TEACH") + body(20, "TEACH") + body(20, "CTA");
    const outline = buildSectionOutline(script);
    expect(outline).toHaveLength(4);
    expect(outline.map((s) => s.tag)).toEqual(["HOOK", "TEACH", "TEACH", "CTA"]);
  });

  it("agrees with parseSectionInstances on count and order for every tag", () => {
    const script = SECTION_TAGS.map((t) => body(15, t)).join("");
    const outline = buildSectionOutline(script);
    const instances = parseSectionInstances(script);
    expect(outline).toHaveLength(instances.length);
    expect(outline.map((s) => s.tag)).toEqual(instances.map((i) => i.tag));
    expect(outline.map((s) => s.index)).toEqual(instances.map((i) => i.index));
  });
});

describe("buildSectionOutline — labels", () => {
  it("does not number a tag that appears once", () => {
    const outline = buildSectionOutline(body(10, "HOOK") + body(10, "CTA"));
    expect(outline.map((s) => s.label)).toEqual(["Hook", "Cta"]);
  });

  it("numbers recurring tags in document order", () => {
    const script = body(10, "TEACH") + body(10, "PROOF") + body(10, "TEACH") + body(10, "TEACH");
    const outline = buildSectionOutline(script);
    expect(outline.map((s) => s.label)).toEqual(["Teach 1", "Proof", "Teach 2", "Teach 3"]);
  });
});

describe("buildSectionOutline — clock parity with insertTimestamps", () => {
  /**
   * The strongest available assertion: stamp the script with the production
   * function, then check every label the outline computed actually appears
   * against the same tag in the stamped output. If the two ever diverge the
   * navigator would be pointing at times the script itself does not claim.
   */
  it("matches the timestamps insertTimestamps writes into the body", () => {
    const script =
      body(145, "HOOK") + body(290, "PAIN") + body(145, "TEACH") + body(72, "CTA");
    const stamped = insertTimestamps(script);
    const outline = buildSectionOutline(script);

    // insertTimestamps writes "[TAG] (m:ss)"; pull them back out in order.
    const re = /\[([A-Z]+)\] \((\d+:\d{2})\)/g;
    const found: { tag: string; label: string }[] = [];
    let m: RegExpExecArray | null;
    while ((m = re.exec(stamped)) !== null) found.push({ tag: m[1], label: m[2] });

    expect(found).toHaveLength(outline.length);
    outline.forEach((s, i) => {
      expect(s.tag).toBe(found[i].tag);
      expect(s.startLabel).toBe(found[i].label);
    });
  });

  it("starts the first section at 0:00 and increases monotonically", () => {
    const script = body(100, "HOOK") + body(100, "TEACH") + body(100, "CTA");
    const outline = buildSectionOutline(script);
    expect(outline[0].startLabel).toBe("0:00");
    for (let i = 1; i < outline.length; i++) {
      expect(outline[i].startSeconds).toBeGreaterThan(outline[i - 1].startSeconds);
    }
  });

  it("is stable on an already-stamped body (idempotent like insertTimestamps)", () => {
    const script = body(145, "HOOK") + body(145, "TEACH");
    const once = buildSectionOutline(script);
    const twice = buildSectionOutline(insertTimestamps(script));
    expect(twice.map((s) => s.startLabel)).toEqual(once.map((s) => s.startLabel));
    expect(twice.map((s) => s.wordCount)).toEqual(once.map((s) => s.wordCount));
  });

  it("does not count injected timestamps as spoken words", () => {
    const script = body(50, "HOOK") + body(50, "TEACH");
    const plain = buildSectionOutline(script);
    const stampedOutline = buildSectionOutline(insertTimestamps(script));
    expect(stampedOutline.map((s) => s.wordCount)).toEqual(plain.map((s) => s.wordCount));
  });
});

describe("buildSectionOutline — story slots", () => {
  const slot = `${STORY_SLOT_OPEN}\nPaste the real patient case here.\n${STORY_SLOT_CLOSE}`;

  it("flags a slot-only section and credits it 200 words", () => {
    const script = body(20, "HOOK") + `[STORY] ${slot}\n\n` + body(20, "CTA");
    const outline = buildSectionOutline(script);
    const story = outline.find((s) => s.tag === "STORY")!;
    expect(story.slotOnly).toBe(true);
    // 200-word credit, and the slot INSTRUCTIONS must not be counted as prose.
    expect(story.wordCount).toBe(200);
  });

  it("pushes later timestamps by the slot credit, not by the instruction text", () => {
    const withSlot = body(145, "HOOK") + `[STORY] ${slot}\n\n` + body(50, "CTA");
    const outline = buildSectionOutline(withSlot);
    const cta = outline.find((s) => s.tag === "CTA")!;
    /*
     * 145 words = 60.0s, + 200 credited = 82.75s → 142.75s. Floored, not
     * rounded: "2:22". The clock in scriptMetrics.ts floors, and the navigator
     * must agree with the stamps already written into the body rather than
     * being independently "more accurate" by a second.
     */
    expect(cta.startLabel).toBe("2:22");
    // and the authority for that: insertTimestamps' own output.
    const stamped = insertTimestamps(withSlot);
    expect(stamped).toContain("[CTA] (2:22)");
  });

  /*
   * `isSlotOnly` (scriptMetrics.ts) treats <= 12 non-slot words as "slot only":
   * a one-line lead-in such as "Here is a case:" is scaffolding, not content,
   * and must not be counted as a grounded-able section. My first version of
   * this test used a 7-word lead-in and asserted false — the test was wrong,
   * not the server. Both sides of the threshold are asserted below so the
   * boundary is documented rather than discovered again later.
   */
  it("still counts as slot-only when the prose is only a short lead-in (<= 12 words)", () => {
    const script = `[STORY] Real narration here about the mechanism.\n${slot}\n\n`;
    const outline = buildSectionOutline(script);
    expect(outline[0].slotOnly).toBe(true);
  });

  it("is NOT slot-only once the section carries substantial prose (> 12 words)", () => {
    const prose =
      "This section explains the underlying inflammation mechanism in enough " +
      "detail that it stands on its own as spoken content for the presenter.";
    const script = `[STORY] ${prose}\n${slot}\n\n`;
    const outline = buildSectionOutline(script);
    expect(outline[0].slotOnly).toBe(false);
    expect(outline[0].wordCount).toBeGreaterThan(200);
  });
});

describe("buildSectionOutline — grounding", () => {
  it("marks a section grounded when [VERIFIED] sits in its prose", () => {
    const script = "[HOOK] Opening line [VERIFIED] with proof.\n\n[CTA] Book now.\n\n";
    const outline = buildSectionOutline(script);
    expect(outline[0].grounded).toBe(true);
    expect(outline[1].grounded).toBe(false);
  });

  it("does not credit a [VERIFIED] that only appears inside a story slot", () => {
    const script =
      `[STORY] ${STORY_SLOT_OPEN}\nYour case [VERIFIED] goes here.\n${STORY_SLOT_CLOSE}\n\n`;
    const outline = buildSectionOutline(script);
    expect(outline[0].grounded).toBe(false);
  });
});

describe("buildSectionOutline — char offsets anchor into the RAW body", () => {
  it("charStart/charEnd bracket the tag exactly", () => {
    const script = body(10, "HOOK") + body(10, "TEACH") + body(10, "CTA");
    for (const s of buildSectionOutline(script)) {
      expect(script.slice(s.charStart, s.charEnd)).toBe(`[${s.tag}]`);
    }
  });

  it("resolves repeated tags to successive occurrences, not all to the first", () => {
    const script = body(10, "TEACH") + body(10, "TEACH") + body(10, "TEACH");
    const outline = buildSectionOutline(script);
    expect(outline[0].charStart).toBeLessThan(outline[1].charStart);
    expect(outline[1].charStart).toBeLessThan(outline[2].charStart);
  });

  it("offsets remain valid against a stamped body", () => {
    const stamped = insertTimestamps(body(40, "HOOK") + body(40, "TEACH"));
    for (const s of buildSectionOutline(stamped)) {
      expect(stamped.slice(s.charStart, s.charEnd)).toBe(`[${s.tag}]`);
    }
    // sanity: the stamped body really does differ from the stripped one
    expect(stripTimestamps(stamped)).not.toBe(stamped);
  });
});

/*
 * sectionKey — the single naming authority shared by the navigator anchors, the
 * `?section=` deep link, and Part 3's regenerateSection input. These assertions
 * exist because a mismatch between those three consumers would regenerate the
 * wrong section of a script, not merely scroll to the wrong place.
 */
describe("buildSectionOutline — sectionKey", () => {
  it("uses a bare slug when a tag occurs once, and -N when it recurs", () => {
    const body = [
      "[HOOK] Opening line here.",
      "[TEACH] First teaching block.",
      "[TEACH] Second teaching block.",
      "[TEACH] Third teaching block.",
      "[CTA] Book the intake.",
    ].join("\n\n");
    const out = buildSectionOutline(body);
    expect(out.map((s) => s.sectionKey)).toEqual([
      "hook",
      "teach-1",
      "teach-2",
      "teach-3",
      "cta",
    ]);
  });

  it("keeps sectionKey and label in lockstep on the suffix rule", () => {
    const body = "[HOOK] a\n\n[TEACH] b\n\n[TEACH] c\n\n[CLOSE] d";
    for (const s of buildSectionOutline(body)) {
      // "Teach 2" <-> "teach-2"; "Hook" <-> "hook". If one gains a suffix the
      // other must too, or Part 3 will target a section the operator did not click.
      expect(s.sectionKey).toBe(s.label.toLowerCase().replace(/ /g, "-"));
    }
  });

  it("produces unique keys for every section in a script", () => {
    const body = "[HOOK] a\n\n[PAIN] b\n\n[TEACH] c\n\n[TEACH] d\n\n[OBJECTION] e\n\n[OBJECTION] f\n\n[CTA] g";
    const keys = buildSectionOutline(body).map((s) => s.sectionKey);
    expect(new Set(keys).size).toBe(keys.length);
  });
});
