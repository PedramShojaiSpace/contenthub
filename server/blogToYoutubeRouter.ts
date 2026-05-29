/**
 * Blog → YouTube Backlog Router
 *
 * Workflow:
 * 1. Browse existing WordPress blog posts (from wpPostIndex)
 * 2. Add any post to the backlog
 * 3. Generate a spoken video script from the blog content
 * 4. Edit and approve the script
 * 5. Generate the full video package: SEO title, description (with UTM footer),
 *    thumbnail text options, and VA instructions for title cards / end screens
 * 6. Record the video, mark as recorded
 * 7. Upload to YouTube, save video ID
 * 8. Push blog URL into YouTube description (reuses videoToBlogRouter helper)
 * 9. Mark as live
 */

import { z } from "zod";
import { protectedProcedure, router } from "./_core/trpc";
import { invokeLLM } from "./_core/llm";
import { getDb } from "./db";

// ── Router ────────────────────────────────────────────────────────────────────

export const blogToYoutubeRouter = router({

  /**
   * List all WordPress blog posts from wpPostIndex that are NOT yet in the
   * blogToYoutubeItems table. These are the "available" posts to add to backlog.
   */
  listAvailableBlogPosts: protectedProcedure
    .input(
      z.object({
        search: z.string().optional(),
        category: z.string().optional(),
        limit: z.number().min(1).max(200).default(100),
        offset: z.number().min(0).default(0),
      })
    )
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return { posts: [], total: 0 };

      const { wpPostIndex, blogToYoutubeItems } = await import("../drizzle/schema");
      const { notInArray, like, and } = await import("drizzle-orm");

      // Get all wpPostIds already in the backlog
      const inBacklog = await db
        .select({ wpPostId: blogToYoutubeItems.wpPostId })
        .from(blogToYoutubeItems);
      const inBacklogIds = inBacklog
        .map((r: any) => r.wpPostId)
        .filter(Boolean) as number[];

      const conditions: any[] = [];
      if (inBacklogIds.length > 0) {
        conditions.push(notInArray(wpPostIndex.wpPostId, inBacklogIds));
      }
      if (input.search) {
        conditions.push(like(wpPostIndex.title, `%${input.search}%`));
      }
      if (input.category) {
        conditions.push(like(wpPostIndex.categories, `%${input.category}%`));
      }

      const { desc, count } = await import("drizzle-orm");
      const where = conditions.length > 0 ? and(...conditions) : undefined;

      const [posts, [countRow]] = await Promise.all([
        db
          .select()
          .from(wpPostIndex)
          .where(where)
          .orderBy(desc(wpPostIndex.publishedAt))
          .limit(input.limit)
          .offset(input.offset),
        db.select({ total: count() }).from(wpPostIndex).where(where),
      ]);

      return { posts, total: Number(countRow?.total ?? 0) };
    }),

  /**
   * List all items currently in the Blog → YouTube backlog.
   */
  listBacklogItems: protectedProcedure
    .input(
      z.object({
        status: z.enum(["backlog", "scripted", "recorded", "uploaded", "live", "all"]).default("all"),
        limit: z.number().min(1).max(200).default(100),
        offset: z.number().min(0).default(0),
      })
    )
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return { items: [], total: 0 };

      const { blogToYoutubeItems } = await import("../drizzle/schema");
      const { desc, eq, count } = await import("drizzle-orm");

      const where =
        input.status !== "all"
          ? eq(blogToYoutubeItems.status, input.status as any)
          : undefined;

      const [items, [countRow]] = await Promise.all([
        db
          .select()
          .from(blogToYoutubeItems)
          .where(where)
          .orderBy(desc(blogToYoutubeItems.createdAt))
          .limit(input.limit)
          .offset(input.offset),
        db.select({ total: count() }).from(blogToYoutubeItems).where(where),
      ]);

      return { items, total: Number(countRow?.total ?? 0) };
    }),

  /**
   * Add a WordPress blog post to the Blog → YouTube backlog.
   */
  addToBacklog: protectedProcedure
    .input(
      z.object({
        wpPostId: z.number(),
        blogTitle: z.string().min(1),
        blogUrl: z.string().url(),
        blogExcerpt: z.string().optional(),
        blogCategories: z.string().optional(), // JSON string
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");

      const { blogToYoutubeItems } = await import("../drizzle/schema");

      const result = await db.insert(blogToYoutubeItems).values({
        wpPostId: input.wpPostId,
        blogTitle: input.blogTitle,
        blogUrl: input.blogUrl,
        blogExcerpt: input.blogExcerpt ?? null,
        blogCategories: input.blogCategories ?? null,
        status: "backlog",
      });

      return { id: (result as any).insertId };
    }),

  /**
   * Generate a spoken video script from a blog post.
   * The script is written in Pedram's voice, structured for a 5-10 minute YouTube video.
   */
  generateScript: protectedProcedure
    .input(
      z.object({
        itemId: z.number(),
        blogTitle: z.string().min(1),
        blogUrl: z.string().url(),
        blogExcerpt: z.string().optional(),
        blogCategories: z.string().optional(),
        customInstructions: z.string().optional(),
        targetDurationMinutes: z.number().min(3).max(20).default(8),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");

      // Try to fetch the full blog post content from WordPress
      let blogContent = input.blogExcerpt ?? "";
      try {
        const wpUrl = process.env.WORDPRESS_URL ?? "https://theurbanmonk.com";
        const wpUser = process.env.WORDPRESS_USERNAME;
        const wpPass = process.env.WORDPRESS_APP_PASSWORD;
        if (wpUser && wpPass) {
          // Find the post by URL slug
          const slug = input.blogUrl.split("/").filter(Boolean).pop() ?? "";
          const res = await fetch(
            `${wpUrl}/wp-json/wp/v2/posts?slug=${slug}&_fields=content,excerpt`,
            {
              headers: {
                Authorization: `Basic ${Buffer.from(`${wpUser}:${wpPass}`).toString("base64")}`,
              },
            }
          );
          if (res.ok) {
            const posts = await res.json();
            if (posts?.[0]?.content?.rendered) {
              // Strip HTML tags for LLM input
              blogContent = posts[0].content.rendered
                .replace(/<[^>]+>/g, " ")
                .replace(/\s+/g, " ")
                .trim()
                .slice(0, 8000);
            }
          }
        }
      } catch {
        // Fall back to excerpt
      }

      const wordsPerMinute = 130; // Pedram's measured speaking pace
      const targetWords = input.targetDurationMinutes * wordsPerMinute;

      const systemPrompt = `You are Dr. Pedram Shojai (The Urban Monk) — Doctor of Oriental Medicine, Taoist monk, NY Times bestselling author, and host of The Urban Monk YouTube channel. Write a spoken video script based on the blog post provided.

SCRIPT STRUCTURE:
1. HOOK (30-45 seconds): Open with a compelling question or bold statement that grabs attention. Do NOT start with "Welcome back" or "In today's video."
2. INTRO (1 minute): Briefly introduce yourself as Dr. Pedram Shojai and what the viewer will learn. Build credibility with one specific data point or ancient wisdom reference.
3. MAIN CONTENT (${input.targetDurationMinutes - 3} minutes): 3-5 key sections, each with a clear heading you say aloud (e.g., "The first thing to understand is..."). Bridge ancient wisdom with modern science. Use "you" and "your" to speak directly to the viewer.
4. PRACTICAL TAKEAWAYS (1 minute): 3 specific, actionable things the viewer can do today.
5. CTA & OUTRO (30 seconds): Direct viewer to read the full article at the blog URL for deeper resources. Invite them to subscribe and hit the bell. End with a signature sign-off.

VOICE GUIDELINES:
- Warm, authoritative, and conversational — like a wise friend who happens to be a doctor
- Weave in Taoist philosophy and ancient wisdom naturally
- Use pauses and rhetorical questions to create rhythm
- Avoid jargon; explain technical terms simply
- Target length: approximately ${targetWords} words (${input.targetDurationMinutes} minutes at speaking pace)

FORMAT:
- Write the script as continuous spoken prose — no bullet points, no stage directions
- Use [PAUSE] markers where natural breaks should occur
- Use [EMPHASIS] before words to stress
- Mark section transitions with: === SECTION: [Name] ===
- At the end, include a === PRODUCTION NOTES === section with 3-5 tips for Pedram on delivery, pacing, and any props or B-roll suggestions
- Output ONLY the script — no preamble or commentary`;

      const userMessage = `BLOG TITLE: ${input.blogTitle}
BLOG URL: ${input.blogUrl}
CATEGORIES: ${input.blogCategories ?? "General"}
${input.customInstructions ? `\nCUSTOM INSTRUCTIONS: ${input.customInstructions}` : ""}

BLOG CONTENT:
${blogContent || "(No full content available — generate from title and categories)"}`;

      const response = await invokeLLM({
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMessage },
        ],
      });

      const script = String(response.choices?.[0]?.message?.content ?? "").trim();
      if (!script || script.length < 500) {
        throw new Error("Script generation failed — output was too short.");
      }

      const wordCount = script.split(/\s+/).length;

      // Save to DB
      const { blogToYoutubeItems } = await import("../drizzle/schema");
      const { eq } = await import("drizzle-orm");
      await db
        .update(blogToYoutubeItems)
        .set({
          script,
          scriptWordCount: wordCount,
          scriptGeneratedAt: new Date(),
          status: "scripted",
        })
        .where(eq(blogToYoutubeItems.id, input.itemId));

      return { script, wordCount };
    }),

  /**
   * Save an edited script back to the DB.
   */
  updateScript: protectedProcedure
    .input(
      z.object({
        itemId: z.number(),
        script: z.string().min(1),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");

      const { blogToYoutubeItems } = await import("../drizzle/schema");
      const { eq } = await import("drizzle-orm");
      const wordCount = input.script.split(/\s+/).length;

      await db
        .update(blogToYoutubeItems)
        .set({ script: input.script, scriptWordCount: wordCount })
        .where(eq(blogToYoutubeItems.id, input.itemId));

      return { wordCount };
    }),

  /**
   * Generate the full video package from the script:
   * - SEO-optimized video title (3 options)
   * - Full YouTube description (Hook → Body → Timestamps → Channel Footer)
   * - 3 thumbnail text options
   * - VA instructions for title cards, end screens, and pinned comment
   */
  generateVideoPackage: protectedProcedure
    .input(
      z.object({
        itemId: z.number(),
        blogTitle: z.string().min(1),
        blogUrl: z.string().url(),
        script: z.string().min(100),
        blogCategories: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");

      const scriptSnippet = input.script.slice(0, 5000);

      // ── 1. Generate SEO title options + thumbnail text ─────────────────────
      const titleResponse = await invokeLLM({
        messages: [
          {
            role: "system",
            content: `You are an expert YouTube SEO strategist for The Urban Monk channel. Generate video metadata from the script provided. Return ONLY valid JSON.`,
          },
          {
            role: "user",
            content: `Blog title: ${input.blogTitle}\nScript excerpt:\n${scriptSnippet.slice(0, 2000)}`,
          },
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "video_metadata",
            strict: true,
            schema: {
              type: "object",
              properties: {
                titleOptions: {
                  type: "array",
                  items: { type: "string" },
                  description: "3 SEO-optimized YouTube title options (50-70 chars each)",
                },
                thumbnailTextOptions: {
                  type: "array",
                  items: { type: "string" },
                  description: "3 punchy thumbnail text options (max 6 words each, all caps)",
                },
                primaryKeyword: { type: "string" },
                tags: {
                  type: "array",
                  items: { type: "string" },
                  description: "10-15 relevant YouTube tags",
                },
              },
              required: ["titleOptions", "thumbnailTextOptions", "primaryKeyword", "tags"],
              additionalProperties: false,
            },
          },
        },
      } as any);

      let meta = {
        titleOptions: [input.blogTitle],
        thumbnailTextOptions: ["WATCH THIS", "LIFE CHANGING", "MUST SEE"],
        primaryKeyword: input.blogTitle.split(" ").slice(0, 3).join(" "),
        tags: [] as string[],
      };
      try {
        const raw = String(titleResponse.choices?.[0]?.message?.content ?? "{}");
        const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
        meta = { ...meta, ...JSON.parse(cleaned) };
      } catch {}

      const videoTitle = meta.titleOptions[0] ?? input.blogTitle;

      // ── 2. Generate full YouTube description ──────────────────────────────
      const channelFooter = `---
Welcome to The Urban Monk channel! If you enjoyed this video, make sure to Like, Subscribe, and hit the Notification Bell so you never miss an update. We have a massive library of resources designed to help you optimize your health, mind, and spirit. Ready to take the next step? Explore our core programs and free resources below:

🚀 Stop Guessing, Start Healing: The Upstream Masterclass
Tired of chasing symptoms? Join our free masterclass to discover the exact framework we use to help high-performers optimize their gut health, regain their energy, and build a personalized protocol that actually works.
👉 Watch the Free Upstream Masterclass: https://upstream.theurbanmonk.com?utm_source=youtube&utm_medium=video&utm_campaign=upstream-bundle&utm_content=video-description&utm_term=youtube_cold_upstream

💡 Level Up Your Life: The Lights On Course
If you are passionate about personal development and want a structured path to waking up and living with purpose, this is for you. Lights On is our foundational program designed to help you break through the noise and optimize your mind, body, and spirit.
👉 Explore the Lights On Course: https://lightson.theurbanmonk.com?utm_source=youtube&utm_medium=video&utm_campaign=lights-on&utm_content=video-description&utm_term=youtube_cold_LO

🌿 Discover the Root Cause: InterConnected Free Screening
Is the root of your health issues hiding in your gut? In this groundbreaking documentary series, we uncover the hidden truths about our microbiome and how modern life is impacting our overall health.
👉 Watch the Free InterConnected Screening: https://theacademy.theurbanmonk.com/ic-interconnected-free-screening-Meta?utm_source=youtube&utm_medium=video&utm_campaign=ic-free-screening&utm_content=video-description&utm_term=youtube_cold_IC

📚 Explore The Urban Monk Ecosystem
Want to dive deeper into the philosophy, science, and practices of The Urban Monk? We have a ton more interviews, articles, and resources waiting for you.
👉 Visit The Urban Monk: https://www.theurbanmonk.com?utm_source=youtube&utm_medium=video&utm_campaign=brand-awareness&utm_content=video-description&utm_term=youtube_cold_UM`;

      const descResponse = await invokeLLM({
        messages: [
          {
            role: "system",
            content: `You are an expert YouTube SEO strategist for The Urban Monk channel. Write a fully optimized YouTube description. Always refer to the host as Dr. Pedram Shojai.

Structure:
1. HOOK (2-3 sentences): primary keyword, search-preview optimized, do NOT start with "In this video"
2. BODY (150-200 words): key topics, second person (you/your), mention Dr. Pedram Shojai, include a natural CTA to the companion blog article
3. BLOG LINK: 📝 Read the full article: [blog title]\\n[blog URL]
4. TIMESTAMPS: 4-6 chapter markers (00:00 - Topic) if identifiable from script, else skip
5. CHANNEL FOOTER: paste EXACTLY as provided

FORMAT: plain text only, no markdown, no asterisks, no pound signs. 300-500 words before footer.`,
          },
          {
            role: "user",
            content: `VIDEO TITLE: ${videoTitle}\nBLOG URL: ${input.blogUrl}\nBLOG TITLE: ${input.blogTitle}\n\nSCRIPT:\n${scriptSnippet}\n\nCHANNEL FOOTER (paste EXACTLY):\n${channelFooter}`,
          },
        ],
      });

      const ytDescription = String(descResponse.choices?.[0]?.message?.content ?? "").trim();

      // ── 3. Generate VA instructions ────────────────────────────────────────
      const vaResponse = await invokeLLM({
        messages: [
          {
            role: "system",
            content: `You are a YouTube production coordinator writing clear, step-by-step instructions for a virtual assistant who will set up a YouTube video after it is uploaded. Write in plain English, numbered steps, no jargon.`,
          },
          {
            role: "user",
            content: `VIDEO TITLE: ${videoTitle}
BLOG URL: ${input.blogUrl}
BLOG TITLE: ${input.blogTitle}
YOUTUBE CHANNEL: The Urban Monk (Dr. Pedram Shojai)

Write step-by-step VA instructions for:
1. Adding the blog URL as a YouTube Card (info card) that appears at the 70% mark of the video
2. Adding an End Screen element linking to the blog post URL (appears in the last 20 seconds)
3. Pinning a comment with the blog URL (copy-paste the exact comment text to use)
4. Adding the video to the correct YouTube playlist based on categories: ${input.blogCategories ?? "Health & Wellness"}
5. Setting the correct video category in YouTube Studio
6. Verifying the description contains the blog URL

For each step, include exactly where to click in YouTube Studio and what text/URL to enter.
Be specific enough that someone who has never done this before can follow along.`,
          },
        ],
      });

      const vaInstructions = String(vaResponse.choices?.[0]?.message?.content ?? "").trim();

      // ── 4. Save to DB ──────────────────────────────────────────────────────
      const { blogToYoutubeItems } = await import("../drizzle/schema");
      const { eq } = await import("drizzle-orm");
      await db
        .update(blogToYoutubeItems)
        .set({
          videoTitle,
          ytDescription,
          thumbnailTextOptions: JSON.stringify(meta.thumbnailTextOptions),
          vaInstructions,
        })
        .where(eq(blogToYoutubeItems.id, input.itemId));

      return {
        titleOptions: meta.titleOptions,
        videoTitle,
        ytDescription,
        thumbnailTextOptions: meta.thumbnailTextOptions,
        tags: meta.tags,
        vaInstructions,
      };
    }),

  /**
   * Update production notes for a backlog item.
   */
  updateProductionNotes: protectedProcedure
    .input(
      z.object({
        itemId: z.number(),
        productionNotes: z.string(),
        status: z.enum(["backlog", "scripted", "recorded", "uploaded", "live"]).optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");

      const { blogToYoutubeItems } = await import("../drizzle/schema");
      const { eq } = await import("drizzle-orm");
      await db
        .update(blogToYoutubeItems)
        .set({
          productionNotes: input.productionNotes,
          ...(input.status ? { status: input.status as any } : {}),
          ...(input.status === "recorded" ? { recordedAt: new Date() } : {}),
        })
        .where(eq(blogToYoutubeItems.id, input.itemId));

      return { success: true };
    }),

  /**
   * Mark a video as uploaded to YouTube. Saves the video ID and URL.
   */
  markVideoUploaded: protectedProcedure
    .input(
      z.object({
        itemId: z.number(),
        youtubeVideoId: z.string().min(1),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");

      const { blogToYoutubeItems } = await import("../drizzle/schema");
      const { eq } = await import("drizzle-orm");
      const youtubeUrl = `https://www.youtube.com/watch?v=${input.youtubeVideoId}`;

      await db
        .update(blogToYoutubeItems)
        .set({
          youtubeVideoId: input.youtubeVideoId,
          youtubeUrl,
          uploadedAt: new Date(),
          status: "uploaded",
        })
        .where(eq(blogToYoutubeItems.id, input.itemId));

      return { youtubeUrl };
    }),

  /**
   * Mark a video as live (fully published and linked).
   */
  markLive: protectedProcedure
    .input(z.object({ itemId: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");

      const { blogToYoutubeItems } = await import("../drizzle/schema");
      const { eq } = await import("drizzle-orm");
      await db
        .update(blogToYoutubeItems)
        .set({ status: "live" })
        .where(eq(blogToYoutubeItems.id, input.itemId));

      return { success: true };
    }),

  /**
   * Delete a backlog item.
   */
  deleteItem: protectedProcedure
    .input(z.object({ itemId: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");

      const { blogToYoutubeItems } = await import("../drizzle/schema");
      const { eq } = await import("drizzle-orm");
      await db
        .delete(blogToYoutubeItems)
        .where(eq(blogToYoutubeItems.id, input.itemId));

      return { success: true };
    }),

  /**
   * Get a single backlog item by ID.
   */
  getItem: protectedProcedure
    .input(z.object({ itemId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return null;

      const { blogToYoutubeItems } = await import("../drizzle/schema");
      const { eq } = await import("drizzle-orm");
      const [item] = await db
        .select()
        .from(blogToYoutubeItems)
        .where(eq(blogToYoutubeItems.id, input.itemId));

      return item ?? null;
    }),
});
