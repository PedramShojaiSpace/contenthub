/**
 * Buffer → Kanban Status Sync Handler
 *
 * Called by a Manus Heartbeat cron every 30 minutes.
 * Scans all content_items with status = 'scheduled' and scheduledAt <= now().
 * For each one, flips status to 'published' and sets publishedAt = now().
 *
 * This closes the gap where items pushed to Buffer move to 'scheduled' but
 * never advance to 'published' after Buffer actually sends the post.
 *
 * Endpoint: POST /api/scheduled/buffer-sync
 * Auth: Manus cron identity (isCron = true via sdk.authenticateRequest)
 */

import type { Request, Response } from "express";
import { sdk } from "./_core/sdk";
import { getDb } from "./db";
import { contentItems } from "../drizzle/schema";
import { and, eq, lte, isNotNull } from "drizzle-orm";

export async function handleBufferSync(req: Request, res: Response) {
  // Authenticate — only cron callers are allowed
  let user: Awaited<ReturnType<typeof sdk.authenticateRequest>>;
  try {
    user = await sdk.authenticateRequest(req);
  } catch {
    return res.status(403).json({ error: "Unauthorized" });
  }

  // Accept both cron callers and the project owner (for manual testing)
  const isCron = (user as { isCron?: boolean }).isCron === true;
  const isOwner = user.openId === process.env.OWNER_OPEN_ID;
  if (!isCron && !isOwner) {
    return res.status(403).json({ error: "cron-only" });
  }

  try {
    const db = await getDb();
    if (!db) return res.status(503).json({ error: "Database unavailable" });

    const now = Date.now();

    // Find all items that are 'scheduled' and whose scheduled time has passed
    const overdueItems = await db
      .select({ id: contentItems.id, title: contentItems.title, scheduledAt: contentItems.scheduledAt })
      .from(contentItems)
      .where(
        and(
          eq(contentItems.status, "scheduled"),
          isNotNull(contentItems.scheduledAt),
          lte(contentItems.scheduledAt, now)
        )
      );

    if (overdueItems.length === 0) {
      console.log("[buffer-sync] No overdue scheduled items found.");
      return res.json({ ok: true, advanced: 0, items: [] });
    }

    // Advance each item to 'published'
    const advanced: { id: number; title: string }[] = [];
    for (const item of overdueItems) {
      await db
        .update(contentItems)
        .set({
          status: "published",
          publishedAt: now,
        })
        .where(eq(contentItems.id, item.id));

      advanced.push({ id: item.id, title: item.title });
      console.log(`[buffer-sync] Advanced item #${item.id} "${item.title}" → published`);
    }

    console.log(`[buffer-sync] Done — advanced ${advanced.length} item(s) to published.`);
    return res.json({ ok: true, advanced: advanced.length, items: advanced });
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? err.stack : undefined;
    console.error("[buffer-sync] Error:", error);
    return res.status(500).json({
      error,
      stack,
      context: { url: req.url },
      timestamp: new Date().toISOString(),
    });
  }
}
