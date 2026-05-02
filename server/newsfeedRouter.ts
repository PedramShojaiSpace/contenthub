/**
 * newsfeedRouter.ts — tRPC router for the LinkedIn Newsfeed (Doovo replacement).
 *
 * Procedures:
 *   newsfeed.getArticles           — list articles (with optional topic/status filter)
 *   newsfeed.refreshFeed           — fetch new articles from Google News + PubMed
 *   newsfeed.approveArticle        — approve → creates a LinkedIn ContentItem in Kanban
 *   newsfeed.dismissArticle        — mark as dismissed
 *   newsfeed.regenerateCommentary  — re-run LLM commentary for an article
 *   newsfeed.pushToBuffer          — push LinkedIn post (+ optional X version) to Buffer
 *   newsfeed.getXVersion           — generate/return cached X/Twitter version
 */

import { z } from "zod";
import { protectedProcedure, router } from "./_core/trpc";
import { getDb } from "./db";
import { newsfeedArticles, contentItems } from "../drizzle/schema";
import { eq, desc, and } from "drizzle-orm";
import { fetchAllTopics, fetchGoogleNewsRSS, fetchPubMedArticles, TOPIC_CLUSTERS } from "./newsfeed";
import { generateCommentary, generateXVersion } from "./newsfeedCommentary";
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

      const database = await getDb();
      if (!database) throw new Error("Database not available");

      const existingUrls = await database
        .select({ url: newsfeedArticles.url })
        .from(newsfeedArticles);
      const existingUrlSet = new Set(existingUrls.map((r: { url: string }) => r.url));

      const newArticles = rawArticles.filter((a) => !existingUrlSet.has(a.url));

      let inserted = 0;
      let errors = 0;

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
  approveArticle: protectedProcedure
    .input(z.object({
      id: z.number(),
      includeX: z.boolean().default(false), // persist the X preference set at approval time
    }))
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
      const [inserted] = await database.insert(contentItems).values({
        title: article.title.slice(0, 255),
        platform: "linkedin",
        status: "approved",
        textContent: article.commentary,
        rawIdea: `[Newsfeed] ${article.source}: ${article.url}`,
        notes: `Source: ${article.source}\nURL: ${article.url}\nTopic: ${article.topic}`,
      });
      const contentItemId = (inserted as any).insertId as number;
      await database
        .update(newsfeedArticles)
        .set({
          status: "approved",
          contentItemId,
          approvedAt: new Date(),
          includeX: input.includeX, // store so Approved tab can pre-fill the toggle
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

      // Also regenerate the X version so it stays in sync
      const xVersion = await generateXVersion(commentary, article.url);

      await database
        .update(newsfeedArticles)
        .set({ commentary, xVersion })
        .where(eq(newsfeedArticles.id, input.id));

      return { commentary, xVersion };
    }),

  // ── Push to Buffer ─────────────────────────────────────────────────────────
  // Sends the LinkedIn commentary to Buffer with the article URL appended in
  // the post text and an optional custom thumbnail image as a standalone image
  // attachment. When includeX is true, also pushes a condensed ≤280-char
  // version to all connected X/Twitter channels simultaneously.
  pushToBuffer: protectedProcedure
    .input(z.object({
      id: z.number(),
      includeX: z.boolean().default(false),
      customImageUrl: z.string().url().optional(), // user-supplied thumbnail image
    }))
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

      const profiles = await getBufferProfiles();
      const linkedInProfiles = profiles.filter((p) => p.platform === "linkedin");
      const xProfiles = profiles.filter(
        (p) => p.platform === "x"
      );

      if (linkedInProfiles.length === 0) {
        throw new Error(
          "No LinkedIn channel found in Buffer. Please connect your LinkedIn account in Buffer."
        );
      }
      // ── LinkedIn push ──────────────────────────────────────────────────────────────────
      // Post text has the URL appended; image is sent as a standalone attachment.
      const linkedInChannelIds = linkedInProfiles.map((p) => p.id);
      // Build the post text: commentary (URL-free) + article URL appended once
      // Strip any stale "Read more: URL" from older saved commentaries using simple string replace
      const cleanCommentary = article.commentary
        .split(`Read more: ${article.url}`).join('')
        .split(`Read more:${article.url}`).join('')
        .split(article.url).join('')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
      const postText = `${cleanCommentary}\n\n${article.url}`;

      // Build channelServiceMap so pushToBuffer knows which channels are LinkedIn
      // (required for the metadata.linkedin.linkAttachment block to fire)
      const linkedInServiceMap: Record<string, string> = {};
      for (const p of linkedInProfiles) {
        linkedInServiceMap[p.id] = p.service; // e.g. "linkedin"
      }

      // v142: image travels INSIDE the link card as thumbnailUrl (not as a standalone asset).
      // This avoids the LinkedIn conflict where assets.images suppresses linkAttachment.
      // Use custom image if provided, otherwise fall back to article's own imageUrl.
      const thumbnailUrl = input.customImageUrl ?? article.imageUrl ?? undefined;

      const linkedInResult = await pushToBuffer({
        text: postText,
        profileIds: linkedInChannelIds,
        platform: "linkedin",
        // No standalone imageUrl — image goes inside the link card as thumbnailUrl
        channelServiceMap: linkedInServiceMap,
        linkAsset: { url: article.url, thumbnailUrl }, // image inside link card
      });
      if (!linkedInResult.success) {
        throw new Error(linkedInResult.error ?? "LinkedIn Buffer push failed");
      }

      await database
        .update(newsfeedArticles)
        .set({ bufferSentAt: new Date() })
        .where(eq(newsfeedArticles.id, input.id));

      // ── Optional X/Twitter push ────────────────────────────────────────────
      let xPushed = false;
      let xError: string | undefined;

      if (input.includeX) {
        if (xProfiles.length === 0) {
          xError =
            "No X/Twitter channel found in Buffer. Connect your X account in Buffer to enable this.";
        } else {
          // Generate or reuse cached X version
          let xText = article.xVersion;
          if (!xText) {
            xText = await generateXVersion(article.commentary, article.url);
            await database
              .update(newsfeedArticles)
              .set({ xVersion: xText })
              .where(eq(newsfeedArticles.id, input.id));
          }

          const xChannelIds = xProfiles.map((p) => p.id);
          const xResult = await pushToBuffer({
            text: xText,
            profileIds: xChannelIds,
            platform: "x",
            // URL is embedded in xText — no separate link asset needed for X
          });

          if (xResult.success) {
            xPushed = true;
            await database
              .update(newsfeedArticles)
              .set({ xSentAt: new Date() })
              .where(eq(newsfeedArticles.id, input.id));
          } else {
            xError = xResult.error ?? "X/Twitter Buffer push failed";
          }
        }
      }

      return {
        success: true,
        bufferId: linkedInResult.bufferId,
        linkedInChannelCount: linkedInChannelIds.length,
        xPushed,
        xError,
      };
    }),

  // ── Generate / return cached X version ────────────────────────────────────
  // Called when the user opens the detail dialog and wants to preview the
  // X version before pushing. Generates and caches if not already present.
  getXVersion: protectedProcedure
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

      if (article.xVersion) return { xVersion: article.xVersion };

      const xVersion = await generateXVersion(article.commentary, article.url);
      await database
        .update(newsfeedArticles)
        .set({ xVersion })
        .where(eq(newsfeedArticles.id, input.id));

      return { xVersion };
    }),

  // ── Get topic list ─────────────────────────────────────────────────────────
  getTopics: protectedProcedure.query(() => {
    return Object.entries(TOPIC_CLUSTERS).map(([key, val]) => ({
      key,
      label: val.label,
    }));
  }),
});
