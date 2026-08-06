/**
 * v2.3 Part 3 — regeneration planning tests.
 *
 * These target `planRegeneration`, which is where every regeneration decision
 * actually lives; the two mutations that call it differ only in the lineage they
 * attach. Testing the planner directly means these assertions do not depend on a
 * mocked LLM, and they fail on the specific promises that are easy to break:
 *
 *   - research is REUSED, never re-run (a "different length" click must not spend
 *     research credits or move the grounding under a comparison);
 *   - a pre-v2.3 script is REFUSED rather than partially replayed;
 *   - `sourceIdeaId` is dropped, so a variant cannot steal the idea link;
 *   - the auto-label is derived from the same diff the confirm dialog shows.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("./db", () => ({ getDb: vi.fn() }));

import { getDb } from "./db";

/** Frozen params as written by the generate pipeline. */
function frozen(over: Record<string, unknown> = {}) {
  return {
    topic: "Why dinner bloat wakes you at 2 AM",
    format: "youtube_script",
    personaId: 7,
    analogDataEntryIds: [3],
    targetLengthMinutes: 20,
    storyMode: "brief",
    offerTier: "Diagnostic Intake",
    ctaOverride: null,
    researchJobId: 42,
    seedKeyword: "dinner bloat sleep",
    useCorpusSearch: true,
    model: "gpt-5.5",
    ...over,
  };
}

function sourceRow(over: Record<string, unknown> = {}) {
  return {
    id: 3,
    title: "2 AM Wake-Ups & Dinner Bloat",
    parentScriptId: null,
    variantOfRootId: null,
    sourceIdeaId: 99,
    generationParams: frozen(),
    ...over,
  };
}

/**
 * db mock. The db root is not thenable (getDb is awaited); the builder is.
 */
function makeDb(results: unknown[]) {
  const queue = [...results];
  const builder: Record<string, unknown> = {};
  for (const m of ["from", "where", "orderBy", "limit", "offset"]) builder[m] = vi.fn(() => builder);
  builder.then = (res: (v: unknown) => unknown) =>
    Promise.resolve(queue.length ? queue.shift() : []).then(res);
  return { select: vi.fn(() => builder) };
}

async function plan(results: unknown[], overrides: Record<string, unknown> = {}) {
  (getDb as ReturnType<typeof vi.fn>).mockResolvedValue(makeDb(results));
  const { planRegeneration } = await import("./scriptFactoryRouter");
  return planRegeneration(3, overrides as any);
}

describe("planRegeneration — research reuse", () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => vi.restoreAllMocks());

  it("reuses the source's research job and suppresses auto-research both ways", async () => {
    const p = await plan([[sourceRow()]], { targetLengthMinutes: 10 });
    expect(p.input.researchJobId).toBe(42);
    expect(p.researchReused).toBe(42);
    /*
     * BOTH of these independently prevent executeDeepResearch from running
     * (`wantsAutoResearch` requires !skipResearch && !researchJobId). Asserting
     * both means a future change to either flag's meaning still trips a test
     * rather than silently re-running paid research on every variant.
     */
    expect(p.input.skipResearch).toBe(true);
    expect(p.input.useDeepResearch).toBe(false);
  });

  it("carries the seed keyword so a replay resolves by the same key", async () => {
    const p = await plan([[sourceRow()]], {});
    expect(p.input.seedKeyword).toBe("dinner bloat sleep");
  });
});

describe("planRegeneration — refuses to guess", () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => vi.restoreAllMocks());

  it("refuses a pre-v2.3 script instead of partially replaying it", async () => {
    /*
     * The failure mode being prevented: persona and length would survive from the
     * row's own columns while storyMode, offerTier and ctaOverride reverted to
     * defaults — a "different length" variant that also dropped the custom close.
     */
    await expect(plan([[sourceRow({ generationParams: null })]], {})).rejects.toThrow(
      /never recorded/
    );
  });

  it("throws NOT_FOUND for a missing source", async () => {
    await expect(plan([[]], {})).rejects.toThrow(/was not found/);
  });
});

describe("planRegeneration — parameter handling", () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => vi.restoreAllMocks());

  it("applies the override and leaves every other param identical", async () => {
    const p = await plan([[sourceRow()]], { targetLengthMinutes: 10 });
    expect(p.input.targetLengthMinutes).toBe(10);
    // Everything else comes through unchanged — this is the spec's "provably
    // injects the change and keeps everything else identical".
    expect(p.input.topic).toBe("Why dinner bloat wakes you at 2 AM");
    expect(p.input.personaId).toBe(7);
    expect(p.input.storyMode).toBe("brief");
    expect(p.input.offerTier).toBe("Diagnostic Intake");
    expect(p.input.analogDataEntryIds).toEqual([3]);
    expect(p.changed).toEqual([{ field: "targetLengthMinutes", from: "20", to: "10" }]);
  });

  it("drops sourceIdeaId so a variant cannot steal the idea link", async () => {
    /*
     * Carrying it would re-stamp the suggested idea as `generated` and repoint it
     * at the variant, losing the original it actually produced.
     */
    const p = await plan([[sourceRow()]], {});
    expect(p.input.sourceIdeaId).toBeUndefined();
  });

  it("clears target length when the format is not long-form video", async () => {
    const p = await plan([[sourceRow()]], { format: "email" });
    expect(p.input.targetLengthMinutes).toBeUndefined();
    // And the diff says so, rather than promising a 20-minute email.
    expect(p.changed).toContainEqual({ field: "targetLengthMinutes", from: "20", to: null });
  });
});

describe("planRegeneration — auto-label", () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => vi.restoreAllMocks());

  it("names a pure length change", async () => {
    const p = await plan([[sourceRow()]], { targetLengthMinutes: 15 });
    expect(p.autoLabel).toBe("15-min cut");
  });

  it("resolves the persona NAME for a pure persona change", async () => {
    // 2nd queued result is the persona lookup the label path performs.
    const p = await plan([[sourceRow()], [{ name: "The Skeptic" }]], { personaId: 12 });
    expect(p.autoLabel).toBe("Persona: The Skeptic");
  });

  it("lists fields when several changed", async () => {
    const p = await plan([[sourceRow()]], { targetLengthMinutes: 10, storyMode: "none" });
    expect(p.autoLabel).toMatch(/^Changed: /);
    expect(p.autoLabel).toContain("targetLengthMinutes");
    expect(p.autoLabel).toContain("storyMode");
  });

  it("says so plainly when nothing changed, rather than implying a change", async () => {
    /*
     * Zero overrides is a legitimate request — the model is non-deterministic, so
     * "run it again with the same settings" is real. The label must not claim a
     * difference that does not exist.
     */
    const p = await plan([[sourceRow()]], {});
    expect(p.changed).toEqual([]);
    expect(p.autoLabel).toBe("Re-run, same settings");
  });
});
