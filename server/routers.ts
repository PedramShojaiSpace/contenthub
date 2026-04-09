import { COOKIE_NAME } from "@shared/const";
import { z } from "zod";
import { getSessionCookieOptions } from "./_core/cookies";
import { generateImage } from "./_core/imageGeneration";
import { invokeLLM } from "./_core/llm";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import {
  createContentItem,
  deleteContentItem,
  getContentItem,
  getDb,
  getPlatformStrategy,
  listContentItems,
  listGeneratedImages,
  listPlatformStrategies,
  updateContentItem,
  upsertPlatformStrategy,
} from "./db";
import { getBufferProfiles, pushToBuffer } from "./buffer";
import { uploadMediaFromUrl, createWpPost } from "./wordpress";
import {
  countAddressedGaps,
  getCompetitorLeaderboard,
  getCoverageTrend,
  getPersonaQueries,
  getQueryCompetitors,
  getTopGapQueries,
  getResearchReport,
  ingestGumshoeReport,
  linkQueryToContentItem,
  listResearchQueriesByReport,
  listResearchReports,
  markQueryPublished,
} from "./gumshoe";
import { sendWeeklyDigest } from "./digest";
import { notifyOwner } from "./_core/notification";
import { personasRouter } from "./personasRouter";
import { scriptsRouter } from "./scriptsRouter";
import { landingPagesRouter } from "./landingPagesRouter";
import { youtubeRouter } from "./youtubeRouter";
import { typeformRouter } from "./typeformRouter";

// Platform-specific prompt templates for Pedram's voice
// CRITICAL: All prompts must produce ONLY clean, publishable copy — no labels, headers, or internal markup.
const PLATFORM_PROMPTS: Record<string, string> = {
  linkedin: `You are a ghostwriter for Dr. Pedram Shojai (The Urban Monk) on LinkedIn. His audience is high-achieving corporate executives, entrepreneurs, and professionals aged 35-55.

VOICE: Professional, authoritative, data-informed, challenges hustle culture, bridges ancient wisdom with modern science. Direct, confident, slightly provocative. No fluff.

CRITICAL OUTPUT RULES:
- Output ONLY the finished post text — nothing else
- Do NOT include any labels, headers, or structural markers (no "Hook:", "CTA:", "Body:", "---", "[Section]", or any similar markup)
- Do NOT include any meta-commentary, instructions, or explanations
- The output must be copy-paste ready to publish directly on LinkedIn
- Start with the first word of the post itself

POST STRUCTURE (invisible — do not label these):
- First line: a scroll-stopping statement, counterintuitive insight, or provocative question
- 3-5 short paragraphs (2-4 sentences each)
- Final line: a thought-provoking question or call to action
- 150-300 words total
- No hashtags in the body; add 3-5 relevant hashtags at the very end on their own line — always include #urbanmonk as the first hashtag
- Use blank lines between paragraphs for readability

CONTENT PILLARS: Performance optimization, biological hardware, gut-brain connection, energy management, upstream medicine, the cost of ignoring your health, ancient wisdom applied to modern life.`,

  meta: `You are a ghostwriter for Dr. Pedram Shojai (The Urban Monk) on Instagram and Facebook. His audience is health-conscious professionals and wellness seekers aged 28-50.

VOICE: Warm, relatable, inspiring, educational but accessible. Bridges science and spirituality. Personal stories welcome. Empathetic but direct.

CRITICAL OUTPUT RULES:
- Output ONLY the finished post text — nothing else
- Do NOT include any labels, headers, or structural markers (no "Hook:", "CTA:", "Body:", "---", "[Section]", or any similar markup)
- Do NOT include any meta-commentary, instructions, or explanations
- The output must be copy-paste ready to publish directly on Instagram or Facebook
- Start with the first word of the post itself

POST STRUCTURE (invisible — do not label these):
- First 1-2 lines: compelling hook before the "more" cutoff
- 3-5 short paragraphs with a story, insight, or lesson
- Final line: a clear call to action (comment, save, share, or link in bio)
- 150-250 words
- 5-10 relevant hashtags on their own line at the very end — always include #urbanmonk as the first hashtag

CONTENT PILLARS: Daily practices, mindfulness, gut health, energy, sleep, stress, the Urban Monk Academy, personal transformation stories.`,

  x: `You are a ghostwriter for Dr. Pedram Shojai (The Urban Monk) on X (Twitter). His audience is intellectually curious professionals and wellness enthusiasts.

VOICE: Sharp, punchy, thought-provoking. Challenges conventional wisdom. Mix of bold statements and nuanced insights.

CRITICAL OUTPUT RULES:
- Output ONLY the finished tweet or thread text — nothing else
- Do NOT include any labels, headers, or structural markers (no "Tweet 1:", "Hook:", "Thread:", "---", or any similar markup)
- Do NOT include any meta-commentary, instructions, or explanations
- The output must be copy-paste ready to publish directly on X
- For a thread: start each tweet on a new line, numbered as 1/, 2/, 3/ etc.
- For a single tweet: output only the tweet text (max 280 characters)

- For threads: add #urbanmonk at the end of the final tweet
- For single tweets: add #urbanmonk at the end if character count allows

CONTENT PILLARS: Counterintuitive health insights, performance hacks, mindset shifts, short wisdom nuggets, thread-worthy deep dives.`,

  youtube: `You are a ghostwriter for Dr. Pedram Shojai (The Urban Monk) on YouTube. His audience is serious wellness seekers and high-performers looking for in-depth education.

VOICE: Educational, authoritative, storytelling-driven. Pedram is the guide/teacher. Conversational but substantive. Mix of personal experience and clinical/scientific backing.

CRITICAL OUTPUT RULES:
- Output ONLY the finished YouTube video description text — nothing else
- Do NOT include any labels, headers, or structural markers (no "Title:", "Description:", "Hook:", "CTA:", "---", "[Section]", or any similar markup)
- Do NOT include any meta-commentary, instructions, or explanations
- The output must be copy-paste ready to paste directly into the YouTube description field
- Start with the first word of the description itself

DESCRIPTION STRUCTURE (invisible — do not label these):
- First 2-3 lines: compelling hook that appears before the "Show more" cutoff
- 3-4 paragraphs: what viewers will learn, why it matters, Pedram's credentials on this topic
- Final paragraph: call to action (subscribe, link to Academy, etc.)
- 150-200 words total
- Include 5-8 relevant SEO keywords/phrases naturally in the text
- End with: #urbanmonk #theurbanmonk and 3-5 additional relevant hashtags

CONTENT PILLARS: Deep dives on gut health, sleep optimization, stress physiology, ancient practices, functional medicine, the Urban Monk Academy curriculum.`,

  tiktok: `You are a ghostwriter for Dr. Pedram Shojai (The Urban Monk) writing a TikTok video script. His audience is health-curious 25-45 year olds who scroll fast and need to be hooked in the first 2 seconds.

VOICE: Direct, energetic, conversational. Pedram speaks as a knowledgeable friend who cuts through the noise. Short punchy sentences. No jargon — translate science into plain language. Slightly provocative but always backed by substance.

CRITICAL OUTPUT RULES:
- Output ONLY the finished TikTok script — nothing else
- Do NOT include any labels, headers, or structural markers (no "Hook:", "Body:", "CTA:", "---", "[Section]", or any similar markup)
- Do NOT include any meta-commentary, instructions, or explanations
- The output must be copy-paste ready to use as a speaking script
- Start with the first spoken word of the video

SCRIPT STRUCTURE (invisible — do not label these):
- First sentence (0-2 sec): a bold hook that stops the scroll — a shocking stat, counterintuitive claim, or direct challenge
- Middle (3-50 sec): 3-4 punchy talking points, each 1-2 sentences. Deliver one insight per point. Build curiosity.
- Final line (50-60 sec): a clear CTA — follow for more, comment with a question, or visit the Academy
- Total spoken length: 60-90 seconds (approximately 150-220 words)
- End with 5-8 TikTok hashtags on their own line — always include #urbanmonk #drpedramshojai as the first two hashtags

CONTENT PILLARS: Quick health hacks, gut health myths, sleep optimization, stress shortcuts, ancient practices in 60 seconds, the one thing most doctors don't tell you.`,
};

// ─── Nano Banana Platform Brand Style Presets ──────────────────────────────
// Each platform has a distinct visual identity tuned for its audience and format.
// Aesthetic: warm, light, inspirational — The Urban Monk brand is uplifting, not dark.
const PLATFORM_IMAGE_STYLES: Record<string, string> = {
  linkedin: `Clean, professional, inspirational wellness aesthetic. Bright, airy composition with warm cream or soft white backgrounds. Warm terracotta and sage green accents. Natural morning light, soft shadows. Conveys clarity, wisdom, and high performance. Minimalist but warm. Think Harvard Business Review meets a mindful wellness retreat. Aspect ratio 1:1 or 4:5.`,

  meta: `Warm, uplifting, aspirational lifestyle photography. Bright natural light, earthy tones — warm sage greens, soft terracottas, golden morning light. Human connection with nature, open skies, peaceful contemplative moments. Evokes transformation, vitality, and inner peace. Authentic, radiant, hopeful. Think National Geographic meets a sunrise yoga retreat. Aspect ratio 4:5 or 9:16 for Stories.`,

  x: `Bold, clean, thought-provoking. Bright backgrounds with a single warm accent color. Minimal elements — one strong visual metaphor in warm tones. High-contrast but light and airy. Intellectual, provocative, but uplifting. Think a clean wellness editorial meets modern science communication. Aspect ratio 16:9 or 1:1.`,

  youtube: `Bright, inviting thumbnail composition. Warm golden-hour lighting — soft shadows, single warm light source. Rich, warm colors with a light base. Evokes discovery, wisdom, and transformation. Strong foreground subject (anonymous human silhouette or symbolic object bathed in warm light). Feels like a still from an uplifting wellness documentary. Aspect ratio 16:9. High visual impact at small sizes.`,

  all: `Warm, bright, inspirational. Soft morning light with golden and sage green accents. High-end wellness photography aesthetic. Professional, sophisticated, uplifting. Bridges ancient wisdom and modern science. Wellness and peak performance theme. Timeless, editorial quality. Light backgrounds, warm tones.`,

  tiktok: `Vertical 9:16 format. High-energy, vibrant composition. Warm, saturated colors — sunrise oranges, golden yellows, bright sage greens. Bold, dynamic framing. A single striking visual element (symbolic object, dramatic close-up, or abstract concept) that reads instantly at thumbnail size. Energetic, optimistic, scroll-stopping. No text overlay.`,

  blog: `Wide-format editorial hero image (16:9). Warm, authoritative, and contemplative. Soft golden morning light with warm cream and sage tones. A single light source illuminating a symbolic object or anonymous human figure from the side. Think a high-end wellness magazine or an uplifting documentary thumbnail. No text overlay. Evokes wisdom, transformation, hope, and scientific depth. Timeless, warm quality.`,
};

// Blog-specific AI prompt — produces a full SEO-optimized article in clean Markdown
const BLOG_PROMPT = `You are a ghostwriter for Dr. Pedram Shojai (The Urban Monk) writing a long-form blog article for theurbanmonk.com.

His audience is educated, health-conscious adults aged 30-55 who are serious about optimizing their biology, reducing stress, and integrating ancient wisdom with modern science. They are skeptical of hype but open to evidence-based alternatives.

VOICE: Authoritative, educational, deeply knowledgeable. Pedram writes as a doctor, a Taoist monk, a filmmaker, and a father. He bridges Eastern philosophy and Western medicine without being preachy. He challenges conventional thinking with science and story. Warm but direct. No fluff.

CRITICAL OUTPUT RULES:
- Output ONLY a valid JSON object — nothing else, no preamble, no explanation
- The JSON must have exactly these fields:
  {
    "title": "The SEO-optimized article title",
    "slug": "url-friendly-slug-with-hyphens",
    "metaDescription": "150-160 character meta description for SEO",
    "focusKeyword": "primary SEO keyword phrase",
    "article": "the full article in clean Markdown"
  }
- The article field must be clean Markdown only — no JSON escaping issues, use \\n for newlines
- Do NOT include the title as an H1 in the article body (it will be rendered separately)
- Article structure: intro paragraph (hook), 4-6 H2 sections with 2-4 paragraphs each, conclusion paragraph, CTA paragraph linking to the Urban Monk Academy
- Total article length: 800-1200 words
- Use H2 headings (##) for main sections, H3 (###) for subsections if needed
- Include 1-2 relevant internal references to Pedram's books or the Academy naturally in the text
- End with a CTA paragraph that naturally leads to the Urban Monk Academy

CONTENT PILLARS: Gut-brain axis, sleep optimization, stress physiology, energy management, Taoist philosophy applied to modern life, functional medicine, the cost of ignoring upstream health, ancient practices with scientific backing.`;

const DEFAULT_IMAGE_STYLE = PLATFORM_IMAGE_STYLES.all;

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  // ─── Content Items ──────────────────────────────────────────────────────────
  content: router({
    list: protectedProcedure.query(async () => {
      return listContentItems();
    }),

    get: protectedProcedure.input(z.object({ id: z.number() })).query(async ({ input }) => {
      return getContentItem(input.id);
    }),

    create: protectedProcedure
      .input(
        z.object({
          title: z.string().min(1),
          rawIdea: z.string().optional(),
          platform: z.enum(["meta", "linkedin", "x", "youtube", "tiktok", "blog", "all"]).default("all"),
          status: z
            .enum(["idea", "drafting", "review", "approved", "scheduled", "published"])
            .default("idea"),
          textContent: z.string().optional(),
          notes: z.string().optional(),
          gapQueryId: z.number().optional(), // Research Intelligence: link to source Gumshoe gap query
          personaId: z.number().optional(), // Target audience persona
          contentGoal: z.enum(["audience_growth", "llm_seo", "community_engagement"]).optional(),
        })
      )
      .mutation(async ({ input }) => {
        const item = await createContentItem(input);
        // If created from a gap query, mark the query as in_progress
        if (input.gapQueryId && item) {
          await linkQueryToContentItem(input.gapQueryId, (item as { id: number }).id);
        }
        return item;
      }),

    update: protectedProcedure
      .input(
        z.object({
          id: z.number(),
          title: z.string().optional(),
          rawIdea: z.string().optional(),
          platform: z.enum(["meta", "linkedin", "x", "youtube", "tiktok", "blog", "all"]).optional(),
          status: z
            .enum(["idea", "drafting", "review", "approved", "scheduled", "published"])
            .optional(),
          textContent: z.string().optional(),
          imageUrl: z.string().optional(),
          imageKey: z.string().optional(),
          imagePrompt: z.string().optional(),
          scheduledAt: z.number().optional(),
          publishedAt: z.number().optional(),
          publishUrl: z.string().optional(),
          notes: z.string().optional(),
          analyticsViews: z.number().optional(),
          analyticsLikes: z.number().optional(),
          analyticsComments: z.number().optional(),
          analyticsShares: z.number().optional(),
          personaId: z.number().optional(),
          contentGoal: z.enum(["audience_growth", "llm_seo", "community_engagement"]).optional(),
          wpPostId: z.number().optional(),
        })
      )
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        await updateContentItem(id, data);
        return { success: true };
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await deleteContentItem(input.id);
        return { success: true };
      }),

    changeStatus: protectedProcedure
      .input(
        z.object({
          id: z.number(),
          status: z.enum(["idea", "drafting", "review", "approved", "scheduled", "published"]),
        })
      )
      .mutation(async ({ input }) => {
        await updateContentItem(input.id, { status: input.status });

        // If moving to Published, auto-mark any linked gap query as addressed
        if (input.status === "published") {
          const item = await getContentItem(input.id);
          if (item?.gapQueryId) {
            await markQueryPublished(item.gapQueryId);
          }
        }

        return { success: true };
      }),
  }),

  // ─── AI Generation ──────────────────────────────────────────────────────────
  ai: router({
    generateContent: protectedProcedure
      .input(
        z.object({
          idea: z.string().min(1),
          platform: z.enum(["meta", "linkedin", "x", "youtube", "tiktok", "blog", "all"]),
          customInstructions: z.string().optional(),
          generateImages: z.boolean().default(true), // auto-generate images alongside content
          personaId: z.number().optional(), // inject Typeform-enriched persona pain points
        })
      )
      .mutation(async ({ input }) => {
        const platforms =
          input.platform === "all"
            ? (["linkedin", "meta", "x", "youtube"] as const)
            : ([input.platform] as const);

        // Load persona pain points from DB if personaId is provided
        let personaContext = "";
        if (input.personaId) {
          try {
            const db = await getDb();
            if (db) {
              const { personas } = await import("../drizzle/schema");
              const { eq } = await import("drizzle-orm");
              const found = await db.select().from(personas).where(eq(personas.id, input.personaId));
              if (found.length > 0) {
                const p = found[0];
                const pains: string[] = JSON.parse((p as any).painPoints ?? "[]");
                const aspirations: string[] = JSON.parse((p as any).aspirations ?? "[]");
                if (pains.length > 0 || aspirations.length > 0) {
                  personaContext = `\n\nTARGET PERSONA — ${(p as any).name}:\n`;
                  if (pains.length > 0) personaContext += `Real pain points from survey data: ${pains.slice(0, 6).join("; ")}\n`;
                  if (aspirations.length > 0) personaContext += `Real aspirations from survey data: ${aspirations.slice(0, 4).join("; ")}\n`;
                  personaContext += `Speak directly to these real concerns in the content.`;
                }
              }
            }
          } catch (err) {
            console.warn("[AI] Could not load persona pain points:", err);
          }
        }

        // Step 1: Generate all platform text in parallel
        const textResults = await Promise.all(
          platforms.map(async (platform) => {
            const systemPrompt = PLATFORM_PROMPTS[platform] || PLATFORM_PROMPTS.linkedin;
            const userMessage = input.customInstructions
              ? `Raw idea: ${input.idea}\n\nAdditional instructions: ${input.customInstructions}${personaContext}`
              : `Raw idea: ${input.idea}${personaContext}`;

            const response = await invokeLLM({
              messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: userMessage },
              ],
            });

            const rawContent = response.choices?.[0]?.message?.content;
            const text = typeof rawContent === "string" ? rawContent : "Content generation failed.";

            // Generate a clean, short title for this content item (used as Kanban card title)
            const titleResponse = await invokeLLM({
              messages: [
                {
                  role: "system",
                  content: `You are a content editor. Given a piece of social media content, write a clean, descriptive title for it. The title should:\n- Be 5-10 words maximum\n- Be specific and descriptive (not generic like "LinkedIn Post")\n- Capture the core message or hook\n- Read like a headline, not a label\n- Return ONLY the title — no quotes, no punctuation at the end, no explanation`,
                },
                {
                  role: "user",
                  content: `Write a title for this ${platform} content:\n\n${text.slice(0, 400)}`,
                },
              ],
            });
            const rawTitle = titleResponse.choices?.[0]?.message?.content;
            const title = typeof rawTitle === "string" ? rawTitle.trim().replace(/^["']|["']$/g, "").slice(0, 80) : input.idea.slice(0, 80);

            return { platform, text, title };
          })
        );

        // Step 2: Generate platform-specific images in parallel (if enabled)
        const imageResults: Record<string, string> = {};
        if (input.generateImages) {
          await Promise.all(
            textResults.map(async ({ platform, text }) => {
              try {
                const platformStyle = PLATFORM_IMAGE_STYLES[platform] ?? DEFAULT_IMAGE_STYLE;

                // First generate a tailored image prompt from the content
                const promptResponse = await invokeLLM({
                  messages: [
                    {
                      role: "system",
                      content: `You are an expert visual director for The Urban Monk brand (Dr. Pedram Shojai). You write precise, evocative image generation prompts.

Platform visual style for ${platform.toUpperCase()}: ${platformStyle}

Rules:
- Generate a concise, vivid image prompt (max 80 words)
- Focus on mood, lighting, composition, and symbolic elements that reinforce the message
- Do NOT include people who look like the author — use anonymous silhouettes or symbolic objects
- The image should convey the FEELING of the content, not illustrate it literally
- Return ONLY the image prompt, no explanation or preamble`,
                    },
                    {
                      role: "user",
                      content: `Generate a Nano Banana image prompt for this ${platform} content:\n\n${text.slice(0, 600)}`,
                    },
                  ],
                });

                const rawPrompt = promptResponse.choices?.[0]?.message?.content;
                const imagePrompt = typeof rawPrompt === "string" ? rawPrompt : input.idea;
                const fullPrompt = `${imagePrompt}. Visual style: ${platformStyle}`;

                const { url } = await generateImage({ prompt: fullPrompt });
                if (url) imageResults[platform] = url;
              } catch (err) {
                // Image generation failure is non-fatal — content still returns
                console.warn(`[AI] Image generation failed for ${platform}:`, err);
              }
            })
          );
        }

        // Step 3: Assemble combined results
        const results: Record<string, { text: string; imageUrl?: string; title: string }> = {};
        for (const { platform, text, title } of textResults) {
          results[platform] = { text, imageUrl: imageResults[platform], title };
        }

        return results;
      }),

    // Return all platform style descriptions for the UI
    getPlatformStyles: protectedProcedure.query(() => {
      return PLATFORM_IMAGE_STYLES;
    }),

    generateImagePrompt: protectedProcedure
      .input(
        z.object({
          textContent: z.string(),
          platform: z.enum(["meta", "linkedin", "x", "youtube", "tiktok", "blog", "all"]),
        })
      )
      .mutation(async ({ input }) => {
        const platformStyle = PLATFORM_IMAGE_STYLES[input.platform] ?? DEFAULT_IMAGE_STYLE;
        const response = await invokeLLM({
            messages: [
              {
                role: "system",
                content: `You are an expert visual director for The Urban Monk brand (Dr. Pedram Shojai). You write precise, evocative image generation prompts.

Platform visual style for ${input.platform.toUpperCase()}: ${platformStyle}

Rules:
- Generate a concise, vivid image prompt (max 120 words)
- Focus on mood, lighting, composition, and symbolic elements that reinforce the message
- Do NOT include people who look like the author — use anonymous silhouettes or symbolic objects
- The image should convey the FEELING of the content, not illustrate it literally
- Return ONLY the image prompt, no explanation or preamble`,
              },
              {
                role: "user",
                content: `Generate a Nano Banana image prompt for this ${input.platform} content:\n\n${input.textContent}`,
              },
            ],
          });

        const rawPrompt = response.choices?.[0]?.message?.content;
        return {
          prompt: typeof rawPrompt === "string" ? rawPrompt : "",
        };
      }),

    generateImage: protectedProcedure
      .input(
        z.object({
          prompt: z.string(),
          contentItemId: z.number().optional(),
          platform: z.enum(["meta", "linkedin", "x", "youtube", "tiktok", "blog", "all"]).optional(),
          styleOverride: z.string().optional(),
        })
      )
      .mutation(async ({ input }) => {
        const platformStyle = PLATFORM_IMAGE_STYLES[input.platform ?? "all"] ?? DEFAULT_IMAGE_STYLE;
        const styleToUse = input.styleOverride || platformStyle;
        const fullPrompt = `${input.prompt}. Visual style: ${styleToUse}`;
        const { url } = await generateImage({ prompt: fullPrompt });

        // Save to generated_images table
        const dbModule = await import("./db");
        const { getDb } = dbModule;
        const schemaModule = await import("../drizzle/schema");
        const { generatedImages: genImagesTable } = schemaModule;
        const drizzleDb = await getDb();
        if (drizzleDb && url) {
          await drizzleDb.insert(genImagesTable).values({
            contentItemId: input.contentItemId ?? undefined,
            platform: input.platform ?? "all",
            imageUrl: url,
            prompt: input.prompt,
          });
        }

        return { url };
      }),

    generateBlog: protectedProcedure
      .input(
        z.object({
          idea: z.string().min(1),
          customInstructions: z.string().optional(),
          generateImage: z.boolean().default(true),
          gapQueryId: z.number().optional(),
          gapQueryText: z.string().optional(),
        })
      )
      .mutation(async ({ input }) => {
        // Step 1: Generate the full blog article as structured JSON
        const userMessage = [
          `Raw idea: ${input.idea}`,
          input.gapQueryText ? `\nThis article should directly answer the LLM search query: "${input.gapQueryText}"` : "",
          input.customInstructions ? `\nAdditional instructions: ${input.customInstructions}` : "",
        ]
          .filter(Boolean)
          .join("");

        const response = await invokeLLM({
          messages: [
            { role: "system", content: BLOG_PROMPT },
            { role: "user", content: userMessage },
          ],
        });

        const rawContent = response.choices?.[0]?.message?.content;
        let blogData: {
          title: string;
          slug: string;
          metaDescription: string;
          focusKeyword: string;
          article: string;
        } | null = null;

        if (typeof rawContent === "string") {
          try {
            // Strip any markdown code fences if present
            const cleaned = rawContent.replace(/^```json\n?|^```\n?|\n?```$/g, "").trim();
            blogData = JSON.parse(cleaned);
          } catch {
            // Fallback: treat the whole response as the article
            blogData = {
              title: input.idea.slice(0, 80),
              slug: input.idea.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 60),
              metaDescription: "",
              focusKeyword: "",
              article: rawContent,
            };
          }
        }

        if (!blogData) {
          throw new Error("Blog generation failed — no content returned.");
        }

        // Step 2: Generate the hero image in parallel (16:9 blog style)
        let heroImageUrl: string | undefined;
        if (input.generateImage) {
          try {
            const blogStyle = PLATFORM_IMAGE_STYLES.blog ?? DEFAULT_IMAGE_STYLE;
            const promptResponse = await invokeLLM({
              messages: [
                {
                  role: "system",
                  content: `You are an expert visual director for The Urban Monk brand. Write a concise, evocative image generation prompt (max 80 words) for a blog hero image. Style: ${blogStyle}. Return ONLY the prompt, no explanation.`,
                },
                {
                  role: "user",
                  content: `Blog title: ${blogData.title}\nArticle intro: ${blogData.article.slice(0, 400)}`,
                },
              ],
            });
            const rawPrompt = promptResponse.choices?.[0]?.message?.content;
            const imagePrompt = typeof rawPrompt === "string" ? rawPrompt : input.idea;
            const fullPrompt = `${imagePrompt}. Visual style: ${blogStyle}`;
            const { url } = await generateImage({ prompt: fullPrompt });
            heroImageUrl = url;
          } catch (err) {
            console.warn("[AI] Blog hero image generation failed:", err);
          }
        }

        // Estimate read time (avg 200 words/min)
        const wordCount = blogData.article.split(/\s+/).length;
        const readTime = Math.max(1, Math.round(wordCount / 200));

        return {
          ...blogData,
          heroImageUrl,
          wordCount,
          readTime,
        };
      }),
  }),

  // ─── Platform Strategies ────────────────────────────────────────────────────
  strategy: router({
    list: protectedProcedure.query(async () => {
      return listPlatformStrategies();
    }),

    get: protectedProcedure
      .input(z.object({ platform: z.enum(["meta", "linkedin", "x", "youtube"]) }))
      .query(async ({ input }) => {
        return getPlatformStrategy(input.platform);
      }),

    upsert: protectedProcedure
      .input(
        z.object({
          platform: z.enum(["meta", "linkedin", "x", "youtube"]),
          voiceGuidelines: z.string().optional(),
          promptTemplate: z.string().optional(),
          documentUrl: z.string().optional(),
        })
      )
      .mutation(async ({ input }) => {
        await upsertPlatformStrategy(input);
        return { success: true };
      }),
  }),

  // ─── Asset Library ──────────────────────────────────────────────────────────
  assets: router({
    listImages: protectedProcedure
      .input(z.object({ contentItemId: z.number().optional() }))
      .query(async ({ input }) => {
        return listGeneratedImages(input.contentItemId);
      }),
  }),

  // ─── Buffer Syndication ──────────────────────────────────────────────────────
  syndication: router({
    // List all connected Buffer profiles
    getProfiles: protectedProcedure.query(async () => {
      return getBufferProfiles();
    }),

    // Diagnostic: returns raw Buffer API response for debugging token/scope issues
    diagnose: protectedProcedure.query(async () => {
      const { getBufferProfilesRaw } = await import("./buffer");
      return getBufferProfilesRaw();
    }),

    // Push content to Buffer for selected platform profiles
    push: protectedProcedure
      .input(
        z.object({
          contentItemId: z.number(),
          text: z.string().min(1),
          profileIds: z.array(z.string()).min(1),
          imageUrl: z.string().optional(),
          scheduledAt: z.number().optional(),
        })
      )
      .mutation(async ({ input }) => {
        const result = await pushToBuffer({
          text: input.text,
          profileIds: input.profileIds,
          imageUrl: input.imageUrl,
          scheduledAt: input.scheduledAt,
        });

        // If successful, update the content item status to 'scheduled'
        if (result.success) {
          await updateContentItem(input.contentItemId, {
            status: "scheduled",
            notes: `Buffer ID: ${result.bufferId ?? "queued"}`,
          });
        }

        return result;
      }),
  }),

  // ─── Research Intelligence (Gumshoe AI) ──────────────────────────────────
  research: router({
    // List all uploaded reports
    listReports: protectedProcedure.query(async () => {
      return listResearchReports();
    }),

    // Get a single report
    getReport: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return getResearchReport(input.id);
      }),

    // Ingest a new Gumshoe report (JSON + CSV text pair)
    ingest: protectedProcedure
      .input(
        z.object({
          jsonText: z.string().min(1),
          csvText: z.string().min(1),
          weekLabel: z.string().min(1),
        })
      )
      .mutation(async ({ input }) => {
        return ingestGumshoeReport(input.jsonText, input.csvText, input.weekLabel);
      }),

    // Get all queries for a report
    listQueries: protectedProcedure
      .input(z.object({ reportId: z.number() }))
      .query(async ({ input }) => {
        return listResearchQueriesByReport(input.reportId);
      }),

    // Get top gap queries (for Creation Studio context panel)
    getTopGaps: protectedProcedure
      .input(z.object({ limit: z.number().default(5) }))
      .query(async ({ input }) => {
        return getTopGapQueries(input.limit);
      }),

    // Get competitor leaderboard for a report (or all reports)
    getCompetitorLeaderboard: protectedProcedure
      .input(z.object({ reportId: z.number().optional(), limit: z.number().default(15) }))
      .query(async ({ input }) => {
        return getCompetitorLeaderboard(input.reportId, input.limit);
      }),

    // Get all queries for a persona in a report
    getPersonaQueries: protectedProcedure
      .input(z.object({ reportId: z.number(), personaName: z.string() }))
      .query(async ({ input }) => {
        return getPersonaQueries(input.reportId, input.personaName);
      }),

    // Get competitor mentions for a specific query
    getQueryCompetitors: protectedProcedure
      .input(z.object({ queryId: z.number() }))
      .query(async ({ input }) => {
        return getQueryCompetitors(input.queryId);
      }),

    // Link a gap query to a content item (marks as in_progress)
    linkToContent: protectedProcedure
      .input(z.object({ queryId: z.number(), contentItemId: z.number() }))
      .mutation(async ({ input }) => {
        await linkQueryToContentItem(input.queryId, input.contentItemId);
        return { success: true };
      }),

    // Mark a gap query as published
    markPublished: protectedProcedure
      .input(z.object({ queryId: z.number() }))
      .mutation(async ({ input }) => {
        await markQueryPublished(input.queryId);
        return { success: true };
      }),

    // Get coverage trend data for the chart
    getCoverageTrend: protectedProcedure.query(async () => {
      return getCoverageTrend();
    }),

    // Count addressed gaps for a report
    countAddressedGaps: protectedProcedure
      .input(z.object({ reportId: z.number() }))
      .query(async ({ input }) => {
        const count = await countAddressedGaps(input.reportId);
        return { count };
      }),

    // AI: generate content brief from a gap query
    generateBriefFromGap: protectedProcedure
      .input(
        z.object({
          query: z.string(),
          personaName: z.string(),
          topicTags: z.array(z.string()),
          competitorBrands: z.array(z.string()),
          platform: z.enum(["meta", "linkedin", "x", "youtube", "tiktok", "blog", "all"]).default("all"),
        })
      )
      .mutation(async ({ input }) => {
        const competitorList = input.competitorBrands.slice(0, 5).join(", ");
        const tagList = input.topicTags.join(", ");

        const systemPrompt = `You are a content strategist for The Urban Monk (Dr. Pedram Shojai). Your job is to create a content brief that will help Urban Monk appear in LLM search results for a specific query that competitors are currently winning.

Context:
- Target persona: ${input.personaName}
- Query they are asking LLMs: "${input.query}"
- Topic angles they care about: ${tagList}
- Brands currently winning this query: ${competitorList}

Your task: Write a content brief that positions Dr. Pedram Shojai as the definitive answer to this query. The brief should:
1. Explain WHY Urban Monk is uniquely qualified to answer this (credentials, books, experience)
2. Identify the specific angle that differentiates from the competitor brands listed
3. Suggest a headline/title
4. Outline 3-5 key points to cover
5. Recommend the best content format (article, video, social thread, etc.)
6. Note any specific Urban Monk programs, books, or credentials to reference

Be specific and actionable. This brief will go directly to content creation.`;

        const response = await invokeLLM({
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: `Create a content brief to win this LLM search gap.` },
          ],
        });

        const rawContent = response.choices?.[0]?.message?.content;
        return {
          brief: typeof rawContent === "string" ? rawContent : "Brief generation failed.",
        };
      }),
  }),

  // ─── Weekly Digest ─────────────────────────────────────────────────────────────────────────────
  digest: router({
    // Manually trigger the weekly digest (admin only)
    sendNow: protectedProcedure.mutation(async () => {
      await sendWeeklyDigest();
      return { success: true };
    }),
  }),

  // ─── WordPress Publish ──────────────────────────────────────────────────────────────────────────
  blog: router({
    publish: protectedProcedure
      .input(
        z.object({
          contentItemId: z.number(),
          title: z.string(),
          slug: z.string(),
          body: z.string(),
          metaDescription: z.string().optional(),
          heroImageUrl: z.string().optional(),
          status: z.enum(["draft", "publish", "pending", "future"]).default("draft"),
          scheduledAt: z.number().optional(), // UTC ms timestamp for scheduled posts
        })
      )
      .mutation(async ({ input }) => {
        // Step 1: Upload hero image to WordPress media library (if provided)
        let featuredMediaId: number | undefined;
        let wpImageUrl: string | undefined;
        if (input.heroImageUrl) {
          try {
            const filename = `${input.slug}-hero.jpg`;
            const media = await uploadMediaFromUrl(
              input.heroImageUrl,
              filename,
              input.title
            );
            featuredMediaId = media.id;
            wpImageUrl = media.url;
          } catch (err) {
            console.warn("[WP] Hero image upload failed:", err);
          }
        }

        // Determine WP status and date
        let wpStatus = input.status;
        let wpDate: string | undefined;
        if (input.scheduledAt && input.scheduledAt > Date.now()) {
          wpStatus = "future";
          wpDate = new Date(input.scheduledAt).toISOString();
        }

        // Step 2: Create the WordPress post
        const post = await createWpPost({
          title: input.title,
          slug: input.slug,
          content: input.body,
          excerpt: input.metaDescription,
          status: wpStatus,
          featuredMediaId,
          metaDescription: input.metaDescription,
          date: wpDate,
        });

        // Step 3: Update the content item status in the database
        const newStatus = wpStatus === "publish" ? "published" : wpStatus === "future" ? "scheduled" : "drafting";
        await updateContentItem(input.contentItemId, {
          status: newStatus,
          publishUrl: post.link,
        });

        return {
          success: true,
          postId: post.id,
          postUrl: post.link,
          editUrl: post.editLink,
          wpImageUrl,
          wpStatus,
        };
      }),

    // Batch publish all approved blog posts to WordPress as drafts
    publishBatch: protectedProcedure
      .input(z.object({ contentItemIds: z.array(z.number()) }))
      .mutation(async ({ input }) => {
        const results: Array<{ id: number; success: boolean; postUrl?: string; error?: string }> = [];

        for (const id of input.contentItemIds) {
          try {
            const item = await getContentItem(id);
            if (!item || !item.textContent) {
              results.push({ id, success: false, error: "No content" });
              continue;
            }

            // Generate a slug from the title
            const slug = item.title
              .toLowerCase()
              .replace(/[^a-z0-9\s-]/g, "")
              .replace(/\s+/g, "-")
              .substring(0, 80);

            // Upload hero image if available
            let featuredMediaId: number | undefined;
            if (item.imageUrl) {
              try {
                const media = await uploadMediaFromUrl(item.imageUrl, `${slug}-hero.jpg`, item.title);
                featuredMediaId = media.id;
              } catch {
                // Non-fatal
              }
            }

            const post = await createWpPost({
              title: item.title,
              slug,
              content: item.textContent,
              status: "draft",
              featuredMediaId,
            });

            await updateContentItem(id, { status: "scheduled", publishUrl: post.link });
            results.push({ id, success: true, postUrl: post.link });
          } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : String(err);
            results.push({ id, success: false, error: msg });
          }
        }

        const succeeded = results.filter((r) => r.success).length;
        const failed = results.filter((r) => !r.success).length;
        return { results, succeeded, failed };
      }),
  }),

  personas: personasRouter,
  scripts: scriptsRouter,
  landingPages: landingPagesRouter,
  youtube: youtubeRouter,
  typeform: typeformRouter,
});
export type AppRouter = typeof appRouter;
