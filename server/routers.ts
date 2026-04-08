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
  getPlatformStrategy,
  listContentItems,
  listGeneratedImages,
  listPlatformStrategies,
  updateContentItem,
  upsertPlatformStrategy,
} from "./db";

// Platform-specific prompt templates for Pedram's voice
const PLATFORM_PROMPTS: Record<string, string> = {
  linkedin: `You are writing for Dr. Pedram Shojai (The Urban Monk) on LinkedIn. His audience is high-achieving corporate executives, entrepreneurs, and professionals aged 35-55. 

VOICE: Professional, authoritative, data-informed, challenges hustle culture, bridges ancient wisdom with modern science. Tone is direct, confident, slightly provocative. No fluff.

FORMAT: 
- Hook (first line must stop the scroll — bold statement, counterintuitive insight, or provocative question)
- 3-5 short paragraphs (2-4 sentences each)
- End with a thought-provoking question or call to action
- 150-300 words total
- No hashtags in the body; add 3-5 relevant hashtags at the very end
- Use line breaks for readability

CONTENT PILLARS: Performance optimization, biological hardware, gut-brain connection, energy management, upstream medicine, the cost of ignoring your health, ancient wisdom applied to modern life.`,

  meta: `You are writing for Dr. Pedram Shojai (The Urban Monk) on Instagram/Facebook. His audience is health-conscious professionals and wellness seekers aged 28-50.

VOICE: Warm, relatable, inspiring, educational but accessible. Bridges science and spirituality. Personal stories welcome. Empathetic but direct.

FORMAT:
- Hook (first 1-2 lines must be compelling before the "more" cutoff)
- Story or insight (3-5 short paragraphs)
- Clear takeaway or lesson
- Call to action (comment, save, share, or link in bio)
- 150-250 words
- 5-10 relevant hashtags at the end

CONTENT PILLARS: Daily practices, mindfulness, gut health, energy, sleep, stress, the Urban Monk Academy, personal transformation stories.`,

  x: `You are writing for Dr. Pedram Shojai (The Urban Monk) on X (Twitter). His audience is intellectually curious professionals and wellness enthusiasts.

VOICE: Sharp, punchy, thought-provoking. Challenges conventional wisdom. Mix of bold statements and nuanced insights.

FORMAT:
- Option A: Single tweet (max 280 characters) — one powerful insight or provocative statement
- Option B: Thread (5-8 tweets) — start with a hook tweet, then expand with numbered insights
- For threads: number each tweet (1/, 2/, etc.)
- No hashtags unless essential (max 2)

CONTENT PILLARS: Counterintuitive health insights, performance hacks, mindset shifts, short wisdom nuggets, thread-worthy deep dives.`,

  youtube: `You are writing for Dr. Pedram Shojai (The Urban Monk) on YouTube. His audience is serious wellness seekers and high-performers looking for in-depth education.

VOICE: Educational, authoritative, storytelling-driven. Pedram is the guide/teacher. Conversational but substantive. Mix of personal experience and clinical/scientific backing.

FORMAT:
- Title ideas (3 options: curiosity-gap, how-to, and bold statement formats)
- Video description (SEO-optimized, 150-200 words)
- Script outline with sections: Hook (0-30s), Problem Setup (30s-2min), Main Content (2-8min), Solution/Teaching (8-12min), CTA (last 30s)
- Suggested chapters/timestamps

CONTENT PILLARS: Deep dives on gut health, sleep optimization, stress physiology, ancient practices, functional medicine, the Urban Monk Academy curriculum.`,
};

const DEFAULT_IMAGE_STYLE =
  "dark, moody, cinematic, high-end photography aesthetic, deep blacks, warm gold accents, professional, sophisticated, wellness and performance theme";

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
          platform: z.enum(["meta", "linkedin", "x", "youtube", "all"]).default("all"),
          status: z
            .enum(["idea", "drafting", "review", "approved", "scheduled", "published"])
            .default("idea"),
          textContent: z.string().optional(),
          notes: z.string().optional(),
        })
      )
      .mutation(async ({ input }) => {
        return createContentItem(input);
      }),

    update: protectedProcedure
      .input(
        z.object({
          id: z.number(),
          title: z.string().optional(),
          rawIdea: z.string().optional(),
          platform: z.enum(["meta", "linkedin", "x", "youtube", "all"]).optional(),
          status: z
            .enum(["idea", "drafting", "review", "approved", "scheduled", "published"])
            .optional(),
          textContent: z.string().optional(),
          imageUrl: z.string().optional(),
          imageKey: z.string().optional(),
          imagePrompt: z.string().optional(),
          scheduledAt: z.number().optional(),
          notes: z.string().optional(),
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
        return { success: true };
      }),
  }),

  // ─── AI Generation ──────────────────────────────────────────────────────────
  ai: router({
    generateContent: protectedProcedure
      .input(
        z.object({
          idea: z.string().min(1),
          platform: z.enum(["meta", "linkedin", "x", "youtube", "all"]),
          customInstructions: z.string().optional(),
        })
      )
      .mutation(async ({ input }) => {
        const platforms =
          input.platform === "all"
            ? (["linkedin", "meta", "x", "youtube"] as const)
            : [input.platform];

        const results: Record<string, string> = {};

        for (const platform of platforms) {
          const systemPrompt = PLATFORM_PROMPTS[platform] || PLATFORM_PROMPTS.linkedin;
          const userMessage = input.customInstructions
            ? `Raw idea: ${input.idea}\n\nAdditional instructions: ${input.customInstructions}`
            : `Raw idea: ${input.idea}`;

          const response = await invokeLLM({
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: userMessage },
            ],
          });

          const rawContent = response.choices?.[0]?.message?.content;
          results[platform] =
            typeof rawContent === "string" ? rawContent : "Content generation failed.";
        }

        return results;
      }),

    generateImagePrompt: protectedProcedure
      .input(
        z.object({
          textContent: z.string(),
          platform: z.enum(["meta", "linkedin", "x", "youtube", "all"]),
        })
      )
      .mutation(async ({ input }) => {
        const response = await invokeLLM({
            messages: [
              {
                role: "system",
                content: `You are an expert at writing image generation prompts for The Urban Monk brand. 
The visual style is: ${DEFAULT_IMAGE_STYLE}.
Generate a concise, vivid image prompt (max 100 words) based on the content provided. 
Focus on mood, composition, and symbolic elements that reinforce the message.
Return ONLY the image prompt, no explanation.`,
              },
              {
                role: "user",
                content: `Generate an image prompt for this ${input.platform} content:\n\n${input.textContent}`,
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
          platform: z.enum(["meta", "linkedin", "x", "youtube", "all"]).optional(),
        })
      )
      .mutation(async ({ input }) => {
        const fullPrompt = `${input.prompt}, ${DEFAULT_IMAGE_STYLE}`;
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
});

export type AppRouter = typeof appRouter;
