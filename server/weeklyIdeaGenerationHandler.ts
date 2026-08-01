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
import { and, eq } from "drizzle-orm";
import { suggestedIdeas } from "../drizzle/schema";
import { ENV } from "./_core/env";
import { sdk } from "./_core/sdk";
import type { TrpcContext } from "./_core/context";
import { getDb } from "./db";
import { isoWeekLabel } from "./scriptFactoryHelpers";

/** Ideas generated per automatic weekly run (spec §1.4). */
const WEEKLY_IDEA_COUNT = 8;

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
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[Weekly Idea Generation Cron] Error:", msg);
    return res.status(500).json({ error: msg, timestamp: new Date().toISOString() });
  }
}
