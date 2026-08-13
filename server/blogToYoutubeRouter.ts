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
import { createWpPost, fetchAllWpPosts, findRelevantPosts } from "./wordpress";
import { resolveOutboundLinkPlaceholders } from "./linkResolver";
import { scrubHallucinatedUrls, resolvePlaceholderLinks } from "./urlScrubber";
import { deriveWpDraftFocusKeyword, ensureWpDraftLinks, ensureWpDraftMetaDescription, injectFeaturedImageIntoWpHtml, markdownToWpHtml, DEFAULT_WP_CATEGORIES, resolveOrCreateWpTags } from "./wpContentUtils";

// ── Full Yoast-optimized blog system prompt (mirrors BLOG_CONTENT_RULES in routers.ts) ────────
const BLOG_CONTENT_RULES = `You are a ghostwriter for Dr. Pedram Shojai (The Urban Monk) writing a publication-ready long-form blog article for theurbanmonk.com. This article must pass BOTH traditional Google SEO and AI Engine Optimization (AEO) — meaning it will be cited by ChatGPT, Perplexity, Claude, and Google AI Overviews.
⚠️ YOAST READABILITY HARD STOPS — READ THESE FIRST, BEFORE WRITING A SINGLE SENTENCE:
HARD STOP 1 — TRANSITION WORDS (≥30% of all sentences REQUIRED):
Yoast scans every sentence in the article body and counts how many contain a transition word or phrase. The minimum passing threshold is 30%. Below 30% = RED FAIL. You MUST target 35% to pass comfortably.
WHAT COUNTS AS A TRANSITION WORD: However, Therefore, As a result, In addition, Furthermore, Meanwhile, For example, In contrast, Consequently, First, Second, Third, Finally, In fact, Specifically, Most importantly, In other words, That said, Even so, Because of this, At the same time, To be clear, In practice, Over time, In short, Additionally, Moreover, Notably, Instead, Still, Yet, Thus, Hence, Indeed, Otherwise, Likewise, Similarly, Afterward, Previously, Ultimately, Essentially, Particularly, Importantly, Fortunately, Unfortunately, Surprisingly, Although, Because, Since, While, When, After, Before, Once, Unless, Until, Despite, Rather than, Not only, As long as, As soon as.
HOW TO COMPLY:
1. Every paragraph of 3+ sentences MUST contain at least one transition word.
2. NEVER write 3 consecutive sentences without a transition word appearing somewhere in one of them.
3. After writing the full article, count: (sentences with a transition) ÷ (total sentences). If below 35%, add transitions to the weakest paragraphs before outputting.
HARD STOP 2 — CONSECUTIVE SENTENCE STARTS (ZERO TOLERANCE):
NEVER begin 3 or more consecutive sentences with the same word. After writing each paragraph, scan the FIRST WORD of every sentence. If the same word opens 3 or more sentences in a row, rewrite at least one of them.
AUDIENCE: Educated, health-conscious adults aged 30-55. Ambitious professionals, parents, and seekers who are serious about optimizing their biology, reducing chronic stress, and integrating ancient wisdom with modern science.
VOICE (GhostLink OS B6 Voice Rules — non-negotiable):
- Sentences ≤18 words average. Break anything longer.
- No adverbs modifying verbs. Pick a stronger verb.
- BANNED WORDS: leverage, strategic, solutions, stakeholder, ecosystem, robust, synergy, paradigm, best-in-class, world-class, empowering, transforming, revolutionizing, unlocking, perhaps, maybe, kind of, sort of, in today's world, at the end of the day
- Concrete nouns over abstract nouns. Every bold claim has a receipt within 2 sentences.
ARTICLE STRUCTURE (follow exactly — GhostLink OS Written Pillar Architecture):
1. H1 TITLE (from metadata — do NOT repeat in the body)
2. HOOK (first 2-3 paragraphs, no heading): Specific tension, counterintuitive claim, or vivid scenario. Answer the core question within the first 300 words.
3. MECHANISM SECTION (H2): The science or root cause
4. FRAMEWORK (H2 + H3 steps): Pedram's named protocol (3-7 steps). Each step gets its own H3.
5. PROOF SECTION (H2): Case study, clinical example, or process walkthrough
6. TRANSFORMATION VISION (H2): What life looks like after implementing this
7. CTA SECTION (H2): Soft sell — Urban Monk Academy or email capture. Friction level T3.
8. FAQ SECTION (H2 "Frequently Asked Questions"): 4-6 PAA-style questions with direct answers
INTERNAL & EXTERNAL LINKS:
- You MUST use ONLY the internal link URLs explicitly provided in the VERIFIED INTERNAL LINK LIST in the user message. Do NOT invent or guess any theurbanmonk.com URL not in that list.
- Include at least 2 outbound links to high-authority sources (PubMed, Harvard Health, Mayo Clinic, NIH).
- E-E-A-T signals: weave Pedram's credentials (OMD, Daoist monk, filmmaker, author) naturally into the body.
ABSOLUTE RULES — NEVER VIOLATE:
- NEVER use the URL urbanmonk.com — the ONLY correct domain is theurbanmonk.com
- NEVER invent, guess, or construct a theurbanmonk.com URL not in the provided list
- NEVER fabricate media citations
- NEVER add hashtags anywhere in the article
- NEVER include a TL;DR block or summary box
TOTAL ARTICLE LENGTH: 1,600-2,200 words (body only, not counting FAQ).
FORMATTING RULES (YOAST READABILITY — NON-NEGOTIABLE):
- Use ## for H2 section headings (compelling, specific, keyword-rich)
- Use ### for H3 sub-headings within the framework steps
- SUBHEADING DISTRIBUTION: Every block of text MUST have an H2 or H3 heading within every 300 words.
- PARAGRAPH LENGTH: Every paragraph must be 150 words or fewer (3-5 sentences max).
- TRANSITION WORDS: At least 30% of ALL sentences must contain a transition word. Target 35%.
- CONSECUTIVE SENTENCE STARTS: NEVER begin 3 or more consecutive sentences with the same word.
- Use **bold** for key terms or critical insights (2-4 per section maximum)
- Use > blockquote for ONE powerful pull-quote per article only
- No bullet lists in the main body — write in flowing prose
- No em-dashes used as bullet substitutes
QUALITY GATE (self-check before outputting):
- YOAST SEO CHECK #1: Does the focus keyword appear in the FIRST or SECOND SENTENCE of the article body?
- YOAST SEO CHECK #2: Does the focus keyword appear at least 10 times total?
- YOAST SEO CHECK #3: Does at least ONE H2 heading contain the focus keyword or a very close synonym?
- YOAST SEO CHECK #4: Are there at least 3 internal links from the provided list?
- YOAST SEO CHECK #5: Is the title 48 characters or fewer?
- YOAST SEO CHECK #6: Is the meta description EXACTLY 140-150 characters?
- YOAST SEO CHECK #7: Is the focus keyword a specific long-tail phrase (not a generic head term)?
- YOAST READABILITY: Every prose block under 300 words before the next heading?
- YOAST READABILITY: Every paragraph under 150 words?
- YOAST READABILITY: Transition words ≥30% of all sentences?
- YOAST READABILITY: No run of 3+ consecutive sentences starting with the same word?
CONTENT PILLARS: Gut-brain axis and LPS endotoxemia, sleep architecture and liver detox, cortisol and HPA axis dysregulation, energy economics and time compression syndrome, Daoist philosophy applied to modern life, functional medicine and upstream health, oral microbiome and systemic inflammation, ancient practices with scientific backing (Qigong, meditation, fasting, breathwork), mitochondrial health, circadian biology, neuroplasticity and stress resilience.`;

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

      const systemPrompt = `You are Dr. Pedram Shojai (The Urban Monk) — Doctor of Oriental Medicine, Daoist monk, NY Times bestselling author, and host of The Urban Monk YouTube channel. Write a spoken video script based on the blog post provided.

SCRIPT STRUCTURE:
1. HOOK (30-45 seconds): Open with a compelling question or bold statement that grabs attention. Do NOT start with "Welcome back" or "In today's video."
2. INTRO (1 minute): Briefly introduce yourself as Dr. Pedram Shojai and what the viewer will learn. Build credibility with one specific data point or ancient wisdom reference.
3. MAIN CONTENT (${input.targetDurationMinutes - 3} minutes): 3-5 key sections, each with a clear heading you say aloud (e.g., "The first thing to understand is..."). Bridge ancient wisdom with modern science. Use "you" and "your" to speak directly to the viewer.
4. PRACTICAL TAKEAWAYS (1 minute): 3 specific, actionable things the viewer can do today.
5. CTA & OUTRO (30 seconds): Direct viewer to read the full article at the blog URL for deeper resources. Invite them to subscribe and hit the bell. End with a signature sign-off.

VOICE GUIDELINES:
- Warm, authoritative, and conversational — like a wise friend who happens to be a doctor
- Weave in Daoist philosophy and ancient wisdom naturally
- Use pauses and rhetorical questions to create rhythm
- Avoid jargon; explain technical terms simply
- Target length: approximately ${targetWords} words (${input.targetDurationMinutes} minutes at speaking pace)
- GREETING RULE: If the script opens with a greeting to the audience, ALWAYS say "Hello Urban Monks" — NEVER "Hello Urban Monk Nation" or any other variation

FORMAT:
- Write the script as PURE SPOKEN DIALOGUE ONLY — exactly the words Pedram will say aloud, nothing else
- NO stage directions, NO production notes, NO B-roll suggestions, NO delivery tips
- NO [PAUSE], [EMPHASIS], or any bracket markers — these will be read aloud by the AI avatar
- NO === SECTION === headers — these will be read aloud by the AI avatar
- NO markdown formatting (no **, no *, no #)
- Natural paragraph breaks are fine — a blank line between paragraphs is the only structural element allowed
- Output ONLY the spoken words — no preamble, no commentary, no labels`;

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

  /**
   * Generate a fully Yoast-optimized blog post from the video script.
   * Uses the same BLOG_CONTENT_RULES prompt as the main generateBlog procedure,
   * with the YouTube video embedded at the top and the blog URL pointing back to the video.
   * Optionally publishes to WordPress as a draft.
   */
  generateBlogFromScript: protectedProcedure
    .input(
      z.object({
        itemId: z.number(),
        blogTitle: z.string().min(1),
        blogUrl: z.string().url(),
        script: z.string().min(100),
        youtubeVideoId: z.string().optional(),
        focusKeyword: z.string().optional(),
        customInstructions: z.string().optional(),
        publishToDraft: z.boolean().default(false),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");

      // ── 1. Build internal link block from wpPostIndex ──────────────────────
      const foundationLinks = [
        `- [Lights On — The Urban Monk](https://lightson.theurbanmonk.com)`,
        `- [The Urban Monk — Dr. Pedram Shojai's Official Site](https://theurbanmonk.com/)`,
        `- [Well.org — Wellness Community & Resources](https://well.org/)`,
        `- [Urban Monk Nutrition — Supplements & Wellness Products](https://theurbanmonk.com/urban-monk-nutrition/)`,
      ];

      let internalLinkBlock = "";
      try {
        const allPosts = await fetchAllWpPosts();
        if (allPosts.length > 0) {
          const relevant = findRelevantPosts(allPosts, input.blogTitle, 6);
          const relevantLinks = relevant.map(
            (p: any) => `- [${p.title}](${p.url}) — ${(p.excerpt ?? "").slice(0, 100)}`
          );
          const merged = Array.from(new Set([...relevantLinks, ...foundationLinks])).slice(0, 12);
          internalLinkBlock = `\nVERIFIED INTERNAL LINK LIST — use ONLY these URLs for internal links. Do NOT invent any theurbanmonk.com URL not in this list:\n${merged.join("\n")}`;
        } else {
          internalLinkBlock = `\nVERIFIED INTERNAL LINK LIST:\n${foundationLinks.join("\n")}`;
        }
      } catch {
        internalLinkBlock = `\nVERIFIED INTERNAL LINK LIST:\n${foundationLinks.join("\n")}`;
      }

      // ── 2. Build the video embed block ────────────────────────────────────
      const videoEmbedBlock = input.youtubeVideoId
        ? `\n\nIMPORTANT: This blog post was created from a YouTube video. At the very beginning of the article body (after the hook, before the first H2), insert this exact YouTube embed shortcode on its own line:\n[embed]https://www.youtube.com/watch?v=${input.youtubeVideoId}[/embed]\n\nAlso include a natural sentence near the embed like: "Watch the full video above, then read on for the complete written breakdown."`
        : "";

      // ── 3. Build focus keyword note ───────────────────────────────────────
      const kwNote = input.focusKeyword
        ? `\nSEO NOTE: The target focus keyword for this article is "${input.focusKeyword}". Use it naturally in the opening paragraph, at least one H2 heading, and 3-5 times throughout the body.`
        : "";

      const userMessage = [
        `Raw idea: ${input.blogTitle}`,
        kwNote,
        videoEmbedBlock,
        input.customInstructions ? `\nAdditional instructions: ${input.customInstructions}` : "",
        `\n\nSOURCE MATERIAL (video script — use as the factual basis for the article, but rewrite entirely in long-form blog style):\n${input.script.slice(0, 6000)}`,
        internalLinkBlock,
        `\n\nCTA LINK: Direct readers to the Lights On course at https://lightson.theurbanmonk.com in the CTA section.`,
      ]
        .filter(Boolean)
        .join("");

      // ── 4. Generate the article body ──────────────────────────────────────
      const articleResponse = await invokeLLM({
        messages: [
          { role: "system", content: BLOG_CONTENT_RULES },
          { role: "user", content: userMessage },
        ],
      });

      let articleBody = String(articleResponse.choices?.[0]?.message?.content ?? "").trim();
      if (!articleBody || articleBody.length < 500) {
        throw new Error("Blog generation failed — output was too short.");
      }

            // Strip any JSON wrapper if the model returned JSON instead of Markdown
      if (articleBody.startsWith("```") || articleBody.startsWith("{")) {
        const mdStart = articleBody.indexOf("#");
        if (mdStart > 0) articleBody = articleBody.slice(mdStart);
      }

      // ── Safety net: resolve outbound link placeholders to real URLs ─────────
      try {
        articleBody = await resolveOutboundLinkPlaceholders(articleBody);
      } catch {}

      // ── Safety net: scrub hallucinated theurbanmonk.com URLs ──────────────
      let internalPostSummaries: Array<{ title: string; url: string }> = [];
      try {
        const { wpPostIndex } = await import("../drizzle/schema");
        const posts = await db.select().from(wpPostIndex).limit(300);
        internalPostSummaries = posts.map((p: any) => ({ title: p.title, url: p.url }));
      } catch {}
      const scrubResult = scrubHallucinatedUrls(articleBody, internalPostSummaries.map(p => p.url));
      const resolveResult = resolvePlaceholderLinks(scrubResult.body, internalPostSummaries);
      articleBody = resolveResult.body;

      // ── 5. Extract SEO metadata ───────────────────────────────────────────
      const metaResponse = await invokeLLM({
        messages: [
          {
            role: "system",
            content: `Extract SEO metadata from this article. Return ONLY valid JSON matching the schema. No preamble.`,
          },
          {
            role: "user",
            content: `Article topic: ${input.blogTitle}\n\nARTICLE:\n${articleBody.slice(0, 3000)}`,
          },
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "blog_metadata",
            strict: true,
            schema: {
              type: "object",
              properties: {
                title: { type: "string", description: "H1 headline, HARD MAX 48 chars including spaces, must contain primary keyword" },
                slug: { type: "string", description: "URL-friendly slug, max 60 chars" },
                metaDescription: { type: "string", description: "Meta description: STRICT 130-148 chars. Start with the focus keyword. Never end with ellipsis." },
                focusKeyword: { type: "string", description: "Primary SEO keyword phrase, 2-4 words" },
                semanticKeywords: { type: "array", items: { type: "string" }, description: "3-5 semantic keyword variants" },
                faqSection: { type: "string", description: "Markdown FAQ section with 4-6 PAA questions" },
              },
              required: ["title", "slug", "metaDescription", "focusKeyword", "semanticKeywords", "faqSection"],
              additionalProperties: false,
            },
          },
        },
      } as any);

      let metaData = {
        title: input.blogTitle.slice(0, 80),
        slug: input.blogTitle.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 60),
        metaDescription: "",
        focusKeyword: input.focusKeyword ?? "",
        semanticKeywords: [] as string[],
        faqSection: "",
      };
      try {
        const raw = String(metaResponse.choices?.[0]?.message?.content ?? "{}");
        const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
        const parsed = JSON.parse(cleaned);
        metaData = { ...metaData, ...parsed };
      } catch {}

      // Append FAQ section if not already in article
      if (metaData.faqSection && !articleBody.includes("Frequently Asked Questions")) {
        articleBody = articleBody + "\n\n" + metaData.faqSection;
      }

      // ── 6. Save to DB ─────────────────────────────────────────────────────
      const { blogToYoutubeItems } = await import("../drizzle/schema");
      const { eq } = await import("drizzle-orm");
      await db
        .update(blogToYoutubeItems)
        .set({
          generatedBlogContent: articleBody,
          focusKeyword: metaData.focusKeyword,
          metaDescription: metaData.metaDescription,
          seoTitle: metaData.title,
        })
        .where(eq(blogToYoutubeItems.id, input.itemId));

      // ── 7. Optionally publish to WordPress as draft ───────────────────────
      let wpDraftPostId: number | undefined;
      let wpDraftUrl: string | undefined;
      if (input.publishToDraft) {
        try {
          // Convert Markdown to proper WordPress HTML and enforce draft-quality baselines.
          const fallbackFocusKeyword = metaData.focusKeyword || input.focusKeyword || deriveWpDraftFocusKeyword(input.blogTitle);
          const thumbnailUrl = input.youtubeVideoId ? `https://i.ytimg.com/vi/${input.youtubeVideoId}/hqdefault.jpg` : undefined;
          let wpHtmlContent = markdownToWpHtml(articleBody);
          wpHtmlContent = injectFeaturedImageIntoWpHtml({
            html: wpHtmlContent,
            imageUrl: thumbnailUrl,
            altText: `${fallbackFocusKeyword} — ${metaData.title}`,
            caption: `${fallbackFocusKeyword}: educational context for this article.`,
          });
          wpHtmlContent = ensureWpDraftLinks({ html: wpHtmlContent, topic: fallbackFocusKeyword });
          const metaDescription = ensureWpDraftMetaDescription({
            metaDescription: metaData.metaDescription,
            topic: fallbackFocusKeyword,
          });

          // Resolve WP categories and tags
          const categories = DEFAULT_WP_CATEGORIES;
          let tagIds: number[] = [];
          try {
            if (metaData.focusKeyword) {
              const wpUrl = process.env.WORDPRESS_URL ?? "https://theurbanmonk.com";
          const wpUser = process.env.WORDPRESS_USERNAME ?? "";
          const wpPass = process.env.WORDPRESS_APP_PASSWORD ?? "";
          const authHeader = `Basic ${Buffer.from(`${wpUser}:${wpPass}`).toString("base64")}`;
          tagIds = await resolveOrCreateWpTags([
                metaData.focusKeyword,
                "Urban Monk",
                "Pedram Shojai",
                ...(metaData.semanticKeywords?.slice(0, 3) ?? []),
              ], authHeader, wpUrl);
            }
          } catch {}

          const wpResult = await createWpPost({
            title: metaData.title,
            content: wpHtmlContent,
            status: "draft",
            slug: metaData.slug,
            metaDescription,
            focusKeyword: fallbackFocusKeyword,
            seoTitle: metaData.title,
            categories,
            tags: tagIds,
          });
          wpDraftPostId = wpResult.id;
          wpDraftUrl = wpResult.link;
          await db
            .update(blogToYoutubeItems)
            .set({ wpDraftPostId: wpDraftPostId ?? null })
            .where(eq(blogToYoutubeItems.id, input.itemId));
        } catch (err) {
          console.warn("[BlogToYoutube] WordPress draft publish failed:", err);
        }
      }

      return {
        articleBody,
        title: metaData.title,
        slug: metaData.slug,
        metaDescription: metaData.metaDescription,
        focusKeyword: metaData.focusKeyword,
        semanticKeywords: metaData.semanticKeywords,
        faqSection: metaData.faqSection,
        wpDraftPostId,
        wpDraftUrl,
      };
    }),
});
