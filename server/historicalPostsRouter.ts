/**
 * historicalPostsRouter.ts
 *
 * Historical WordPress Post Rehabilitation workflow.
 *
 * Phases:
 * 1. Import — pull historical WP posts into contentItems as published blog entries
 * 2. Audit  — fetch live Yoast scores + AI-generate suggested SEO fields
 * 3. Fix    — push AI-generated Yoast fields back to WordPress
 * 4. CTA    — inject a topic-matched CTA block into the post HTML and push back
 * 5. Batch  — run the full pipeline across all imported posts in sequence
 */

import { z } from "zod";
import { router, protectedProcedure } from "./_core/trpc";
import { getDb } from "./db";
import { invokeLLM } from "./_core/llm";
import {
  fetchAllWpPosts,
  fetchSingleWpPost,
  updateWpPostYoast,
  updateWpPostContent,
  getWpYoastScore,
} from "./wordpress";
import { appendUtmToCtaUrl } from "./ctaRouter";

// ─── Types ────────────────────────────────────────────────────────────────────

type RehabStatus = "imported" | "yoast_fixed" | "cta_injected";

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Inject a CTA block into a WordPress HTML body.
 * Strategy: insert just before the FAQ section (<h2>Frequently Asked Questions</h2>)
 * or, if no FAQ, before the last <h2> section, or at the end of the body.
 */
function injectCtaIntoHtml(html: string, ctaHtml: string): string {
  // Try to find FAQ heading (various capitalizations)
  const faqRegex = /<h2[^>]*>[\s\S]*?[Ff]requently\s+[Aa]sked[\s\S]*?<\/h2>/i;
  const faqMatch = faqRegex.exec(html);
  if (faqMatch) {
    const idx = faqMatch.index;
    return html.slice(0, idx) + "\n\n" + ctaHtml + "\n\n" + html.slice(idx);
  }

  // Fall back: find the last <h2> and insert before it
  const h2Regex = /<h2[^>]*>/gi;
  let lastH2Match: RegExpExecArray | null = null;
  let m: RegExpExecArray | null;
  while ((m = h2Regex.exec(html)) !== null) {
    lastH2Match = m;
  }
  if (lastH2Match) {
    const idx = lastH2Match.index;
    return html.slice(0, idx) + "\n\n" + ctaHtml + "\n\n" + html.slice(idx);
  }

  // Last resort: append at end
  return html + "\n\n" + ctaHtml;
}

/**
 * Build the HTML for a CTA block to inject into a blog post.
 */
function buildCtaHtml(params: {
  ctaText: string;
  url: string;
  label: string;
}): string {
  const { ctaText, url, label } = params;
  // Clean CTA text to plain paragraphs (strip any existing HTML)
  const cleanText = ctaText.replace(/<[^>]+>/g, "").trim();
  return `<div class="um-cta-block" style="background:#f9f5ef;border-left:4px solid #c8a96e;padding:24px 28px;margin:32px 0;border-radius:4px;">
<p style="margin:0 0 12px;font-size:1.05em;line-height:1.6;">${cleanText}</p>
<a href="${url}" style="display:inline-block;background:#c8a96e;color:#fff;padding:10px 22px;border-radius:4px;text-decoration:none;font-weight:600;">${label}</a>
</div>`;
}

// ─── Router ───────────────────────────────────────────────────────────────────

export const historicalPostsRouter = router({

  /**
   * List all WP posts from wpPostIndex that have NOT yet been imported
   * (rehabStatus is null or missing). Supports search and pagination.
   */
  listUnimported: protectedProcedure
    .input(z.object({
      search: z.string().optional(),
      page: z.number().default(1),
      pageSize: z.number().default(50),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      const { wpPostIndex } = await import("../drizzle/schema");
      const { isNull, like, or, and } = await import("drizzle-orm");

      const where = and(
        isNull(wpPostIndex.rehabStatus),
        input.search
          ? or(
              like(wpPostIndex.title, `%${input.search}%`),
              like(wpPostIndex.slug, `%${input.search}%`),
            )
          : undefined,
      );

      const rows = await db
        .select()
        .from(wpPostIndex)
        .where(where)
        .orderBy(wpPostIndex.publishedAt)
        .limit(input.pageSize)
        .offset((input.page - 1) * input.pageSize);

      const total = await db
        .select({ id: wpPostIndex.id })
        .from(wpPostIndex)
        .where(where);

      return { posts: rows, total: total.length };
    }),

  /**
   * List all imported historical posts (rehabStatus is not null).
   * Returns the full row including audit/fix status.
   */
  listImported: protectedProcedure
    .input(z.object({
      search: z.string().optional(),
      status: z.enum(["imported", "yoast_fixed", "cta_injected", "all"]).default("all"),
      page: z.number().default(1),
      pageSize: z.number().default(50),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      const { wpPostIndex } = await import("../drizzle/schema");
      const { isNotNull, like, or, and, eq, desc } = await import("drizzle-orm");

      const conditions = [isNotNull(wpPostIndex.rehabStatus)];
      if (input.status !== "all") {
        conditions.push(eq(wpPostIndex.rehabStatus, input.status));
      }
      if (input.search) {
        conditions.push(
          or(
            like(wpPostIndex.title, `%${input.search}%`),
            like(wpPostIndex.slug, `%${input.search}%`),
          ) as ReturnType<typeof like>,
        );
      }

      const where = and(...conditions);

      const rows = await db
        .select()
        .from(wpPostIndex)
        .where(where)
        .orderBy(desc(wpPostIndex.syncedAt))
        .limit(input.pageSize)
        .offset((input.page - 1) * input.pageSize);

      const total = await db
        .select({ id: wpPostIndex.id })
        .from(wpPostIndex)
        .where(where);

      return { posts: rows, total: total.length };
    }),

  /**
   * Import selected WP posts into the content hub.
   * Creates a contentItems row for each post and marks rehabStatus = "imported".
   */
  importPosts: protectedProcedure
    .input(z.object({
      wpPostIds: z.array(z.number()).min(1).max(100),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      const { wpPostIndex, contentItems } = await import("../drizzle/schema");
      const { eq, inArray } = await import("drizzle-orm");

      // Fetch the selected rows from wpPostIndex
      const rows = await db
        .select()
        .from(wpPostIndex)
        .where(inArray(wpPostIndex.wpPostId, input.wpPostIds));

      const results: Array<{ wpPostId: number; title: string; contentItemId: number | null; status: "created" | "already_imported" | "error"; error?: string }> = [];

      for (const row of rows) {
        // Skip if already imported
        if (row.rehabStatus) {
          results.push({ wpPostId: row.wpPostId, title: row.title, contentItemId: row.contentItemId, status: "already_imported" });
          continue;
        }

        try {
          // Create a contentItems row
          const [inserted] = await db.insert(contentItems).values({
            title: row.title,
            platform: "blog",
            status: "published",
            wpPostId: row.wpPostId,
            publishUrl: row.url,
            notes: `Imported from WordPress on ${new Date().toISOString().slice(0, 10)}. Historical post rehabilitation.`,
            focusKeyword: null,
            yoastSeoTitle: null,
            yoastMetaDescription: null,
          });

          // Get the inserted ID
          const [newItem] = await db
            .select({ id: contentItems.id })
            .from(contentItems)
            .where(eq(contentItems.wpPostId, row.wpPostId))
            .limit(1);

          const newId = newItem?.id ?? null;

          // Update wpPostIndex row
          await db
            .update(wpPostIndex)
            .set({
              rehabStatus: "imported" as RehabStatus,
              contentItemId: newId,
              syncedAt: new Date(),
            })
            .where(eq(wpPostIndex.wpPostId, row.wpPostId));

          results.push({ wpPostId: row.wpPostId, title: row.title, contentItemId: newId, status: "created" });
        } catch (err) {
          results.push({ wpPostId: row.wpPostId, title: row.title, contentItemId: null, status: "error", error: String(err) });
        }
      }

      const created = results.filter(r => r.status === "created").length;
      return { results, created, message: `Imported ${created} of ${input.wpPostIds.length} posts.` };
    }),

  /**
   * Audit a single imported post: fetch live Yoast score from WP + AI-generate
   * suggested focus keyword, SEO title, and meta description.
   * Stores suggestions in wpPostIndex for preview before pushing.
   */
  auditPost: protectedProcedure
    .input(z.object({ wpPostId: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      const { wpPostIndex } = await import("../drizzle/schema");
      const { eq } = await import("drizzle-orm");

      // Fetch live Yoast score
      const yoastScores = await getWpYoastScore(input.wpPostId);

      // Fetch full post content for AI analysis
      const livePost = await fetchSingleWpPost(input.wpPostId);
      const htmlBody = livePost.content;

      // Strip HTML tags for LLM input (keep first 3000 chars to stay within token budget)
      const plainText = htmlBody
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 3000);

      // Fetch the wpPostIndex row for title
      const [row] = await db
        .select()
        .from(wpPostIndex)
        .where(eq(wpPostIndex.wpPostId, input.wpPostId))
        .limit(1);

      if (!row) throw new Error(`Post ${input.wpPostId} not found in wpPostIndex`);

      // AI-generate Yoast suggestions
      const aiResponse = await invokeLLM({
        messages: [
          {
            role: "system",
            content: `You are an SEO expert for The Urban Monk (theurbanmonk.com), Dr. Pedram Shojai's health and wellness blog. You generate Yoast SEO fields that maximize organic search performance.

Rules:
- Focus keyword: a specific long-tail phrase (3-5 words) that appears naturally in the content. Must be something real people search for.
- SEO title: 48 characters or fewer. Include the focus keyword. End with " | The Urban Monk" if it fits.
- Meta description: EXACTLY 140-150 characters. Must contain the focus keyword. Must be compelling and click-worthy.

Output JSON only, no explanation:
{"focusKeyword": "...", "seoTitle": "...", "metaDescription": "..."}`,
          },
          {
            role: "user",
            content: `Post title: ${row.title}\n\nPost content (first 3000 chars):\n${plainText}`,
          },
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "yoast_suggestions",
            strict: true,
            schema: {
              type: "object",
              properties: {
                focusKeyword: { type: "string" },
                seoTitle: { type: "string" },
                metaDescription: { type: "string" },
              },
              required: ["focusKeyword", "seoTitle", "metaDescription"],
              additionalProperties: false,
            },
          },
        },
      });

      let suggestions: { focusKeyword: string; seoTitle: string; metaDescription: string } | null = null;
      try {
        const raw = aiResponse.choices?.[0]?.message?.content ?? "{}";
        suggestions = typeof raw === "string" ? JSON.parse(raw) : raw;
      } catch {
        // Non-fatal — suggestions will be null
      }

      // Store in wpPostIndex
      await db
        .update(wpPostIndex)
        .set({
          yoastScore: yoastScores.seoScore ?? undefined,
          yoastAuditedAt: Date.now(),
          suggestedFocusKeyword: suggestions?.focusKeyword ?? undefined,
          suggestedSeoTitle: suggestions?.seoTitle ?? undefined,
          suggestedMetaDescription: suggestions?.metaDescription ?? undefined,
        })
        .where(eq(wpPostIndex.wpPostId, input.wpPostId));

      return {
        wpPostId: input.wpPostId,
        yoastScore: yoastScores.seoScore,
        readabilityScore: yoastScores.readabilityScore,
        currentFocusKeyword: livePost.focusKeyword,
        currentSeoTitle: livePost.seoTitle,
        currentMetaDescription: livePost.metaDescription,
        suggestions,
      };
    }),

  /**
   * Push AI-generated (or manually edited) Yoast fields to WordPress for a single post.
   * Updates both wpPostIndex and contentItems with the new values.
   */
  fixYoast: protectedProcedure
    .input(z.object({
      wpPostId: z.number(),
      focusKeyword: z.string(),
      seoTitle: z.string(),
      metaDescription: z.string(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      const { wpPostIndex, contentItems } = await import("../drizzle/schema");
      const { eq } = await import("drizzle-orm");

      // Push to WordPress
      const result = await updateWpPostYoast({
        wpPostId: input.wpPostId,
        focusKeyword: input.focusKeyword,
        seoTitle: input.seoTitle,
        metaDescription: input.metaDescription,
      });

      const now = Date.now();

      // Update wpPostIndex
      await db
        .update(wpPostIndex)
        .set({
          rehabStatus: "yoast_fixed",
          yoastAuditedAt: now,
        })
        .where(eq(wpPostIndex.wpPostId, input.wpPostId));

      // Update contentItems if linked
      const [row] = await db
        .select({ contentItemId: wpPostIndex.contentItemId })
        .from(wpPostIndex)
        .where(eq(wpPostIndex.wpPostId, input.wpPostId))
        .limit(1);

      if (row?.contentItemId) {
        await db
          .update(contentItems)
          .set({
            focusKeyword: input.focusKeyword,
            yoastSeoTitle: input.seoTitle,
            yoastMetaDescription: input.metaDescription,
            yoastFixedAt: now,
          })
          .where(eq(contentItems.id, row.contentItemId));
      }

      return { success: result.success, wpPostId: input.wpPostId, snippetInstalled: result.snippetInstalled };
    }),

  /**
   * Inject a CTA block into a post's HTML body and push the updated content to WordPress.
   * Picks the best matching CTA block from ctaBlocks based on the post's topicCluster.
   * Falls back to the default CTA block if no topic match is found.
   */
  injectCta: protectedProcedure
    .input(z.object({
      wpPostId: z.number(),
      ctaBlockId: z.number().optional(), // if not provided, auto-selects by topic
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      const { wpPostIndex, ctaBlocks } = await import("../drizzle/schema");
      const { eq, or, isNull } = await import("drizzle-orm");

      // Fetch the wpPostIndex row
      const [row] = await db
        .select()
        .from(wpPostIndex)
        .where(eq(wpPostIndex.wpPostId, input.wpPostId))
        .limit(1);

      if (!row) throw new Error(`Post ${input.wpPostId} not found in wpPostIndex`);

      // Select CTA block
      let ctaBlock: typeof ctaBlocks.$inferSelect | null = null;

      if (input.ctaBlockId) {
        const [found] = await db
          .select()
          .from(ctaBlocks)
          .where(eq(ctaBlocks.id, input.ctaBlockId))
          .limit(1);
        ctaBlock = found ?? null;
      }

      if (!ctaBlock && row.topicCluster) {
        // Try to match by topic keyword
        const allBlocks = await db
          .select()
          .from(ctaBlocks)
          .where(eq(ctaBlocks.active, true));

        const clusterLower = row.topicCluster.toLowerCase();
        ctaBlock = allBlocks.find(b => {
          if (!b.topic) return false;
          return clusterLower.includes(b.topic.toLowerCase()) || b.topic.toLowerCase().includes(clusterLower.split(" ")[0]);
        }) ?? null;

        // Fall back to default
        if (!ctaBlock) {
          ctaBlock = allBlocks.find(b => b.isDefault) ?? allBlocks[0] ?? null;
        }
      }

      if (!ctaBlock) {
        // Hard-coded fallback CTA
        ctaBlock = {
          id: 0,
          label: "Urban Monk Academy",
          topic: "general",
          ctaText: "Want to go deeper? The Urban Monk Academy gives you Dr. Pedram Shojai's complete system for energy, sleep, gut health, and longevity — all in one place.",
          url: "https://theurbanmonk.com/urban-monk-academy",
          keywords: null,
          isDefault: true,
          active: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
      }

      // Build UTM-tagged URL
      const utmUrl = appendUtmToCtaUrl(ctaBlock.url ?? null, "blog", "historical-rehab", "inline-cta");

      // Build CTA HTML
      const ctaHtml = buildCtaHtml({
        ctaText: ctaBlock.ctaText,
        url: utmUrl,
        label: ctaBlock.label,
      });

      // Fetch current post HTML
      const livePost = await fetchSingleWpPost(input.wpPostId);
      const updatedHtml = injectCtaIntoHtml(livePost.content, ctaHtml);

      // Push updated content to WordPress
      await updateWpPostContent(input.wpPostId, updatedHtml);

      // Update wpPostIndex
      await db
        .update(wpPostIndex)
        .set({
          rehabStatus: "cta_injected",
          ctaInjectedAt: Date.now(),
        })
        .where(eq(wpPostIndex.wpPostId, input.wpPostId));

      return {
        wpPostId: input.wpPostId,
        ctaBlockUsed: ctaBlock.label,
        ctaUrl: utmUrl,
        success: true,
      };
    }),

  /**
   * Batch fix: run the full pipeline (audit → fix Yoast → inject CTA) across
   * all imported posts that haven't been fully rehabilitated yet.
   * Processes posts sequentially to avoid rate-limiting WordPress.
   * Returns per-post results with status.
   */
  batchFix: protectedProcedure
    .input(z.object({
      limit: z.number().default(20),  // max posts to process in one call
      skipCta: z.boolean().default(false),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      const { wpPostIndex } = await import("../drizzle/schema");
      const { isNotNull, ne, or, and, eq } = await import("drizzle-orm");

      // Find imported posts that are NOT yet fully rehabilitated
      const posts = await db
        .select()
        .from(wpPostIndex)
        .where(
          and(
            isNotNull(wpPostIndex.rehabStatus),
            or(
              eq(wpPostIndex.rehabStatus, "imported"),
              eq(wpPostIndex.rehabStatus, "yoast_fixed"),
            ),
          ),
        )
        .limit(input.limit);

      type BatchResult = {
        wpPostId: number;
        title: string;
        status: "fixed" | "cta_injected" | "skipped" | "error";
        steps: string[];
        error?: string;
      };

      const results: BatchResult[] = [];

      for (const row of posts) {
        const steps: string[] = [];
        try {
          // Step 1: Audit (generate AI suggestions if not already done)
          let focusKw = row.suggestedFocusKeyword;
          let seoTitle = row.suggestedSeoTitle;
          let metaDesc = row.suggestedMetaDescription;

          if (!focusKw || !seoTitle || !metaDesc) {
            // Fetch post content
            const livePost = await fetchSingleWpPost(row.wpPostId);
            const plainText = livePost.content
              .replace(/<[^>]+>/g, " ")
              .replace(/\s+/g, " ")
              .trim()
              .slice(0, 3000);

            const aiResponse = await invokeLLM({
              messages: [
                {
                  role: "system",
                  content: `You are an SEO expert for The Urban Monk (theurbanmonk.com). Generate Yoast SEO fields.
Output JSON only: {"focusKeyword": "...", "seoTitle": "...", "metaDescription": "..."}
Rules: focusKeyword = 3-5 word long-tail phrase; seoTitle ≤ 48 chars; metaDescription = 140-150 chars containing the focus keyword.`,
                },
                {
                  role: "user",
                  content: `Post title: ${row.title}\n\nContent:\n${plainText}`,
                },
              ],
              response_format: {
                type: "json_schema",
                json_schema: {
                  name: "yoast_suggestions",
                  strict: true,
                  schema: {
                    type: "object",
                    properties: {
                      focusKeyword: { type: "string" },
                      seoTitle: { type: "string" },
                      metaDescription: { type: "string" },
                    },
                    required: ["focusKeyword", "seoTitle", "metaDescription"],
                    additionalProperties: false,
                  },
                },
              },
            });

            const raw = aiResponse.choices?.[0]?.message?.content ?? "{}";
            const suggestions = typeof raw === "string" ? JSON.parse(raw) : raw;
            focusKw = suggestions.focusKeyword;
            seoTitle = suggestions.seoTitle;
            metaDesc = suggestions.metaDescription;

            // Store suggestions
            await db
              .update(wpPostIndex)
              .set({
                suggestedFocusKeyword: focusKw ?? undefined,
                suggestedSeoTitle: seoTitle ?? undefined,
                suggestedMetaDescription: metaDesc ?? undefined,
                yoastAuditedAt: Date.now(),
              })
              .where(eq(wpPostIndex.wpPostId, row.wpPostId));

            steps.push("ai_audit");
          }

          // Step 2: Fix Yoast (if not already done)
          if (row.rehabStatus === "imported" && focusKw && seoTitle && metaDesc) {
            await updateWpPostYoast({
              wpPostId: row.wpPostId,
              focusKeyword: focusKw,
              seoTitle: seoTitle,
              metaDescription: metaDesc,
            });

            await db
              .update(wpPostIndex)
              .set({ rehabStatus: "yoast_fixed" })
              .where(eq(wpPostIndex.wpPostId, row.wpPostId));

            // Update contentItems if linked
            if (row.contentItemId) {
              const { contentItems } = await import("../drizzle/schema");
              await db
                .update(contentItems)
                .set({
                  focusKeyword: focusKw,
                  yoastSeoTitle: seoTitle,
                  yoastMetaDescription: metaDesc,
                  yoastFixedAt: Date.now(),
                })
                .where(eq(contentItems.id, row.contentItemId));
            }

            steps.push("yoast_fixed");
          }

          // Step 3: Inject CTA (if not skipped and not already done)
          if (!input.skipCta && row.rehabStatus !== "cta_injected") {
            // Auto-select CTA block by topic
            const { ctaBlocks } = await import("../drizzle/schema");
            const allBlocks = await db
              .select()
              .from(ctaBlocks)
              .where(eq(ctaBlocks.active, true));

            let ctaBlock = allBlocks.find(b => {
              if (!b.topic || !row.topicCluster) return false;
              const cl = row.topicCluster.toLowerCase();
              return cl.includes(b.topic.toLowerCase()) || b.topic.toLowerCase().includes(cl.split(" ")[0]);
            }) ?? allBlocks.find(b => b.isDefault) ?? allBlocks[0] ?? null;

            if (ctaBlock) {
              const utmUrl = appendUtmToCtaUrl(ctaBlock.url ?? null, "blog", "historical-rehab", "inline-cta");
              const ctaHtml = buildCtaHtml({ ctaText: ctaBlock.ctaText, url: utmUrl, label: ctaBlock.label });
              const livePost = await fetchSingleWpPost(row.wpPostId);
              const updatedHtml = injectCtaIntoHtml(livePost.content, ctaHtml);
              await updateWpPostContent(row.wpPostId, updatedHtml);

              await db
                .update(wpPostIndex)
                .set({ rehabStatus: "cta_injected", ctaInjectedAt: Date.now() })
                .where(eq(wpPostIndex.wpPostId, row.wpPostId));

              steps.push("cta_injected");
              results.push({ wpPostId: row.wpPostId, title: row.title, status: "cta_injected", steps });
            } else {
              results.push({ wpPostId: row.wpPostId, title: row.title, status: "fixed", steps });
            }
          } else {
            results.push({ wpPostId: row.wpPostId, title: row.title, status: "fixed", steps });
          }

          // Small delay to avoid hammering WordPress
          await new Promise(resolve => setTimeout(resolve, 500));

        } catch (err) {
          results.push({
            wpPostId: row.wpPostId,
            title: row.title,
            status: "error",
            steps,
            error: String(err),
          });
        }
      }

      const fixed = results.filter(r => r.status === "fixed" || r.status === "cta_injected").length;
      const errors = results.filter(r => r.status === "error").length;

      return {
        processed: results.length,
        fixed,
        errors,
        results,
        message: `Processed ${results.length} posts: ${fixed} fixed, ${errors} errors.`,
      };
    }),

  /**
   * Get summary stats for the rehabilitation dashboard.
   */
  getStats: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return { total: 0, unimported: 0, imported: 0, yoastFixed: 0, ctaInjected: 0 };
    const { wpPostIndex } = await import("../drizzle/schema");
    const { isNull, eq, isNotNull } = await import("drizzle-orm");

    const all = await db.select({ rehabStatus: wpPostIndex.rehabStatus }).from(wpPostIndex);
    const total = all.length;
    const unimported = all.filter(r => !r.rehabStatus).length;
    const imported = all.filter(r => r.rehabStatus === "imported").length;
    const yoastFixed = all.filter(r => r.rehabStatus === "yoast_fixed").length;
    const ctaInjected = all.filter(r => r.rehabStatus === "cta_injected").length;

    return { total, unimported, imported, yoastFixed, ctaInjected };
  }),

  /**
   * List all active CTA blocks for the CTA picker in the UI.
   */
  listCtaBlocks: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];
    const { ctaBlocks } = await import("../drizzle/schema");
    const { eq } = await import("drizzle-orm");
    return db.select().from(ctaBlocks).where(eq(ctaBlocks.active, true));
  }),
});
