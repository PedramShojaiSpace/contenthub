/**
 * rankSnapshotHandler.ts
 *
 * Heartbeat handler for the weekly keyword rank snapshot.
 * Triggered every Monday at 10:00 UTC via project-level Heartbeat cron.
 *
 * What it does:
 *  1. Loads all keyword_targets that have been published (publishedUrl is set)
 *     OR have a currentPosition already (i.e. GSC has seen them)
 *  2. Fetches up to 500 GSC queries for the last 7 days
 *  3. Fuzzy-matches each keyword target against the GSC data
 *  4. Writes a keyword_rank_history row for each target (position may be null if not ranking)
 *  5. Updates keyword_targets.currentPosition with the fresh position
 *  6. Sends a rank movers notification if any keyword moved ≥5 positions
 *
 * Registered at: POST /api/scheduled/rank-snapshot
 */

import type { Request, Response } from "express";
import { getDb } from "./db";
import { notifyOwner } from "./_core/notification";
import { keywordTargets, keywordRankHistory, keywordCampaigns } from "../drizzle/schema";
import { eq, and, isNotNull, desc } from "drizzle-orm";
import { getTopQueries } from "./googleSearchConsole";
import { userCredentials } from "../drizzle/schema";

/** ISO week label: e.g. "2026-W21" */
function getWeekLabel(date = new Date()): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}

export async function rankSnapshotHandler(req: Request, res: Response) {
  try {
    const taskUid = req.headers["x-manus-cron-task-uid"] as string | undefined;
    if (!taskUid) {
      return res.status(403).json({ error: "cron-only endpoint" });
    }

    const db = await getDb();
    if (!db) return res.status(503).json({ error: "Database unavailable" });

    // Find the owner's GSC credentials (user id 1 = owner)
    const [creds] = await db
      .select()
      .from(userCredentials)
      .where(isNotNull(userCredentials.gscRefreshToken))
      .limit(1);

    if (!creds?.gscRefreshToken || !creds?.gscSiteUrl) {
      console.log("[rankSnapshot] GSC not connected — skipping snapshot");
      return res.json({ ok: true, skipped: "gsc_not_connected" });
    }

    const weekLabel = getWeekLabel();
    const snapshotAt = Date.now();

    // Fetch up to 500 GSC queries for the last 7 days
    let gscRows: Array<{ query: string; clicks: number; impressions: number; ctr: number; position: number }> = [];
    try {
      gscRows = await getTopQueries(creds.gscRefreshToken, creds.gscSiteUrl, 500);
    } catch (err) {
      console.error("[rankSnapshot] GSC fetch error:", err);
      return res.status(500).json({ error: `GSC fetch failed: ${String(err)}` });
    }

    // Build lookup map: normalised query -> GSC row
    const gscMap = new Map<string, { position: number; clicks: number; impressions: number; ctr: number }>();
    for (const row of gscRows) {
      gscMap.set(row.query.toLowerCase().trim(), {
        position: row.position,
        clicks: row.clicks,
        impressions: row.impressions,
        ctr: row.ctr,
      });
    }

    // Load all keyword targets that are worth tracking:
    // - have a publishedUrl (content is live), OR
    // - have a currentPosition (GSC has seen them before)
    const targets = await db
      .select()
      .from(keywordTargets)
      .where(
        // We snapshot ALL targets so we can track when new content starts ranking
        // Filter to only targets that belong to active campaigns
        isNotNull(keywordTargets.campaignId)
      );

    const movers: Array<{
      keyword: string;
      oldPosition: number | null;
      newPosition: number | null;
      delta: number;
    }> = [];

    let snapshotted = 0;
    let ranked = 0;

    for (const target of targets) {
      const normalised = target.keyword.toLowerCase().trim();

      // Fuzzy match: exact → substring
      let gscData = gscMap.get(normalised);
      if (!gscData) {
        for (const [gscQuery, data] of Array.from(gscMap.entries())) {
          if (gscQuery.includes(normalised) || normalised.includes(gscQuery)) {
            gscData = data;
            break;
          }
        }
      }

      const newPosition = gscData ? Math.round(gscData.position) : null;
      const oldPosition = target.currentPosition ? parseFloat(target.currentPosition) : null;

      // Write rank history row
      await db.insert(keywordRankHistory).values({
        targetId: target.id,
        keyword: target.keyword,
        position: newPosition ?? undefined,
        clicks: gscData?.clicks ?? 0,
        impressions: gscData?.impressions ?? 0,
        ctr: gscData ? String((gscData.ctr * 100).toFixed(2)) : null,
        weekLabel,
        snapshotAt,
      });

      // Update currentPosition on the target
      if (newPosition !== null) {
        await db
          .update(keywordTargets)
          .set({ currentPosition: String(newPosition) })
          .where(eq(keywordTargets.id, target.id));
        ranked++;
      }

      // Track significant movers (≥5 positions)
      if (oldPosition !== null && newPosition !== null) {
        const delta = oldPosition - newPosition; // positive = improved
        if (Math.abs(delta) >= 5) {
          movers.push({ keyword: target.keyword, oldPosition, newPosition, delta });
        }
      }

      snapshotted++;
    }

    // Sort movers: biggest improvements first, then biggest drops
    movers.sort((a, b) => b.delta - a.delta);

    // Send notification if there are significant movers
    if (movers.length > 0) {
      const improved = movers.filter((m) => m.delta > 0);
      const dropped = movers.filter((m) => m.delta < 0);

      const lines: string[] = [
        `📊 **Weekly Rank Snapshot — ${weekLabel}**`,
        `Snapshotted ${snapshotted} keywords | ${ranked} currently ranking in GSC\n`,
      ];

      if (improved.length > 0) {
        lines.push("**🚀 Rank Improvements:**");
        improved.slice(0, 5).forEach((m) => {
          lines.push(`  • "${m.keyword}" — pos ${m.oldPosition} → ${m.newPosition} (+${m.delta})`);
        });
      }

      if (dropped.length > 0) {
        lines.push("\n**⚠️ Rank Drops:**");
        dropped.slice(0, 5).forEach((m) => {
          lines.push(`  • "${m.keyword}" — pos ${m.oldPosition} → ${m.newPosition} (${m.delta})`);
        });
      }

      lines.push(`\nView full rank trends at https://content.theurbanmonk.com/keyword-strategy`);

      await notifyOwner({
        title: `📊 Rank Snapshot ${weekLabel} — ${movers.length} significant movers`,
        content: lines.join("\n"),
      });
    }

    return res.json({
      ok: true,
      weekLabel,
      snapshotted,
      ranked,
      movers: movers.length,
      gscQueriesFetched: gscRows.length,
    });
  } catch (err) {
    console.error("[rankSnapshot] error:", err);
    return res.status(500).json({ error: String(err) });
  }
}
