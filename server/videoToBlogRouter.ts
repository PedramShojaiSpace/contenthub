/**
 * YouTube → Blog Closed-Loop Pipeline
 *
 * Workflow:
 * 1. Paste a YouTube URL
 * 2. Fetch transcript via Supadata
 * 3. Generate a full SEO blog post with the video embedded at the top
 * 4. Save as a draft content_item in the DB
 * 5. Publish to WordPress as draft
 * 6. Push the blog URL back into the YouTube video description (prepend)
 *
 * The YouTube description update requires a YouTube Data API OAuth token.
 * We reuse the Google OAuth credentials already stored in userCredentials
 * (the same ones used for Google Search Console and Google Drive).
 */

import { z } from "zod";
import { protectedProcedure, router } from "./_core/trpc";
import { invokeLLM } from "./_core/llm";
import { getDb } from "./db";
import { createWpPost, fetchAllWpPosts, findRelevantPosts } from "./wordpress";
import { Supadata } from "@supadata/js";
import { resolveOutboundLinkPlaceholders } from "./linkResolver";
import { scrubHallucinatedUrls, resolvePlaceholderLinks } from "./urlScrubber";
import { markdownToWpHtml, DEFAULT_WP_CATEGORIES, resolveOrCreateWpTags } from "./wpContentUtils";

// ── Full Yoast-optimized blog system prompt (identical to BLOG_CONTENT_RULES in routers.ts) ──
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
- Include at least 2 outbound links to high-authority sources (PubMed, Harvard Health, Mayo Clinic, NIH). Format them as: [Outbound Link: describe the study or resource you want to cite here] — the system will resolve these to real URLs automatically.
- E-E-A-T signals: weave Pedram's credentials (OMD, Taoist monk, filmmaker, author) naturally into the body.
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
- YOAST SEO CHECK #1 (CRITICAL): Does the focus keyword appear in the FIRST or SECOND sentence of the article body? If not, rewrite the opening.
- YOAST SEO CHECK #2: Does the focus keyword appear at least 10 times total in the article?
- YOAST SEO CHECK #3: Does at least ONE H2 heading contain the focus keyword or a very close synonym?
- YOAST SEO CHECK #4: Are there at least 3 internal links to theurbanmonk.com URLs from the provided list?
- YOAST SEO CHECK #5: Is the SEO title 48 characters or fewer AND starts with the focus keyword?
- YOAST SEO CHECK #6: Is the meta description EXACTLY 140-150 characters? Must NOT end with '...'.
- YOAST SEO CHECK #7: Are H2 headings varied — no more than 25% of H2s contain the exact focus keyword phrase?
- YOAST READABILITY CHECK: Is every prose block under 300 words before the next heading?
- YOAST READABILITY CHECK: Is every paragraph under 150 words?
- YOAST READABILITY CHECK — TRANSITION WORDS: Count transitions ÷ total sentences. Must be ≥30%. Target 35%.
- YOAST READABILITY CHECK — CONSECUTIVE SENTENCE STARTS: No word starts 3+ consecutive sentences.
- Does the FAQ section contain 4-6 real PAA-style questions with direct answers?
CONTENT PILLARS: Gut-brain axis and LPS endotoxemia, sleep architecture and liver detox, cortisol and HPA axis dysregulation, energy economics and time compression syndrome, Taoist philosophy applied to modern life, functional medicine and upstream health, oral microbiome and systemic inflammation, ancient practices with scientific backing (Qigong, meditation, fasting, breathwork), mitochondrial health, circadian biology, neuroplasticity and stress resilience.`;

// ── Helpers ──────────────────────────────────────────────────────────────────

function getSupadata() {
  const apiKey = process.env.SUPADATA_API_KEY;
  if (!apiKey) throw new Error("SUPADATA_API_KEY is not configured");
  return new Supadata({ apiKey });
}

/** Extract a YouTube video ID from any YouTube URL format */
function extractVideoId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/)([a-zA-Z0-9_-]{11})/,
    /^([a-zA-Z0-9_-]{11})$/, // bare video ID
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

/** Build the YouTube embed HTML block to inject at the top of the blog post */
function buildYouTubeEmbedBlock(videoId: string, title: string): string {
  return `<div class="um-video-embed" style="margin:0 0 2rem 0;position:relative;padding-bottom:56.25%;height:0;overflow:hidden;border-radius:12px;box-shadow:0 4px 24px rgba(0,0,0,0.15);">
  <iframe
    src="https://www.youtube.com/embed/${videoId}"
    title="${title.replace(/"/g, "&quot;")}"
    frameborder="0"
    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
    allowfullscreen
    style="position:absolute;top:0;left:0;width:100%;height:100%;"
  ></iframe>
</div>`;
}

/** Fetch video metadata (title, description, channel) from Supadata */
async function fetchVideoMetadata(videoId: string): Promise<{
  title: string;
  description: string;
  channelName: string;
  thumbnail: string;
}> {
  try {
    const supadata = getSupadata();
    const result = await (supadata as any).youtube.video({ videoId });
    return {
      title: result?.title ?? `YouTube Video ${videoId}`,
      description: (result?.description ?? "").slice(0, 1000),
      channelName: result?.channel?.name ?? "The Urban Monk",
      thumbnail: result?.thumbnail ?? `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
    };
  } catch {
    return {
      title: `YouTube Video ${videoId}`,
      description: "",
      channelName: "The Urban Monk",
      thumbnail: `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
    };
  }
}

/** Fetch the transcript for a single video ID via Supadata */
async function fetchTranscript(videoId: string): Promise<string> {
  const supadata = getSupadata();
  const url = `https://www.youtube.com/watch?v=${videoId}`;
  try {
    const result = await supadata.transcript({
      url,
      text: true,
      lang: "en",
      mode: "native",
    });

    if ("jobId" in result) {
      // Poll for up to 60 seconds for long videos
      for (let i = 0; i < 60; i++) {
        await new Promise((r) => setTimeout(r, 1000));
        const jobResult = await supadata.transcript.getJobStatus(result.jobId);
        if (jobResult.status === "completed") {
          return ((jobResult as any).content as string) ?? "";
        }
        if (jobResult.status === "failed") break;
      }
      return "";
    }

    return (result.content as string) ?? "";
  } catch {
    return "";
  }
}

/**
 * Update a YouTube video description by prepending the blog URL.
 * Requires a valid YouTube OAuth refresh token stored in userCredentials.
 */
async function updateYouTubeDescription(
  videoId: string,
  blogUrl: string,
  blogTitle: string,
  userId: number
): Promise<{ success: boolean; error?: string }> {
  try {
    const db = await getDb();
    if (!db) return { success: false, error: "Database unavailable" };

    const { userCredentials } = await import("../drizzle/schema");
    const { eq } = await import("drizzle-orm");
    const [creds] = await db
      .select()
      .from(userCredentials)
      .where(eq(userCredentials.userId, userId));

    const refreshToken = (creds as any)?.googleRefreshToken;
    if (!refreshToken) {
      return {
        success: false,
        error: "No Google OAuth token found. Please connect your Google account in Settings.",
      };
    }

    const { google } = await import("googleapis");
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_DRIVE_CLIENT_ID,
      process.env.GOOGLE_DRIVE_CLIENT_SECRET,
      `${process.env.WORDPRESS_URL ?? "https://content.theurbanmonk.com"}/api/google/callback`
    );
    oauth2Client.setCredentials({ refresh_token: refreshToken });

    const youtube = google.youtube({ version: "v3", auth: oauth2Client });

    // 1. Fetch current video details to get existing description
    const videoRes = await youtube.videos.list({
      part: ["snippet"],
      id: [videoId],
    });

    const videoItem = videoRes.data.items?.[0];
    if (!videoItem?.snippet) {
      return { success: false, error: "Video not found or not accessible" };
    }

    const currentDescription = videoItem.snippet.description ?? "";
    const blogLink = `📖 Read the full article: ${blogTitle}\n${blogUrl}\n\n`;

    // Only prepend if the blog URL isn't already in the description
    if (currentDescription.includes(blogUrl)) {
      return { success: true }; // Already there — idempotent
    }

    const newDescription = blogLink + currentDescription;

    // 2. Update the video description
    await youtube.videos.update({
      part: ["snippet"],
      requestBody: {
        id: videoId,
        snippet: {
          ...videoItem.snippet,
          description: newDescription,
        },
      },
    });

    return { success: true };
  } catch (err: any) {
    console.error("[VideoToBlog] YouTube description update failed:", err?.message);
    return {
      success: false,
      error: err?.message ?? "YouTube description update failed",
    };
  }
}

// ── Router ────────────────────────────────────────────────────────────────────

export const videoToBlogRouter = router({
  /**
   * Step 1: Fetch video metadata + transcript from a YouTube URL.
   * Returns enough info to preview before generating the blog.
   */
  fetchVideoInfo: protectedProcedure
    .input(
      z.object({
        youtubeUrl: z.string().min(1),
      })
    )
    .mutation(async ({ input }) => {
      const videoId = extractVideoId(input.youtubeUrl.trim());
      if (!videoId) {
        throw new Error("Invalid YouTube URL. Please paste a valid youtube.com or youtu.be link.");
      }

      const [metadata, transcript] = await Promise.all([
        fetchVideoMetadata(videoId),
        fetchTranscript(videoId),
      ]);

      return {
        videoId,
        title: metadata.title,
        description: metadata.description,
        channelName: metadata.channelName,
        thumbnail: metadata.thumbnail,
        transcript: transcript.slice(0, 8000), // cap for display
        transcriptLength: transcript.length,
        hasTranscript: transcript.length > 100,
      };
    }),

  /**
   * Step 2: Generate a full SEO blog post from the video transcript.
   * Embeds the video at the top of the post.
   * Saves the result as a draft content_item in the DB.
   * Returns the generated blog data + the new content_item ID.
   */
  generateBlogFromVideo: protectedProcedure
    .input(
      z.object({
        videoId: z.string().min(1),
        videoTitle: z.string().min(1),
        transcript: z.string(),
        customInstructions: z.string().optional(),
        focusKeyword: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const embedHtml = buildYouTubeEmbedBlock(input.videoId, input.videoTitle);
      const transcriptSnippet = input.transcript.slice(0, 6000);

      // ── Load internal link context (same as generateBlog) ───────────────────
      let internalLinkBlock = "";
      try {
        const db = await getDb();
        if (db) {
          const { wpPostIndex, verifiedLinks } = await import("../drizzle/schema");
          const { eq: eqOp } = await import("drizzle-orm");
          const allVerified = await db.select().from(verifiedLinks).where(eqOp(verifiedLinks.active, true));
          const verifiedEntries = allVerified.map((v: any) => `- [${v.title}](${v.url})`);
          const allPosts = await db.select().from(wpPostIndex).limit(300);
          const postEntries = allPosts.slice(0, 8).map((p: any) => `- [${p.title}](${p.url})`);
          const foundationLinks = [
            `- [The Urban Monk Academy](https://theurbanmonk.com/urban-monk-academy/)`,
            `- [The Urban Monk](https://theurbanmonk.com/)`,
            `- [Well.org](https://well.org/)`,
            `- [Urban Monk Nutrition](https://theurbanmonk.com/urban-monk-nutrition/)`,
          ];
          const merged = Array.from(new Set([...verifiedEntries, ...postEntries, ...foundationLinks])).slice(0, 12);
          internalLinkBlock = `\n\nVERIFIED INTERNAL LINKS — use ONLY these URLs as internal links. Include at least 3:\n${merged.join("\n")}`;
        }
      } catch {}

      const focusKwNote = input.focusKeyword
        ? `\n\nSEO NOTE: The target focus keyword is "${input.focusKeyword}". Use it in the opening paragraph, at least one H2, and 3–5 times throughout.`
        : "";

      const userMessage = `Video title: ${input.videoTitle}${focusKwNote}${input.customInstructions ? `\n\nCustom instructions: ${input.customInstructions}` : ""}
${internalLinkBlock}

VIDEO TRANSCRIPT (use as source material — do NOT mention "transcript" or "video script" in the article):
${transcriptSnippet}

IMPORTANT: Start the article with a brief 2-sentence intro that naturally references the video embedded above it. Then follow the full GhostLink OS article structure.`;

      const articleResponse = await invokeLLM({
        messages: [
          { role: "system", content: BLOG_CONTENT_RULES },
          { role: "user", content: userMessage },
        ],
      });

      let articleBody = String(articleResponse.choices?.[0]?.message?.content ?? "").trim();
      if (!articleBody || articleBody.length < 400) {
        throw new Error("Blog generation failed — article body was empty or too short.");
      }

      // ── Safety net: resolve outbound link placeholders to real URLs ──────────
      try {
        articleBody = await resolveOutboundLinkPlaceholders(articleBody);
      } catch {}

      // ── Safety net: scrub any hallucinated theurbanmonk.com URLs ─────────────
      let internalPostSummaries: Array<{ title: string; url: string }> = [];
      try {
        const db = await getDb();
        if (db) {
          const { wpPostIndex } = await import("../drizzle/schema");
          const posts = await db.select().from(wpPostIndex).limit(300);
          internalPostSummaries = posts.map((p: any) => ({ title: p.title, url: p.url }));
        }
      } catch {}
      const scrubResult = scrubHallucinatedUrls(articleBody, internalPostSummaries.map(p => p.url));
      const resolveResult = resolvePlaceholderLinks(scrubResult.body, internalPostSummaries);
      articleBody = resolveResult.body;

      // ── Extract SEO metadata via structured JSON ──────────────────────────────
      const metaResponse = await invokeLLM({
        messages: [
          {
            role: "system",
            content: `You are an SEO specialist. Extract structured metadata from this blog article. The SEO title MUST start with the focus keyword and be 48 characters or fewer. The meta description MUST be 140-150 characters and NOT end with '...'.`,
          },
          {
            role: "user",
            content: `Article intro (first 2000 chars):\n${articleBody.slice(0, 2000)}\n\nVideo title: ${input.videoTitle}${input.focusKeyword ? `\nSuggested focus keyword: ${input.focusKeyword}` : ""}`,
          },
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "blog_meta",
            strict: true,
            schema: {
              type: "object",
              properties: {
                title: { type: "string", description: "SEO title: starts with focus keyword, max 48 chars" },
                slug: { type: "string", description: "URL slug, lowercase, hyphens only, max 60 chars" },
                metaDescription: { type: "string", description: "Meta description: 140-150 chars, no trailing ellipsis" },
                focusKeyword: { type: "string", description: "Primary focus keyphrase, 2-4 words" },
                semanticKeywords: { type: "string", description: "5-8 related keywords, comma-separated" },
              },
              required: ["title", "slug", "metaDescription", "focusKeyword", "semanticKeywords"],
              additionalProperties: false,
            },
          },
        },
      } as any);

      let meta = {
        title: input.videoTitle.slice(0, 48),
        slug: input.videoTitle.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 60),
        metaDescription: "",
        focusKeyword: input.focusKeyword ?? "",
        semanticKeywords: "",
      };
      try {
        const raw = String(metaResponse.choices?.[0]?.message?.content ?? "{}");
        const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
        const parsed = JSON.parse(cleaned);
        meta = { ...meta, ...parsed };
      } catch {}

      // Prepend the YouTube embed to the article body
      const articleWithEmbed = embedHtml + "\n\n" + articleBody;

      // Save as draft content_item
      const db = await getDb();
      let contentItemId: number | undefined;
      if (db) {
        const { contentItems } = await import("../drizzle/schema");
        const result = await db.insert(contentItems).values({
          title: meta.title,
          platform: "blog" as any,
          status: "idea" as any,
          textContent: articleBody, // clean Markdown (no embed HTML) for editing
          rawIdea: `[YouTube → Blog] ${input.videoTitle}`,
          focusKeyword: meta.focusKeyword,
          yoastMetaDescription: meta.metaDescription,
          youtubeVideoId: input.videoId,
          notes: `Auto-generated from YouTube video: https://www.youtube.com/watch?v=${input.videoId}`,
        });
        contentItemId = (result as any).insertId;
      }

      return {
        contentItemId,
        videoId: input.videoId,
        title: meta.title,
        slug: meta.slug,
        metaDescription: meta.metaDescription,
        focusKeyword: meta.focusKeyword,
        article: articleBody,
        articleWithEmbed, // HTML version with embed for WP publish
        embedHtml,
        wordCount: articleBody.split(/\s+/).length,
      };
    }),

  /**
   * Step 3: Publish the generated blog post to WordPress as a draft.
   * Injects the YouTube embed at the top of the post content.
   * Returns the WP post ID, draft link, and edit link.
   */
  publishToWordPress: protectedProcedure
    .input(
      z.object({
        contentItemId: z.number().optional(),
        videoId: z.string().min(1),
        title: z.string().min(1),
        slug: z.string().min(1),
        article: z.string().min(1),
        embedHtml: z.string(),
        metaDescription: z.string().optional(),
        focusKeyword: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      // Convert Markdown to proper WordPress HTML (handles headings, bold, blockquotes, links)
      const articleHtml = markdownToWpHtml(input.article);

      // Prepend the YouTube embed block
      const fullContent = input.embedHtml + "\n\n" + articleHtml;

      // Resolve WP categories and tags
      const categories = DEFAULT_WP_CATEGORIES;
      let tagIds: number[] = [];
      try {
        if (input.focusKeyword) {
          const wpUrl = process.env.WORDPRESS_URL ?? "https://theurbanmonk.com";
          const wpUser = process.env.WORDPRESS_USERNAME ?? "";
          const wpPass = process.env.WORDPRESS_APP_PASSWORD ?? "";
          const authHeader = `Basic ${Buffer.from(`${wpUser}:${wpPass}`).toString("base64")}`;
          tagIds = await resolveOrCreateWpTags([input.focusKeyword, "Urban Monk", "Pedram Shojai"], authHeader, wpUrl);
        }
      } catch {}

      const wpResult = await createWpPost({
        title: input.title,
        slug: input.slug,
        content: fullContent,
        status: "draft",
        metaDescription: input.metaDescription,
        focusKeyword: input.focusKeyword,
        categories,
        tags: tagIds,
      });

      // Update the content_item with the WP post ID
      if (input.contentItemId) {
        const db = await getDb();
        if (db) {
          const { contentItems } = await import("../drizzle/schema");
          const { eq } = await import("drizzle-orm");
          await db
            .update(contentItems)
            .set({ wpPostId: wpResult.id, status: "ready_to_post" as any })
            .where(eq(contentItems.id, input.contentItemId));
        }
      }

      return {
        wpPostId: wpResult.id,
        link: wpResult.link,
        editLink: wpResult.editLink,
        status: wpResult.status,
      };
    }),

  /**
   * Step 4: Push the blog URL back into the YouTube video description.
   * Prepends "📖 Read the full article: [title]\n[url]\n\n" to the existing description.
   * Requires the user to have a Google OAuth refresh token stored.
   */
  updateYouTubeDescription: protectedProcedure
    .input(
      z.object({
        videoId: z.string().min(1),
        blogUrl: z.string().url(),
        blogTitle: z.string().min(1),
        contentItemId: z.number().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const result = await updateYouTubeDescription(
        input.videoId,
        input.blogUrl,
        input.blogTitle,
        ctx.user.id
      );

      // Track that the YouTube description was updated
      if (result.success && input.contentItemId) {
        const db = await getDb();
        if (db) {
          const { contentItems } = await import("../drizzle/schema");
          const { eq } = await import("drizzle-orm");
          await db
            .update(contentItems)
            .set({
              notes: `Auto-generated from YouTube video: https://www.youtube.com/watch?v=${input.videoId}\nBlog URL pushed to YouTube description: ${input.blogUrl}`,
            })
            .where(eq(contentItems.id, input.contentItemId));
        }
      }

      return result;
    }),

  /**
   * Step 2b: Generate an SEO-optimized YouTube description for the video.
   * Uses the Urban Monk description framework:
   *   Hook → Body → Timestamps → Channel Footer
   * Automatically injects the blog post URL (if available) as a CTA
   * and points the blog post back to the video.
   */
  generateYouTubeDescription: protectedProcedure
    .input(
      z.object({
        videoId: z.string().min(1),
        videoTitle: z.string().min(1),
        transcript: z.string(),
        blogUrl: z.string().url().optional(), // injected after blog is published
        blogTitle: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const transcriptSnippet = input.transcript.slice(0, 6000);

      const blogCta = input.blogUrl
        ? `\n📝 Read the full article: ${input.blogTitle ?? "Full Blog Post"}\n${input.blogUrl}\n`
        : "";

      const systemPrompt = `You are an expert YouTube SEO strategist for The Urban Monk channel. Your job is to write a fully optimized YouTube video description. Always refer to the host as Dr. Pedram Shojai.

Write the description using EXACTLY this structure:

1. HOOK (first 2-3 sentences):
   - Must contain the primary keyword or topic of the video
   - Written to appear in YouTube search previews
   - Describes what the viewer will learn or gain
   - Do NOT start with "In this video"

2. BODY (150-200 words):
   - Expand on the key topics, insights, and takeaways from the video
   - Use natural language that includes relevant search keywords
   - Write in second person (you/your) addressing the viewer directly
   - Mention Dr. Pedram Shojai / The Urban Monk at least once
   - If a blog post URL is provided, include a natural CTA line pointing to it (e.g. "For the full breakdown, read the companion article below.")

3. TIMESTAMPS (if the transcript contains clear topic shifts):
   - List 4-6 chapter markers in format: 00:00 - Topic Name
   - If the transcript does not have enough detail to identify timestamps, skip this section entirely

4. BLOG LINK (only if blog URL provided):
   - Insert the blog CTA block exactly as given

5. CHANNEL FOOTER:
   - Paste the footer EXACTLY as provided, with no changes

FORMAT RULES:
- Output only the final description text, ready to paste into YouTube Studio
- Do not include any commentary, notes, or explanation before or after
- Do not use markdown formatting (no asterisks, no pound signs)
- Do not alter the footer section in any way
- Total description length should be 300-500 words before the footer`;

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

      const userMessage = `VIDEO TITLE: ${input.videoTitle}

TRANSCRIPT:
${transcriptSnippet}${blogCta ? `\n\nBLOG CTA TO INJECT (insert in Body section and in step 4):\n${blogCta}` : ""}

CHANNEL FOOTER (paste EXACTLY at the end):
${channelFooter}`;

      const response = await invokeLLM({
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMessage },
        ],
      });

      const description = String(response.choices?.[0]?.message?.content ?? "").trim();
      if (!description || description.length < 200) {
        throw new Error("Description generation failed — output was too short.");
      }

      return { description };
    }),

  /**
   * List recent YouTube → Blog items from the content_items table.
   */
  listVideoBlogs: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return { items: [] };

    const { contentItems } = await import("../drizzle/schema");
    const { isNotNull, desc } = await import("drizzle-orm");

    const items = await db
      .select({
        id: contentItems.id,
        title: contentItems.title,
        youtubeVideoId: contentItems.youtubeVideoId,
        wpPostId: contentItems.wpPostId,
        status: contentItems.status,
        focusKeyword: contentItems.focusKeyword,
        createdAt: contentItems.createdAt,
        notes: contentItems.notes,
      })
      .from(contentItems)
      .where(isNotNull(contentItems.youtubeVideoId))
      .orderBy(desc(contentItems.createdAt))
      .limit(50);

    return { items };
  }),
});
