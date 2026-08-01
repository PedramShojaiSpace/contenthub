/**
 * Weekly Idea Generation Scheduled Handler (Script Factory v2, Phase 1.4)
 *
 * Called by the Manus Heartbeat cron every Monday at 08:00 UTC. Runs the same
 * research-blended `suggestIdeas` pipeline the UI uses, with `count: 8` and
 * `source: 'weekly_auto'`, so a fresh set of grounded ideas is waiting at the
 * start of every week.
 *
 * Endpoint: POST /api/scheduled/weekly-idea-generation
 * Auth: Manus cron identity (user.isCron === true) OR the project owner. This
 * mirrors `bufferSyncHandler` — accepting the owner as well makes the run
 * manually triggerable for testing without weakening the cron-only guarantee.
 *
 * Idempotency: exactly one `weekly_auto` batch per ISO week. If a batch already
 * exists for the current weekLabel the run is skipped, which makes retries and
 * duplicate cron deliveries harmless.
 *
 * Implementation note: this deliberately calls the tRPC procedure through
 * `appRouter.createCaller` rather than duplicating the pipeline. The idea engine
 * is ~300 lines of prompt construction and research blending; a second copy here
 * would drift out of sync with the UI path within one change cycle.
 */

import type { Request, Response } from "express";
import { and, asc, eq, sql } from "drizzle-orm";
import { suggestedIdeas, topicNodes } from "../drizzle/schema";
import { ENV } from "./_core/env";
import { sdk } from "./_core/sdk";
import type { TrpcContext } from "./_core/context";
import { getDb } from "./db";
import { isoWeekLabel } from "./scriptFactoryHelpers";

/** Ideas generated per automatic weekly run (spec §1.4). */
const WEEKLY_IDEA_COUNT = 8;

/**
 * Ideas generated for the rotated topic-tree leaf (spec §5.5).
 *
 * Deliberately smaller than WEEKLY_IDEA_COUNT: node-scoped ideas are narrow by
 * construction, and asking for 8 from one leaf pushes the model into repeating
 * itself. 4 keeps them distinct.
 */
const NODE_ROTATION_IDEA_COUNT = 4;

/**
 * Pick the leaf node that has gone longest without being mined (spec §5.5).
 *
 * "Leaf" is defined as a node with no children rather than by depth, because the
 * operator can expand any branch to an arbitrary depth — a depth test would keep
 * re-mining interior nodes on deep branches and skip shallow ones entirely.
 *
 * Never-mined nodes (`lastMinedAt IS NULL`) sort first so a freshly built map is
 * covered before anything is revisited. Returns `null` when no tree exists yet,
 * which is the normal state until the operator builds one.
 */
async function pickLeastRecentlyMinedLeaf(
  db: NonNullable<Awaited<ReturnType<typeof getDb>>>
): Promise<{ id: number; label: string; path: string } | null> {
  const candidates = await db
    .select({
      id: topicNodes.id,
      label: topicNodes.label,
      path: topicNodes.path,
      lastMinedAt: topicNodes.lastMinedAt,
    })
    .from(topicNodes)
    .where(
      and(
        eq(topicNodes.status, "active"),
        // Leaf test: no other active node claims this one as its parent.
        sql`NOT EXISTS (SELECT 1 FROM ${topicNodes} AS child WHERE child.parent_id = ${topicNodes.id})`
      )
    )
    .orderBy(asc(topicNodes.lastMinedAt), asc(topicNodes.id))
    .limit(1);

  const node = candidates[0];
  return node ? { id: node.id, label: node.label, path: node.path } : null;
}

/**
 * Build a tRPC context representing the cron itself.
 *
 * `suggestIdeas` is a `protectedProcedure`, so it requires `ctx.user`. The cron
 * has no browser session, so we synthesize the owner identity — the same account
 * that owns every row this pipeline writes.
 */
function buildCronContext(req: Request, res: Response): TrpcContext {
  const now = new Date();
  return {
    user: {
      id: ENV.ownerOpenId,
      openId: ENV.ownerOpenId,
      email: null,
      name: "Weekly Idea Generation Cron",
      loginMethod: "manus",
      role: "admin",
      createdAt: now,
      updatedAt: now,
      lastSignedIn: now,
    },
    req,
    res,
  } as unknown as TrpcContext;
}

export async function weeklyIdeaGenerationHandler(req: Request, res: Response) {
  try {
    // Authenticate — cron callers, plus the owner for manual runs.
    let user: Awaited<ReturnType<typeof sdk.authenticateRequest>>;
    try {
      user = await sdk.authenticateRequest(req);
    } catch {
      return res.status(403).json({ error: "Unauthorized" });
    }

    const isCron = (user as { isCron?: boolean }).isCron === true;
    const isOwner = user.openId === (ENV.ownerOpenId || process.env.OWNER_OPEN_ID);
    if (!isCron && !isOwner) {
      return res.status(403).json({ error: "cron-only endpoint" });
    }

    const db = await getDb();
    if (!db) return res.status(500).json({ error: "Database unavailable" });

    const weekLabel = isoWeekLabel();

    // ── Idempotency guard — one automatic batch per ISO week ─────────────────
    const [existing] = await db
      .select({ id: suggestedIdeas.id })
      .from(suggestedIdeas)
      .where(and(eq(suggestedIdeas.weekLabel, weekLabel), eq(suggestedIdeas.source, "weekly_auto")))
      .limit(1);

    if (existing) {
      console.log(
        `[Weekly Idea Generation] Skipped — a weekly_auto batch already exists for ${weekLabel}`
      );
      return res.json({
        ok: true,
        skipped: "already_generated",
        weekLabel,
        message: `Ideas already generated for ${weekLabel}`,
      });
    }

    // ── Run the shared pipeline ─────────────────────────────────────────────
    const { appRouter } = await import("./routers");
    const caller = appRouter.createCaller(buildCronContext(req, res));

    const result = await caller.scriptFactory.suggestIdeas({
      count: WEEKLY_IDEA_COUNT,
      source: "weekly_auto",
      skipResearch: false,
    });

    console.log(
      `[Weekly Idea Generation] ${weekLabel}: persisted ${result.savedIdeas.length} ideas ` +
        `(batch ${result.batchId}, research seeds: ${result.researchSeedCount}` +
        `${result.researchSkipped ? `, research skipped: ${result.reason}` : ""})`
    );

    // ── Topic-tree rotation (spec §5.5) ─────────────────────────────────────
    // Mine the leaf that has waited longest, so the tree is worked through
    // systematically instead of the operator having to remember which branches
    // they have already explored.
    //
    // This runs AFTER the general batch is persisted and is wrapped in its own
    // try/catch: a tree that does not exist yet, or one bad node, must never
    // cost the operator their weekly ideas. Rotation is an enhancement, not a
    // precondition.
    let rotation: {
      nodeId: number;
      label: string;
      path: string;
      inserted: number;
    } | null = null;
    let rotationError: string | null = null;

    try {
      const leaf = await pickLeastRecentlyMinedLeaf(db);
      if (leaf) {
        const nodeResult = await caller.topicTree.generateIdeasForNode({
          nodeId: leaf.id,
          count: NODE_ROTATION_IDEA_COUNT,
          source: "weekly_auto",
        });
        rotation = {
          nodeId: leaf.id,
          label: leaf.label,
          path: leaf.path,
          inserted: nodeResult.inserted,
        };
        console.log(
          `[Weekly Idea Generation] Rotation: mined leaf #${leaf.id} "${leaf.label}" ` +
            `(${leaf.path}) — ${nodeResult.inserted} ideas`
        );
      } else {
        console.log(
          "[Weekly Idea Generation] Rotation skipped — no active topic-tree leaves exist yet"
        );
      }
    } catch (rotErr) {
      rotationError = rotErr instanceof Error ? rotErr.message : String(rotErr);
      console.error(
        "[Weekly Idea Generation] Rotation failed (weekly batch was still saved):",
        rotationError
      );
    }

    // Tell the owner the week's ideas are ready. Notification failure must not
    // fail the run — the ideas are already persisted by this point.
    try {
      const { notifyOwner } = await import("./_core/notification");
      const topicLines = result.savedIdeas
        .slice(0, WEEKLY_IDEA_COUNT)
        .map((idea) => `  - ${idea.topic}`)
        .join("\n");
      await notifyOwner({
        title: `Script Factory — ${result.savedIdeas.length} new ideas for ${weekLabel}`,
        content:
          `# Weekly Ideas — ${weekLabel}\n\n` +
          `${result.savedIdeas.length} ideas generated from ${result.analogDataCount} analog entries ` +
          `and ${result.researchSeedCount} research seeds.\n\n${topicLines}\n\n` +
          (rotation
            ? `**Topic rotation:** mined “${rotation.label}” (${rotation.path}) — ` +
              `${rotation.inserted} additional branch ideas.\n\n`
            : "") +
          (result.researchSkipped ? `_Research skipped: ${result.reason}_\n` : ""),
      });
    } catch (notifyErr) {
      console.error(
        "[Weekly Idea Generation] Notification failed (ideas were still saved):",
        notifyErr instanceof Error ? notifyErr.message : String(notifyErr)
      );
    }

    return res.json({
      ok: true,
      skipped: false,
      weekLabel,
      batchId: result.batchId,
      ideaCount: result.savedIdeas.length,
      analogDataCount: result.analogDataCount,
      researchSeedCount: result.researchSeedCount,
      researchSkipped: result.researchSkipped,
      reason: result.reason,
      rotation,
      rotationError,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[Weekly Idea Generation Cron] Error:", msg);
    return res.status(500).json({ error: msg, timestamp: new Date().toISOString() });
  }
}
