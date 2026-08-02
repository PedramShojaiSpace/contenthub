/**
 * PART 3C — structure summary shape handling.
 *
 * These tests exist because of a MEASURED silent failure: every research job on
 * this branch recorded `structure_summary=no`, including jobs that completed
 * with real transcripts. The prompt showed a single-object schema but handed the
 * model three transcripts, so it returned an ARRAY of per-video objects. The
 * validator read `obj.sectionFlow` off the array, got undefined, and discarded
 * a perfectly good analysis without a word.
 *
 * The raw captured response is in docs/build-reports/v22r/proof_structure_summary.txt
 */
import { describe, it, expect } from "vitest";
import { validateStructureSummary } from "./researchGrounding";

describe("validateStructureSummary — shape tolerance", () => {
  it("accepts the single aggregate object the prompt asks for", () => {
    const out = validateStructureSummary(
      JSON.stringify({
        sectionFlow: ["cold open", "credential", "mechanism"],
        pacingNotes: "slows for the mechanism",
        firstPayoffPoint: "at the routine",
        reHookPlacement: "mid-video objection",
        ctaPlacement: "after the payoff",
      }),
      ["vid1", "vid2"]
    );
    expect(out).not.toBeNull();
    expect(out!.sectionFlow).toHaveLength(3);
    expect(out!.sourceCount).toBe(2);
  });

  /*
   * THE REAL BUG. This is the exact shape the model returned when handed three
   * transcripts — reproduced from the captured proof. Before the fix this
   * returned null and the job recorded structure_summary=no.
   */
  it("merges an ARRAY of per-video objects instead of discarding it", () => {
    const modelReturnedThisShape = JSON.stringify([
      {
        sectionFlow: ["cold open", "dialogue/argument", "scene change"],
        pacingNotes: "quick cuts then moderate",
        firstPayoffPoint: "N/A (highlight reel)",
        reHookPlacement: "new characters introduced",
        ctaPlacement: "N/A (no CTA in clip)",
      },
      {
        sectionFlow: ["cold open", "credential", "mechanism explanation"],
        pacingNotes: "steady",
        firstPayoffPoint: "at the routine",
        reHookPlacement: "objection handled mid-video",
        ctaPlacement: "closing",
      },
    ]);

    const out = validateStructureSummary(modelReturnedThisShape, ["a", "b", "c"]);
    expect(out).not.toBeNull();
    // Union of both flows, "cold open" deduped rather than listed twice.
    expect(out!.sectionFlow).toEqual([
      "cold open",
      "dialogue/argument",
      "scene change",
      "credential",
      "mechanism explanation",
    ]);
    // Prose fields take the first non-empty value, not three glued paragraphs.
    expect(out!.pacingNotes).toBe("quick cuts then moderate");
    expect(out!.sourceCount).toBe(3);
  });

  it("dedupes case-insensitively across videos", () => {
    const out = validateStructureSummary(
      JSON.stringify([
        { sectionFlow: ["Cold Open", "Credential"], pacingNotes: "x" },
        { sectionFlow: ["cold open", "payoff"], pacingNotes: "y" },
      ]),
      ["a"]
    );
    expect(out!.sectionFlow).toEqual(["Cold Open", "Credential", "payoff"]);
  });

  it("still rejects an empty array", () => {
    expect(validateStructureSummary("[]", ["a"])).toBeNull();
  });

  it("still rejects an array of non-objects", () => {
    expect(validateStructureSummary('["a","b"]', ["a"])).toBeNull();
  });

  /*
   * The all-or-nothing honesty rule survives the array path: a summary carrying
   * neither flow nor pacing guidance is ABSENT, not an empty object that looks
   * like real analysis to every later reader.
   */
  it("rejects an array whose objects carry no usable guidance", () => {
    const out = validateStructureSummary(
      JSON.stringify([{ sectionFlow: [], pacingNotes: "" }, { sectionFlow: [], pacingNotes: "  " }]),
      ["a"]
    );
    expect(out).toBeNull();
  });

  it("still rejects unparseable text", () => {
    expect(validateStructureSummary("I could not analyse these.", ["a"])).toBeNull();
  });

  it("tolerates a fenced array after the caller strips the fence", () => {
    const raw = '```json\n[{"sectionFlow":["cold open"],"pacingNotes":"n"}]\n```';
    const unfenced = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
    expect(validateStructureSummary(unfenced, ["a"])).not.toBeNull();
  });
});
