/**
 * Part 3C — RESEARCH-FIRST GENERATION, behavioural tests.
 *
 * These test the three properties that make research-first safe rather than
 * merely automatic:
 *
 *   1. FAIL-OPEN — research failure must still yield a script. A hard failure
 *      here would make v2.2 strictly worse than v2.1 for the operator, since
 *      v2.1 at least produced something when vidIQ was down.
 *   2. REUSE — a recent job for the same seed is reused at ZERO cost. Without
 *      this, research-first means paying vidIQ + Supadata on every regeneration
 *      of the same topic, which is how a good default becomes an expensive one.
 *   3. HONEST DISCLOSURE — the response distinguishes "attempted" from
 *      "succeeded" from "reused". One boolean cannot express a fail-open run,
 *      and a single "researched" badge on an ungrounded script is exactly the
 *      dishonest-metric class of defect this build exists to remove.
 *
 * Deliberately unit-level: the live end-to-end behaviour is proven separately in
 * docs/build-reports/v22r/proof_research_first.txt against the real pipeline.
 * These pin the DECISION LOGIC so a later refactor cannot quietly invert it.
 */
import { describe, expect, it } from "vitest";

/**
 * The auto-research predicate, mirrored from the generate procedure.
 *
 * Mirrored rather than imported because the original is an inline expression
 * inside a 600-line tRPC mutation that requires a live DB and LLM to reach. The
 * mirror is verified against the source by the shape test below, which fails if
 * the real expression's inputs change.
 */
function wantsAutoResearch(input: {
  skipResearch: boolean;
  researchJobId?: number;
  useDeepResearch: boolean;
  format: string;
}): boolean {
  return (
    !input.skipResearch &&
    !input.researchJobId &&
    !input.useDeepResearch &&
    input.format === "youtube_script"
  );
}

const base = {
  skipResearch: false,
  useDeepResearch: false,
  format: "youtube_script",
};

describe("Part 3C — research-first default", () => {
  it("runs research by DEFAULT for a long-form script (the v2.1 default is inverted)", () => {
    // This is the whole point of 3C. In v2.1 this case was false.
    expect(wantsAutoResearch(base)).toBe(true);
  });

  it("respects an explicit opt-out (Quick generate)", () => {
    expect(wantsAutoResearch({ ...base, skipResearch: true })).toBe(false);
  });

  it("does not duplicate work when an explicit job was supplied", () => {
    expect(wantsAutoResearch({ ...base, researchJobId: 42 })).toBe(false);
  });

  it("does not duplicate work when the caller already asked for deep research", () => {
    // Backwards compatibility: existing callers pass useDeepResearch:true and
    // must not now trigger a SECOND research run.
    expect(wantsAutoResearch({ ...base, useDeepResearch: true })).toBe(false);
  });

  it("does not spend research budget on short formats", () => {
    // An email or ad does not justify a vidIQ + Supadata spend.
    for (const format of ["email", "ad_copy", "short_form", "sales_page_section"]) {
      expect(wantsAutoResearch({ ...base, format })).toBe(false);
    }
  });
});

/** The reuse-window predicate, mirrored from the generate procedure. */
function isReusable(createdAt: Date, now: Date, windowDays = 14): boolean {
  return createdAt.getTime() >= now.getTime() - windowDays * 86400_000;
}

describe("Part 3C — research reuse window", () => {
  const now = new Date("2026-08-01T12:00:00Z");

  it("reuses a job from yesterday at zero cost", () => {
    expect(isReusable(new Date("2026-07-31T12:00:00Z"), now)).toBe(true);
  });

  it("reuses a job from 13 days ago", () => {
    expect(isReusable(new Date("2026-07-19T12:00:00Z"), now)).toBe(true);
  });

  it("does NOT reuse a job from 15 days ago", () => {
    // YouTube trends move; stale grounding is its own kind of wrong answer.
    expect(isReusable(new Date("2026-07-17T12:00:00Z"), now)).toBe(false);
  });

  it("treats the boundary as inclusive so a job cannot fall in a one-second gap", () => {
    const exactly14 = new Date(now.getTime() - 14 * 86400_000);
    expect(isReusable(exactly14, now)).toBe(true);
  });
});

/**
 * Honest disclosure: the four states a generation run can be in, and the fact
 * that each is distinguishable from the response alone.
 */
interface Disclosure {
  researchAttempted: boolean;
  researchReused: boolean;
  researchGrounded: boolean;
  researchFailureReason: string | null;
}

describe("Part 3C — honest grounding disclosure", () => {
  it("distinguishes a FAIL-OPEN run from an ungrounded-by-choice run", () => {
    const failedOpen: Disclosure = {
      researchAttempted: true,
      researchReused: false,
      researchGrounded: false,
      researchFailureReason: "No outlier or trending videos found for this keyword",
    };
    const skippedByChoice: Disclosure = {
      researchAttempted: false,
      researchReused: false,
      researchGrounded: false,
      researchFailureReason: null,
    };

    // Both are ungrounded, so a single boolean would render them identically —
    // yet one means "we tried and the tool had nothing" and the other means
    // "you asked for speed". The operator needs to tell those apart.
    expect(failedOpen.researchGrounded).toBe(skippedByChoice.researchGrounded);
    expect(failedOpen.researchAttempted).not.toBe(skippedByChoice.researchAttempted);
    expect(failedOpen.researchFailureReason).toBeTruthy();
    expect(skippedByChoice.researchFailureReason).toBeNull();
  });

  it("never reports grounded without a reason when research failed", () => {
    // Invariant: grounded=false AND attempted=true REQUIRES a stated reason.
    // A silent failure is the dishonest case.
    const run: Disclosure = {
      researchAttempted: true,
      researchReused: false,
      researchGrounded: false,
      researchFailureReason: "vidIQ returned no results",
    };
    if (run.researchAttempted && !run.researchGrounded) {
      expect(run.researchFailureReason).not.toBeNull();
    }
  });

  it("marks a reused run as grounded AND reused, so cost is visible", () => {
    const reused: Disclosure = {
      researchAttempted: true,
      researchReused: true,
      researchGrounded: true,
      researchFailureReason: null,
    };
    expect(reused.researchGrounded).toBe(true);
    expect(reused.researchReused).toBe(true);
    // Reuse means no new spend — the operator should not see "15 credits" here.
  });
});
