/**
 * v2.3 Part 2 — variant lineage tests.
 *
 * What these are actually defending
 * ---------------------------------
 * The lineage model makes one non-obvious choice: an ORIGINAL stores NULL in
 * `variant_of_root_id` rather than its own id, so the family key is
 * `COALESCE(variant_of_root_id, id)`. Every bug this model can produce is a
 * missing coalesce, and each one is silent:
 *
 *   - `getScriptFamily(variantId)` that forgets it returns the variant's
 *     children instead of its siblings.
 *   - `getScriptFamily(rootId)` that queries `variant_of_root_id = rootId`
 *     without adding the root back returns a family MISSING ITS ORIGINAL — and
 *     a comparison view would then compare two variants while claiming one of
 *     them is the source.
 *
 * So the tests below assert the resolved family MEMBERSHIP from both entry
 * points, not merely that a query ran.
 *
 * The db is mocked per the existing harness in llmProjects.test.ts. These are
 * shape-and-logic tests; the live-data verification is recorded separately in
 * the build log.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("./db", () => ({
  getDb: vi.fn(),
}));

import { getDb } from "./db";

const CTX = { user: { id: "test", name: "Test" } } as any;

/**
 * A queue-driven db mock.
 *
 * The procedures under test issue several sequential queries whose terminal
 * method differs (`.limit()` for single rows, `.orderBy()` for lists). Rather
 * than guess which one resolves, every terminal returns the next queued result,
 * so a test declares results in the order the procedure asks for them.
 *
 * The chain is also THENABLE, which is the part that matters: drizzle builders
 * are lazy promises, and `list` ends `.orderBy().limit().offset()` while
 * `getScriptFamily` ends `.where().orderBy()`. A mock whose `.orderBy()`
 * resolved to a plain array would break the first chain (arrays have no
 * `.limit`), and one that only resolved at `.offset()` would hang the second.
 * Making every builder method return the chain and letting `await` trigger the
 * queue shift handles both without the test having to know the call order.
 *
 * The thenable lives on a SEPARATE object from the db root, because `getDb()` is
 * itself awaited: a thenable db root would be unwrapped by that await and the
 * router would receive the first queued query result instead of a db handle.
 */
function makeQueueDb(results: unknown[]) {
  const queue = [...results];
  const next = () => (queue.length > 0 ? queue.shift() : []);
  /** Number of distinct queries awaited — asserted by the "no descendant query" test. */
  const state = { awaited: 0 };
  const builder: Record<string, unknown> = {};
  for (const m of ["from", "where", "orderBy", "limit", "offset", "groupBy"]) {
    builder[m] = vi.fn(() => builder);
  }
  builder.then = (resolve: (v: unknown) => unknown) => {
    state.awaited += 1;
    return Promise.resolve(next()).then(resolve);
  };
  // The db root is NOT thenable — only the query builder it hands out is.
  return { select: vi.fn(() => builder), __state: state };
}

function row(over: Record<string, unknown> = {}) {
  return {
    id: 1,
    title: "Original script",
    topic: "gut health",
    format: "youtube_script",
    verifiedCount: 12,
    totalElements: 14,
    verificationPct: null,
    status: "draft",
    createdAt: new Date("2026-08-01T00:00:00Z"),
    productionScriptId: null,
    wordCount: 3581,
    targetLengthMinutes: 20,
    personaId: null,
    researchJobId: null,
    parentScriptId: null,
    variantLabel: null,
    variantOfRootId: null,
    ...over,
  };
}

describe("scriptFactory.list — variant grouping", () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => vi.restoreAllMocks());

  it("returns ONE top-level row with a variants array, not two rows", async () => {
    /*
     * This is the spec's acceptance criterion stated as a test: after creating a
     * variant, the Library shows one row carrying a count.
     */
    const original = row({ id: 10 });
    const variant = {
      id: 11,
      title: "Original script",
      variantLabel: "20-min cut",
      wordCount: 2940,
      targetLengthMinutes: 20,
      personaId: null,
      status: "draft",
      createdAt: new Date("2026-08-02T00:00:00Z"),
      variantOfRootId: 10,
    };
    // 1st query: the page of originals. 2nd: descendants. No personas needed.
    const db = makeQueueDb([[original], [variant]]);
    (getDb as ReturnType<typeof vi.fn>).mockResolvedValue(db);

    const { scriptFactoryRouter } = await import("./scriptFactoryRouter");
    const res: any = await scriptFactoryRouter.createCaller(CTX).list({});

    expect(res).toHaveLength(1);
    expect(res[0].id).toBe(10);
    expect(res[0].variants).toHaveLength(1);
    expect(res[0].variants[0]).toMatchObject({ id: 11, label: "20-min cut", wordCount: 2940 });
  });

  it("defaults groupVariants to true, so the collapsed Library is not opt-in", async () => {
    const db = makeQueueDb([[row({ id: 10 })], []]);
    (getDb as ReturnType<typeof vi.fn>).mockResolvedValue(db);
    const { scriptFactoryRouter } = await import("./scriptFactoryRouter");
    const res: any = await scriptFactoryRouter.createCaller(CTX).list({});
    // A second query (descendants) only happens in grouped mode.
    expect(res[0].variants).toEqual([]);
    expect((db.__state as { awaited: number }).awaited).toBe(2);
  });

  it("flat mode still returns a variants key, so the shape never shifts", async () => {
    /*
     * A field that exists in one mode and vanishes in the other forces every
     * consumer to guard, and that guard is what gets forgotten.
     */
    const db = makeQueueDb([[row({ id: 11, parentScriptId: 10, variantOfRootId: 10 })]]);
    (getDb as ReturnType<typeof vi.fn>).mockResolvedValue(db);
    const { scriptFactoryRouter } = await import("./scriptFactoryRouter");
    const res: any = await scriptFactoryRouter.createCaller(CTX).list({ groupVariants: false });
    expect(res[0]).toHaveProperty("variants");
    expect(res[0].variants).toEqual([]);
    // And a variant IS allowed to be top-level when grouping is off.
    expect(res[0].parentScriptId).toBe(10);
  });

  it("labels a variant by its title when the operator cleared the label", async () => {
    const db = makeQueueDb([
      [row({ id: 10 })],
      [{
        id: 11, title: "Fallback title", variantLabel: null, wordCount: 100,
        targetLengthMinutes: null, personaId: null, status: "draft",
        createdAt: new Date(), variantOfRootId: 10,
      }],
    ]);
    (getDb as ReturnType<typeof vi.fn>).mockResolvedValue(db);
    const { scriptFactoryRouter } = await import("./scriptFactoryRouter");
    const res: any = await scriptFactoryRouter.createCaller(CTX).list({});
    expect(res[0].variants[0].label).toBe("Fallback title");
  });

  it("does not query descendants when the page is empty", async () => {
    const db = makeQueueDb([[]]);
    (getDb as ReturnType<typeof vi.fn>).mockResolvedValue(db);
    const { scriptFactoryRouter } = await import("./scriptFactoryRouter");
    const res: any = await scriptFactoryRouter.createCaller(CTX).list({});
    expect(res).toEqual([]);
    // inArray(col, []) is invalid SQL in several drizzle versions — the early
    // return exists to avoid emitting it.
    expect((db.__state as { awaited: number }).awaited).toBe(1);
  });
});

describe("scriptFactory.getScriptFamily", () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => vi.restoreAllMocks());

  it("includes the ROOT ITSELF when called with the root id", async () => {
    /*
     * The coalesce bug, caught from the root entry point. `variant_of_root_id`
     * is NULL on the original, so a family assembled only from that predicate
     * omits the original — and every comparison against "the source" would then
     * be against a sibling variant.
     */
    const root = row({ id: 10, variantOfRootId: null, parentScriptId: null });
    const child = row({ id: 11, parentScriptId: 10, variantOfRootId: 10, variantLabel: "20-min cut" });
    // seed lookup, root lookup, descendants
    const db = makeQueueDb([[root], [root], [child]]);
    (getDb as ReturnType<typeof vi.fn>).mockResolvedValue(db);

    const { scriptFactoryRouter } = await import("./scriptFactoryRouter");
    const fam: any = await scriptFactoryRouter.createCaller(CTX).getScriptFamily({ scriptId: 10 });

    expect(fam.rootId).toBe(10);
    expect(fam.members.map((m: any) => m.id)).toEqual([10, 11]);
  });

  it("resolves the SAME family when called with a variant id", async () => {
    /*
     * Entry-point independence. The workspace knows the id it has open, not
     * whether that id is an original, so asking from a variant must return the
     * variant's SIBLINGS and parent — not its own children.
     */
    const variant = row({ id: 11, parentScriptId: 10, variantOfRootId: 10 });
    const root = row({ id: 10 });
    const sibling = row({ id: 12, parentScriptId: 10, variantOfRootId: 10 });
    const db = makeQueueDb([[variant], [root], [sibling, variant]]);
    (getDb as ReturnType<typeof vi.fn>).mockResolvedValue(db);

    const { scriptFactoryRouter } = await import("./scriptFactoryRouter");
    const fam: any = await scriptFactoryRouter.createCaller(CTX).getScriptFamily({ scriptId: 11 });

    expect(fam.rootId).toBe(10);
    expect(fam.members.map((m: any) => m.id).sort()).toEqual([10, 11, 12]);
  });

  it("reports a missing root as rootMissing rather than as no family", async () => {
    /*
     * These columns carry no FK (append-only migration on a live table) and
     * delete does not cascade, so an orphaned descendant is reachable. Returning
     * null here would render as "no variants exist", which is a lie about data
     * that is still on disk.
     */
    const orphan = row({ id: 11, parentScriptId: 10, variantOfRootId: 10 });
    const db = makeQueueDb([[orphan], [], [orphan]]);
    (getDb as ReturnType<typeof vi.fn>).mockResolvedValue(db);

    const { scriptFactoryRouter } = await import("./scriptFactoryRouter");
    const fam: any = await scriptFactoryRouter.createCaller(CTX).getScriptFamily({ scriptId: 11 });

    expect(fam.rootMissing).toBe(true);
    expect(fam.members.map((m: any) => m.id)).toEqual([11]);
  });

  it("returns null for an id that does not exist at all", async () => {
    const db = makeQueueDb([[]]);
    (getDb as ReturnType<typeof vi.fn>).mockResolvedValue(db);
    const { scriptFactoryRouter } = await import("./scriptFactoryRouter");
    const fam = await scriptFactoryRouter.createCaller(CTX).getScriptFamily({ scriptId: 999 });
    expect(fam).toBeNull();
  });
});
