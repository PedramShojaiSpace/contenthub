/**
 * Syndication Router
 *
 * Manages the staggered multi-platform syndication pipeline:
 *   WordPress (Day 0) → Substack (Day 1) → Medium (Day 2) → Quora (Day 3)
 *
 * Flow:
 * 1. When a blog is published to WordPress, call `enqueue` to create 3 jobs.
 * 2. The Heartbeat cron at /api/scheduled/syndication runs daily at 08:00 UTC.
 * 3. Each run: finds pending jobs where scheduledAt <= now, adapts content via AI,
 *    publishes to the platform, and marks the job published/failed.
 * 4. The UI calls `listJobs` to show the syndication queue for each post.
 *
 * Substack note: The simultaneous Substack push in Step 9e of the WordPress publish
 * flow (routers.ts) has been DISABLED. Substack is now handled exclusively by this
 * pipeline with a 24-hour delay and a distinct founder letter format.
 */

import { z } from "zod";
import { router, protectedProcedure } from "./_core/trpc";
import { getDb } from "./db";
import { syndicationJobs } from "../drizzle/schema";
import { eq, and, lte, inArray } from "drizzle-orm";
import { generateSyndicationAdaptations } from "./syndicationAdapter";
import { publishToSubstack } from "./substackPublisher";
import { publishToMedium } from "./mediumPublisher";

// ─── Constants ────────────────────────────────────────────────────────────────

const DAY_MS = 24 * 60 * 60 * 1000;

// Delay offsets from WordPress publish time
const PLATFORM_DELAY: Record<string, number> = {
  substack: 1 * DAY_MS,  // Day 1
  medium:   2 * DAY_MS,  // Day 2
  quora:    3 * DAY_MS,  // Day 3
  reddit:   4 * DAY_MS,  // Day 4
};

// ─── tRPC Router ─────────────────────────────────────────────────────────────

export const syndicationRouter = router({
  /**
   * Enqueue syndication jobs for a newly published WordPress post.
   * Creates one job per platform (substack, medium, quora, reddit) with staggered scheduledAt.
   * Called automatically from the WordPress publish flow.
   */
  enqueue: protectedProcedure
    .input(z.object({
      contentItemId: z.number(),
      wordpressUrl: z.string().url(),
      wordpressTitle: z.string(),
      wordpressBodyHtml: z.string(),
      wordpressMetaDescription: z.string().optional(),
      wordpressFocusKeyword: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");

      const now = Date.now();
      const platforms = ["substack", "medium", "quora", "reddit"] as const;

      // Check for existing jobs for this content item to avoid duplicates
      const existing = await db
        .select({ platform: syndicationJobs.platform })
        .from(syndicationJobs)
        .where(eq(syndicationJobs.contentItemId, input.contentItemId));

      const existingPlatforms = new Set(existing.map((j) => j.platform));

      const toCreate = platforms.filter((p) => !existingPlatforms.has(p));

      if (toCreate.length === 0) {
        return { created: 0, message: "All syndication jobs already exist for this post" };
      }

      await db.insert(syndicationJobs).values(
        toCreate.map((platform) => ({
          contentItemId: input.contentItemId,
          wordpressUrl: input.wordpressUrl,
          wordpressTitle: input.wordpressTitle,
          wordpressBodyHtml: input.wordpressBodyHtml,
          wordpressMetaDescription: input.wordpressMetaDescription ?? null,
          wordpressFocusKeyword: input.wordpressFocusKeyword ?? null,
          platform,
          status: "pending" as const,
          scheduledAt: now + PLATFORM_DELAY[platform],
        }))
      );

      return {
        created: toCreate.length,
        message: `Enqueued ${toCreate.length} syndication jobs: ${toCreate.join(", ")}`,
        schedule: {
          substack: new Date(now + PLATFORM_DELAY.substack).toISOString(),
          medium: new Date(now + PLATFORM_DELAY.medium).toISOString(),
          quora: new Date(now + PLATFORM_DELAY.quora).toISOString(),
          reddit: new Date(now + PLATFORM_DELAY.reddit).toISOString(),
        },
      };
    }),

  /**
   * List all syndication jobs for a given content item.
   * Used by the UI to show the syndication queue panel on each blog card.
   */
  listJobs: protectedProcedure
    .input(z.object({ contentItemId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];

      return db
        .select()
        .from(syndicationJobs)
        .where(eq(syndicationJobs.contentItemId, input.contentItemId))
        .orderBy(syndicationJobs.scheduledAt);
    }),

  /**
   * List all pending syndication jobs across all posts.
   * Used by the admin dashboard to show the full queue.
   */
  listPendingJobs: protectedProcedure
    .query(async () => {
      const db = await getDb();
      if (!db) return [];

      return db
        .select()
        .from(syndicationJobs)
        .where(inArray(syndicationJobs.status, ["pending", "ready", "failed"]))
        .orderBy(syndicationJobs.scheduledAt);
    }),

  /**
   * Manually skip a syndication job (e.g. user decides not to publish to Medium).
   */
  skipJob: protectedProcedure
    .input(z.object({ jobId: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");

      await db
        .update(syndicationJobs)
        .set({ status: "skipped", updatedAt: new Date() })
        .where(eq(syndicationJobs.id, input.jobId));

      return { ok: true };
    }),

  /**
   * Manually retry a failed syndication job.
   */
  retryJob: protectedProcedure
    .input(z.object({ jobId: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");

      await db
        .update(syndicationJobs)
        .set({
          status: "pending",
          errorMessage: null,
          scheduledAt: Date.now(), // Retry immediately
          updatedAt: new Date(),
        })
        .where(and(
          eq(syndicationJobs.id, input.jobId),
          eq(syndicationJobs.status, "failed")
        ));

      return { ok: true };
    }),

  /**
   * Preview the AI-adapted content for a job without publishing.
   * Generates the adaptation and stores it as status=ready.
   */
  previewAdaptation: protectedProcedure
    .input(z.object({ jobId: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");

      const [job] = await db
        .select()
        .from(syndicationJobs)
        .where(eq(syndicationJobs.id, input.jobId))
        .limit(1);

      if (!job) throw new Error("Job not found");
      if (!job.wordpressBodyHtml) throw new Error("WordPress content not available for this job");

      // Generate all three adaptations (we only use the one for this platform)
      const adaptations = await generateSyndicationAdaptations({
        title: job.wordpressTitle,
        slug: job.wordpressUrl.split("/").filter(Boolean).pop() ?? "",
        wordpressUrl: job.wordpressUrl,
        bodyHtml: job.wordpressBodyHtml,
        metaDescription: job.wordpressMetaDescription ?? undefined,
        focusKeyword: job.wordpressFocusKeyword ?? undefined,
      });

      const platformContent = adaptations[job.platform as keyof typeof adaptations];

      await db
        .update(syndicationJobs)
        .set({
          status: "ready",
          adaptedContent: JSON.stringify(platformContent),
          updatedAt: new Date(),
        })
        .where(eq(syndicationJobs.id, input.jobId));

      return { ok: true, content: platformContent };
    }),

  /**
   * List all VA-actionable jobs: manual platforms (quora, reddit, medium).
   * "published" means the cron has processed them and the content is ready to post manually.
   */
  listVaJobs: protectedProcedure
    .query(async () => {
      const db = await getDb();
      if (!db) return [];
      const jobs = await db
        .select()
        .from(syndicationJobs)
        .where(
          inArray(syndicationJobs.platform, ["medium", "quora", "reddit"])
        )
        .orderBy(syndicationJobs.scheduledAt);
      return jobs;
    }),

  /**
   * Mark a VA job as manually posted.
   */
  markVaJobPosted: protectedProcedure
    .input(z.object({
      jobId: z.number(),
      publishedUrl: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      await db
        .update(syndicationJobs)
        .set({
          status: "published",
          publishedUrl: input.publishedUrl ?? null,
          updatedAt: new Date(),
        })
        .where(eq(syndicationJobs.id, input.jobId));
      return { ok: true };
    }),
});

// ─── Heartbeat Cron Handler ───────────────────────────────────────────────────
// Called by the Manus Heartbeat cron at /api/scheduled/syndication
// Runs daily at 08:00 UTC. Processes all pending jobs where scheduledAt <= now.

export async function handleSyndicationCron(req: {
  headers: Record<string, string | string[] | undefined>;
}): Promise<{ processed: number; results: Array<{ jobId: number; platform: string; status: string; url?: string; error?: string }> }> {
  const db = await getDb();
  if (!db) {
    console.error("[Syndication Cron] Database unavailable");
    return { processed: 0, results: [] };
  }

  const now = Date.now();

  // Find all pending jobs that are due
  const dueJobs = await db
    .select()
    .from(syndicationJobs)
    .where(and(
      eq(syndicationJobs.status, "pending"),
      lte(syndicationJobs.scheduledAt, now)
    ));

  if (dueJobs.length === 0) {
    console.log("[Syndication Cron] No pending jobs due");
    return { processed: 0, results: [] };
  }

  console.log(`[Syndication Cron] Processing ${dueJobs.length} due jobs`);
  const results: Array<{ jobId: number; platform: string; status: string; url?: string; error?: string }> = [];

  for (const job of dueJobs) {
    try {
      // Mark as adapting
      await db
        .update(syndicationJobs)
        .set({ status: "adapting", updatedAt: new Date() })
        .where(eq(syndicationJobs.id, job.id));

      // Generate adaptations if not already done
      let adaptedContent = job.adaptedContent ? JSON.parse(job.adaptedContent) : null;

      if (!adaptedContent) {
        if (!job.wordpressBodyHtml) {
          throw new Error("WordPress body HTML not available — cannot adapt content");
        }

        const adaptations = await generateSyndicationAdaptations({
          title: job.wordpressTitle,
          slug: job.wordpressUrl.split("/").filter(Boolean).pop() ?? "",
          wordpressUrl: job.wordpressUrl,
          bodyHtml: job.wordpressBodyHtml,
          metaDescription: job.wordpressMetaDescription ?? undefined,
          focusKeyword: job.wordpressFocusKeyword ?? undefined,
        });

        adaptedContent = adaptations[job.platform as keyof typeof adaptations];

        // Store adapted content
        await db
          .update(syndicationJobs)
          .set({ adaptedContent: JSON.stringify(adaptedContent), updatedAt: new Date() })
          .where(eq(syndicationJobs.id, job.id));
      }

      // Publish to platform
      let publishedUrl: string | undefined;
      let publishedPostId: string | undefined;

      if (job.platform === "substack") {
        const result = await publishToSubstack({
          title: adaptedContent.title,
          bodyHtml: adaptedContent.bodyHtml,
          subtitle: adaptedContent.subtitle,
          sendEmail: true,
        });
        publishedUrl = result.postUrl;
        publishedPostId = result.postId;

      } else if (job.platform === "medium") {
        const result = await publishToMedium({
          title: adaptedContent.title,
          bodyMarkdown: adaptedContent.bodyMarkdown,
          canonicalUrl: adaptedContent.canonicalUrl,
          tags: ["health", "wellness", "gut health", "functional medicine", "urban monk"],
        });
        publishedUrl = result.postUrl;
        publishedPostId = result.postId;

      } else if (job.platform === "quora") {
        // Quora has no publish API — we store the adapted answer for manual posting
        // and mark it as "published" (meaning: ready for the team to post manually)
        publishedUrl = undefined;
        publishedPostId = undefined;
        console.log(`[Syndication Cron] Quora answer ready for manual posting. Question: "${adaptedContent.targetQuestion}"`);
      } else if (job.platform === "reddit") {
        // Reddit has no publish API for organic posts — we store the adapted post for manual posting
        // and mark it as "published" (meaning: ready for the VA to post manually)
        publishedUrl = undefined;
        publishedPostId = undefined;
        console.log(`[Syndication Cron] Reddit post ready for manual posting. Suggested subreddits: ${(adaptedContent.suggestedSubreddits ?? []).join(", ")}`);
      }

      // Mark as published
      await db
        .update(syndicationJobs)
        .set({
          status: "published",
          publishedUrl: publishedUrl ?? null,
          publishedPostId: publishedPostId ?? null,
          errorMessage: null,
          updatedAt: new Date(),
        })
        .where(eq(syndicationJobs.id, job.id));

      results.push({
        jobId: job.id,
        platform: job.platform,
        status: "published",
        url: publishedUrl,
      });

      console.log(`[Syndication Cron] ✓ ${job.platform} job ${job.id} published: ${publishedUrl ?? "(manual)"}`);

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      const retryCount = (job.retryCount ?? 0) + 1;

      // After 3 retries, mark as permanently failed
      const newStatus = retryCount >= 3 ? "failed" : "pending";
      const nextScheduledAt = newStatus === "pending"
        ? Date.now() + (60 * 60 * 1000) // retry in 1 hour
        : job.scheduledAt;

      await db
        .update(syndicationJobs)
        .set({
          status: newStatus as "failed" | "pending",
          errorMessage,
          retryCount,
          scheduledAt: nextScheduledAt,
          updatedAt: new Date(),
        })
        .where(eq(syndicationJobs.id, job.id));

      results.push({
        jobId: job.id,
        platform: job.platform,
        status: newStatus,
        error: errorMessage,
      });

      console.error(`[Syndication Cron] ✗ ${job.platform} job ${job.id} failed (attempt ${retryCount}): ${errorMessage}`);
    }
  }

  return { processed: dueJobs.length, results };
}

// ─── VA Dashboard Procedure ───────────────────────────────────────────────────
// Export a separate function so it can be imported by syndicationRouter
