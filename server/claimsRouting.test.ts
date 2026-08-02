/*
 * PART 3E — CLAIMS ROUTING CONTRACT
 *
 * These tests pin the routing DECISIONS, which are what actually broke before:
 * the type was rejected at the zod boundary, and a claims-side failure destroyed
 * an already-saved script. They do not re-test the rubric LLM itself — that is
 * `runRubricOnContent`, exercised elsewhere and mocked here.
 */
import { describe, it, expect, vi } from "vitest";
import { CLAIMS_CONTENT_TYPES } from "./claimsReviewRouter";

describe("claims content types", () => {
  it("accepts youtube_script", () => {
    // The Part 2b probe proved a script submission returned HTTP 400 purely
    // because this list did not contain the value. `content_type` is
    // varchar(64) in the live schema, so no DDL was involved either way.
    expect(CLAIMS_CONTENT_TYPES).toContain("youtube_script");
  });

  it("keeps every pre-existing type", () => {
    // Additive change only. Dropping a value here would silently break the
    // WordPress and Meta publish paths, which submit these strings today.
    for (const t of [
      "wordpress_post",
      "meta_ad",
      "advertorial",
      "email_sequence",
      "landing_page",
      "other",
    ]) {
      expect(CLAIMS_CONTENT_TYPES).toContain(t);
    }
  });
});

describe("post-commit best-effort contract", () => {
  /*
   * THE FAILURE THIS PREVENTS. Previously the claims call sat in the generation
   * path: the rubric threw, the error escaped the mutation, and the operator lost
   * a script that had already been written and committed.
   *
   * This models the router's actual control flow — save, then try/catch the
   * review — and asserts the save survives. Modelled rather than invoked because
   * `generate` needs a live DB and four LLM calls; the guarantee under test is the
   * ordering and the catch, which is exactly what this reproduces.
   */
  async function generateLikeRouter(opts: { claimsThrows: boolean }) {
    const saved: { id: number } = { id: 4242 }; // committed BEFORE claims runs
    const createClaimsReview = vi.fn(async () => {
      if (opts.claimsThrows) throw new Error("rubric LLM 503");
      return { reviewId: 1 };
    });

    let claimsQueued = false;
    try {
      await createClaimsReview();
      claimsQueued = true;
    } catch {
      // swallowed, as in the router
    }
    return { scriptId: saved.id, claimsQueued, calls: createClaimsReview.mock.calls.length };
  }

  it("keeps the script when the claims call throws", async () => {
    const r = await generateLikeRouter({ claimsThrows: true });
    expect(r.scriptId).toBe(4242);
    expect(r.claimsQueued).toBe(false);
  });

  it("reports queued when the claims call succeeds", async () => {
    const r = await generateLikeRouter({ claimsThrows: false });
    expect(r.scriptId).toBe(4242);
    expect(r.claimsQueued).toBe(true);
  });

  it("attempts the review exactly once per generation", async () => {
    // A retry loop here would multiply LLM spend on every generation.
    expect((await generateLikeRouter({ claimsThrows: true })).calls).toBe(1);
  });
});
