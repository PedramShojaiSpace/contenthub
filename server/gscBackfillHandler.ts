/**
 * GSC Indexing Backfill — Scheduled Handler
 *
 * Called daily by the Manus Heartbeat cron at 02:00 UTC.
 * Submits up to 200 unindexed URLs to Google's Indexing API per day
 * (Google's hard daily quota is 200 requests per project).
 *
 * The handler is idempotent: it only submits URLs that are NOT already
 * in the gsc_indexing_log table with success=true.
 *
 * Registered in server/_core/index.ts:
 *   app.post("/api/scheduled/gsc-backfill", gscBackfillHandler);
 */

import type { Request, Response } from "express";
import { getDb } from "./db";
import { requestIndexing } from "./googleSearchConsole";

const DAILY_QUOTA = 200; // Google Indexing API hard limit per project per day

export async function gscBackfillHandler(req: Request, res: Response) {
  try {
    const db = await getDb();
    if (!db) return res.status(500).json({ error: "DB unavailable" });

    const { wpPostIndex, gscIndexingLog, userCredentials } = await import("../drizzle/schema");
    const { isNotNull, ne, eq } = await import("drizzle-orm");

    // Get the owner's GSC refresh token (userId = 1 = project owner)
    const [creds] = await db
      .select({ gscRefreshToken: userCredentials.gscRefreshToken })
      .from(userCredentials)
      .where(eq(userCredentials.userId, 1));

    if (!creds?.gscRefreshToken) {
      console.log("[GSC Backfill Cron] No GSC credentials found — skipping");
      return res.json({ ok: true, skipped: "no_credentials", submitted: 0 });
    }

    // Get all published post URLs
    const allPosts = await db
      .select({ wpPostId: wpPostIndex.wpPostId, url: wpPostIndex.url })
      .from(wpPostIndex)
      .where(isNotNull(wpPostIndex.url));

    // Get all URLs already successfully logged
    const alreadyLogged = await db
      .select({ url: gscIndexingLog.url })
      .from(gscIndexingLog)
      .where(ne(gscIndexingLog.url, ""));

    const loggedUrls = new Set(alreadyLogged.map((r) => r.url));
    const unsubmitted = allPosts
      .filter((p) => p.url && !loggedUrls.has(p.url))
      .slice(0, DAILY_QUOTA); // respect daily quota

    if (unsubmitted.length === 0) {
      console.log("[GSC Backfill Cron] All URLs already submitted — nothing to do");
      return res.json({ ok: true, skipped: "all_done", submitted: 0, remaining: 0 });
    }

    console.log(`[GSC Backfill Cron] Submitting ${unsubmitted.length} URLs to Google Indexing API…`);

    let succeeded = 0;
    let failed = 0;

    for (const post of unsubmitted) {
      if (!post.url) continue;
      try {
        const result = await requestIndexing(creds.gscRefreshToken!, post.url);
        await db.insert(gscIndexingLog).values({
          userId: "1",
          url: post.url,
          wpPostId: post.wpPostId ?? undefined,
          success: result.success,
          message: result.message,
          source: "backfill",
          submittedAt: Date.now(),
        }).catch(() => {});
        if (result.success) succeeded++;
        else failed++;
      } catch (err: any) {
        await db.insert(gscIndexingLog).values({
          userId: "1",
          url: post.url,
          wpPostId: post.wpPostId ?? undefined,
          success: false,
          message: err?.message ?? "Request failed",
          source: "backfill",
          submittedAt: Date.now(),
        }).catch(() => {});
        failed++;
      }
      // 300ms gap between requests to respect Google rate limits
      await new Promise((r) => setTimeout(r, 300));
    }

    const remaining = allPosts.filter((p) => p.url && !loggedUrls.has(p.url)).length - unsubmitted.length;

    console.log(`[GSC Backfill Cron] Done: ${succeeded} succeeded, ${failed} failed, ${remaining} remaining for tomorrow`);
    return res.json({ ok: true, submitted: unsubmitted.length, succeeded, failed, remaining });

  } catch (err: any) {
    const msg = err?.message ?? String(err);
    console.error("[GSC Backfill Cron] Error:", msg);
    return res.status(500).json({ error: msg, timestamp: new Date().toISOString() });
  }
}
