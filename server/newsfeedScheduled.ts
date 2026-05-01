/**
 * newsfeedScheduled.ts — Express handler for POST /api/scheduled/newsfeed-refresh
 *
 * Called by the Manus scheduled task agent every morning at 7 AM.
 * Fetches new articles from Google News + PubMed, generates commentary,
 * and inserts new articles into the newsfeed_articles table.
 *
 * Auth: Uses the INGEST_SECRET shared secret (same pattern as ingestRouter.ts).
 * The scheduled task agent sends: { secret: "$INGEST_SECRET" }
 */

import { Request, Response } from "express";
import { getDb } from "./db";
import { newsfeedArticles, contentItems } from "../drizzle/schema";
import { fetchAllTopics, fetchGoogleNewsRSS, fetchPubMedArticles } from "./newsfeed";
import { generateCommentary } from "./newsfeedCommentary";
import { ENV } from "./_core/env";

export async function handleNewsfeedRefresh(req: Request, res: Response) {
  // Validate shared secret
  const expectedSecret = ENV.ingestSecret;
  if (!expectedSecret) {
    console.error("[newsfeed-scheduled] INGEST_SECRET is not configured");
    return res.status(500).json({ error: "Server misconfiguration" });
  }

  const body = req.body ?? {};
  if (!body.secret || body.secret !== expectedSecret) {
    console.warn("[newsfeed-scheduled] Invalid secret from", req.ip);
    return res.status(401).json({ error: "Unauthorized" });
  }

  const db = await getDb();
  if (!db) {
    return res.status(500).json({ error: "Database unavailable" });
  }

  try {
    // Fetch raw articles from all topic clusters
    const rawArticles = await fetchAllTopics();

    if (rawArticles.length === 0) {
      return res.json({ inserted: 0, skipped: 0, errors: 0, message: "No articles fetched" });
    }

    // Get existing URLs to avoid duplicates
    const existingUrls = await db.select({ url: newsfeedArticles.url }).from(newsfeedArticles);
    const existingUrlSet = new Set(existingUrls.map((r: { url: string }) => r.url));

    const newArticles = rawArticles.filter((a) => !existingUrlSet.has(a.url));
    let inserted = 0;
    let errors = 0;

    // Generate commentary in batches of 5
    const BATCH = 5;
    for (let i = 0; i < newArticles.length; i += BATCH) {
      const batch = newArticles.slice(i, i + BATCH);
      await Promise.allSettled(
        batch.map(async (article) => {
          try {
            const commentary = await generateCommentary(article);
            await db.insert(newsfeedArticles).values({
              title: article.title.slice(0, 512),
              source: (article.source ?? "").slice(0, 255),
              url: article.url.slice(0, 1024),
              imageUrl: article.imageUrl ?? null,
              description: (article.description ?? "").slice(0, 65535),
              commentary,
              topic: article.topic,
              status: "pending",
              fetchedAt: article.fetchedAt,
            });
            inserted++;
          } catch (err) {
            console.error(`[newsfeed-scheduled] Failed to insert "${article.title}":`, err);
            errors++;
          }
        })
      );
    }

    console.log(`[newsfeed-scheduled] Refresh complete: ${inserted} inserted, ${rawArticles.length - newArticles.length} skipped, ${errors} errors`);
    return res.json({
      inserted,
      skipped: rawArticles.length - newArticles.length,
      errors,
      message: `Inserted ${inserted} new articles`,
    });
  } catch (err) {
    console.error("[newsfeed-scheduled] Unexpected error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}
