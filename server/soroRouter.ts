import { z } from "zod";
import { protectedProcedure, router } from "./_core/trpc";
import { getDb } from "./db";
import { invokeLLM } from "./_core/llm";
import { TRPCError } from "@trpc/server";

const WP_BASE = "https://www.theurbanmonk.com/wp-json/wp/v2";
const WP_USER = process.env.WORDPRESS_USERNAME || "";
const WP_PASS = process.env.WORDPRESS_APP_PASSWORD || "";
const WP_AUTH = Buffer.from(`${WP_USER}:${WP_PASS}`).toString("base64");

// Category map for auto-assignment
const CATEGORY_MAP: Record<string, number> = {
  "health and wellness": 19,
  "wellness": 19,
  "gut health": 1782,
  "gut health & digestion": 1782,
  "meditation": 48,
  "mindfulness": 754,
  "mindfulness & meditation": 1788,
  "sleep": 403,
  "sleep & recovery": 1793,
  "mental health": 718,
  "fitness": 159,
  "diet and nutrition": 637,
  "personal goals": 260,
  "relationships": 720,
  "stress & mental wellness": 1823,
  "natural remedies": 757,
  "eco news": 64,
};

async function fetchWpPosts(page = 1, perPage = 20) {
  const url = `${WP_BASE}/posts?per_page=${perPage}&page=${page}&orderby=date&order=desc&_fields=id,title,slug,date,status,categories,tags,featured_media,excerpt,content,meta,yoast_head_json,author`;
  const res = await fetch(url, {
    headers: { Authorization: `Basic ${WP_AUTH}` },
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) throw new Error(`WP API error: ${res.status}`);
  const totalPages = parseInt(res.headers.get("X-WP-TotalPages") || "1");
  const posts = await res.json() as any[];
  return { posts, totalPages };
}

async function analyzePostWithAI(post: any) {
  const contentText = post.content?.rendered?.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 3000) || "";
  const wordCount = contentText.split(/\s+/).filter(Boolean).length;

  const prompt = `You are an expert SEO and content strategist analyzing a blog post published on The Urban Monk website (theurbanmonk.com), a functional medicine and personal development brand by Dr. Pedram Shojai.

POST DETAILS:
Title: ${post.title?.rendered || ""}
Slug: ${post.slug}
Meta Description: ${post.yoast_head_json?.description || "none"}
Word Count: ~${wordCount}
Current Categories: ${JSON.stringify(post.categories)}
Current Tags: ${JSON.stringify(post.tags)}
Content Preview: ${contentText.slice(0, 1500)}

AVAILABLE CATEGORIES (use exact IDs):
- 19: Health and Wellness
- 1782: Gut Health & Digestion  
- 48: Meditation
- 754: Mindfulness
- 1788: Mindfulness & Meditation
- 403: Sleep
- 1793: Sleep & Recovery
- 718: Mental Health
- 637: Diet and Nutrition
- 260: Personal Goals
- 720: Relationships
- 1823: Stress & Mental Wellness
- 757: Natural Remedies
- 159: Fitness

Analyze this post and respond with JSON:
{
  "suggested_category_ids": [array of 2-3 most relevant category IDs from the list above],
  "suggested_tags": [array of 5-8 specific keyword tags as strings],
  "is_uncategorized": boolean (true if current categories is [1] only),
  "seo_score": "excellent|good|needs_work|poor",
  "readability_score": "excellent|good|needs_work|poor",
  "best_practices_found": [array of strings - what Soro did well],
  "best_practices_missing": [array of strings - what could be improved],
  "enhancement_suggestions": "2-3 sentence summary of how to improve this post",
  "lessons_for_content_hub": "1-2 sentence insight about what we can learn from this post's approach",
  "primary_keyword": "the main keyword this post targets"
}`;

  const response = await invokeLLM({
    messages: [
      { role: "system", content: "You are an expert SEO content analyst. Always respond with valid JSON only." },
      { role: "user", content: prompt },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "post_analysis",
        strict: true,
        schema: {
          type: "object",
          properties: {
            suggested_category_ids: { type: "array", items: { type: "number" } },
            suggested_tags: { type: "array", items: { type: "string" } },
            is_uncategorized: { type: "boolean" },
            seo_score: { type: "string" },
            readability_score: { type: "string" },
            best_practices_found: { type: "array", items: { type: "string" } },
            best_practices_missing: { type: "array", items: { type: "string" } },
            enhancement_suggestions: { type: "string" },
            lessons_for_content_hub: { type: "string" },
            primary_keyword: { type: "string" },
          },
          required: ["suggested_category_ids", "suggested_tags", "is_uncategorized", "seo_score", "readability_score", "best_practices_found", "best_practices_missing", "enhancement_suggestions", "lessons_for_content_hub", "primary_keyword"],
          additionalProperties: false,
        },
      },
    },
  });

  const content = response.choices?.[0]?.message?.content;
  return JSON.parse(typeof content === "string" ? content : JSON.stringify(content));
}

async function fixPostCategories(wpPostId: number, categoryIds: number[]) {
  const url = `${WP_BASE}/posts/${wpPostId}`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Basic ${WP_AUTH}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ categories: categoryIds }),
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`WP update failed: ${res.status} ${await res.text()}`);
  return await res.json();
}

export const soroRouter = router({
  // Sync recent posts from WordPress
  syncPosts: protectedProcedure
    .input(z.object({ pages: z.number().min(1).max(5).default(2) }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      let synced = 0;
      let newPosts = 0;

      for (let page = 1; page <= input.pages; page++) {
        const { posts } = await fetchWpPosts(page, 20);

        for (const post of posts) {
          if (post.status !== "publish") continue;

          const contentHtml = post.content?.rendered || "";
          const contentText = contentHtml.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
          const wordCount = contentText.split(/\s+/).filter(Boolean).length;
          const isUncategorized = post.categories?.length === 1 && post.categories[0] === 1;
          const hasMetaDesc = !!post.yoast_head_json?.description;
          const hasFeaturedImage = post.featured_media > 0;

          // Check if already synced
          const [existingRows] = await db.execute(
            "SELECT id FROM soro_posts WHERE wp_post_id = " + JSON.stringify(post.id) + " LIMIT 1"
          ) as any[];

          if ((existingRows as any[]).length === 0) {
            newPosts++;
          }

          const esc = (v: string) => JSON.stringify(String(v ?? ""));
          const titleVal = esc(post.title?.rendered || "");
          const slugVal = esc(post.slug);
          const urlVal = esc(`https://www.theurbanmonk.com/${post.slug}`);
          const publishedVal = esc(new Date(post.date).toISOString().slice(0, 19).replace("T", " "));
          const catsVal = esc(JSON.stringify(post.categories || []));
          const tagsVal = esc(JSON.stringify(post.tags || []));
          const previewVal = esc(contentText.slice(0, 500));
          const fullVal = esc(contentText.slice(0, 10000));
          const yTitleVal = esc(post.yoast_head_json?.title || "");
          const yDescVal = esc(post.yoast_head_json?.description || "");

          await db.execute(
            `INSERT INTO soro_posts (
              wp_post_id, title, slug, url, published_at,
              wp_categories, wp_tags, word_count, has_featured_image,
              has_meta_description, content_preview, full_content,
              yoast_title, yoast_description, is_uncategorized, synced_at
            ) VALUES (
              ${post.id}, ${titleVal}, ${slugVal}, ${urlVal}, ${publishedVal},
              ${catsVal}, ${tagsVal}, ${wordCount}, ${hasFeaturedImage ? 1 : 0},
              ${hasMetaDesc ? 1 : 0}, ${previewVal}, ${fullVal},
              ${yTitleVal}, ${yDescVal}, ${isUncategorized ? 1 : 0}, NOW()
            )
            ON DUPLICATE KEY UPDATE
              title = VALUES(title),
              wp_categories = VALUES(wp_categories),
              wp_tags = VALUES(wp_tags),
              word_count = VALUES(word_count),
              has_featured_image = VALUES(has_featured_image),
              has_meta_description = VALUES(has_meta_description),
              is_uncategorized = VALUES(is_uncategorized),
              synced_at = NOW()`
          );

          synced++;
        }
      }

      return { synced, newPosts };
    }),

  // Get all synced posts
  getPosts: protectedProcedure
    .input(z.object({
      filter: z.enum(["all", "uncategorized", "needs_enhancement", "enhanced"]).default("all"),
      limit: z.number().min(1).max(100).default(30),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      let where = "1=1";
      if (input.filter === "uncategorized") where = "is_uncategorized = 1";
      else if (input.filter === "needs_enhancement") where = "enhancement_status = 'pending'";
      else if (input.filter === "enhanced") where = "enhancement_status = 'enhanced'";

      const [rows] = await db.execute(
        `SELECT * FROM soro_posts WHERE ${where} ORDER BY published_at DESC LIMIT ${input.limit}`
      ) as any[];

      return (rows as any[]).map((r: any) => ({
        ...r,
        wp_categories: r.wp_categories ? JSON.parse(r.wp_categories) : [],
        wp_tags: r.wp_tags ? JSON.parse(r.wp_tags) : [],
        ai_suggested_categories: r.ai_suggested_categories ? JSON.parse(r.ai_suggested_categories) : null,
        ai_suggested_tags: r.ai_suggested_tags ? JSON.parse(r.ai_suggested_tags) : null,
        ai_best_practices: r.ai_best_practices ? JSON.parse(r.ai_best_practices) : null,
      }));
    }),

  // Get stats
  getStats: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

    const [rows] = await db.execute(`
      SELECT
        COUNT(*) as total,
        SUM(is_uncategorized) as uncategorized,
        SUM(CASE WHEN enhancement_status = 'enhanced' THEN 1 ELSE 0 END) as enhanced,
        SUM(CASE WHEN enhancement_status = 'pending' THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN category_fix_status = 'fixed' THEN 1 ELSE 0 END) as categories_fixed,
        SUM(CASE WHEN seo_score = 'excellent' THEN 1 ELSE 0 END) as excellent_seo,
        SUM(CASE WHEN seo_score = 'good' THEN 1 ELSE 0 END) as good_seo,
        AVG(word_count) as avg_word_count,
        MAX(synced_at) as last_synced
      FROM soro_posts
    `) as any[];

    return (rows as any[])[0];
  }),

  // AI analyze a single post
  analyzePost: protectedProcedure
    .input(z.object({ postId: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      const [rows] = await db.execute(
        "SELECT * FROM soro_posts WHERE id = " + input.postId + " LIMIT 1"
      ) as any[];
      const post = (rows as any[])[0];
      if (!post) throw new TRPCError({ code: "NOT_FOUND", message: "Post not found" });

      // Reconstruct post object for AI
      const wpPost = {
        title: { rendered: post.title },
        slug: post.slug,
        categories: JSON.parse(post.wp_categories || "[]"),
        tags: JSON.parse(post.wp_tags || "[]"),
        content: { rendered: post.full_content || post.content_preview },
        yoast_head_json: {
          description: post.yoast_description,
          title: post.yoast_title,
        },
      };

      const analysis = await analyzePostWithAI(wpPost);

      const e = (v: string) => JSON.stringify(String(v ?? ""));
      await db.execute(
        `UPDATE soro_posts SET
          seo_score = ${e(analysis.seo_score)},
          readability_score = ${e(analysis.readability_score)},
          ai_suggested_categories = ${e(JSON.stringify({ found: analysis.best_practices_found, missing: analysis.best_practices_missing, primary_keyword: analysis.primary_keyword }))},
          ai_suggested_tags = ${e(JSON.stringify(analysis.suggested_tags))},
          ai_best_practices = ${e(JSON.stringify({ category_ids: analysis.suggested_category_ids }))},
          ai_enhancement_suggestions = ${e(analysis.enhancement_suggestions)},
          ai_lessons_learned = ${e(analysis.lessons_for_content_hub)},
          is_uncategorized = ${analysis.is_uncategorized ? 1 : 0},
          updated_at = NOW()
        WHERE id = ${input.postId}`
      );

      return { success: true, analysis };
    }),

  // Fix categories on WordPress
  fixCategories: protectedProcedure
    .input(z.object({ postId: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      const [rows] = await db.execute(
        "SELECT * FROM soro_posts WHERE id = " + input.postId + " LIMIT 1"
      ) as any[];
      const post = (rows as any[])[0];
      if (!post) throw new TRPCError({ code: "NOT_FOUND", message: "Post not found" });

      const bestPractices = post.ai_best_practices ? JSON.parse(post.ai_best_practices) : null;
      const categoryIds: number[] = bestPractices?.category_ids || [19]; // fallback to Health and Wellness

      await fixPostCategories(post.wp_post_id, categoryIds);

      await db.execute(
        `UPDATE soro_posts SET
          wp_categories = ${JSON.stringify(JSON.stringify(categoryIds))},
          is_uncategorized = 0,
          category_fix_status = 'fixed',
          updated_at = NOW()
        WHERE id = ${input.postId}`
      );

      return { success: true, categoryIds };
    }),

  // Mark post as enhanced
  markEnhanced: protectedProcedure
    .input(z.object({ postId: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      await db.execute(
        "UPDATE soro_posts SET enhancement_status = 'enhanced', updated_at = NOW() WHERE id = " + input.postId
      );
      return { success: true };
    }),

  // Get aggregated best practices lessons
  getBestPracticesInsights: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

    const [rows] = await db.execute(`
      SELECT ai_best_practices, ai_lessons_learned, seo_score, readability_score, word_count, title
      FROM soro_posts
      WHERE ai_best_practices IS NOT NULL
      ORDER BY published_at DESC
      LIMIT 20
    `) as any[];

    const posts = (rows as any[]).map((r: any) => ({
      title: r.title,
      seo_score: r.seo_score,
      readability_score: r.readability_score,
      word_count: r.word_count,
      lessons: r.ai_lessons_learned,
      best_practices: r.ai_best_practices ? JSON.parse(r.ai_best_practices) : null,
    }));

    if (posts.length === 0) return { insights: [], summary: "No posts analyzed yet. Sync and analyze posts first." };

    // Aggregate lessons with AI
    const lessonsText = posts.map(p => `- "${p.title}": ${p.lessons || "no lesson"}`).join("\n");
    const response = await invokeLLM({
      messages: [
        { role: "system", content: "You are an expert content strategist. Be concise and actionable." },
        { role: "user", content: `Based on these lessons from Soro-generated blog posts on The Urban Monk website, what are the top 5 actionable best practices we should adopt in our content strategy?\n\n${lessonsText}\n\nRespond with a JSON array of 5 objects: [{\"title\": string, \"description\": string, \"priority\": \"high|medium|low\"}]` },
      ],
    });

    let insights = [];
    try {
      const content = response.choices?.[0]?.message?.content;
      const text = typeof content === "string" ? content : JSON.stringify(content);
      const match = text.match(/\[[\s\S]*\]/);
      if (match) insights = JSON.parse(match[0]);
    } catch {}

    return { insights, posts };
  }),
});
