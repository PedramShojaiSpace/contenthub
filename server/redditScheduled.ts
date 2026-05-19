/**
 * Reddit Nightly Heartbeat Handler
 * POST /api/scheduled/reddit-nightly
 *
 * Triggered by Manus Heartbeat cron at 7:00 AM UTC daily.
 * 1. Refreshes all active subreddits (fetches latest hot threads)
 * 2. Batch-analyzes the top 5 unanalyzed posts by reddit score
 */

import type { Request, Response } from "express";
import { getDb } from "./db";
import { redditSubreddits, redditPosts } from "../drizzle/schema";
import { eq, and, isNull, desc, sql } from "drizzle-orm";
import { invokeLLM } from "./_core/llm";

// ─── Reddit fetch (same logic as redditRouter.ts) ────────────────────────────

interface RedditRawPost {
  id: string;
  subreddit: string;
  title: string;
  selftext: string;
  score: number;
  num_comments: number;
  upvote_ratio: number;
  permalink: string;
  author: string;
  created_utc: number;
}

const REDDIT_USER_AGENTS = [
  "script:urbanmonk-content-hub:v1.0 (by /u/urbanmonk_admin)",
  "Mozilla/5.0 (X11; Linux x86_64; rv:109.0) Gecko/20100101 Firefox/115.0",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
];

async function fetchRedditHot(subreddit: string, limit = 25): Promise<RedditRawPost[]> {
  for (const ua of REDDIT_USER_AGENTS) {
    try {
      const url = `https://www.reddit.com/r/${subreddit}/hot.json?limit=${limit}&raw_json=1`;
      const res = await fetch(url, {
        headers: { "User-Agent": ua, "Accept": "application/json", "Accept-Language": "en-US,en;q=0.9" },
      });
      if (!res.ok) continue;
      const data = await res.json() as { data?: { children?: { data: RedditRawPost }[] } };
      const posts = (data?.data?.children ?? []).map((c) => c.data);
      if (posts.length > 0) return posts;
    } catch { /* try next UA */ }
  }
  // RSS fallback
  try {
    const rssRes = await fetch(`https://www.reddit.com/r/${subreddit}/hot.rss?limit=${limit}`, {
      headers: { "User-Agent": "script:urbanmonk-content-hub:v1.0", "Accept": "application/rss+xml" },
    });
    if (rssRes.ok) {
      const xml = await rssRes.text();
      const entries: RedditRawPost[] = [];
      const entryRegex = /<entry>([\s\S]*?)<\/entry>/g;
      let match; let idx = 0;
      while ((match = entryRegex.exec(xml)) !== null && idx < limit) {
        const entry = match[1];
        const titleMatch = entry.match(/<title[^>]*><!\[CDATA\[([^\]]+)\]\]><\/title>/) || entry.match(/<title[^>]*>([^<]+)<\/title>/);
        const linkMatch = entry.match(/<link[^>]*href="([^"]+)"/);
        const idMatch = entry.match(/<id>([^<]+)<\/id>/);
        const authorMatch = entry.match(/<name>([^<]+)<\/name>/);
        const updatedMatch = entry.match(/<updated>([^<]+)<\/updated>/);
        if (titleMatch && idMatch) {
          const postIdMatch = idMatch[1].match(/comments\/([a-z0-9]+)/);
          entries.push({
            id: postIdMatch ? postIdMatch[1] : `rss_${idx}`,
            subreddit,
            title: titleMatch[1].replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>'),
            selftext: "",
            score: 0,
            num_comments: 0,
            upvote_ratio: 1,
            permalink: linkMatch ? linkMatch[1] : `https://reddit.com/r/${subreddit}`,
            author: authorMatch ? authorMatch[1] : "[unknown]",
            created_utc: updatedMatch ? Math.floor(new Date(updatedMatch[1]).getTime() / 1000) : Math.floor(Date.now() / 1000),
          });
          idx++;
        }
      }
      if (entries.length > 0) return entries;
    }
  } catch { /* ignore */ }
  return [];
}

// ─── AI analysis (same prompt as redditRouter.ts) ────────────────────────────

async function analyzePost(post: { title: string; selftext: string | null; subreddit: string; score: number; numComments: number }) {
  const prompt = `You are the editorial AI for Dr. Pedram Shojai (The Urban Monk) — a doctor of Oriental Medicine, bestselling author, and expert in energy medicine, Taoist philosophy, biohacking, meditation, stress resilience, gut health, and longevity.

Analyze this Reddit thread and respond with ONLY valid JSON (no markdown, no code fences):

SUBREDDIT: r/${post.subreddit}
TITLE: ${post.title}
BODY: ${(post.selftext ?? "").slice(0, 600)}
SCORE: ${post.score} | COMMENTS: ${post.numComments}

Return JSON with these exact keys:
{
  "engagementScore": <1-10 integer, how valuable is this thread for Dr. Shojai to engage in>,
  "aiSummary": "<one sentence summary of what this thread is about>",
  "aiRecommendation": "<one sentence on the angle Dr. Shojai should take>",
  "aiDraftComment": "<3-5 sentence comment in Dr. Shojai's voice: warm, grounded, blends ancient wisdom with modern science, ends with a curiosity-opener>"
}`;

  try {
    const res = await invokeLLM({ messages: [{ role: "user", content: prompt }] });
    const content = res.choices?.[0]?.message?.content;
    if (typeof content !== "string") return null;
    const cleaned = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    return JSON.parse(cleaned) as { engagementScore: number; aiSummary: string; aiRecommendation: string; aiDraftComment: string };
  } catch {
    return null;
  }
}

// ─── Main handler ─────────────────────────────────────────────────────────────

export async function handleRedditNightly(req: Request, res: Response) {
  const startTime = Date.now();
  const log: string[] = [];

  try {
    const db = await getDb();
    if (!db) return res.status(500).json({ error: "DB unavailable" });

    // ── Step 1: Refresh all active subreddits ──────────────────────────────────
    const subs = await db.select().from(redditSubreddits).where(eq(redditSubreddits.isActive, true));
    log.push(`Refreshing ${subs.length} active subreddits…`);

    let totalNew = 0;
    for (const sub of subs) {
      const posts = await fetchRedditHot(sub.subreddit, 15);
      for (const p of posts) {
        const existing = await db
          .select({ id: redditPosts.id })
          .from(redditPosts)
          .where(eq(redditPosts.redditId, p.id))
          .limit(1);

        if (existing.length === 0) {
          await db.insert(redditPosts).values({
            redditId: p.id,
            subreddit: p.subreddit,
            category: sub.category,
            title: p.title,
            selftext: p.selftext?.slice(0, 2000) ?? null,
            score: p.score,
            numComments: p.num_comments,
            upvoteRatio: p.upvote_ratio,
            permalink: p.permalink ? (p.permalink.startsWith("http") ? p.permalink : `https://reddit.com${p.permalink}`) : `https://reddit.com/r/${sub.subreddit}`,
            author: p.author,
            createdUtc: Math.floor(p.created_utc),
          });
          totalNew++;
        } else {
          await db
            .update(redditPosts)
            .set({ score: p.score, numComments: p.num_comments })
            .where(eq(redditPosts.redditId, p.id));
        }
      }
      await db
        .update(redditSubreddits)
        .set({ lastFetchedAt: new Date() })
        .where(eq(redditSubreddits.id, sub.id));
    }
    log.push(`Refresh complete: ${totalNew} new posts across ${subs.length} subreddits`);

    // ── Step 2: Batch-analyze top 5 unanalyzed posts by score ─────────────────
    const unanalyzed = await db
      .select()
      .from(redditPosts)
      .where(
        and(
          eq(redditPosts.isAnalyzed, false),
          eq(redditPosts.isDismissed, false)
        )
      )
      .orderBy(desc(redditPosts.score))
      .limit(5);

    log.push(`Analyzing top ${unanalyzed.length} unanalyzed posts…`);
    let analyzed = 0;

    for (const post of unanalyzed) {
      const analysis = await analyzePost({
        title: post.title,
        selftext: post.selftext,
        subreddit: post.subreddit,
        score: post.score,
        numComments: post.numComments,
      });
      if (analysis) {
        await db
          .update(redditPosts)
          .set({
            engagementScore: analysis.engagementScore,
            aiSummary: analysis.aiSummary,
            aiRecommendation: analysis.aiRecommendation,
            aiDraftComment: analysis.aiDraftComment,
            isAnalyzed: true,
          })
          .where(eq(redditPosts.id, post.id));
        analyzed++;
      }
    }
    log.push(`Analysis complete: ${analyzed} posts analyzed`);

    const elapsed = Math.round((Date.now() - startTime) / 1000);
    const result = { ok: true, totalNew, analyzed, subredditsScanned: subs.length, elapsed, log };
    console.log("[reddit-nightly]", result);
    return res.json(result);

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? err.stack : undefined;
    console.error("[reddit-nightly] Error:", msg);
    return res.status(500).json({ error: msg, stack, context: { url: req.url }, timestamp: new Date().toISOString() });
  }
}
