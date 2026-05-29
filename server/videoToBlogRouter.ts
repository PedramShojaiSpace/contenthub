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
import { createWpPost } from "./wordpress";
import { Supadata } from "@supadata/js";

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

      const systemPrompt = `You are Dr. Pedram Shojai (The Urban Monk) — Doctor of Oriental Medicine, Taoist monk, NY Times bestselling author. Write a full SEO blog post based on the YouTube video transcript provided.

CRITICAL RULES:
1. Start the article with a brief intro paragraph (2-3 sentences) that introduces the topic and naturally references the embedded video above it.
2. Write in Pedram's warm, authoritative voice — ancient wisdom meets modern science.
3. Structure: H1 title, intro, 4-6 H2 sections, FAQ section (4-6 PAA questions), conclusion with CTA to https://lightson.theurbanmonk.com/
4. Length: 1,200–1,800 words.
5. Include at least 3 internal links from the verified list.
6. DO NOT mention "transcript" or "video script" — write as if this is an original article.
7. Return ONLY the Markdown article body — no preamble, no code fences.`;

      const userMessage = `Video title: ${input.videoTitle}
${focusKwNote}
${input.customInstructions ? `\nCustom instructions: ${input.customInstructions}` : ""}
${internalLinkBlock}

VIDEO TRANSCRIPT (use as source material):
${transcriptSnippet}`;

      const articleResponse = await invokeLLM({
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMessage },
        ],
      });

      let articleBody = String(articleResponse.choices?.[0]?.message?.content ?? "").trim();
      if (!articleBody || articleBody.length < 400) {
        throw new Error("Blog generation failed — article body was empty or too short.");
      }

      // Extract SEO metadata
      const metaResponse = await invokeLLM({
        messages: [
          {
            role: "system",
            content: `Extract SEO metadata from this blog article. Return ONLY valid JSON.`,
          },
          {
            role: "user",
            content: `Article intro: ${articleBody.slice(0, 2000)}\nVideo title: ${input.videoTitle}`,
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
                title: { type: "string" },
                slug: { type: "string" },
                metaDescription: { type: "string" },
                focusKeyword: { type: "string" },
              },
              required: ["title", "slug", "metaDescription", "focusKeyword"],
              additionalProperties: false,
            },
          },
        },
      } as any);

      let meta = {
        title: input.videoTitle.slice(0, 80),
        slug: input.videoTitle.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 60),
        metaDescription: "",
        focusKeyword: input.focusKeyword ?? "",
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
      const { marked } = await import("marked");

      // Convert Markdown to HTML
      const articleHtml = await marked(input.article);

      // Prepend the YouTube embed block
      const fullContent = input.embedHtml + "\n\n" + articleHtml;

      const wpResult = await createWpPost({
        title: input.title,
        slug: input.slug,
        content: fullContent,
        status: "draft",
        metaDescription: input.metaDescription,
        focusKeyword: input.focusKeyword,
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
