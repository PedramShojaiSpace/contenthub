/**
 * v2.3 Part 3 — section splice geometry.
 *
 * `regenerateSection` locates a section by the outline's own offsets and replaces
 * exactly that slice. These tests pin the geometry, because the failure mode is
 * not a crash — it is quietly rewriting a DIFFERENT section, or corrupting the
 * sections either side of the right one, and both look like a model quality
 * problem rather than a bug.
 *
 * Splicing is exercised through `buildSectionOutline` (the same function the
 * mutation calls) rather than through the mutation itself, so no LLM is needed and
 * the assertions are about geometry only.
 */
import { describe, it, expect } from "vitest";
import { buildSectionOutline } from "./scriptFactoryRouter";

const BODY = [
  "[HOOK] (0:00) You wake at 2 AM and blame stress.",
  "",
  "[PAIN] (0:12) The pattern repeats for months.",
  "",
  "[TEACH] (0:30) First mechanism: cortisol timing. [VERIFIED]",
  "",
  "[TEACH] (1:00) Second mechanism: blood sugar.",
  "",
  "[TEACH] (1:30) Third mechanism: gut motility.",
  "",
  "[CTA] (2:00) Book a diagnostic intake.",
].join("\n");

/** The exact slice arithmetic the mutation performs. */
function sliceOf(body: string, sectionKey: string) {
  const outline = buildSectionOutline(body);
  const t = outline.find((s) => s.sectionKey === sectionKey);
  if (!t) throw new Error(`no such section: ${sectionKey}`);
  const i = outline.indexOf(t);
  const start = t.charStart;
  const end = i + 1 < outline.length ? outline[i + 1].charStart : body.length;
  return { start, end, text: body.slice(start, end), before: body.slice(0, start), after: body.slice(end) };
}

describe("section splice — addressing", () => {
  it("resolves a recurring tag to the right instance, not the first", () => {
    /*
     * THE bug this file exists for. Three TEACH blocks; "teach-2" must land on the
     * second. A naive indexOf("[TEACH]") would rewrite the first one every time,
     * and the operator would report "regenerate doesn't work" on a script where it
     * silently worked on the wrong paragraph.
     */
    expect(sliceOf(BODY, "teach-2").text).toContain("Second mechanism");
    expect(sliceOf(BODY, "teach-1").text).toContain("First mechanism");
    expect(sliceOf(BODY, "teach-3").text).toContain("Third mechanism");
  });

  it("uses bare slugs for tags that occur once", () => {
    const keys = buildSectionOutline(BODY).map((s) => s.sectionKey);
    expect(keys).toEqual(["hook", "pain", "teach-1", "teach-2", "teach-3", "cta"]);
  });
});

describe("section splice — preservation", () => {
  it("leaves everything outside the slice byte-for-byte identical", () => {
    const { before, after, text } = sliceOf(BODY, "teach-2");
    // The reassembled original must be the original, exactly.
    expect(before + text + after).toBe(BODY);
    // And the neighbours must be untouched by the slice boundaries.
    expect(before).toContain("First mechanism");
    expect(before).not.toContain("Second mechanism");
    expect(after).toContain("Third mechanism");
    expect(after).not.toContain("Second mechanism");
  });

  it("a replacement changes only the target section", () => {
    const { before, after } = sliceOf(BODY, "teach-2");
    const spliced = `${before}[TEACH] Rewritten second mechanism.\n\n${after}`;
    expect(spliced).toContain("First mechanism");
    expect(spliced).toContain("Third mechanism");
    expect(spliced).toContain("Rewritten second mechanism");
    expect(spliced).not.toContain("Second mechanism: blood sugar");
    // Structure preserved: still six sections, still in order.
    expect(buildSectionOutline(spliced).map((s) => s.sectionKey)).toEqual([
      "hook", "pain", "teach-1", "teach-2", "teach-3", "cta",
    ]);
  });

  it("handles the LAST section, where the slice runs to end of body", () => {
    const { after, text } = sliceOf(BODY, "cta");
    expect(after).toBe("");
    expect(text).toContain("Book a diagnostic intake");
  });

  it("handles the FIRST section, where there is nothing before it", () => {
    const { before, text } = sliceOf(BODY, "hook");
    expect(before).toBe("");
    expect(text).toContain("blame stress");
  });
});

describe("section splice — undo is a verbatim restore", () => {
  it("restoring the stored slice reproduces the original body exactly", () => {
    /*
     * Why previousText is stored verbatim INCLUDING its tag and stamp: an undo is
     * then a splice, not a reconstruction. Reconstructing would risk reformatting
     * whitespace elsewhere in the script, which an operator would see as the undo
     * having "changed something else too".
     */
    const { before, after, text: original } = sliceOf(BODY, "pain");
    const edited = `${before}[PAIN] A different pain paragraph.\n\n${after}`;

    // Undo path: find the section again in the EDITED body, splice the stored text.
    const e = sliceOf(edited, "pain");
    const restored = e.before + original + e.after;
    expect(restored).toBe(BODY);
  });
});
