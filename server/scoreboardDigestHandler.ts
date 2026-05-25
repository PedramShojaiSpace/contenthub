/**
 * scoreboardDigestHandler.ts
 *
 * Heartbeat handler for the weekly Content Scoreboard digest.
 * Triggered every Monday at 09:00 UTC via project-level Heartbeat cron.
 *
 * What it does:
 *  1. Fetches top 3 "Publish Next" recommendations (striking-distance GSC keywords)
 *  2. Fetches the 3 posts that gained the most position points this week
 *  3. Sends a combined digest notification via notifyOwner
 *
 * Registered at: POST /api/scheduled/scoreboard-digest
 */

import type { Request, Response } from "express";
import { getDb } from "./db";
import { notifyOwner } from "./_core/notification";
import { getTopQueries, getTopPages } from "./googleSearchConsole";
import { invokeLLM } from "./_core/llm";

const MY_DOMAIN = "theurbanmonk.com";

export async function scoreboardDigestHandler(req: Request, res: Response) {
  try {
    // Authenticate as cron — trust the /api/scheduled/* gateway
    const taskUid = req.headers["x-manus-cron-task-uid"] as string | undefined;
    if (!taskUid) {
      return res.status(403).json({ error: "cron-only endpoint" });
    }

    const db = await getDb();
    if (!db) return res.status(500).json({ error: "DB unavailable" });

    const { userCredentials, users, contentItems: ci, gscPositionHistory } = await import("../drizzle/schema");
    const { eq, and, isNotNull, desc, inArray } = await import("drizzle-orm");

    // Find the owner's credentials
    const ownerOpenId = process.env.OWNER_OPEN_ID;
    if (!ownerOpenId) return res.status(500).json({ error: "OWNER_OPEN_ID not configured" });

    const [owner] = await db.select().from(users).where(eq(users.openId, ownerOpenId)).limit(1);
    if (!owner) return res.json({ ok: true, skipped: "owner not found" });

    const [creds] = await db.select().from(userCredentials).where(eq(userCredentials.userId, owner.id)).limit(1);
    if (!creds?.gscRefreshToken || !creds?.gscSiteUrl) {
      return res.json({ ok: true, skipped: "GSC not connected" });
    }

    const refreshToken = creds.gscRefreshToken;
    const siteUrl = creds.gscSiteUrl;

    // ── 1. Publish Next: top 3 striking-distance keywords ─────────────────────
    let publishNextSection = "";
    try {
      const publishedPosts = await db
        .select({ focusKeyword: ci.focusKeyword, title: ci.title })
        .from(ci)
        .where(and(eq(ci.status, "published"), eq(ci.platform, "blog")));

      const coveredKeywords = new Set(
        publishedPosts.map((p: any) => (p.focusKeyword ?? "").toLowerCase().trim()).filter(Boolean)
      );

      const allKws = await getTopQueries(refreshToken, siteUrl, 200);
      const striking = allKws
        .filter((k: any) => k.position >= 4 && k.position <= 20 && k.impressions >= 50)
        .filter((k: any) => !coveredKeywords.has(k.query.toLowerCase().trim()))
        .map((k: any) => ({ keyword: k.query, position: k.position, impressions: k.impressions }))
        .sort((a: any, b: any) => (b.impressions * (1 / b.position)) - (a.impressions * (1 / a.position)))
        .slice(0, 3);

      if (striking.length > 0) {
        // Quick LLM title generation
        const kwList = striking.map((k: any, i: number) =>
          `${i + 1}. "${k.keyword}" (pos ${k.position.toFixed(1)}, ${k.impressions} impressions)`
        ).join("\n");

        let titles: string[] = striking.map((k: any) => k.keyword);
        try {
          const llmRes = await invokeLLM({
            messages: [
              {
                role: "system",
                content: `You are an SEO strategist for The Urban Monk (Dr. Pedram Shojai). For each keyword below, write a compelling blog post title in Pedram's voice (bridges ancient wisdom + modern science). Return JSON: {"titles": ["title1", "title2", "title3"]}`,
              },
              { role: "user", content: kwList },
            ],
            response_format: {
              type: "json_schema",
              json_schema: {
                name: "digest_titles",
                strict: true,
                schema: {
                  type: "object",
                  properties: { titles: { type: "array", items: { type: "string" } } },
                  required: ["titles"],
                  additionalProperties: false,
                },
              },
            },
          });
          const parsed = JSON.parse(llmRes.choices[0].message.content as string);
          titles = parsed.titles ?? titles;
        } catch { /* use fallback titles */ }

        publishNextSection = `\n📝 TOP 3 POSTS TO PUBLISH THIS WEEK\n${"─".repeat(40)}\n`;
        striking.forEach((k: any, i: number) => {
          publishNextSection += `\n${i + 1}. ${titles[i] ?? k.keyword}\n`;
          publishNextSection += `   Keyword: "${k.keyword}"\n`;
          publishNextSection += `   Current position: #${k.position.toFixed(1)} | Monthly impressions: ${k.impressions.toLocaleString()}\n`;
          publishNextSection += `   → Write this post to move from page 2 into the top 3 results.\n`;
        });
      } else {
        publishNextSection = "\n📝 PUBLISH NEXT\nConnect Google Search Console to unlock keyword recommendations.\n";
      }
    } catch (e) {
      publishNextSection = "\n📝 PUBLISH NEXT\nUnable to fetch recommendations this week.\n";
    }

    // ── 2. Biggest position gainers this week ─────────────────────────────────
    let gainersSection = "";
    try {
      const oneWeekAgo = Date.now() - 7 * 24 * 3600 * 1000;

      const posts = await db
        .select()
        .from(ci)
        .where(and(eq(ci.status, "published"), eq(ci.platform, "blog"), isNotNull(ci.wpPostId)));

      const postIds = posts.map((p: any) => p.id);
      if (postIds.length > 0) {
        // Get all history from the last 8 days (to have a "before" and "after" snapshot)
        const history = await db
          .select()
          .from(gscPositionHistory)
          .where(inArray(gscPositionHistory.contentItemId, postIds))
          .orderBy(desc(gscPositionHistory.recordedAt));

        // Group by contentItemId
        const byItem = new Map<number, any[]>();
        for (const row of history) {
          const id = row.contentItemId;
          if (!id) continue;
          if (!byItem.has(id)) byItem.set(id, []);
          byItem.get(id)!.push(row);
        }

        // Compute gain: latest position vs oldest position in the last 7 days
        const gains: Array<{ title: string; gain: number; latestPos: number; url: string | null }> = [];
        for (const post of posts as any[]) {
          const rows = byItem.get(post.id) ?? [];
          if (rows.length < 2) continue;
          const latest = parseFloat(rows[0].position ?? "0");
          const oldest = parseFloat(rows[rows.length - 1].position ?? "0");
          if (isNaN(latest) || isNaN(oldest) || oldest === 0) continue;
          const gain = oldest - latest; // positive = improved
          if (gain > 0.5) {
            gains.push({ title: post.title, gain: parseFloat(gain.toFixed(1)), latestPos: latest, url: post.publishUrl });
          }
        }

        gains.sort((a, b) => b.gain - a.gain);
        const top3 = gains.slice(0, 3);

        if (top3.length > 0) {
          gainersSection = `\n📈 BIGGEST POSITION GAINS THIS WEEK\n${"─".repeat(40)}\n`;
          top3.forEach((g, i) => {
            gainersSection += `\n${i + 1}. ${g.title}\n`;
            gainersSection += `   Gained +${g.gain} positions → now at #${g.latestPos.toFixed(1)}\n`;
            if (g.url) gainersSection += `   ${g.url}\n`;
          });
        } else {
          gainersSection = "\n📈 POSITION GAINS\nNo significant position changes recorded this week yet. Check back after more snapshots accumulate.\n";
        }
      }
    } catch (e) {
      gainersSection = "\n📈 POSITION GAINS\nUnable to compute position gains this week.\n";
    }

    // ── 3. Quick GSC summary ──────────────────────────────────────────────────
    let summarySection = "";
    try {
      const topPages = await getTopPages(refreshToken, siteUrl, 5);
      const totalClicks = topPages.reduce((s: number, p: any) => s + p.clicks, 0);
      summarySection = `\n🌐 SITE OVERVIEW (LAST 28 DAYS)\n${"─".repeat(40)}\n`;
      summarySection += `Total clicks (top 5 pages): ${totalClicks.toLocaleString()}\n`;
      summarySection += `Top performing page: ${topPages[0]?.page ?? "—"} (${topPages[0]?.clicks ?? 0} clicks)\n`;
    } catch { /* skip */ }

    // ── Compose and send digest ───────────────────────────────────────────────
    const now = new Date();
    const dateStr = now.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });

    const content = `Weekly Content Scoreboard Digest — ${dateStr}
${"═".repeat(50)}
${summarySection}
${publishNextSection}
${gainersSection}
${"═".repeat(50)}
View full scoreboard: https://content.theurbanmonk.com/scoreboard`;

    await notifyOwner({
      title: `📊 Weekly Scoreboard Digest — ${dateStr}`,
      content,
    });

    return res.json({ ok: true, sectionsIncluded: ["summary", "publishNext", "gainers"] });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[scoreboardDigestHandler] Error:", msg);
    return res.status(500).json({ error: msg, timestamp: new Date().toISOString() });
  }
}
