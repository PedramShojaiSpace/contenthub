/**
 * newsfeedRouter.ts — tRPC router for the LinkedIn Newsfeed (Doovo replacement).
 *
 * Procedures:
 *   newsfeed.getArticles        — list articles (with optional topic/status filter)
 *   newsfeed.refreshFeed        — fetch new articles from Google News + PubMed
 *   newsfeed.approveArticle     — approve → creates a LinkedIn ContentItem in Kanban
 *   newsfeed.dismissArticle     — mark as dismissed
 *   newsfeed.regenerateCommentary — re-run LLM commentary for an article
 */

import { z } from "zod";
import { protectedProcedure, router } from "./_core/trpc";
import { getDb } from "./db";
import { newsfeedArticles, contentItems } from "../drizzle/schema";
import { eq, desc, and } from "drizzle-orm";
import { fetchAllTopics, fetchGoogleNewsRSS, fetchPubMedArticles, TOPIC_CLUSTERS } from "./newsfeed";
// fetchGoogleNewsRSS and fetchPubMedArticles are used in the refreshFeed procedure
import { generateCommentary } from "./newsfeedCommentary";
import { getBufferProfiles, pushToBuffer } from "./buffer";

export const newsfeedRouter = router({
  // ── List articles ──────────────────────────────────────────────────────────
  getArticles: protectedProcedure
    .input(
      z.object({
        topic: z.string().optional(),
        status: z.enum(["pending", "approved", "dismissed"]).optional(),
        limit: z.number().min(1).max(200).default(60),
      })
    )
    .query(async ({ input }) => {
      const conditions = [];
      if (input.topic) conditions.push(eq(newsfeedArticles.topic, input.topic));
      if (input.status) conditions.push(eq(newsfeedArticles.status, input.status));

      const database = await getDb();
      if (!database) return [];

      const articles = await database
        .select()
        .from(newsfeedArticles)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(newsfeedArticles.fetchedAt))
        .limit(input.limit);

      return articles;
    }),

  // ── Refresh feed ───────────────────────────────────────────────────────────
  // Fetches new articles from Google News + PubMed, generates commentary,
  // and inserts only articles not already in the DB (dedup by URL).
  refreshFeed: protectedProcedure
    .input(
      z.object({
        topic: z.string().optional(), // if omitted, refresh all topics
      })
    )
    .mutation(async ({ input }) => {
      // Fetch raw articles
      let rawArticles;
      if (input.topic) {
        const [news, pubmed] = await Promise.all([
          fetchGoogleNewsRSS(input.topic, 6),
          fetchPubMedArticles(input.topic, 4),
        ]);
        rawArticles = [...news, ...pubmed];
      } else {
        rawArticles = await fetchAllTopics();
      }

      if (rawArticles.length === 0) {
        return { inserted: 0, skipped: 0, errors: 0 };
      }

      // Get existing URLs to avoid duplicates
      const database = await getDb();
      if (!database) throw new Error("Database not available");

      const existingUrls = await database
        .select({ url: newsfeedArticles.url })
        .from(newsfeedArticles);
      const existingUrlSet = new Set(existingUrls.map((r: { url: string }) => r.url));

      const newArticles = rawArticles.filter((a) => !existingUrlSet.has(a.url));

      let inserted = 0;
      let errors = 0;

      // Generate commentary for each new article (in parallel, max 5 at a time)
      const BATCH = 5;
      for (let i = 0; i < newArticles.length; i += BATCH) {
        const batch = newArticles.slice(i, i + BATCH);
        await Promise.allSettled(
          batch.map(async (article) => {
            try {
              const commentary = await generateCommentary(article);
              await database.insert(newsfeedArticles).values({
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
              console.error(`[newsfeed] Failed to insert article "${article.title}":`, err);
              errors++;
            }
          })
        );
      }

      return { inserted, skipped: rawArticles.length - newArticles.length, errors };
    }),

  // ── Approve article ────────────────────────────────────────────────────────
  // Creates a LinkedIn ContentItem in the Command Center Kanban (status: approved)
  approveArticle: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const database = await getDb();
      if (!database) throw new Error("Database not available");

      const [article] = await database
        .select()
        .from(newsfeedArticles)
        .where(eq(newsfeedArticles.id, input.id))
        .limit(1);

      if (!article) throw new Error("Article not found");
      if (!article.commentary) throw new Error("Article has no commentary yet");

      // Create a LinkedIn ContentItem in the Kanban
      const [inserted] = await database.insert(contentItems).values({
        title: article.title.slice(0, 255),
        platform: "linkedin",
        status: "approved",
        textContent: article.commentary,
        rawIdea: `[Newsfeed] ${article.source}: ${article.url}`,
        notes: `Source: ${article.source}\nURL: ${article.url}\nTopic: ${article.topic}`,
      });

      const contentItemId = (inserted as any).insertId as number;

      // Update newsfeed article status
      await database
        .update(newsfeedArticles)
        .set({
          status: "approved",
          contentItemId,
          approvedAt: new Date(),
        })
        .where(eq(newsfeedArticles.id, input.id));

      return { contentItemId };
    }),

  // ── Dismiss article ────────────────────────────────────────────────────────
  dismissArticle: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const database = await getDb();
      if (!database) throw new Error("Database not available");

      await database
        .update(newsfeedArticles)
        .set({ status: "dismissed" })
        .where(eq(newsfeedArticles.id, input.id));
      return { success: true };
    }),

  // ── Regenerate commentary ──────────────────────────────────────────────────
  regenerateCommentary: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const database = await getDb();
      if (!database) throw new Error("Database not available");

      const [article] = await database
        .select()
        .from(newsfeedArticles)
        .where(eq(newsfeedArticles.id, input.id))
        .limit(1);

      if (!article) throw new Error("Article not found");

      const commentary = await generateCommentary({
        title: article.title,
        url: article.url,
        source: article.source ?? "",
        description: article.description ?? "",
        imageUrl: article.imageUrl ?? undefined,
        topic: article.topic ?? "integrative_medicine",
        fetchedAt: article.fetchedAt,
      });

      await database
        .update(newsfeedArticles)
        .set({ commentary })
        .where(eq(newsfeedArticles.id, input.id));

      return { commentary };
    }),

  // ── Push to Buffer ─────────────────────────────────────────────────────────
  // Sends the article's AI-generated commentary to the LinkedIn Buffer queue.
  // Automatically selects the first LinkedIn channel found in Buffer.
  pushToBuffer: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const database = await getDb();
      if (!database) throw new Error("Database not available");

      const [article] = await database
        .select()
        .from(newsfeedArticles)
        .where(eq(newsfeedArticles.id, input.id))
        .limit(1);

      if (!article) throw new Error("Article not found");
      if (!article.commentary) throw new Error("Article has no commentary to push");

      // Discover Buffer LinkedIn channels
      const profiles = await getBufferProfiles();
      const linkedInProfiles = profiles.filter((p) => p.platform === "linkedin");

      if (linkedInProfiles.length === 0) {
        throw new Error("No LinkedIn channel found in Buffer. Please connect your LinkedIn account in Buffer.");
      }

      // Push to all connected LinkedIn channels
      const channelIds = linkedInProfiles.map((p) => p.id);
      const result = await pushToBuffer({
        text: article.commentary,
        profileIds: channelIds,
        platform: "linkedin",
        imageUrl: article.imageUrl ?? undefined,
      });

      if (!result.success) {
        throw new Error(result.error ?? "Buffer push failed");
      }

      // Record the push timestamp
      await database
        .update(newsfeedArticles)
        .set({ bufferSentAt: new Date() })
        .where(eq(newsfeedArticles.id, input.id));

      return { success: true, bufferId: result.bufferId, channelCount: channelIds.length };
    }),

  // ── Get topic list ─────────────────────────────────────────────────────────
  getTopics: protectedProcedure.query(() => {
    return Object.entries(TOPIC_CLUSTERS).map(([key, val]) => ({
      key,
      label: val.label,
    }));
  }),
});
