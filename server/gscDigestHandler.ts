/**
 * gscDigestHandler.ts
 *
 * Heartbeat handler for the weekly GSC SEO digest.
 * Triggered every Monday at 09:00 UTC via project-level Heartbeat cron.
 *
 * What it does:
 *  1. Loads GSC credentials for the site owner (OWNER_OPEN_ID)
 *  2. Fetches top queries, top pages, striking-distance keywords, and WoW summary
 *  3. Sends a formatted digest notification via notifyOwner
 *
 * Registered at: POST /api/scheduled/gsc-digest
 */

import type { Request, Response } from "express";
import { getDb } from "./db";
import { notifyOwner } from "./_core/notification";
import {
  getTopQueries,
  getTopPages,
  getStrikingDistanceKeywords,
  getWeekOverWeekSummary,
  getQueryRankChanges,
} from "./googleSearchConsole";

export async function gscDigestHandler(req: Request, res: Response) {
  try {
    // Authenticate as cron — the platform injects a cron session cookie
    // For project-level Heartbeat (§4a), we trust the /api/scheduled/* gateway
    // and verify via the x-manus-cron-task-uid header (no sdk.authenticateRequest needed)
    const taskUid = req.headers["x-manus-cron-task-uid"] as string | undefined;
    if (!taskUid) {
      return res.status(403).json({ error: "cron-only endpoint" });
    }

    const db = await getDb();
    if (!db) {
      return res.status(500).json({ error: "DB unavailable" });
    }

    const { userCredentials } = await import("../drizzle/schema");
    const { eq } = await import("drizzle-orm");

    // Find the owner's GSC credentials
    const ownerOpenId = process.env.OWNER_OPEN_ID;
    if (!ownerOpenId) {
      return res.status(500).json({ error: "OWNER_OPEN_ID not configured" });
    }

    // Get owner user record
    const { users } = await import("../drizzle/schema");
    const [owner] = await db.select().from(users).where(eq(users.openId, ownerOpenId)).limit(1);
    if (!owner) {
      return res.json({ ok: true, skipped: "owner not found in DB" });
    }

    // Get GSC credentials
    const [creds] = await db
      .select()
      .from(userCredentials)
      .where(eq(userCredentials.userId, owner.id))
      .limit(1);

    if (!creds?.gscRefreshToken || !creds?.gscSiteUrl) {
      return res.json({ ok: true, skipped: "GSC not connected or no site URL configured" });
    }

    const refreshToken = creds.gscRefreshToken;
    const siteUrl = creds.gscSiteUrl;

    // Fetch all data in parallel
    const [topQueries, topPages, strikingKeywords, wow, rankChanges] = await Promise.all([
      getTopQueries(refreshToken, siteUrl, 10),
      getTopPages(refreshToken, siteUrl, 10),
      getStrikingDistanceKeywords(refreshToken, siteUrl),
      getWeekOverWeekSummary(refreshToken, siteUrl),
      getQueryRankChanges(refreshToken, siteUrl, 3), // flag drops of 3+ positions
    ]);

    // Format the digest notification
    const formatNum = (n: number) =>
      n >= 1000 ? `${(n / 1000).toFixed(1)}K` : n.toString();

    const wowClicksDelta = wow.thisWeekClicks - wow.lastWeekClicks;
    const wowImpDelta = wow.thisWeekImpressions - wow.lastWeekImpressions;
    const wowSign = (n: number) => (n >= 0 ? `+${formatNum(n)}` : formatNum(n));

    const topQueriesLines = topQueries
      .slice(0, 5)
      .map(
        (q, i) =>
          `${i + 1}. "${q.query}" — ${formatNum(q.clicks)} clicks, pos #${q.position.toFixed(1)}`
      )
      .join("\n");

    const strikingLines =
      strikingKeywords.length === 0
        ? "None found this week."
        : strikingKeywords
            .slice(0, 8)
            .map(
              (q, i) =>
                `${i + 1}. "${q.query}" — pos #${q.position.toFixed(1)}, ${formatNum(q.impressions)} impressions`
            )
            .join("\n");

    const topPagesLines = topPages
      .slice(0, 5)
      .map((p, i) => {
        const slug = p.page.replace(/^https?:\/\/[^/]+/, "") || "/";
        return `${i + 1}. ${slug} — ${formatNum(p.clicks)} clicks`;
      })
      .join("\n");

    const title = `📊 Weekly SEO Digest — ${new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;

    const content = `
**Week-over-Week Summary** (${siteUrl.replace(/^https?:\/\//, "")})
• Clicks: ${formatNum(wow.thisWeekClicks)} (${wowSign(wowClicksDelta)} vs last week)
• Impressions: ${formatNum(wow.thisWeekImpressions)} (${wowSign(wowImpDelta)} vs last week)
• Click delta: ${wow.clicksDelta > 0 ? "+" : ""}${wow.clicksDelta}%

**Top 5 Keywords by Clicks (last 28 days)**
${topQueriesLines}

**Top 5 Pages by Clicks (last 28 days)**
${topPagesLines}

**Striking Distance Keywords (positions 11–20)**
${strikingLines}

**⚠️ Rank-Drop Alerts (dropped 3+ positions this week)**
${rankChanges.length === 0
  ? "No significant drops detected this week."
  : rankChanges
      .slice(0, 8)
      .map(
        (r, i) =>
          `${i + 1}. "${r.query}" — was #${r.previousPosition.toFixed(1)}, now #${r.currentPosition.toFixed(1)} (▼${r.drop.toFixed(1)} positions)`
      )
      .join("\n")}

View full dashboard: https://content.theurbanmonk.com/seo
`.trim();

    await notifyOwner({ title, content });

    return res.json({
      ok: true,
      summary: {
        site: siteUrl,
        clicks: wow.thisWeekClicks,
        impressions: wow.thisWeekImpressions,
        strikingCount: strikingKeywords.length,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? err.stack : undefined;
    console.error("[gscDigestHandler] Error:", message);
    return res.status(500).json({
      error: message,
      stack,
      context: { url: req.url, taskUid: req.headers["x-manus-cron-task-uid"] },
      timestamp: new Date().toISOString(),
    });
  }
}
