import { COOKIE_NAME } from "@shared/const";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { getSessionCookieOptions } from "./_core/cookies";
import { generateImage } from "./_core/imageGeneration";
import { invokeLLM, type InvokeParams } from "./_core/llm";

// Wrapper that converts RATE_LIMIT errors from invokeLLM into user-friendly TRPCErrors
async function safeLLM(params: InvokeParams) {
  try {
    return await invokeLLM(params);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.startsWith("RATE_LIMIT:")) {
      throw new TRPCError({
        code: "TOO_MANY_REQUESTS",
        message: "AI generation limit reached. Please wait 30–60 seconds and try again.",
      });
    }
    throw err;
  }
}
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
import { getBufferProfiles, pushToBuffer, pushCarouselToBuffer } from "./buffer";
import { uploadMediaFromUrl, createWpPost, buildBlogSchemas, fetchAllWpPosts, findRelevantPosts, updateWpPostYoast, type WpPostSummary } from "./wordpress";
import { markdownToWpHtml, DEFAULT_WP_CATEGORIES, resolveOrCreateWpTags } from "./wpContentUtils";
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
import { pressRouter } from "./pressRouter";
import { mediaRouter } from "./mediaRouter";
import { avatarRouter } from "./avatarRouter";
import { ctaRouter } from "./ctaRouter";
import { growthRouter } from "./growthRouter";
import { webinarRouter } from "./webinarRouter";
import { webinarIntelligenceRouter } from "./webinarIntelligenceRouter";
import { llmProjectsRouter } from "./llmProjectsRouter";
import { kajabiOptIn } from "./kajabiApi";
import { resolveOutboundLinkPlaceholders } from "./linkResolver";

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

CHARACTER LIMIT RULES — NON-NEGOTIABLE:
- DEFAULT: Write a SINGLE tweet. Only write a thread if the idea genuinely requires multiple steps or a list.
- A single tweet MUST be 240 characters or fewer (hard ceiling — no exceptions).
- Write SHORT from the start — aim for 160-200 characters. Never write long and trim.
- The tweet must be a COMPLETE, SELF-CONTAINED thought — begins and ends naturally, no ellipses, no cut-off sentences.
- For a THREAD (only when truly needed): write 3-5 numbered tweets (1/, 2/, 3/ etc.), each on its own line, each a COMPLETE thought, each 240 characters or fewer.
- Count your characters before outputting. If your draft exceeds 240 characters, rewrite it shorter.

URL RULE:
- If a URL is provided in the CTA block, use EXACTLY that URL — do not shorten, alter, or substitute it.
- Do NOT include a URL in a single tweet unless it was explicitly provided in the CTA block.

CRITICAL OUTPUT RULES:
- Output ONLY the finished tweet or thread text — nothing else
- Do NOT include any labels, headers, or structural markers (no "Tweet 1:", "Hook:", "Thread:", "---", or any similar markup)
- Do NOT include any meta-commentary, instructions, or explanations
- The output must be copy-paste ready to publish directly on X
- Add #urbanmonk only if it fits within the character budget

CONTENT PILLARS: Counterintuitive health insights, performance hacks, mindset shifts, short wisdom nuggets, thread-worthy deep dives.

EXAMPLE of a good single tweet (complete thought, punchy, under 200 chars):
"Most people treat exhaustion with caffeine. That's like putting tape on a leaking pipe. The real fix is upstream — your nervous system, your sleep architecture, your qi. #urbanmonk"

EXAMPLE of a bad tweet (too long, truncated, incoherent):
"Most people don't realize that the root cause of their chronic fatigue goes back to the adrenal system and how cortisol dysregulation affects..."
NEVER produce output like the bad example above.`,

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

// Blog-specific AI prompt — produces a full SEO+AEO-optimized article implementing GhostLink OS pillar standards
const BLOG_PROMPT = `You are a ghostwriter for Dr. Pedram Shojai (The Urban Monk) writing a publication-ready long-form blog article for theurbanmonk.com. This article must pass BOTH traditional Google SEO and AI Engine Optimization (AEO) — meaning it will be cited by ChatGPT, Perplexity, Claude, and Google AI Overviews.

AUDIENCE: Educated, health-conscious adults aged 30-55. Ambitious professionals, parents, and seekers who are serious about optimizing their biology, reducing chronic stress, and integrating ancient wisdom with modern science. They are skeptical of hype but hungry for evidence-based alternatives. They have tried conventional medicine and found it lacking. They want depth, not listicles.

VOICE (GhostLink OS B6 Voice Rules — non-negotiable):
- Sentences ≤18 words average. Break anything longer.
- No adverbs modifying verbs. Pick a stronger verb.
- BANNED WORDS: leverage, strategic, solutions, stakeholder, ecosystem, robust, synergy, paradigm, best-in-class, world-class, empowering, transforming, revolutionizing, unlocking, perhaps, maybe, kind of, sort of, in today's world, at the end of the day
- Concrete nouns over abstract nouns. Every bold claim has a receipt within 2 sentences.
- Direct address: "you" and "we" — never "one" or "users"
- Opinions land hard. No "I think maybe."
- Pedram writes as a doctor (OMD), a Taoist monk, a filmmaker, and a father. Warm but direct. He cites mechanisms (not just studies). He tells short stories. Never condescending. No fluff.

CRITICAL OUTPUT RULES:
- Output ONLY a valid JSON object — nothing else, no preamble, no explanation, no markdown code fences
- The JSON must have EXACTLY these fields:
  {
    "title": "H1 headline — must contain the primary keyword, 50-65 chars, use one of the 12 Hook Families: Pain-Based, Desire-Based, Contrarian, Truth Bomb, Pattern Interrupt, Misconception, Data/Proof, Experience, Identity, Challenge, Story, or Framework Preview",
    "slug": "url-friendly-slug-max-60-chars — must contain the primary keyword",
    "metaDescription": "150-160 chars — include focus keyword in first 20 chars, state the benefit clearly, end with a soft CTA",
    "focusKeyword": "primary SEO keyword phrase (2-4 words) — the exact phrase the target audience types into Google",
    "semanticKeywords": ["3-5 semantic variant phrases that support the focus keyword — weave these naturally into H2s and body"],
    "hookFamily": "which of the 12 Hook Families was used for the title",
    "emotionalDriver": "which of the 7 Emotional Drivers (Clarity, Pain, Belonging, Authority, Courage, Identity, Inspiration) is primary",
    "faqSection": "a Markdown FAQ section with 4-6 questions formatted as: ### Question\\nAnswer (2-3 sentences, direct, no fluff). Questions must be real People Also Ask (PAA) queries for this topic.",
    "waterfallMap": "a brief 5-item list of derivative content pieces this article can generate: e.g. 1. Short-form video hook (Pain driver), 2. LinkedIn post (Authority driver), etc.",
    "article": "the full article in clean Markdown"
  }
- The article field must be CLEAN Markdown — escape any double quotes inside the JSON string as \\" — use \\n for newlines
- Do NOT include the title as an H1 in the article body (rendered separately)
- Do NOT include any labels like 'Hook:', 'CTA:', 'Section 1:', or '---' dividers

ARTICLE STRUCTURE (follow exactly — this is the GhostLink OS Written Pillar Architecture):

1. OPENING HOOK (2-3 paragraphs, 200-250 words):
   Select hook from the 12 families based on emotional driver. Start with the painful truth — a provocative statement, a surprising statistic, or a brief patient story. Establish the problem viscerally. Make the reader feel seen. End with a bridge sentence that promises real answers. The first sentence must pass the 3-second scroll test: specific, tensioned, relevant.

3. THE HIDDEN PROBLEM — WHY THIS IS HAPPENING (1 H2, 2-3 paragraphs, 200-250 words):
   H2 must contain a semantic keyword and answer a PAA-style question. Diagnose the root cause — the biology, physiology, Taoist or functional medicine lens. Name the surface symptom, reveal the root cause, explain the mechanism, validate their effort. This earns the right to teach.

4. WHAT MOST PEOPLE GET WRONG (1 H2, 2-3 paragraphs, 200-250 words):
   H2 must contain a semantic keyword. Use the 3-Mistake Pattern: (1) the Tactic mistake — what they're doing that doesn't work, (2) the Mindset mistake — what false belief holds them back, (3) the System mistake — what process or structure is missing. Challenge mainstream medicine AND the wellness industry. Be specific. Be bold.

5. THE FRAMEWORK — [GIVE IT A MEMORABLE NAME] (1-2 H2 sections, 3-4 paragraphs each, 300-400 words):
   H2 must contain the focus keyword or a semantic variant. Name the framework (e.g. "The 3-Gate Protocol" or "The Upstream Reset Method"). For each step: give it a memorable name, teach the core concept, name the common mistake, give a mini-example. Include specific actionable practices — Qigong, breathwork, dietary shifts, supplement protocols, sleep hygiene, nervous system regulation. Reference Pedram's books or podcast episodes naturally as proof.

6. PRACTICAL PROTOCOL (1 H2, 2-3 paragraphs, 150-200 words):
   H2 must be a question (e.g. "How Do You Start This Week?"). Give 3-5 numbered concrete steps. Be specific — not "reduce stress" but "practice 5 minutes of Qigong before breakfast for 30 days."

7. TRANSFORMATION VISION (1-2 paragraphs, 100-150 words):
   Paint the future state using Identity and Inspiration driver language. WHEN you apply this framework... YOU STOP [painful behavior]... YOU START [empowered behavior]... YOU BECOME [identity label]. Make the contrast vivid.

8. CLOSING + CTA (2 paragraphs, 150-200 words):
   Bring the article full circle — reference the opening hook. Close with an empowering statement. Then write a natural, non-pushy CTA paragraph that invites the reader to go deeper. Link ONLY to https://theurbanmonk.com — do NOT use any other URL, do NOT invent course names or module names, do NOT reference "the Academy" as if it is a specific product. Keep the CTA generic: invite the reader to explore more resources at The Urban Monk. Frame as the logical next step, not a sales pitch. CTA friction level: Medium (T3 — email capture or course enrollment).

9. FAQ SECTION (place at the END of the article, after the CTA):
   Use the faqSection field content here. Format: ## Frequently Asked Questions\\n[paste the FAQ content]. This section is critical for Google featured snippets and AI engine citation.

SEO + AEO INTEGRATION RULES (non-negotiable):
- H1 (title) must contain the primary focus keyword
- Each H2 must either contain a semantic keyword variant OR be phrased as a question (PAA format)
- Include a clear, direct answer to the core question within the first 300 words (woven into the opening hook — NOT as a separate TL;DR box or blockquote)
- Use sequential H2/H3 heading structure — this increases AI citation odds by 2.8x
- Weave 3-5 semantic keyword variants naturally into headings and body (not forced)
- Include at least 2 internal links to related articles on theurbanmonk.com. If a REAL INTERNAL LINK LIST is provided in the user message, use those exact URLs in Markdown format: [anchor text](url). If no list is provided, use placeholders: [INTERNAL LINK: topic of related article]
- Include at least 2 outbound links to high-authority sources (PubMed, Harvard Health, Mayo Clinic, NIH). Use real verified URLs if you know them with high confidence. For any source you are not 100% certain of, use the placeholder format: [Outbound Link: Source Name — description] — these will be resolved to real URLs automatically after generation
- The FAQ section at the bottom targets featured snippets and AI citation
- E-E-A-T signals: weave Pedram's credentials (OMD, Taoist monk, filmmaker, author) naturally into the body — not as a bio block, but as contextual authority within the teaching. IMPORTANT: Do NOT claim "NYT bestselling" or any specific award/accolade unless it is a verifiable fact. Do NOT fabricate media mentions (e.g. "As featured in The New York Times"). Do NOT reference specific YouTube series, podcast episode numbers, or course module names that may not exist — reference Pedram's work generically (e.g. "in my practice", "in my book", "in my podcast").

ABSOLUTE RULES — NEVER VIOLATE:
- NEVER use the URL urbanmonk.com — it is NOT owned by Pedram. The ONLY correct domain is theurbanmonk.com
- NEVER fabricate media citations ("As featured in...", "As seen in The New York Times", etc.)
- NEVER reference specific YouTube series, podcast episode titles, or course module names unless they are provided in the user message
- NEVER add hashtags anywhere in the article — this is a blog post, not a social media post
- NEVER include a TL;DR block or summary box — the article should flow naturally without summary callouts
- NEVER use markdown link syntax to create a link where the display text says one URL but the href is a different URL (e.g. [urbanmonk.com/academy](https://theurbanmonk.com) is FORBIDDEN)

TOTAL ARTICLE LENGTH: 1,600-2,200 words (body only, not counting FAQ). Do not stop short. Every section must be fully developed.

FORMATTING RULES:
- Use ## for H2 section headings (compelling, specific, keyword-rich — not generic like "The Solution")
- Use ### for H3 sub-headings within the framework steps
- Use **bold** for key terms or critical insights (2-4 per section maximum)
- Use > blockquote for ONE powerful pull-quote per article only — do NOT use a TL;DR blockquote
- Short paragraphs (3-5 sentences max) for readability and dwell time
- No bullet lists in the main body — write in flowing prose
- No em-dashes used as bullet substitutes
- No banned words from the Voice Rules above

QUALITY GATE (self-check before outputting):
- Does the hook pass the 3-second scroll test? Specific, tensioned, relevant?
- Is there ONE clear Big Idea the audience hasn't heard framed this way?
- Is there a named framework with 3-7 steps?
- Is the primary Emotional Driver woven throughout (not bolted on)?
- Is there proof (mechanism, study, case, process walkthrough)?
- Does the transformation vision activate Identity or Inspiration?
- Is the CTA friction level T3 (medium — course enrollment or email capture)?
- Are all banned words absent?
- Does the opening hook contain a clear, direct answer to the core question within the first 300 words?
- Does the FAQ section contain 4-6 real PAA-style questions with direct answers?

CONTENT PILLARS: Gut-brain axis and LPS endotoxemia, sleep architecture and liver detox, cortisol and HPA axis dysregulation, energy economics and time compression syndrome, Taoist philosophy applied to modern life, functional medicine and upstream health, oral microbiome and systemic inflammation, ancient practices with scientific backing (Qigong, meditation, fasting, breathwork), mitochondrial health, circadian biology, neuroplasticity and stress resilience.`;

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
          focusKeyword: z.string().optional(),         // Yoast SEO focus keyword
          seoKeywords: z.string().optional(),          // JSON array of semantic keyword strings
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
          linkedScriptId: z.number().nullable().optional(),
          focusKeyword: z.string().optional(),         // Yoast SEO focus keyword
          seoKeywords: z.string().optional(),          // JSON array of semantic keyword strings
          yoastSeoTitle: z.string().optional(),        // Yoast SEO title (shown in SERPs)
          yoastMetaDescription: z.string().optional(), // Yoast meta description (150-160 chars)
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
          gapQueryText: z.string().optional(), // Research Intelligence: inject competitor gap query
        })
      )
      .mutation(async ({ input }) => {
        // Strip internal prefixes like [Research Gap] from the idea before using as title/content
        // For multi-line LLM Projects format ("Question to answer: X\nTitle: Y\nTarget keyword: Z"),
        // extract the Title line as the primary idea; fall back to the Question line, then the raw idea.
        const extractCleanIdea = (raw: string): string => {
          const titleMatch = raw.match(/^Title:\s*(.+)$/im);
          if (titleMatch) return titleMatch[1].trim();
          const questionMatch = raw.match(/^Question to answer:\s*(.+)$/im);
          if (questionMatch) return questionMatch[1].trim();
          // Strip [Research Gap] prefix and any label prefixes from a single-line idea
          return raw
            .replace(/^\[Research Gap\]\s*/i, "")
            .replace(/^Question to answer:\s*/i, "")
            .replace(/^Title:\s*/i, "")
            .replace(/^Target keyword:\s*/i, "")
            .split("\n")[0] // take first line if still multi-line
            .trim();
        };
        const cleanIdea = extractCleanIdea(input.idea);

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
                const p = found[0] as any;
                const pains: string[] = JSON.parse(p.painPoints ?? "[]");
                const aspirations: string[] = JSON.parse(p.aspirations ?? "[]");
                const topQs: string[] = JSON.parse(p.topQuestions ?? "[]");
                const hasData = pains.length > 0 || aspirations.length > 0 || topQs.length > 0;
                if (hasData) {
                  personaContext = `\n\nTARGET PERSONA — ${p.name}:\n`;
                  if (pains.length > 0) personaContext += `Real pain points from survey data: ${pains.slice(0, 8).join("; ")}\n`;
                  if (aspirations.length > 0) personaContext += `Real aspirations from survey data: ${aspirations.slice(0, 6).join("; ")}\n`;
                  if (topQs.length > 0) personaContext += `Top questions this persona asks: ${topQs.slice(0, 5).join("; ")}\n`;
                  if (p.intelligenceReport) personaContext += `Intelligence notes: ${p.intelligenceReport.slice(0, 400)}\n`;
                  personaContext += `Speak directly to these real concerns. Use their language, mirror their fears and desires.`;
                }
              }
            }
          } catch (err) {
            console.warn("[AI] Could not load persona pain points:", err);
          }
        }

        // Load press authority block from DB
        let pressAuthorityContext = "";
        try {
          const db = await getDb();
          if (db) {
            const { pressHits } = await import("../drizzle/schema");
            const { desc } = await import("drizzle-orm");
            const topHits = await db.select().from(pressHits)
              .orderBy(desc(pressHits.impressions))
              .limit(20);
            if (topHits.length > 0) {
              const tierS = topHits.filter((h: any) => h.authorityTier === "S").slice(0, 5);
              const tierA = topHits.filter((h: any) => h.authorityTier === "A").slice(0, 5);
              const seenS = new Set<string>(); for (const h of tierS) seenS.add(h.outlet);
              const seenA = new Set<string>(); for (const h of tierA) seenA.add(h.outlet);
              const outlets = [...Array.from(seenS), ...Array.from(seenA)].join(", ");
              pressAuthorityContext = `\n\nAUTHOR CREDENTIALS (weave naturally into content where relevant):\nDr. Pedram Shojai is a New York Times bestselling author, Doctor of Oriental Medicine, and Taoist monk. He has been featured in: ${outlets}. His work has reached millions of readers and viewers across major national and industry publications.`;
            }
          }
        } catch (err) {
          console.warn("[AI] Could not load press authority block:", err);
        }
        // Load media authority context block
        let mediaAuthorityContext = "";
        try {
          const { getMediaContextBlock } = await import("./mediaRouter");
          mediaAuthorityContext = await getMediaContextBlock(input.idea, { maxAssets: 4 });
        } catch (err) {
          console.warn("[AI] Could not load media authority context:", err);
        }
        // Load avatar intelligence context block
        let avatarIntelligenceContext = "";
        try {
          const { getAvatarContextBlock } = await import("./avatarRouter");
          avatarIntelligenceContext = await getAvatarContextBlock(input.idea);
        } catch (err) {
          console.warn("[Content] Could not load avatar context:", err);
        }
        // Load webinar intelligence context block
        let webinarIntelligenceContext = "";
        try {
          const { getWebinarIntelligenceContextBlock } = await import("./webinarIntelligenceRouter");
          webinarIntelligenceContext = await getWebinarIntelligenceContextBlock(input.idea);
        } catch (err) {
          console.warn("[Content] Could not load webinar intelligence context:", err);
        }
        let ctaLabel = "Lights On (Default)";
        let ctaInjection = "";
        try {
          const { getCtaForTopic } = await import("./ctaRouter");
          const cta = await getCtaForTopic(input.idea);
          ctaLabel = cta.label;
          ctaInjection = `\n\n[CTA BLOCK — ${cta.label}]\n${cta.ctaText}\n[END CTA BLOCK]\nCRITICAL URL RULE: If this content includes a link or URL, you MUST use EXACTLY the URL provided in the CTA block above — do NOT invent, shorten, or substitute any other URL. The only permitted URL is: ${cta.url ?? "go.theurbanmonk.com/something-has-been-stolen-from-you-lo-webinar-1"}. Include this CTA naturally at the end of your content. Do not add any other call to action.`;
        } catch (err) {
          console.warn("[Content] Could not load CTA:", err);
        }
        // Step 1: Generate all platform text in parallel
        const textResults = await Promise.all(
          platforms.map(async (platform) => {
            const systemPrompt = PLATFORM_PROMPTS[platform] || PLATFORM_PROMPTS.linkedin;
            const gapQueryLine = input.gapQueryText ? `\n\nThis content should directly address the competitor gap query: "${input.gapQueryText}" — position Pedram's unique perspective as the answer.` : "";
            const userMessage = input.customInstructions
              ? `Raw idea: ${cleanIdea}\n\nAdditional instructions: ${input.customInstructions}${gapQueryLine}${personaContext}${pressAuthorityContext}${mediaAuthorityContext}${avatarIntelligenceContext}${webinarIntelligenceContext}${ctaInjection}`
              : `Raw idea: ${cleanIdea}${gapQueryLine}${personaContext}${pressAuthorityContext}${mediaAuthorityContext}${avatarIntelligenceContext}${webinarIntelligenceContext}${ctaInjection}`;

            const response = await safeLLM({
              messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: userMessage },
              ],
            });

            const rawContent = response.choices?.[0]?.message?.content;
            const text = typeof rawContent === "string" ? rawContent : "Content generation failed.";

            // Generate a clean, short title for this content item (used as Kanban card title)
            const titleResponse = await safeLLM({
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
            // Apply AP/Chicago title case to LLM-generated title and fallback
            const toTitleCase = (s: string) => {
              const LC = new Set(["a","an","the","and","but","or","nor","for","so","yet","as","at","by","in","of","on","to","up","via","vs","vs."]);
              return s.toLowerCase().split(" ").map((w,i,arr) => (!w || (i>0 && i<arr.length-1 && LC.has(w))) ? w : w.charAt(0).toUpperCase()+w.slice(1)).join(" ");
            };
            const rawTitleStr = typeof rawTitle === "string" ? rawTitle.trim().replace(/^["']|["']$/g, "").slice(0, 80) : cleanIdea.slice(0, 80);
            const title = toTitleCase(rawTitleStr);

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
                const promptResponse = await safeLLM({
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
        // For X/Twitter: enforce 280-char hard limit on every tweet/thread line.
        // Single tweets are trimmed at the last word boundary ≤0 280 chars.
        // Thread lines (starting with \d+/) are each trimmed independently.
        function enforceXLimit(text: string): string {
          const LIMIT = 280;
          const lines = text.split("\n");
          const isThread = lines.some((l) => /^\d+\//.test(l.trim()));

          if (isThread) {
            // Trim each thread tweet independently
            return lines
              .map((line) => {
                if (line.length <= LIMIT) return line;
                // Trim at last space before limit
                const trimmed = line.slice(0, LIMIT);
                const lastSpace = trimmed.lastIndexOf(" ");
                const result = lastSpace > 0 ? trimmed.slice(0, lastSpace) : trimmed;
                console.warn(`[X] Thread line trimmed from ${line.length} to ${result.length} chars.`);
                return result;
              })
              .join("\n");
          }

          // Single tweet
          if (text.length <= LIMIT) return text;
          const trimmed = text.slice(0, LIMIT);
          const lastSpace = trimmed.lastIndexOf(" ");
          const result = lastSpace > 0 ? trimmed.slice(0, lastSpace) : trimmed;
          console.warn(`[X] Tweet trimmed from ${text.length} to ${result.length} chars.`);
          return result;
        }
        const results: Record<string, { text: string; imageUrl?: string; title: string }> = {};
        for (const { platform, text, title } of textResults) {
          const finalText = platform === "x" ? enforceXLimit(text) : text;
          results[platform] = { text: finalText, imageUrl: imageResults[platform], title };
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
        const response = await safeLLM({
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
          personaId: z.number().optional(), // inject Typeform-enriched persona pain points
        })
      )
      .mutation(async ({ input }) => {
        // Strip internal prefixes like [Research Gap] from the idea before using as title/content
        // For multi-line LLM Projects format ("Question to answer: X\nTitle: Y\nTarget keyword: Z"),
        // extract the Title line as the primary idea; fall back to the Question line, then the raw idea.
        const extractCleanIdea = (raw: string): string => {
          const titleMatch = raw.match(/^Title:\s*(.+)$/im);
          if (titleMatch) return titleMatch[1].trim();
          const questionMatch = raw.match(/^Question to answer:\s*(.+)$/im);
          if (questionMatch) return questionMatch[1].trim();
          return raw
            .replace(/^\[Research Gap\]\s*/i, "")
            .replace(/^Question to answer:\s*/i, "")
            .replace(/^Title:\s*/i, "")
            .replace(/^Target keyword:\s*/i, "")
            .split("\n")[0]
            .trim();
        };
        const cleanIdea = extractCleanIdea(input.idea);

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
                const p = found[0] as any;
                const pains: string[] = JSON.parse(p.painPoints ?? "[]");
                const aspirations: string[] = JSON.parse(p.aspirations ?? "[]");
                const topQs: string[] = JSON.parse(p.topQuestions ?? "[]");
                if (pains.length > 0 || aspirations.length > 0) {
                  personaContext = `\n\nTARGET PERSONA — ${p.name}:\n`;
                  if (pains.length > 0) personaContext += `Real pain points from survey data: ${pains.slice(0, 6).join("; ")}\n`;
                  if (aspirations.length > 0) personaContext += `Real aspirations from survey data: ${aspirations.slice(0, 4).join("; ")}\n`;
                  if (topQs.length > 0) personaContext += `Top questions this persona asks: ${topQs.slice(0, 4).join("; ")}\n`;
                  personaContext += `Write the article to speak directly to this person's real concerns and goals.`;
                }
              }
            }
          } catch (err) {
            console.warn("[Blog] Could not load persona pain point context:", err);
          }
        }
        // Load press authority context block
        let blogPressContext = "";
        try {
          const db = await getDb();
          if (db) {
            const { pressHits } = await import("../drizzle/schema");
            const { desc } = await import("drizzle-orm");
            const topHits = await db.select().from(pressHits)
              .orderBy(desc(pressHits.impressions))
              .limit(20);
            if (topHits.length > 0) {
              const tierS = topHits.filter((h: any) => h.authorityTier === "S").slice(0, 5);
              const tierA = topHits.filter((h: any) => h.authorityTier === "A").slice(0, 5);
              const seenS = new Set<string>(); for (const h of tierS) seenS.add(h.outlet);
              const seenA = new Set<string>(); for (const h of tierA) seenA.add(h.outlet);
              const outlets = [...Array.from(seenS), ...Array.from(seenA)].join(", ");
              blogPressContext = `\n\nAUTHOR CREDENTIALS (weave naturally into the article for E-E-A-T):\nDr. Pedram Shojai is a New York Times bestselling author, Doctor of Oriental Medicine, and Taoist monk. He has been featured in: ${outlets}. His work has reached millions of readers and viewers across major national and industry publications.`;
            }
          }
        } catch (err) {
          console.warn("[Blog] Could not load press authority context:", err);
        }
        // Load media authority context block
        let blogMediaContext = "";
        try {
          const { getMediaContextBlock } = await import("./mediaRouter");
          blogMediaContext = await getMediaContextBlock(input.idea, { maxAssets: 4 });
        } catch (err) {
          console.warn("[Blog] Could not load media authority context:", err);
        }
        // Load avatar intelligence context block
        let blogAvatarContext = "";
        try {
          const { getAvatarContextBlock } = await import("./avatarRouter");
          blogAvatarContext = await getAvatarContextBlock(input.idea);
        } catch (err) {
          console.warn("[Blog] Could not load avatar context:", err);
        }
        // Load topical CTA
        let blogCtaInjection = "";
        try {
          const { getCtaForTopic } = await import("./ctaRouter");
          const cta = await getCtaForTopic(input.idea);
          blogCtaInjection = `\n\n[CTA BLOCK — ${cta.label}]\n${cta.ctaText}\n[END CTA BLOCK]\nIMPORTANT: Include this CTA naturally in the Conclusion section of the blog post.`;
        } catch (err) {
          console.warn("[Blog] Could not load CTA:", err);
        }
        // Load webinar intelligence context block
        let blogWebinarContext = "";
        try {
          const { getWebinarIntelligenceContextBlock } = await import("./webinarIntelligenceRouter");
          blogWebinarContext = await getWebinarIntelligenceContextBlock(input.idea);
        } catch (err) {
          console.warn("[Blog] Could not load webinar intelligence context:", err);
        }

        // ── Load WordPress post index for real internal links ─────────────────────
        let internalLinkBlock = "";
        try {
          const db = await getDb();
          if (db) {
            const { wpPostIndex } = await import("../drizzle/schema");
            const allPosts = await db.select().from(wpPostIndex).limit(500);
            if (allPosts.length > 0) {
              const postSummaries: WpPostSummary[] = allPosts.map((p: any) => ({
                wpPostId: p.wpPostId,
                title: p.title,
                slug: p.slug,
                url: p.url,
                excerpt: p.excerpt ?? "",
                categories: JSON.parse(p.categories ?? "[]"),
                tags: JSON.parse(p.tags ?? "[]"),
                publishedAt: p.publishedAt?.toISOString() ?? "",
              }));
              const relevant = findRelevantPosts(postSummaries, input.idea, 8);
              if (relevant.length > 0) {
                internalLinkBlock = `\n\nREAL INTERNAL LINK LIST (use these exact URLs for internal links — pick the 2-3 most relevant):\n${relevant.map((p) => `- [${p.title}](${p.url}) — ${p.excerpt.slice(0, 100)}`).join("\n")}`;
              }
            } else {
              // No posts indexed yet — auto-sync in background
              fetchAllWpPosts().then(async (posts) => {
                if (posts.length === 0) return;
                const db2 = await getDb();
                if (!db2) return;
                const { wpPostIndex: wpi } = await import("../drizzle/schema");
                for (const p of posts) {
                  await db2.insert(wpi).values({
                    wpPostId: p.wpPostId,
                    title: p.title,
                    slug: p.slug,
                    url: p.url,
                    excerpt: p.excerpt,
                    categories: JSON.stringify(p.categories),
                    tags: JSON.stringify(p.tags),
                    publishedAt: p.publishedAt ? new Date(p.publishedAt) : null,
                  }).onDuplicateKeyUpdate({ set: { title: p.title, url: p.url, excerpt: p.excerpt, syncedAt: new Date() } });
                }
                console.log(`[Blog] Auto-synced ${posts.length} WordPress posts to index.`);
              }).catch((err) => console.warn("[Blog] WP post auto-sync failed:", err));
            }
          }
        } catch (err) {
          console.warn("[Blog] Could not load WP post index:", err);
        }

        // Step 1: Generate the full blog article as structured JSON
        const userMessage = [
          `Raw idea: ${cleanIdea}`,
          input.gapQueryText ? `\nThis article should directly answer the LLM search query: "${input.gapQueryText}"` : "",
          input.customInstructions ? `\nAdditional instructions: ${input.customInstructions}` : "",
          personaContext,
          blogPressContext,
          blogMediaContext,
          blogAvatarContext,
          blogWebinarContext,
          internalLinkBlock,
          blogCtaInjection,
        ]
          .filter(Boolean)
          .join("");
        // ── PASS 1: Generate the full article body as plain Markdown ────────────────
        // Keeping the article separate from JSON avoids token-limit truncation.
        // The article prompt asks for ONLY the Markdown body — no JSON wrapper.
        const ARTICLE_BODY_PROMPT = `${BLOG_PROMPT}

OVERRIDE FOR THIS CALL: Output ONLY the full article body in clean Markdown. Do NOT wrap in JSON. Do NOT include a title H1 at the top. Start directly with the opening hook paragraph. Write the complete article — all sections fully developed — ending with the FAQ section. Do not stop early.`;

        const articleResponse = await safeLLM({
          messages: [
            { role: "system", content: ARTICLE_BODY_PROMPT },
            { role: "user", content: userMessage },
          ],
        });

        let articleBody = (String(articleResponse.choices?.[0]?.message?.content ?? "")).trim();
        if (!articleBody || articleBody.length < 500) {
          throw new Error("Blog generation failed \u2014 article body was empty or too short.");
        }

        // ── DEFENSIVE: If the model returned JSON despite instructions, extract the article field ──
        // The model sometimes wraps the response in ```json\n{ ... }\n``` even when told not to.
        // JSON.parse is unreliable here because the article field contains unescaped newlines.
        // Strategy: use a targeted regex to extract the "article" string value directly.
        const extractArticleFromJson = (raw: string): string | null => {
          try {
            // Step 1: Strip code fences — handles ```json\n, ```json , ``` variants
            const stripped = raw
              .replace(/^```+\s*json\s*\n?/i, "")
              .replace(/^```+\s*\n?/i, "")
              .replace(/\n?```+\s*$/i, "")
              .trim();

            // Step 2: Try JSON.parse first (works when article field is properly escaped)
            try {
              const firstBrace = stripped.indexOf("{");
              const lastBrace = stripped.lastIndexOf("}");
              if (firstBrace !== -1 && lastBrace !== -1) {
                const jsonStr = stripped.slice(firstBrace, lastBrace + 1);
                const parsed = JSON.parse(jsonStr);
                if (parsed.article && typeof parsed.article === "string" && parsed.article.length > 200) {
                  return parsed.article;
                }
              }
            } catch {
              // JSON.parse failed — fall through to regex extraction
            }

            // Step 3: Regex extraction — find "article": "..." and extract the value
            // This handles cases where the article field contains unescaped newlines
            // that break JSON.parse. We find the key and extract everything until
            // the next top-level JSON key or the closing brace of the root object.
            const articleKeyMatch = stripped.match(/"article"\s*:\s*"/);
            if (!articleKeyMatch || articleKeyMatch.index === undefined) return null;

            const valueStart = articleKeyMatch.index + articleKeyMatch[0].length;
            // Walk forward to find the end of the string value (unescaped closing quote)
            let i = valueStart;
            let result = "";
            while (i < stripped.length) {
              const ch = stripped[i];
              if (ch === "\\" && i + 1 < stripped.length) {
                // Escape sequence — decode common ones
                const next = stripped[i + 1];
                if (next === "n") { result += "\n"; i += 2; continue; }
                if (next === "t") { result += "\t"; i += 2; continue; }
                if (next === "\\") { result += "\\"; i += 2; continue; }
                if (next === '"') { result += '"'; i += 2; continue; }
                result += next; i += 2; continue;
              }
              if (ch === '"') {
                // Unescaped quote = end of string value
                break;
              }
              result += ch;
              i++;
            }

            if (result.length > 200) return result;
            return null;
          } catch {
            return null;
          }
        };

        // Detect: starts with ``` fence OR starts with { (raw JSON object)
        const looksLikeJson =
          /^```/i.test(articleBody) ||
          /^\s*\{/.test(articleBody);

        if (looksLikeJson) {
          const extracted = extractArticleFromJson(articleBody);
          if (extracted) {
            console.log("[Blog] Extracted article from JSON response, length:", extracted.length);
            articleBody = extracted;
          } else {
            console.warn("[Blog] Response looked like JSON but extraction failed — using raw response.");
          }
        }

        // ── CONTINUATION PASS: Detect truncation and complete the article ───────── \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
        // Only run if the article is genuinely truncated (not a JSON extraction issue).
        const hasFaq = /##\s*(Frequently Asked Questions|FAQ)/i.test(articleBody);
        const endsCleanly = /[.!?\"']\s*$/.test(articleBody.slice(-200));
        // Only trigger continuation if truly truncated: no FAQ AND ends mid-sentence
        const isLikelyTruncated = !hasFaq && !endsCleanly;

        if (isLikelyTruncated) {
          try {
            const continuationResponse = await safeLLM({
              messages: [
                { role: "system", content: ARTICLE_BODY_PROMPT },
                { role: "user", content: userMessage },
                { role: "assistant", content: articleBody },
                {
                  role: "user",
                  content: `The article above is incomplete. Continue writing from exactly where it left off. Complete all remaining sections including the FAQ section (## Frequently Asked Questions with 4-6 PAA questions). Do NOT repeat any content already written. Start immediately from where the text ends.`,
                },
              ],
            });
            const continuation = (String(continuationResponse.choices?.[0]?.message?.content ?? "")).trim();
            if (continuation && continuation.length > 100) {
              articleBody = articleBody + "\n\n" + continuation;
            }
          } catch (err) {
            console.warn("[Blog] Continuation pass failed \u2014 using partial article:", err);
          }
        }

        // ── EXTERNAL LINK POST-PROCESSOR ─────────────────────────────────────────
        // Scan the article for [Outbound Link: Source Name — description] placeholders
        // and replace them with real verified URLs via web search.
        articleBody = await resolveOutboundLinkPlaceholders(articleBody);

        // ── PASS 2: Extract metadata from the completed article ───────────────────
        // Now that we have the full article, ask the LLM to extract the SEO fields.
        // This is a short structured call — no risk of truncation.
        const metaResponse = await safeLLM({
          messages: [
            {
              role: "system",
              content: `You are an SEO metadata extractor. Given a completed blog article, extract the required SEO fields. Return ONLY a valid JSON object with no preamble.`,
            },
            {
              role: "user",
              content: `Extract SEO metadata from this article about: ${cleanIdea}\n\nARTICLE:\n${articleBody.slice(0, 3000)}`,
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
                  title: { type: "string", description: "H1 headline, 50-65 chars, contains primary keyword" },
                  slug: { type: "string", description: "URL-friendly slug, max 60 chars" },
                  metaDescription: { type: "string", description: "150-160 char meta description" },
                  focusKeyword: { type: "string", description: "Primary SEO keyword phrase, 2-4 words" },
                  semanticKeywords: { type: "array", items: { type: "string" }, description: "3-5 semantic keyword variants" },
                  hookFamily: { type: "string", description: "Which of the 12 Hook Families was used" },
                  emotionalDriver: { type: "string", description: "Primary emotional driver" },
                  faqSection: { type: "string", description: "Markdown FAQ section with 4-6 PAA questions" },
                  waterfallMap: { type: "string", description: "5-item derivative content list" },
                },
                required: ["title", "slug", "metaDescription", "focusKeyword", "semanticKeywords", "hookFamily", "emotionalDriver", "faqSection", "waterfallMap"],
                additionalProperties: false,
              },
            },
          },
        });

        const rawMeta = String(metaResponse.choices?.[0]?.message?.content ?? "{}");
        let metaData: {
          title: string;
          slug: string;
          metaDescription: string;
          focusKeyword: string;
          semanticKeywords?: string[];
          hookFamily?: string;
          emotionalDriver?: string;
          faqSection?: string;
          waterfallMap?: string;
        } = {
          title: cleanIdea.slice(0, 80),
          slug: cleanIdea.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 60),
          metaDescription: "",
          focusKeyword: "",
          semanticKeywords: [],
          hookFamily: "",
          emotionalDriver: "",
          faqSection: "",
          waterfallMap: "",
        };
        try {
          let cleaned = rawMeta.trim();
          cleaned = cleaned.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
          const jsonStart = cleaned.indexOf("{");
          const jsonEnd = cleaned.lastIndexOf("}");
          if (jsonStart >= 0 && jsonEnd > jsonStart) {
            cleaned = cleaned.slice(jsonStart, jsonEnd + 1);
          }
          const parsed = JSON.parse(cleaned);
          metaData = { ...metaData, ...parsed };
        } catch {
          console.warn("[Blog] Metadata extraction failed — using fallback metadata.");
        }

        // Combine: full article body + extracted metadata
        const blogData: {
          title: string;
          slug: string;
          metaDescription: string;
          focusKeyword: string;
          semanticKeywords?: string[];
          hookFamily?: string;
          emotionalDriver?: string;
          faqSection?: string;
          waterfallMap?: string;
          article: string;
        } = {
          ...metaData,
          article: articleBody,
        };

        // Step 2: Generate the hero image in parallel (16:9 blog style)
        let heroImageUrl: string | undefined;
        if (input.generateImage) {
          try {
            const blogStyle = PLATFORM_IMAGE_STYLES.blog ?? DEFAULT_IMAGE_STYLE;
            const promptResponse = await safeLLM({
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
          semanticKeywords: blogData.semanticKeywords ?? [],
          hookFamily: blogData.hookFamily ?? "",
          emotionalDriver: blogData.emotionalDriver ?? "",
          faqSection: blogData.faqSection ?? "",
          waterfallMap: blogData.waterfallMap ?? "",
        };
      }),

    // ─── Carousel Generator ────────────────────────────────────────────────────
    generateCarousel: protectedProcedure
      .input(
        z.object({
          idea: z.string().min(1),
          platform: z.enum(["meta", "linkedin"]).default("meta"),
          slideCount: z.number().min(4).max(12).default(7),
          customInstructions: z.string().optional(),
          generateImages: z.boolean().default(true),
          personaId: z.number().optional(),
        })
      )
      .mutation(async ({ input }) => {
        // Clean idea (strip LLM Projects prefixes)
        const extractCleanIdea = (raw: string): string => {
          const titleMatch = raw.match(/^Title:\s*(.+)$/im);
          if (titleMatch) return titleMatch[1].trim();
          const questionMatch = raw.match(/^Question to answer:\s*(.+)$/im);
          if (questionMatch) return questionMatch[1].trim();
          return raw.replace(/^\[Research Gap\]\s*/i, "").split("\n")[0].trim();
        };
        const cleanIdea = extractCleanIdea(input.idea);

        // Load persona context
        let personaContext = "";
        if (input.personaId) {
          try {
            const db = await getDb();
            if (db) {
              const { personas } = await import("../drizzle/schema");
              const { eq } = await import("drizzle-orm");
              const found = await db.select().from(personas).where(eq(personas.id, input.personaId));
              if (found.length > 0) {
                const p = found[0] as any;
                const pains: string[] = JSON.parse(p.painPoints ?? "[]");
                if (pains.length > 0) {
                  personaContext = `\n\nTARGET PERSONA — ${p.name}: Real pain points: ${pains.slice(0, 5).join("; ")}. Speak directly to these concerns.`;
                }
              }
            }
          } catch { /* ignore */ }
        }

        // Load CTA
        let ctaInjection = "";
        try {
          const { getCtaForTopic } = await import("./ctaRouter");
          const cta = await getCtaForTopic(cleanIdea);
          ctaInjection = `\n\n[CTA BLOCK — ${cta.label}]\n${cta.ctaText}\n[END CTA BLOCK]\nCRITICAL URL RULE: Use EXACTLY the URL from the CTA block — do NOT substitute any other URL.`;
        } catch { /* ignore */ }

        const platformLabel = input.platform === "meta" ? "Instagram/Facebook" : "LinkedIn";
        const slideCountTarget = input.slideCount;

        const systemPrompt = `You are a carousel content strategist for Dr. Pedram Shojai (The Urban Monk) on ${platformLabel}.
Your task: write a ${slideCountTarget}-slide carousel post on the given topic.

CARROUSEL STRUCTURE:
- Slide 1 (Cover): Bold hook headline (5-8 words). No body text. This is the scroll-stopper.
- Slides 2-${slideCountTarget - 1} (Content): Each slide has ONE insight, tip, or step. Short headline (4-7 words) + 2-3 sentence body (max 60 words). One idea per slide — no cramming.
- Slide ${slideCountTarget} (CTA): Closing slide. Headline: a compelling call to action. Body: 1-2 sentences pointing to the CTA URL from the CTA block.

VOICE: ${input.platform === "meta" ? "Warm, relatable, educational. Bridges science and ancient wisdom. Personal but authoritative." : "Professional, data-informed, challenges conventional thinking. Direct and confident."}

OUTPUT FORMAT — Return ONLY a valid JSON array, no preamble, no explanation:
[
  { "slide": 1, "headline": "...", "body": "", "imagePrompt": "..." },
  { "slide": 2, "headline": "...", "body": "...", "imagePrompt": "..." },
  ...
]

IMAGE PROMPT RULES:
- Each imagePrompt should be 30-50 words describing a photographic or illustrative image for that specific slide
- Style: warm, editorial wellness photography. Soft golden light, natural textures, no text overlay
- Cover slide: wide establishing shot or symbolic object
- Content slides: close-up details, human moments, nature elements that reinforce the slide's insight
- CTA slide: inviting, forward-looking, hopeful

CRITICAL OUTPUT RULES:
- Return ONLY the JSON array — no markdown fences, no explanation, no extra text
- Every slide must have slide number, headline, body (empty string for cover), and imagePrompt
- Headlines must be punchy and specific — no generic wellness clichés`;

        const userMessage = `Topic: ${cleanIdea}${input.customInstructions ? `\nAdditional instructions: ${input.customInstructions}` : ""}${personaContext}${ctaInjection}`;

        const response = await safeLLM({
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userMessage },
          ],
        });

        const rawContent = typeof response.choices?.[0]?.message?.content === "string"
          ? response.choices[0].message.content
          : "[]";

        // Parse the JSON array of slides
        type SlideData = { slide: number; headline: string; body: string; imagePrompt: string; imageUrl?: string };
        let slides: SlideData[] = [];
        try {
          let cleaned = rawContent.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
          const jsonStart = cleaned.indexOf("[");
          const jsonEnd = cleaned.lastIndexOf("]");
          if (jsonStart >= 0 && jsonEnd > jsonStart) cleaned = cleaned.slice(jsonStart, jsonEnd + 1);
          slides = JSON.parse(cleaned);
        } catch (err) {
          console.warn("[Carousel] Failed to parse slide JSON:", err);
          throw new Error("Carousel generation failed — could not parse slide structure. Please try again.");
        }

        // Generate images for each slide in parallel (if requested)
        if (input.generateImages && slides.length > 0) {
          const imageStyle = PLATFORM_IMAGE_STYLES.meta ?? DEFAULT_IMAGE_STYLE;
          const imageResults = await Promise.allSettled(
            slides.map(async (slide) => {
              if (!slide.imagePrompt) return { slide: slide.slide, url: undefined };
              try {
                const fullPrompt = `${slide.imagePrompt}. Visual style: ${imageStyle}`;
                const { url } = await generateImage({ prompt: fullPrompt });
                return { slide: slide.slide, url };
              } catch {
                return { slide: slide.slide, url: undefined };
              }
            })
          );
          for (const result of imageResults) {
            if (result.status === "fulfilled" && result.value.url) {
              const s = slides.find((sl) => sl.slide === result.value.slide);
              if (s) s.imageUrl = result.value.url;
            }
          }
        }

        return {
          slides,
          topic: cleanIdea,
          platform: input.platform,
          slideCount: slides.length,
        };
      }),

    // ─── Bulk Title Cleanup ────────────────────────────────────────────────────
    cleanupStaleTitles: protectedProcedure
      .mutation(async () => {
        const db = await getDb();
        if (!db) throw new Error("Database unavailable");
        const { contentItems } = await import("../drizzle/schema");
        const { like, or } = await import("drizzle-orm");

        // Find all content items with stale title prefixes
        const staleItems = await db
          .select()
          .from(contentItems)
          .where(
            or(
              like(contentItems.title, "[Research Gap]%"),
              like(contentItems.title, "Question to answer:%"),
              like(contentItems.title, "Research Gap%"),
              like(contentItems.title, "Title:%"),
              like(contentItems.title, "Answer this LLM%"),
              like(contentItems.title, "Answer this%search query%"),
            )
          );

        if (staleItems.length === 0) return { renamed: 0, message: "No stale titles found." };

        // AP/Chicago-style title case: capitalize all words except articles, short prepositions,
        // and coordinating conjunctions — unless they are the first or last word, or follow a colon.
        const toTitleCase = (str: string): string => {
          // Skip markdown headers or very long strings (likely body content, not titles)
          if (str.startsWith("##") || str.length > 120) return str;
          const LOWERCASE_WORDS = new Set([
            "a", "an", "the",
            "and", "but", "or", "nor", "for", "so", "yet",
            "as", "at", "by", "in", "of", "on", "to",
            "via", "vs", "vs.",
          ]);
          const words = str.split(" ");
          let afterColon = false;
          return words
            .map((word, i) => {
              if (!word) return word;
              const core = word.replace(/^[^a-zA-Z0-9']+|[^a-zA-Z0-9']+$/g, "");
              const lower = core.toLowerCase();
              const isFirst = i === 0;
              const isLast = i === words.length - 1;
              const shouldCap = isFirst || isLast || afterColon || !LOWERCASE_WORDS.has(lower);
              afterColon = word.endsWith(":") || word.endsWith("—");
              if (!shouldCap) return word.toLowerCase();
              return word.replace(/([a-zA-Z])/, (m) => m.toUpperCase());
            })
            .join(" ");
        };

        const extractCleanTitle = (titleField: string, rawIdea: string | null): string => {
          const raw = rawIdea || titleField;
          // Try to extract from rawIdea first (multi-line LLM Projects format)
          const titleMatch = raw.match(/^Title:\s*(.+)$/im);
          if (titleMatch) return titleMatch[1].trim();
          const questionMatch = raw.match(/^Question to answer:\s*(.+)$/im);
          if (questionMatch) return questionMatch[1].trim();
          // Extract the LLM search query itself — it's the actual topic
          // Pattern: "Answer this LLM search query for the persona "X": <ACTUAL QUERY>"
          const llmQueryMatch = raw.match(/LLM search query[^:]*:\s*(.+?)(?:\n|$)/i);
          if (llmQueryMatch) {
            // The query IS the topic — clean it up as a title
            return llmQueryMatch[1]
              .replace(/^(I need|I want|What are|What is|How do|How can|Why does|Why do|Can you|Tell me|Explain)\s+/i, "")
              .replace(/\?$/, "")
              .trim()
              .split(" ")
              .slice(0, 12)
              .join(" ");
          }
          // Fallback: strip known prefixes from the title itself
          return titleField
            .replace(/^\[Research Gap\]\s*/i, "")
            .replace(/^Question to answer:\s*/i, "")
            .replace(/^Title:\s*/i, "")
            .replace(/^Research Gap\s*/i, "")
            .replace(/^Answer this LLM search query[^:]*:\s*/i, "")
            .split("\n")[0]
            .trim();
        };

        const { eq } = await import("drizzle-orm");
        let renamed = 0;
        for (const item of staleItems) {
          const rawClean = extractCleanTitle(item.title, (item as any).rawIdea ?? null);
          const cleanTitle = toTitleCase(rawClean).slice(0, 255);
          if (cleanTitle && cleanTitle !== item.title) {
            await db
              .update(contentItems)
              .set({ title: cleanTitle })
              .where(eq(contentItems.id, item.id));
            renamed++;
          }
        }

        return { renamed, message: `Renamed ${renamed} of ${staleItems.length} stale titles.` };
      }),

    generateTeleprompterScript: protectedProcedure
      .input(
        z.object({
          title: z.string(),
          query: z.string().optional(),
          personaName: z.string().optional(),
          topicTags: z.array(z.string()).optional(),
          competitorBrands: z.array(z.string()).optional(),
          platform: z.enum(["youtube", "meta", "linkedin", "x", "tiktok", "blog", "all"]).default("youtube"),
        })
      )
      .mutation(async ({ input }) => {
        const tagList = (input.topicTags ?? []).join(", ");
        const competitorList = (input.competitorBrands ?? []).slice(0, 5).join(", ");

        const systemPrompt = `You are a professional teleprompter scriptwriter for Dr. Pedram Shojai (The Urban Monk), OMD — a Taoist monk, functional medicine doctor, and bestselling author. You write in his exact voice: warm, authoritative, grounded in Eastern wisdom and Western science, never preachy, always practical.

Your task: Write a FULL teleprompter-ready script for a ${input.platform === "youtube" ? "YouTube video" : input.platform + " video"} on the topic below.

Topic: "${input.title}"
${input.query ? `Audience question this addresses: "${input.query}"` : ""}
${input.personaName ? `Primary audience persona: ${input.personaName}` : ""}
${tagList ? `Key topic angles: ${tagList}` : ""}
${competitorList ? `Competitors currently winning this topic: ${competitorList} — differentiate from them` : ""}

SCRIPT REQUIREMENTS:
- Open with a compelling hook (first 15 seconds are critical for retention)
- Use teleprompter formatting: short paragraphs, natural speech rhythm, no jargon
- Include [PAUSE] markers for emphasis
- Include [B-ROLL: description] cues for the editor
- Structure: Hook → Problem → Pedram's unique insight → Evidence/story → Practical steps → CTA
- CTA must mention the Lights On Course ($369/year) at go.theurbanmonk.com/something-has-been-stolen-from-you-lo-webinar-1 or a relevant free resource
- Length: 8-12 minutes of spoken content (approximately 1,200-1,800 words)
- Voice: conversational, like Pedram is talking directly to one person
- Weave in his credentials naturally (OMD, Taoist training, functional medicine) without bragging
- Reference relevant books or programs where appropriate

Format the script with clear section headers in [BRACKETS] for the teleprompter operator.`;
        // Inject press authority context
        let scriptPressContext = "";
        try {
          const db = await getDb();
          if (db) {
            const { pressHits } = await import("../drizzle/schema");
            const { desc } = await import("drizzle-orm");
            const topHits = await db.select().from(pressHits)
              .orderBy(desc(pressHits.impressions))
              .limit(20);
            if (topHits.length > 0) {
              const tierS = topHits.filter((h: any) => h.authorityTier === "S").slice(0, 5);
              const tierA = topHits.filter((h: any) => h.authorityTier === "A").slice(0, 5);
              const seenS = new Set<string>(); for (const h of tierS) seenS.add(h.outlet);
              const seenA = new Set<string>(); for (const h of tierA) seenA.add(h.outlet);
              const outlets = [...Array.from(seenS), ...Array.from(seenA)].join(", ");
              scriptPressContext = `\n\nAUTHOR CREDENTIALS (reference naturally when establishing authority):\nDr. Pedram Shojai has been featured in: ${outlets}. New York Times bestselling author, Doctor of Oriental Medicine, Taoist monk.`;
            }
          }
        } catch (err) {
          console.warn("[Script] Could not load press authority context:", err);
        }
        // Inject media authority context
        let scriptMediaContext = "";
        try {
          const { getMediaContextBlock } = await import("./mediaRouter");
          scriptMediaContext = await getMediaContextBlock(input.title, { maxAssets: 5, includeTypes: ["book", "podcast", "film", "youtube"] });
        } catch (err) {
          console.warn("[Script] Could not load media authority context:", err);
        }
        // Inject avatar intelligence context
        let scriptAvatarContext = "";
        try {
          const { getAvatarContextBlock } = await import("./avatarRouter");
          scriptAvatarContext = await getAvatarContextBlock(input.title);
        } catch (err) {
          console.warn("[Script] Could not load avatar context:", err);
        }
        let scriptCtaInjection = "";
        try {
          const { getCtaForTopic } = await import("./ctaRouter");
          const cta = await getCtaForTopic(input.title);
          scriptCtaInjection = `\n\n[CTA BLOCK — ${cta.label}]\n${cta.ctaText}\n[END CTA BLOCK]\nIMPORTANT: Include this CTA naturally at the end of the script, in the closing call-to-action section.`;
        } catch (err) {
          console.warn("[Script] Could not load CTA:", err);
        }
        let scriptWebinarContext = "";
        try {
          const { getWebinarIntelligenceContextBlock } = await import("./webinarIntelligenceRouter");
          scriptWebinarContext = await getWebinarIntelligenceContextBlock(input.title);
        } catch (err) {
          console.warn("[Script] Could not load webinar intelligence context:", err);
        }
        const response = await safeLLM({
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: `Write the full teleprompter script for: "${input.title}"${scriptPressContext}${scriptMediaContext}${scriptAvatarContext}${scriptWebinarContext}${scriptCtaInjection}` },
          ],
        });
        const rawContent = response.choices?.[0]?.message?.content;
        return {
          script: typeof rawContent === "string" ? rawContent : "Script generation failed.",
        };
      }),
    // AI: generate a social post caption + image prompt from a gap query or video topicpic
    generatePostAndImage: protectedProcedure
      .input(
        z.object({
          title: z.string(),
          query: z.string().optional(),
          personaName: z.string().optional(),
          topicTags: z.array(z.string()).optional(),
          platform: z.enum(["meta", "linkedin", "x", "youtube", "tiktok", "all"]).default("meta"),
        })
      )
      .mutation(async ({ input }) => {
        const tagList = (input.topicTags ?? []).join(", ");

        const systemPrompt = `You are a social media content creator for Dr. Pedram Shojai (The Urban Monk). You write in his voice: grounded, wise, practical, bridges Eastern wisdom and Western science. Never preachy. Always actionable.

Your task: Generate TWO things for the topic below:
1. A platform-optimized social media post caption
2. A detailed AI image generation prompt (DALL-E / Midjourney style) for the thumbnail/cover image

Topic: "${input.title}"
${input.query ? `Audience question: "${input.query}"` : ""}
${input.personaName ? `Target persona: ${input.personaName}` : ""}
${tagList ? `Key angles: ${tagList}` : ""}
Platform: ${input.platform}

POST CAPTION REQUIREMENTS:
- Platform: ${input.platform}
- ${input.platform === "linkedin" ? "Professional tone, 150-300 words, end with a thought-provoking question" : input.platform === "x" ? "COMPLETE self-contained thought, 240 characters or fewer (hard ceiling — no exceptions). Write SHORT from the start — aim for 160-200 characters. The post must begin and end naturally as a full idea. No ellipses, no cut-off sentences. Do NOT include a URL unless one was explicitly provided." : input.platform === "tiktok" ? "Casual, energetic, 100-150 words, use relevant hashtags" : "Conversational, 100-200 words, 3-5 relevant hashtags, strong CTA"}
- Write in Pedram's voice — no fluff, no hype
- If including a URL, use ONLY go.theurbanmonk.com/something-has-been-stolen-from-you-lo-webinar-1 — never substitute or invent a different URL
- Do NOT include any labels like "Caption:" — just write the post

IMAGE PROMPT REQUIREMENTS:
- Describe a compelling, professional thumbnail/cover image
- Do NOT include faces or people (use symbolic, nature, or conceptual imagery)
- Style: warm, earthy, cinematic — consistent with The Urban Monk brand (deep greens, amber, earth tones)
- Should visually represent the core insight of the topic
- Include lighting direction, mood, and composition details
- Format: Start with "IMAGE PROMPT:" on its own line, then the description

Return BOTH in this exact format:
[POST]
(the post caption here)

[IMAGE PROMPT]
(the image generation prompt here)`;
        // Inject media authority context
        let postMediaContext = "";
        try {
          const { getMediaContextBlock } = await import("./mediaRouter");
          postMediaContext = await getMediaContextBlock(input.title, { maxAssets: 3, includeTypes: ["book", "podcast", "interview"] });
        } catch (err) {
          console.warn("[Post] Could not load media authority context:", err);
        }
        // Inject avatar intelligence context
        let postAvatarContext = "";
        try {
          const { getAvatarContextBlock } = await import("./avatarRouter");
          postAvatarContext = await getAvatarContextBlock(input.title);
        } catch (err) {
          console.warn("[Post] Could not load avatar context:", err);
        }
        let postCtaInjection = "";
        try {
          const { getCtaForTopic } = await import("./ctaRouter");
          const cta = await getCtaForTopic(input.title);
          postCtaInjection = `\n\n[CTA BLOCK — ${cta.label}]\n${cta.ctaText}\n[END CTA BLOCK]\nIMPORTANT: Include this CTA naturally at the end of the post.`;
        } catch (err) {
          console.warn("[Post] Could not load CTA:", err);
        }
        const response = await safeLLM({
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: `Generate the social post and image prompt for: "${input.title}"${postMediaContext}${postAvatarContext}` },
          ],
        });

        const rawContent = typeof response.choices?.[0]?.message?.content === "string"
          ? response.choices[0].message.content
          : "";

        // Parse the two sections
        const postMatch = rawContent.match(/\[POST\]\s*([\s\S]*?)(?=\[IMAGE PROMPT\]|$)/);
        const imageMatch = rawContent.match(/\[IMAGE PROMPT\]\s*([\s\S]*)$/);

        return {
          post: postMatch?.[1]?.trim() ?? rawContent,
          imagePrompt: imageMatch?.[1]?.trim() ?? "",
        };
      }),

    // AI: generate a Reframe Post (10-slide carousel in Nicole LePera format)
    generateReframePost: protectedProcedure
      .input(
        z.object({
          topic: z.string().min(1),
          commonBelief: z.string().optional(),
          personaName: z.string().optional(),
        })
      )
      .mutation(async ({ input }) => {
        // Default CTA — will be replaced by topical CTA library when available
        const reframeCtaText = "Ready to reclaim your energy? Join the Lights On course — go.theurbanmonk.com/something-has-been-stolen-from-you-lo-webinar-1";

        // Load avatar context
        let avatarCtx = "";
        try {
          const { getAvatarContextBlock } = await import("./avatarRouter");
          avatarCtx = await getAvatarContextBlock(input.topic);
        } catch (err) {
          console.warn("[Reframe] Could not load avatar context:", err);
        }

        const commonBelief = input.commonBelief?.trim() || `a common misconception about ${input.topic}`;

        const systemPrompt = `You are Dr. Pedram Shojai (The Urban Monk), a New York Times bestselling author, doctor of Oriental medicine, and wellness expert. You create viral 10-slide Instagram/Facebook carousel posts in the Nicole LePera "Holistic Psychologist" style.

REFRAME POST STRUCTURE (exactly 10 slides):
SLIDE 1: [Hook] "Most people believe [COMMON BELIEF]." (bold, provocative)
SLIDE 2: [Why it's wrong] "Here's why that's keeping you stuck:" (1 short sentence)
SLIDE 3-7: [Evidence] 5 specific facts, mechanisms, or insights that contradict the belief. Each slide = 1 insight, max 2 sentences.
SLIDE 8: [The reframe] "What's actually true:" (the correct paradigm in 1-2 sentences)
SLIDE 9: [What to do] 3 specific action steps the reader can take today.
SLIDE 10: [CTA] End with: "${reframeCtaText}"

RULES:
- Each slide: max 40 words
- No hashtags, no emojis, no markdown formatting
- Voice: authoritative but warm, like a wise doctor friend
- Ground every claim in ancient wisdom OR modern science (Pedram bridges both)
- After slide 10, write: CAPTION: [A 150-word Instagram caption that expands on the topic, ends with a question to drive comments, and includes the CTA]

${avatarCtx}

Output format:
SLIDE 1: [text]
SLIDE 2: [text]
...
SLIDE 10: [text]
CAPTION: [caption text]`;

        const response = await safeLLM({
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: `Create a Reframe Post about: "${input.topic}"\nCommon belief to reframe: "${commonBelief}"` },
          ],
        });

        const rawContentRaw = response.choices?.[0]?.message?.content;
        const rawContent = typeof rawContentRaw === "string" ? rawContentRaw : "";
        if (!rawContent) {
          throw new Error("Reframe post generation failed.");
        }

        // Parse slides and caption
        const slideMatches = Array.from(rawContent.matchAll(/SLIDE\s*(\d+):\s*([\s\S]*?)(?=SLIDE\s*\d+:|CAPTION:|$)/gi));
        const slides = slideMatches.map((m) => ({
          number: parseInt(m[1]),
          text: m[2].trim(),
        }));
        const captionMatch = rawContent.match(/CAPTION:\s*([\s\S]*)$/i);
        const caption = captionMatch?.[1]?.trim() ?? "";

        return { slides, caption, ctaLabel: reframeCtaText.slice(0, 40) };
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

    // Push a multi-image carousel to Buffer (Meta/Instagram/Facebook only)
    pushCarousel: protectedProcedure
      .input(
        z.object({
          contentItemId: z.number().optional(),
          caption: z.string().min(1),
          imageUrls: z.array(z.string()).min(1).max(10),
          profileIds: z.array(z.string()).min(1),
          channelServiceMap: z.record(z.string(), z.string()).optional(),
          scheduledAt: z.number().optional(),
        })
      )
      .mutation(async ({ input }) => {
        const result = await pushCarouselToBuffer({
          caption: input.caption,
          imageUrls: input.imageUrls,
          profileIds: input.profileIds,
          channelServiceMap: input.channelServiceMap,
          scheduledAt: input.scheduledAt,
        });

        // If successful and a content item ID was provided, update its status
        if (result.success && input.contentItemId) {
          await updateContentItem(input.contentItemId, {
            status: "scheduled",
            notes: `Buffer carousel ID: ${result.bufferId ?? "queued"}`,
          });
        }

        return result;
      }),

    // Upload a base64 PNG data URL to S3 and return the CDN URL
    uploadCarouselImage: protectedProcedure
      .input(z.object({ dataUrl: z.string().min(1) }))
      .mutation(async ({ input }) => {
        const { storagePut } = await import("./storage");
        // Strip the data URL prefix
        const matches = input.dataUrl.match(/^data:([a-zA-Z0-9+/]+\/[a-zA-Z0-9+/]+);base64,(.+)$/);
        if (!matches) throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid data URL" });
        const mimeType = matches[1];
        const base64Data = matches[2];
        const buffer = Buffer.from(base64Data, "base64");
        const suffix = Math.random().toString(36).slice(2, 8);
        const key = `carousel-slides/${Date.now()}-${suffix}.png`;
        const { url } = await storagePut(key, buffer, mimeType);
        return { url };
      }),

    // Direct Meta Content Publishing API — carousel
    publishCarouselToMeta: protectedProcedure
      .input(
        z.object({
          contentItemId: z.number().optional(),
          caption: z.string().min(1),
          imageUrls: z.array(z.string().url()).min(2).max(10),
          instagram: z.boolean().default(true),
          facebook: z.boolean().default(true),
        })
      )
      .mutation(async ({ input }) => {
        const { publishCarouselToMeta } = await import("./metaPublisher");
        const result = await publishCarouselToMeta(
          input.imageUrls,
          input.caption,
          { instagram: input.instagram, facebook: input.facebook }
        );

        // Update content item status
        if (input.contentItemId) {
          const igOk = result.instagram?.success;
          const fbOk = result.facebook?.success;
          if (igOk || fbOk) {
            const notes = [
              igOk ? `IG post: ${result.instagram!.postId}` : `IG failed: ${result.instagram?.error}`,
              fbOk ? `FB post: ${result.facebook!.postId}` : `FB failed: ${result.facebook?.error}`,
            ].filter(Boolean).join(" | ");
            await updateContentItem(input.contentItemId, { status: "published", notes });
          }
        }

        return result;
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
          platform: z.string().optional(), // used for platform-specific limits (e.g. X = 280 chars)
          metaPostType: z.enum(["post", "story", "reel"]).optional(), // required for facebook/instagram
          channelServiceMap: z.record(z.string(), z.string()).optional(), // channelId → service
        })
      )
      .mutation(async ({ input }) => {
        const result = await pushToBuffer({
          text: input.text,
          profileIds: input.profileIds,
          imageUrl: input.imageUrl,
          scheduledAt: input.scheduledAt,
          platform: input.platform,
          metaPostType: input.metaPostType,
          channelServiceMap: input.channelServiceMap,
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

        // Inject all intelligence layers into the brief
        let avatarCtx = "";
        let mediaCtx = "";
        let pressCtx = "";
        try {
          const { getAvatarContextBlock } = await import("./avatarRouter");
          avatarCtx = await getAvatarContextBlock(input.query + " " + tagList);
        } catch (err) { console.warn("[Brief] Avatar context failed:", err); }
        try {
          const { getMediaContextBlock } = await import("./mediaRouter");
          mediaCtx = await getMediaContextBlock(input.query + " " + tagList, { maxAssets: 4 });
        } catch (err) { console.warn("[Brief] Media context failed:", err); }
        try {
          const db = await getDb();
          if (db) {
            const { pressHits } = await import("../drizzle/schema");
            const { desc } = await import("drizzle-orm");
            const topHits = await db.select().from(pressHits).orderBy(desc(pressHits.impressions)).limit(15);
            if (topHits.length > 0) {
              const tierS = topHits.filter((h: any) => h.authorityTier === "S").slice(0, 5);
              const tierA = topHits.filter((h: any) => h.authorityTier === "A").slice(0, 5);
              const outlets = Array.from(new Set([...tierS, ...tierA].map((h: any) => h.outlet))).join(", ");
              pressCtx = `\n\nAUTHOR CREDENTIALS: Dr. Pedram Shojai is a New York Times bestselling author, Doctor of Oriental Medicine, and Taoist monk. Featured in: ${outlets}.`;
            }
          }
        } catch (err) { console.warn("[Brief] Press context failed:", err); }

        const systemPrompt = `You are a content strategist for The Urban Monk (Dr. Pedram Shojai). Your job is to create a content brief that will help Urban Monk appear in LLM search results for a specific query that competitors are currently winning.
${pressCtx}${mediaCtx}${avatarCtx}
Context:
- Target persona: ${input.personaName}
- Query they are asking LLMs: "${input.query}"
- Topic angles they care about: ${tagList}
- Brands currently winning this query: ${competitorList}

Your task: Write a content brief that positions Dr. Pedram Shojai as the definitive answer to this query. The brief should:
1. Explain WHY Urban Monk is uniquely qualified to answer this — reference specific books, episodes, or press hits from the context above
2. Identify the specific angle that differentiates from the competitor brands listed
3. Suggest a headline/title using the avatar pain points and headline formulas above
4. Outline 3-5 key points to cover, each addressing a real pain point from the transcripts
5. Recommend the best content format (article, video, social thread, etc.)
6. Note any specific Urban Monk programs, books, or credentials to reference
7. Include 2-3 verbatim customer phrases from the avatar intelligence to use as hooks

Be specific and actionable. This brief will go directly to content creation.`;

        const response = await safeLLM({
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

    // AI: generate a full teleprompter script from a gap query or video topic
    generateTeleprompterScript: protectedProcedure
      .input(
        z.object({
          title: z.string(),
          query: z.string().optional(),
          personaName: z.string().optional(),
          topicTags: z.array(z.string()).optional(),
          competitorBrands: z.array(z.string()).optional(),
          platform: z.enum(["youtube", "meta", "linkedin", "x", "tiktok", "blog", "all"]).default("youtube"),
        })
      )
      .mutation(async ({ input }) => {
        const tagList = (input.topicTags ?? []).join(", ");
        const competitorList = (input.competitorBrands ?? []).slice(0, 5).join(", ");

        const systemPrompt = `You are a professional teleprompter scriptwriter for Dr. Pedram Shojai (The Urban Monk), OMD — a Taoist monk, functional medicine doctor, and bestselling author. You write in his exact voice: warm, authoritative, grounded in Eastern wisdom and Western science, never preachy, always practical.

Your task: Write a FULL teleprompter-ready script for a ${input.platform === "youtube" ? "YouTube video" : input.platform + " video"} on the topic below.

Topic: "${input.title}"
${input.query ? `Audience question this addresses: "${input.query}"` : ""}
${input.personaName ? `Primary audience persona: ${input.personaName}` : ""}
${tagList ? `Key topic angles: ${tagList}` : ""}
${competitorList ? `Competitors currently winning this topic: ${competitorList} — differentiate from them` : ""}

SCRIPT REQUIREMENTS:
- Open with a compelling hook (first 15 seconds are critical for retention)
- Use teleprompter formatting: short paragraphs, natural speech rhythm, no jargon
- Include [PAUSE] markers for emphasis
- Include [B-ROLL: description] cues for the editor
- Structure: Hook → Problem → Pedram's unique insight → Evidence/story → Practical steps → CTA
- CTA must mention the Lights On Course ($369/year) at go.theurbanmonk.com/something-has-been-stolen-from-you-lo-webinar-1 or a relevant free resource
- Length: 8-12 minutes of spoken content (approximately 1,200-1,800 words)
- Voice: conversational, like Pedram is talking directly to one person
- Weave in his credentials naturally (OMD, Taoist training, functional medicine) without bragging
- Reference relevant books or programs where appropriate

Format the script with clear section headers in [BRACKETS] for the teleprompter operator.`;
        // Inject press authority context
        let scriptPressContext = "";
        try {
          const db = await getDb();
          if (db) {
            const { pressHits } = await import("../drizzle/schema");
            const { desc } = await import("drizzle-orm");
            const topHits = await db.select().from(pressHits)
              .orderBy(desc(pressHits.impressions))
              .limit(20);
            if (topHits.length > 0) {
              const tierS = topHits.filter((h: any) => h.authorityTier === "S").slice(0, 5);
              const tierA = topHits.filter((h: any) => h.authorityTier === "A").slice(0, 5);
              const seenS = new Set<string>(); for (const h of tierS) seenS.add(h.outlet);
              const seenA = new Set<string>(); for (const h of tierA) seenA.add(h.outlet);
              const outlets = [...Array.from(seenS), ...Array.from(seenA)].join(", ");
              scriptPressContext = `\n\nAUTHOR CREDENTIALS (reference naturally when establishing authority):\nDr. Pedram Shojai has been featured in: ${outlets}. New York Times bestselling author, Doctor of Oriental Medicine, Taoist monk.`;
            }
          }
        } catch (err) {
          console.warn("[Script] Could not load press authority context:", err);
        }
        // Inject media authority context
        let scriptMediaContext = "";
        try {
          const { getMediaContextBlock } = await import("./mediaRouter");
          scriptMediaContext = await getMediaContextBlock(input.title, { maxAssets: 5, includeTypes: ["book", "podcast", "film", "youtube"] });
        } catch (err) {
          console.warn("[Script] Could not load media authority context:", err);
        }
        // Inject avatar intelligence context
        let scriptAvatarContext = "";
        try {
          const { getAvatarContextBlock } = await import("./avatarRouter");
          scriptAvatarContext = await getAvatarContextBlock(input.title);
        } catch (err) {
          console.warn("[Script] Could not load avatar context:", err);
        }
        let scriptCtaInjection = "";
        try {
          const { getCtaForTopic } = await import("./ctaRouter");
          const cta = await getCtaForTopic(input.title);
          scriptCtaInjection = `\n\n[CTA BLOCK — ${cta.label}]\n${cta.ctaText}\n[END CTA BLOCK]\nIMPORTANT: Include this CTA naturally at the end of the script, in the closing call-to-action section.`;
        } catch (err) {
          console.warn("[Script] Could not load CTA:", err);
        }
        let scriptWebinarContext = "";
        try {
          const { getWebinarIntelligenceContextBlock } = await import("./webinarIntelligenceRouter");
          scriptWebinarContext = await getWebinarIntelligenceContextBlock(input.title);
        } catch (err) {
          console.warn("[Script] Could not load webinar intelligence context:", err);
        }
        const response = await safeLLM({
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: `Write the full teleprompter script for: "${input.title}"${scriptPressContext}${scriptMediaContext}${scriptAvatarContext}${scriptWebinarContext}${scriptCtaInjection}` },
          ],
        });
        const rawContent = response.choices?.[0]?.message?.content;
        return {
          script: typeof rawContent === "string" ? rawContent : "Script generation failed.",
        };
      }),
    // AI: generate a social post caption + image prompt from a gap query or video topicpic
    generatePostAndImage: protectedProcedure
      .input(
        z.object({
          title: z.string(),
          query: z.string().optional(),
          personaName: z.string().optional(),
          topicTags: z.array(z.string()).optional(),
          platform: z.enum(["meta", "linkedin", "x", "youtube", "tiktok", "all"]).default("meta"),
        })
      )
      .mutation(async ({ input }) => {
        const tagList = (input.topicTags ?? []).join(", ");

        const systemPrompt = `You are a social media content creator for Dr. Pedram Shojai (The Urban Monk). You write in his voice: grounded, wise, practical, bridges Eastern wisdom and Western science. Never preachy. Always actionable.

Your task: Generate TWO things for the topic below:
1. A platform-optimized social media post caption
2. A detailed AI image generation prompt (DALL-E / Midjourney style) for the thumbnail/cover image

Topic: "${input.title}"
${input.query ? `Audience question: "${input.query}"` : ""}
${input.personaName ? `Target persona: ${input.personaName}` : ""}
${tagList ? `Key angles: ${tagList}` : ""}
Platform: ${input.platform}

POST CAPTION REQUIREMENTS:
- Platform: ${input.platform}
- ${input.platform === "linkedin" ? "Professional tone, 150-300 words, end with a thought-provoking question" : input.platform === "x" ? "COMPLETE self-contained thought, 240 characters or fewer (hard ceiling — no exceptions). Write SHORT from the start — aim for 160-200 characters. The post must begin and end naturally as a full idea. No ellipses, no cut-off sentences. Do NOT include a URL unless one was explicitly provided." : input.platform === "tiktok" ? "Casual, energetic, 100-150 words, use relevant hashtags" : "Conversational, 100-200 words, 3-5 relevant hashtags, strong CTA"}
- Write in Pedram's voice — no fluff, no hype
- If including a URL, use ONLY go.theurbanmonk.com/something-has-been-stolen-from-you-lo-webinar-1 — never substitute or invent a different URL
- Do NOT include any labels like "Caption:" — just write the post

IMAGE PROMPT REQUIREMENTS:
- Describe a compelling, professional thumbnail/cover image
- Do NOT include faces or people (use symbolic, nature, or conceptual imagery)
- Style: warm, earthy, cinematic — consistent with The Urban Monk brand (deep greens, amber, earth tones)
- Should visually represent the core insight of the topic
- Include lighting direction, mood, and composition details
- Format: Start with "IMAGE PROMPT:" on its own line, then the description

Return BOTH in this exact format:
[POST]
(the post caption here)

[IMAGE PROMPT]
(the image generation prompt here)`;
        // Inject media authority context
        let postMediaContext = "";
        try {
          const { getMediaContextBlock } = await import("./mediaRouter");
          postMediaContext = await getMediaContextBlock(input.title, { maxAssets: 3, includeTypes: ["book", "podcast", "interview"] });
        } catch (err) {
          console.warn("[Post] Could not load media authority context:", err);
        }
        // Inject avatar intelligence context
        let postAvatarContext = "";
        try {
          const { getAvatarContextBlock } = await import("./avatarRouter");
          postAvatarContext = await getAvatarContextBlock(input.title);
        } catch (err) {
          console.warn("[Post] Could not load avatar context:", err);
        }
        let postCtaInjection = "";
        try {
          const { getCtaForTopic } = await import("./ctaRouter");
          const cta = await getCtaForTopic(input.title);
          postCtaInjection = `\n\n[CTA BLOCK — ${cta.label}]\n${cta.ctaText}\n[END CTA BLOCK]\nIMPORTANT: Include this CTA naturally at the end of the post.`;
        } catch (err) {
          console.warn("[Post] Could not load CTA:", err);
        }
        const response = await safeLLM({
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: `Generate the social post and image prompt for: "${input.title}"${postMediaContext}${postAvatarContext}` },
          ],
        });

        const rawContent = typeof response.choices?.[0]?.message?.content === "string"
          ? response.choices[0].message.content
          : "";

        // Parse the two sections
        const postMatch = rawContent.match(/\[POST\]\s*([\s\S]*?)(?=\[IMAGE PROMPT\]|$)/);
        const imageMatch = rawContent.match(/\[IMAGE PROMPT\]\s*([\s\S]*)$/);

        return {
          post: postMatch?.[1]?.trim() ?? rawContent,
          imagePrompt: imageMatch?.[1]?.trim() ?? "",
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
          focusKeyword: z.string().optional(),       // Yoast focus keyword
          semanticKeywords: z.array(z.string()).optional(), // Semantic variants (for reference)
          faqSection: z.string().optional(),         // Markdown FAQ section for FAQ schema
          hookFamily: z.string().optional(),         // GhostLink OS hook family used
          emotionalDriver: z.string().optional(),    // GhostLink OS emotional driver
          waterfallMap: z.string().optional(),       // Derivative content plan
          heroImageUrl: z.string().optional(),
          status: z.enum(["draft", "publish", "pending", "future"]).default("draft"),
          scheduledAt: z.number().optional(), // UTC ms timestamp for scheduled posts
          yoastSeoTitle: z.string().optional(),      // Override for Yoast SEO title
          yoastMetaDescription: z.string().optional(), // Override for Yoast meta description
        })
      )
      .mutation(async ({ input }) => {
        const wpBaseUrl = (process.env.WORDPRESS_URL ?? "").replace(/\/$/, "");

        // Step 1: Upload hero image to WordPress media library (if provided)
        let featuredMediaId: number | undefined;
        let wpImageUrl: string | undefined;
        if (input.heroImageUrl) {
          try {
            console.log("[WP] Uploading hero image:", input.heroImageUrl);
            // Derive file extension from URL or default to jpg
            const ext = input.heroImageUrl.toLowerCase().endsWith(".png") ? "png" : "jpg";
            const filename = `${input.slug}-hero.${ext}`;
            const media = await uploadMediaFromUrl(
              input.heroImageUrl,
              filename,
              `${input.title} — The Urban Monk` // SEO-optimized alt text
            );
            featuredMediaId = media.id;
            wpImageUrl = media.url;
            console.log("[WP] Hero image uploaded successfully. Media ID:", featuredMediaId, "URL:", wpImageUrl);
          } catch (err) {
            // Log the full error but don't block the publish — post goes up without image
            console.error("[WP] Hero image upload failed:", err);
            wpImageUrl = undefined;
            featuredMediaId = undefined;
          }
        }

        // Determine WP status and date
        let wpStatus = input.status;
        let wpDate: string | undefined;
        if (input.scheduledAt && input.scheduledAt > Date.now()) {
          wpStatus = "future";
          wpDate = new Date(input.scheduledAt).toISOString();
        }

        // Step 2: Convert Markdown → WordPress HTML
        // - Extracts trailing #hashtags and converts them to <strong> bold text
        // - Converts all Markdown formatting (##, **, >, etc.) to HTML
        const wpHtmlBody = markdownToWpHtml(input.body);

        // Step 3: Build Article + FAQ JSON-LD schema blocks (GhostLink OS B15 AEO)
        const { articleSchema, faqSchema } = buildBlogSchemas({
          title: input.title,
          slug: input.slug,
          metaDescription: input.metaDescription ?? "",
          heroImageUrl: wpImageUrl ?? input.heroImageUrl,
          faqSection: input.faqSection,
          baseUrl: wpBaseUrl,
          datePublished: wpDate ?? new Date().toISOString(),
        });

        // Step 4: Build SEO title for Yoast (format: Article Title | The Urban Monk)
        // Use explicit override if provided (from SeoKeywordEditor), otherwise auto-generate
        const seoTitle = input.yoastSeoTitle ?? `${input.title} | The Urban Monk`;
        const metaDesc = input.yoastMetaDescription ?? input.metaDescription;

        // Step 5: Resolve SEO keywords as WordPress tags (create if they don't exist)
        const { authHeader: wpAuthHeader } = (() => {
          const username = process.env.WORDPRESS_USERNAME ?? "";
          const appPassword = process.env.WORDPRESS_APP_PASSWORD ?? "";
          return { authHeader: "Basic " + Buffer.from(`${username}:${appPassword}`).toString("base64") };
        })();

        const allKeywords = [
          ...(input.focusKeyword ? [input.focusKeyword] : []),
          ...(input.semanticKeywords ?? []),
        ].filter(Boolean);

        let wpTagIds: number[] = [];
        if (allKeywords.length > 0) {
          try {
            wpTagIds = await resolveOrCreateWpTags(allKeywords, wpAuthHeader, wpBaseUrl);
            console.log(`[WP] Resolved ${wpTagIds.length} tags from ${allKeywords.length} keywords`);
          } catch (err) {
            console.error("[WP] Tag resolution failed (non-fatal):", err);
          }
        }

        // Step 6: Create the WordPress post with full SEO metadata
        const post = await createWpPost({
          title: input.title,
          slug: input.slug,
          content: wpHtmlBody,
          excerpt: metaDesc,
          status: wpStatus,
          featuredMediaId,
          categories: DEFAULT_WP_CATEGORIES,
          tags: wpTagIds.length > 0 ? wpTagIds : undefined,
          metaDescription: metaDesc,
          focusKeyword: input.focusKeyword,
          seoTitle,
          canonicalUrl: `${wpBaseUrl}/${input.slug}/`,
          articleSchema,
          faqSchema: faqSchema ?? undefined,
          date: wpDate,
        });

        // Step 7: Update the content item status + persist Yoast SEO fields to DB
        // Always mark as "published" once sent to WP — even if sent as a draft.
        // This prevents confusion about what has already been pushed to WordPress.
        const newStatus = wpStatus === "future" ? "scheduled" : "published";
        await updateContentItem(input.contentItemId, {
          status: newStatus,
          publishUrl: post.link,
          wpPostId: post.id,  // Save WP post ID so the edit URL can be constructed on the frontend
          yoastSeoTitle: seoTitle,
          yoastMetaDescription: metaDesc,
        });

        return {
          success: true,
          postId: post.id,
          postUrl: post.link,
          editUrl: post.editLink,
          wpImageUrl,
          wpStatus,
          imageUploaded: !!featuredMediaId,
        };
      }),

    // Sync WordPress post index (for internal link injection in blog generation)
    syncPostIndex: protectedProcedure
      .mutation(async () => {
        const posts = await fetchAllWpPosts();
        if (posts.length === 0) {
          return { synced: 0, message: "No published posts found in WordPress." };
        }
        const db = await getDb();
        if (!db) throw new Error("Database unavailable");
        const { wpPostIndex } = await import("../drizzle/schema");
        let upserted = 0;
        for (const p of posts) {
          await db
            .insert(wpPostIndex)
            .values({
              wpPostId: p.wpPostId,
              title: p.title,
              slug: p.slug,
              url: p.url,
              excerpt: p.excerpt,
              categories: JSON.stringify(p.categories),
              tags: JSON.stringify(p.tags),
              publishedAt: p.publishedAt ? new Date(p.publishedAt) : null,
            })
            .onDuplicateKeyUpdate({
              set: {
                title: p.title,
                url: p.url,
                excerpt: p.excerpt,
                syncedAt: new Date(),
              },
            });
          upserted++;
        }
        return { synced: upserted, message: `Synced ${upserted} posts from WordPress.` };
      }),

    // Get WordPress post index stats
    getPostIndexStats: protectedProcedure.query(async () => {
      const db = await getDb();
      if (!db) return { count: 0, lastSynced: null };
      const { wpPostIndex } = await import("../drizzle/schema");
      const { desc } = await import("drizzle-orm");
      const rows = await db.select().from(wpPostIndex).orderBy(desc(wpPostIndex.syncedAt)).limit(1);
      const count = (await db.select().from(wpPostIndex)).length;
      return {
        count,
        lastSynced: rows[0]?.syncedAt?.toISOString() ?? null,
      };
    }),

    // Generate Yoast SEO fields using AI from blog body content
    generateYoastFields: protectedProcedure
      .input(z.object({
        contentItemId: z.number(),
        title: z.string(),
        body: z.string(),
      }))
      .mutation(async ({ input }) => {
        const response = await safeLLM({
          messages: [
            {
              role: "system",
              content: `You are an expert SEO specialist for The Urban Monk (Dr. Pedram Shojai). 
Generate optimized Yoast SEO fields for a blog post. Return ONLY valid JSON with these exact keys:
- seoTitle: string (max 60 chars, format: "[Topic] | The Urban Monk", include primary keyword)
- metaDescription: string (120-155 chars, compelling summary with primary keyword, ends with a benefit or call to action)
- focusKeyphrase: string (2-4 word phrase, the single most important keyword for this post)
- semanticKeywords: string[] (5-8 related keywords/phrases that support the focus keyphrase)

Rules:
- seoTitle MUST be under 60 characters
- metaDescription MUST be between 120-155 characters
- focusKeyphrase should be what someone would type into Google to find this article
- Write in Dr. Pedram Shojai's voice: authoritative, integrative medicine, practical wisdom`,
            },
            {
              role: "user",
              content: `Blog post title: ${input.title}\n\nBlog post content (first 2000 chars):\n${input.body.substring(0, 2000)}`,
            },
          ],
          response_format: {
            type: "json_schema",
            json_schema: {
              name: "yoast_seo_fields",
              strict: true,
              schema: {
                type: "object",
                properties: {
                  seoTitle: { type: "string", description: "SEO title max 60 chars" },
                  metaDescription: { type: "string", description: "Meta description 120-155 chars" },
                  focusKeyphrase: { type: "string", description: "Primary focus keyword phrase" },
                  semanticKeywords: { type: "array", items: { type: "string" }, description: "Related keywords" },
                },
                required: ["seoTitle", "metaDescription", "focusKeyphrase", "semanticKeywords"],
                additionalProperties: false,
              },
            },
          },
        });

        const raw = String(response.choices?.[0]?.message?.content ?? "{}");
        const fields = JSON.parse(raw) as {
          seoTitle: string;
          metaDescription: string;
          focusKeyphrase: string;
          semanticKeywords: string[];
        };

        // Persist to DB immediately
        await updateContentItem(input.contentItemId, {
          yoastSeoTitle: fields.seoTitle,
          yoastMetaDescription: fields.metaDescription,
          focusKeyword: fields.focusKeyphrase,
          seoKeywords: JSON.stringify(fields.semanticKeywords),
        });

        return fields;
      }),

    // Update Yoast SEO fields on an already-published WordPress post
    updateYoast: protectedProcedure
      .input(z.object({
        contentItemId: z.number(),
        wpPostId: z.number(),
        seoTitle: z.string().optional(),
        metaDescription: z.string().optional(),
        focusKeyword: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const wpBaseUrl = (process.env.WORDPRESS_URL ?? "").replace(/\/$/, "");
        const canonicalUrl = input.focusKeyword
          ? undefined
          : undefined; // canonical stays as-is for updates

        await updateWpPostYoast({
          wpPostId: input.wpPostId,
          seoTitle: input.seoTitle,
          metaDescription: input.metaDescription,
          focusKeyword: input.focusKeyword,
        });

        // Persist the updated fields to DB
        await updateContentItem(input.contentItemId, {
          yoastSeoTitle: input.seoTitle,
          yoastMetaDescription: input.metaDescription,
          focusKeyword: input.focusKeyword,
        });

        return { success: true, wpPostId: input.wpPostId };
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
              content: markdownToWpHtml(item.textContent ?? ""),
              status: "draft",
              featuredMediaId,
              categories: DEFAULT_WP_CATEGORIES,
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
  press: pressRouter,
  media: mediaRouter,
  avatar: avatarRouter,
  cta: ctaRouter,
  growth: growthRouter,
  webinar: webinarRouter,
  webinarIntelligence: webinarIntelligenceRouter,
  llmProjects: llmProjectsRouter,

  /**
   * Public opt-in procedure — called from the Home page "Lights On" ebook form.
   * Creates a Kajabi contact and applies the optin-lights-on tag to trigger the automation.
   */
  optin: router({
    submit: publicProcedure
      .input(
        z.object({
          email: z.string().email(),
          name: z.string().optional(),
        })
      )
      .mutation(async ({ input }) => {
        // Tag name — the tag is auto-created in Kajabi if it doesn't exist yet
        const tagName = "optin-lights-on";

        const { contactId } = await kajabiOptIn({
          email: input.email,
          name: input.name,
          tagName,
        });

        await notifyOwner({
          title: "New Lights On Opt-In",
          content: `Email: ${input.email}\nName: ${input.name ?? "(not provided)"}\nKajabi Contact ID: ${contactId}\nTag applied: ${tagName}`,
        });

        return { success: true, contactId };
      }),
  }),
});
export type AppRouter = typeof appRouter;
