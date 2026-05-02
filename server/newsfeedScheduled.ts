/**
 * newsfeedScheduled.ts — Express handler for POST /api/scheduled/newsfeed-refresh
 *
 * Called by the Manus scheduled task agent every morning at 7 AM.
 * Fetches new articles from Google News + PubMed, generates commentary,
 * and inserts new articles into the newsfeed_articles table.
 *
 * Auth: Accepts either:
 *   1. INGEST_SECRET shared secret in body: { secret: "$INGEST_SECRET" }
 *   2. Valid Manus cron JWT cookie (app_session_id with openId starting with "cron_")
 */

import { Request, Response } from "express";
import { getDb } from "./db";
import { newsfeedArticles } from "../drizzle/schema";
import { fetchAllTopics } from "./newsfeed";
import { generateCommentary } from "./newsfeedCommentary";
import { ENV } from "./_core/env";
import { sdk } from "./_core/sdk";

export async function handleNewsfeedRefresh(req: Request, res: Response) {
  // Validate auth: accept either INGEST_SECRET or a valid cron cookie JWT
  const body = req.body ?? {};
  const expectedSecret = ENV.ingestSecret;

  let authenticated = false;

  // Method 1: INGEST_SECRET in body
  if (expectedSecret && body.secret && body.secret === expectedSecret) {
    authenticated = true;
  }

  // Method 2: Valid cron JWT cookie (openId starts with "cron_")
  if (!authenticated) {
    try {
      const cookieHeader = req.headers.cookie ?? "";
      const match = cookieHeader.match(/app_session_id=([^;]+)/);
      const cookieValue = match ? match[1] : null;
      if (cookieValue) {
        const session = await sdk.verifySession(cookieValue);
        if (session && session.openId.startsWith("cron_") && session.appId === ENV.appId) {
          authenticated = true;
          console.log("[newsfeed-scheduled] Authenticated via cron cookie:", session.openId);
        }
      }
    } catch (err) {
      // Cron cookie auth failed, fall through
    }
  }

  if (!authenticated) {
    console.warn("[newsfeed-scheduled] Invalid auth from", req.ip);
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
