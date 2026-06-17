import { COOKIE_NAME } from "@shared/const";
import { compositeCtaBanner } from "./bannerComposite";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { getSessionCookieOptions } from "./_core/cookies";
import { generateImage } from "./_core/imageGeneration";
import { invokeLLM, type InvokeParams } from "./_core/llm";

// Wrapper that converts RATE_LIMIT / SERVICE_UNAVAILABLE errors from invokeLLM into user-friendly TRPCErrors.
// Automatically retries up to 5 times on transient 503/502/504 errors with exponential backoff.
async function safeLLM(params: InvokeParams, _retryCount = 0): Promise<Awaited<ReturnType<typeof invokeLLM>>> {
  const MAX_RETRIES = 5;
  const BASE_DELAY_MS = 1000; // 1s, 2s, 4s, 8s, 16s
  try {
    return await invokeLLM(params);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.startsWith("RATE_LIMIT:")) {
      throw new TRPCError({
        code: "TOO_MANY_REQUESTS",
        message: "AI generation limit reached. Please wait 30\u201360 seconds and try again.",
      });
    }
    if (msg.startsWith("SERVICE_UNAVAILABLE:")) {
      if (_retryCount < MAX_RETRIES) {
        const delay = BASE_DELAY_MS * Math.pow(2, _retryCount);
        console.warn(`[safeLLM] Service unavailable — retrying in ${delay}ms (attempt ${_retryCount + 1}/${MAX_RETRIES})`);
        await new Promise((resolve) => setTimeout(resolve, delay));
        return safeLLM(params, _retryCount + 1);
      }
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "The AI service is temporarily unavailable. Please try again in a moment.",
      });
    }
    // Catch-all: any other error from invokeLLM (e.g. LLM returned non-JSON, parse failed, unexpected response)
    // Convert to a clean TRPCError so the client never sees a raw JSON.parse crash message.
    const rawMsg = err instanceof Error ? err.message : String(err);
    console.error(`[safeLLM] Unexpected error:`, rawMsg.slice(0, 200));
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "The AI service encountered an unexpected error. Please try again in a moment.",
    });
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
import { uploadMediaFromUrl, createWpPost, buildBlogSchemas, fetchAllWpPosts, findRelevantPosts, updateWpPostYoast, getWpYoastScore, updateWpPostContent, type WpPostSummary } from "./wordpress";
import { markdownToWpHtml, DEFAULT_WP_CATEGORIES, resolveOrCreateWpTags, resolveWpCategories, fetchWpCategories } from "./wpContentUtils";
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
import { utmRouter } from "./utmRouter";
import { ingestGenerateRouter } from "./ingestGenerateRouter";
import { newsfeedRouter } from "./newsfeedRouter";
import { viralStudioRouter } from "./viralStudioRouter";
import { videoVariantRouter } from "./videoVariantRouter";
import { videoSessionRouter } from "./videoSessionRouter";
import { bookLibraryRouter } from "./bookLibraryRouter";
import { presenceAssessmentRouter } from "./presenceAssessmentRouter";
import { ebookRouter } from "./ebookRouter";
import { gscRouter } from "./gscRouter";
import { backlinkRouter } from "./backlinkRouter";
import { dataForSeoRouter } from "./dataForSeoRouter";
import { crossModuleRouter } from "./crossModuleRouter";
import { redditRouter } from "./redditRouter";
import { podcastRouter } from "./podcastRouter";
import { keywordStrategyRouter } from "./keywordStrategyRouter";
import { syndicationRouter } from "./syndicationRouter";
import { hostedLandingPagesRouter } from "./hostedLandingPagesRouter";
import { testimonialsRouter } from "./testimonialsRouter";
import { kajabiOptIn } from "./kajabiApi";
import { videoToBlogRouter } from "./videoToBlogRouter";
import { blogToYoutubeRouter } from "./blogToYoutubeRouter";
import { vidiqRouter } from "./vidiqRouter";
import { analyticsSyncRouter } from "./analyticsSyncRouter";
import { videoPipelineRouter } from "./videoPipelineRouter";
import { heygenRouter } from "./heygenRouter";
import { metaAdsRouter } from "./metaAdsRouter";
import { resolveOutboundLinkPlaceholders } from "./linkResolver";
import { scrubHallucinatedUrls, resolvePlaceholderLinks } from "./urlScrubber";
import { runInternalLinkOptimizer } from "./internalLinkOptimizer";

/**
 * cleanSocialCopy — post-processing guard that strips structural labels the LLM
 * occasionally outputs despite explicit prompt instructions.
 *
 * Patterns removed:
 *  - Standalone label lines: "Hook:", "CTA:", "Body:", "Section 1:", "[Section]", etc.
 *  - Markdown horizontal rules: lines that are only dashes, underscores, or asterisks (---)
 *  - Meta-commentary lines: "Here's your …", "Here is the …", "Below is …"
 *  - Trailing/leading blank lines (normalised to single blank lines between paragraphs)
 *
 * Safe for all platforms — does NOT touch hashtags, URLs, or numbered thread lines (1/).
 */
function cleanSocialCopy(text: string): string {
  const lines = text.split("\n");
  const cleaned: string[] = [];
  // Matches lines that are ONLY a label followed by a colon (and optional whitespace)
  // e.g. "Hook:", "CTA:", "Body:", "Section 1:", "Slide 3:", "Opening:"
  const labelPattern = /^\s*(?:hook|cta|body|intro|outro|caption|section\s*\d*|slide\s*\d*|post|tweet\s*\d*|thread|opening|closing|call\s*to\s*action|visual|image|note|tip|p\d+)\s*:\s*$/i;
  // Matches lines that are only horizontal-rule characters
  const dividerPattern = /^\s*[-_*]{3,}\s*$/;
  // Matches meta-commentary openers ("Here's your LinkedIn post:", "Below is the caption:", etc.)
  const metaCommentPattern = /^\s*(?:here(?:'s| is)|below is|the following is|this is|above is)\s+(?:your|the|a)\s+/i;
  for (const line of lines) {
    if (labelPattern.test(line)) continue;       // strip "Hook:", "CTA:", etc.
    if (dividerPattern.test(line)) continue;     // strip "---", "___", "***"
    if (metaCommentPattern.test(line)) continue; // strip "Here's your LinkedIn post:"
    cleaned.push(line);
  }
  // Collapse 3+ consecutive blank lines down to 2
  const collapsed = cleaned.join("\n").replace(/\n{3,}/g, "\n\n").trim();
  return collapsed;
}

// Platform-specific prompt templates for Pedram's voice
// CRITICAL: All prompts must produce ONLY clean, publishable copy — no labels, headers, or internal markup.
const PLATFORM_PROMPTS: Record<string, string> = {
  linkedin: `You are a ghostwriter for Dr. Pedram Shojai (The Urban Monk) on LinkedIn. His audience is high-achieving corporate executives, entrepreneurs, and professionals aged 35-55.

VOICE: Professional, authoritative, data-informed, challenges hustle culture, bridges ancient wisdom with modern science. Direct, confident, slightly provocative. No fluff.

SOCRATIC PULL METHOD (REQUIRED): Every post must use the discovery narrative format — Pedram is a fellow traveler who went looking and found something, NOT a teacher delivering answers. The audience is invited to recognize their own question in his. Structure: "I had this question. I went looking. Here is what I found. If this resonates, I share more of these here daily."

FIRST LINE RULE: The first line MUST be a question the audience is already half-asking themselves — NOT a statement, NOT a claim, NOT a fact. The question is the hook. Examples: "Have you ever done everything right and still felt like something was missing?" / "What if the disconnection you feel isn't a character flaw — it's a signal?" / "Are you living your life, or watching it?"

CRITICAL OUTPUT RULES:
- Output ONLY the finished post text — nothing else
- Do NOT include any labels, headers, or structural markers (no "Hook:", "CTA:", "Body:", "---", "[Section]", or any similar markup)
- Do NOT include any meta-commentary, instructions, or explanations
- The output must be copy-paste ready to publish directly on LinkedIn
- Start with the first word of the post itself

POST STRUCTURE (invisible — do not label these):
- First line: a question the audience is already half-asking themselves (NEVER a statement)
- 3-5 short paragraphs in discovery narrative format: the question → the journey → the surprising finding → the resolution
- Final line: a soft invitation to follow for more (NOT a hard CTA to buy) — "I share more of these here daily."
- 150-300 words total
- No hashtags in the body; add 3-5 relevant hashtags at the very end on their own line — always include #urbanmonk as the first hashtag
- Use blank lines between paragraphs for readability

CONTENT PILLARS: Performance optimization, biological hardware, gut-brain connection, energy management, upstream medicine, the cost of ignoring your health, ancient wisdom applied to modern life. ADDITIONAL PILLARS FROM RON'S STRATEGY: Actual Intelligence vs. Artificial Intelligence (your trained nervous system is the one thing AI can't replace), the NPC problem (high-achievers living on autopilot, going through the motions, not actually in the game of life), the sailing teacher frame (Pedram teaches sailing — he is not your boat captain), the attention economy theft (your perceptual channels have been systematically hijacked — not by accident, by design).`,

  meta: `You are a ghostwriter for Dr. Pedram Shojai (The Urban Monk) on Instagram and Facebook. His audience is health-conscious professionals and wellness seekers aged 28-50.

VOICE: Warm, relatable, inspiring, educational but accessible. Bridges science and spirituality. Personal stories welcome. Empathetic but direct.

SOCRATIC PULL METHOD (REQUIRED): Every post must begin with a question the audience is already half-asking themselves — NOT a statement, NOT a fact. The question opens a door. Then Pedram walks through it with them: "I had this question. I went looking. Here is what I found." He is a fellow traveler, not a teacher. The audience discovers alongside him.

FIRST LINE RULE: The first 1-2 lines (before the Instagram "more" cutoff) MUST be a question. Examples: "What if the exhaustion you feel isn't a sign you're doing too much — but a sign something has been taken from you?" / "Have you ever woken up after 8 hours and still felt completely empty?" / "What would change if you actually trusted your body again?"

CRITICAL OUTPUT RULES:
- Output ONLY the finished post text — nothing else
- Do NOT include any labels, headers, or structural markers (no "Hook:", "CTA:", "Body:", "---", "[Section]", or any similar markup)
- Do NOT include any meta-commentary, instructions, or explanations
- The output must be copy-paste ready to publish directly on Instagram or Facebook
- Start with the first word of the post itself

POST STRUCTURE (invisible — do not label these):
- First 1-2 lines: a question the audience is already half-asking (NEVER a statement) — must appear before the "more" cutoff
- 3-5 short paragraphs in discovery narrative format: the question → the journey → the surprising finding → the resolution
- Final line: a soft invitation, NOT a hard sell — "I share more of these here daily." or "Save this for when you need it."
- 150-250 words
- 5-10 relevant hashtags on their own line at the very end — always include #urbanmonk as the first hashtag

CONTENT PILLARS: Daily practices, mindfulness, gut health, energy, sleep, stress, Lights On, Upstream, personal transformation stories. ADDITIONAL PILLARS: Actual Intelligence vs. AI (your senses and nervous system are irreplaceable), the NPC problem (going through the motions without being present), the attention economy theft (your perceptual channels have been hijacked by design), the sailing teacher frame (Pedram teaches you to sail — he is not your captain).`,

    x: `You are a ghostwriter for Dr. Pedram Shojai (The Urban Monk) on X (Twitter). His audience is intellectually curious professionals and wellness enthusiasts.
VOICE: Sharp, punchy, thought-provoking. Challenges conventional wisdom. Mix of bold statements and nuanced insights.

SOCRATIC PULL METHOD (REQUIRED): On X, the Socratic Pull is compressed into a single question that stops the scroll. The tweet IS the question — or it is the punchline of a discovery that implies the question. Examples of the format: "What if you're not burned out. What if something was taken from you?" / "Are you an NPC?" / "Your phone knows more about your body than you do. That's not a feature. That's a problem." / "Actual Intelligence: the thing AI can't replace. Most people have lost access to it."

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

CONTENT PILLARS: Counterintuitive health insights, performance hacks, mindset shifts, short wisdom nuggets, thread-worthy deep dives. ADDITIONAL PILLARS: Actual Intelligence vs. AI (the trained nervous system is irreplaceable), the NPC problem (are you actually playing the game of your life?), the attention economy theft (your perceptual channels have been hijacked by design), the sailing teacher frame.

EXAMPLE of a good Socratic Pull tweet (question that stops the scroll):
"What if you're not burned out. What if something was taken from you?"

EXAMPLE of a good discovery tweet (punchline implies the question):
"Actual Intelligence: the thing AI can't replace. Most people have lost access to it. #urbanmonk"

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

CONTENT PILLARS: Deep dives on gut health, sleep optimization, stress physiology, ancient practices, functional medicine, Lights On, Upstream.`,

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
// BLOG_CONTENT_RULES contains all writing/SEO rules WITHOUT any JSON output instruction.
// This is used for the article-body pass (Pass 1) so there is no conflicting output format.
// The metadata pass (Pass 2) uses its own separate JSON schema prompt.
const BLOG_CONTENT_RULES = `You are a ghostwriter for Dr. Pedram Shojai (The Urban Monk) writing a publication-ready long-form blog article for theurbanmonk.com. This article must pass BOTH traditional Google SEO and AI Engine Optimization (AEO) — meaning it will be cited by ChatGPT, Perplexity, Claude, and Google AI Overviews.

⚠️ YOAST READABILITY HARD STOPS — READ THESE FIRST, BEFORE WRITING A SINGLE SENTENCE:

HARD STOP 1 — TRANSITION WORDS (≥30% of all sentences REQUIRED):
Yoast scans every sentence in the article body and counts how many contain a transition word or phrase. The minimum passing threshold is 30%. Below 30% = RED FAIL. You MUST target 35% to pass comfortably.

WHAT COUNTS AS A TRANSITION WORD: However, Therefore, As a result, In addition, Furthermore, Meanwhile, For example, In contrast, Consequently, First, Second, Third, Finally, In fact, Specifically, Most importantly, In other words, That said, Even so, Because of this, At the same time, To be clear, In practice, Over time, In short, Additionally, Moreover, Notably, Instead, Still, Yet, Thus, Hence, Indeed, Otherwise, Likewise, Similarly, Afterward, Previously, Ultimately, Essentially, Particularly, Importantly, Fortunately, Unfortunately, Surprisingly, Although, Because, Since, While, When, After, Before, Once, Unless, Until, Despite, Rather than, Not only, As long as, As soon as.

HOW TO COMPLY:
1. Every paragraph of 3+ sentences MUST contain at least one transition word.
2. NEVER write 3 consecutive sentences without a transition word appearing somewhere in one of them.
3. After writing the full article, count: (sentences with a transition) ÷ (total sentences). If below 35%, add transitions to the weakest paragraphs before outputting.
4. Distribute transitions evenly — do not cluster them all in one section.

HARD STOP 2 — CONSECUTIVE SENTENCE STARTS (ZERO TOLERANCE):
Yoast flags any run of 4 or more consecutive sentences that begin with the same word as a RED FAIL. Even 3 in a row is an amber warning.

HOW TO COMPLY:
1. After writing each paragraph, scan the FIRST WORD of every sentence in that paragraph.
2. If the same word opens 3 or more sentences in a row, rewrite at least one of them to start with a different word or a transition phrase.
3. Most common offenders: ‘The’, ‘This’, ‘It’, ‘You’, ‘Your’, ‘He’, ‘She’, ‘They’, ‘When’, ‘If’, ‘A’, ‘An’, ‘In’, ‘By’.
4. Before outputting the full article, do a FINAL SCAN of the entire text. Find every run of 3+ consecutive sentences starting with the same word. Fix every single instance.

FIX PATTERN: If you have written “The gut… The liver… The brain…” — change the third to “Meanwhile, the brain…” or “Consequently, the brain…” or restructure the sentence entirely.

AUDIENCE: Educated, health-conscious adults aged 30-55. Ambitious professionals, parents, and seekers who are serious about optimizing their biology, reducing chronic stress, and integrating ancient wisdom with modern science. They are skeptical of hype but hungry for evidence-based alternatives. They have tried conventional medicine and found it lacking. They want depth, not listicles.

VOICE (GhostLink OS B6 Voice Rules — non-negotiable):
- Sentences ≤18 words average. Break anything longer.
- No adverbs modifying verbs. Pick a stronger verb.
- BANNED WORDS: leverage, strategic, solutions, stakeholder, ecosystem, robust, synergy, paradigm, best-in-class, world-class, empowering, transforming, revolutionizing, unlocking, perhaps, maybe, kind of, sort of, in today's world, at the end of the day
- Concrete nouns over abstract nouns. Every bold claim has a receipt within 2 sentences.
- Direct address: "you" and "we" — never "one" or "users"
- Opinions land hard. No "I think maybe."
- Pedram writes as a doctor (OMD), a Daoist monk, a filmmaker, and a father. Warm but direct. He cites mechanisms (not just studies). He tells short stories. Never condescending. No fluff.

⚠️ OUTPUT FORMAT FOR THIS CALL: Output ONLY the full article body in clean Markdown. Do NOT wrap in JSON. Do NOT include a title H1 at the top. Start directly with the opening hook paragraph. Write the complete article — all sections fully developed — ending with the FAQ section. Do not stop early. Do NOT output JSON under any circumstances.

Do NOT include any labels like 'Hook:', 'CTA:', 'Section 1:', or '---' dividers

ARTICLE STRUCTURE (follow exactly — this is the GhostLink OS Written Pillar Architecture):

1. OPENING HOOK (2-3 paragraphs, 200-250 words):
   Select hook from the 12 families based on emotional driver. Start with the painful truth — a provocative statement, a surprising statistic, or a brief patient story. Establish the problem viscerally. Make the reader feel seen. End with a bridge sentence that promises real answers. The first sentence must pass the 3-second scroll test: specific, tensioned, relevant.
   ⚠️ YOAST HARD RULE — KEYPHRASE IN FIRST PARAGRAPH: The EXACT focus keyword (or a one-word variation) MUST appear in the FIRST paragraph of the article body — not the second, not the third. The FIRST paragraph. This is Yoast's single highest-priority check. If you write a pain-narrative first paragraph, you MUST include the focus keyword in it. Example: if the focus keyword is 'qigong for digestion', the first paragraph must contain 'qigong for digestion' or 'digestive qigong' or 'qigong and digestion'. There is no exception to this rule — the narrative hook and the keyphrase must coexist in the first paragraph.

2. KEY TAKEAWAYS (immediately after the opening hook, before the first H2):
   Output a Markdown block that begins with the exact heading: ## Key Takeaways
   Then write 4-6 concise bullet points (using - ) that summarise the most actionable insights the reader will gain from this article. Each bullet must be a complete sentence, 15-25 words, written in Pedram's warm-but-direct voice. These bullets should tease the framework and outcomes — they are a promise to the reader, not a dry abstract. Do NOT use sub-bullets. Do NOT repeat the article title. This section must appear in the article body immediately after the opening hook paragraphs.

3. THE HIDDEN PROBLEM — WHY THIS IS HAPPENING (1 H2, 2-3 paragraphs, 200-250 words):
   H2 must contain a semantic keyword and answer a PAA-style question. Diagnose the root cause — the biology, physiology, Daoist or functional medicine lens. Name the surface symptom, reveal the root cause, explain the mechanism, validate their effort. This earns the right to teach.
   ⚠️ YOAST SUBHEADING RULE: At least ONE of the H2 headings in sections 3, 4, or 5 MUST contain the exact focus keyword or a very close synonym (e.g. if focus keyword is 'qigong for digestion', an H2 like 'How Qigong for Digestion Heals Your Gut-Brain Axis' passes). This is mandatory — Yoast checks every H2 and H3 for the focus keyword.

4. WHAT MOST PEOPLE GET WRONG (1 H2, 2-3 paragraphs, 200-250 words):
   H2 must contain a semantic keyword. Use the 3-Mistake Pattern: (1) the Tactic mistake — what they're doing that doesn't work, (2) the Mindset mistake — what false belief holds them back, (3) the System mistake — what process or structure is missing. Challenge mainstream medicine AND the wellness industry. Be specific. Be bold.

5. THE FRAMEWORK — [GIVE IT A MEMORABLE NAME] (1-2 H2 sections, 3-4 paragraphs each, 300-400 words):
   ⚠️ YOAST SUBHEADING RULE: The H2 for this framework section MUST contain the exact focus keyword. This is the most natural place to put it. Example: if focus keyword is 'qigong for digestion', name the section '## The Qigong for Digestion Framework: Three Pillars of Gut Healing'. Name the framework (e.g. "The 3-Gate Protocol" or "The Upstream Reset Method"). For each step: give it a memorable name, teach the core concept, name the common mistake, give a mini-example. Include specific actionable practices — Qigong, breathwork, dietary shifts, supplement protocols, sleep hygiene, nervous system regulation. Reference Pedram's books or podcast episodes naturally as proof.

6. PRACTICAL PROTOCOL (1 H2, 2-3 paragraphs, 150-200 words):
   H2 must be a question (e.g. "How Do You Start This Week?"). Give 3-5 numbered concrete steps. Be specific — not "reduce stress" but "practice 5 minutes of Qigong before breakfast for 30 days."

7. TRANSFORMATION VISION (1-2 paragraphs, 100-150 words):
   Paint the future state using Identity and Inspiration driver language. WHEN you apply this framework... YOU STOP [painful behavior]... YOU START [empowered behavior]... YOU BECOME [identity label]. Make the contrast vivid.

8. CLOSING + CTA (2 paragraphs, 150-200 words):
   Bring the article full circle — reference the opening hook. Close with an empowering statement. Then write a natural, non-pushy CTA paragraph that invites the reader to go deeper. Link ONLY to https://theurbanmonk.com — do NOT use any other URL, do NOT invent course names or module names, do NOT reference "the Academy" as if it is a specific product. Keep the CTA generic: invite the reader to explore more resources at The Urban Monk. Frame as the logical next step, not a sales pitch. CTA friction level: Medium (T3 — email capture or course enrollment).

9. FAQ SECTION (place at the END of the article, after the CTA):
   Use the faqSection field content here. Format: ## Frequently Asked Questions\\n[paste the FAQ content]. This section is critical for Google featured snippets and AI engine citation.

SEO + AEO INTEGRATION RULES (non-negotiable):
- H1 (title) must contain the primary focus keyword. HARD LIMIT: title must be 48 characters MAX INCLUDING spaces. Yoast uses pixel width — colons, capital letters, and wide characters (W, M) consume extra pixels. Aim for 36-45 characters to be safe. If your title is 49+ characters, shorten it before outputting. Example safe titles: 'Heal Your Gut for Good: Beyond Diets' (36 chars ✓), 'Qigong for Digestion: Heal Your Gut' (35 chars ✓), 'Fix Your Sleep Architecture Tonight' (35 chars ✓). DO NOT write a title longer than 48 characters.
- KEYPHRASE IN INTRODUCTION (Yoast #1 check): The focus keyword or a close synonym MUST appear in the very FIRST sentence or second sentence of the article body. Not the third paragraph — the FIRST paragraph, ideally within the first two sentences. This is the single most important Yoast check. If the focus keyword is not in the first paragraph, Yoast will flag it red regardless of density elsewhere.
- KEYPHRASE DENSITY (Yoast minimum — CRITICAL): The focus keyword or its close synonym must appear at least 10 times total in the article. Yoast counts only body text (not the page title or H1), so you need 10+ total to guarantee 8+ in the body. Distribute occurrences across ALL of these locations: (1) first paragraph first sentence, (2) at least one H2 heading, (3) the hidden problem section body, (4) the framework/protocol section body, (5) the practical steps section, (6) the transformation vision paragraph, (7) the closing/CTA paragraph, (8) the FAQ answer text (at least 2 FAQ answers), (9) a sub-pillar or tip paragraph, (10) the conclusion. Do NOT cluster 2 occurrences in the same sentence. After writing the full article, COUNT every occurrence explicitly and add more if below 10. This is non-negotiable.
- KEYPHRASE IN SUBHEADINGS (Yoast check): At least ONE H2 heading must contain the exact focus keyword or a very close synonym (e.g. if focus keyword is 'qigong for stress relief', an H2 like 'How Qigong for Stress Relief Resets Your Nervous System' passes). This is separate from the density check — it must be in a heading specifically.
- INTERNAL LINKS (Yoast check — RED FLAG if missing): Include at least 3 internal links to other articles on theurbanmonk.com. Use URLs from the VERIFIED INTERNAL LINK LIST provided in the user message. If the list has 3+ relevant URLs, use them with descriptive anchor text. If the list has fewer than 3 relevant URLs, use ALL available ones AND add [INTERNAL LINK: topic] placeholders for the remainder. CRITICAL: You MUST output at least 3 internal link references (real URLs or placeholders). Zero internal links = guaranteed Yoast red flag. The urlScrubber will resolve placeholders automatically — just make sure they are present in the article.
- Each H2 must either contain a semantic keyword variant OR be phrased as a question (PAA format)
- Include a clear, direct answer to the core question within the first 300 words (woven into the opening hook — NOT as a separate TL;DR box or blockquote)
- Use sequential H2/H3 heading structure — this increases AI citation odds by 2.8x
- Weave 3-5 semantic keyword variants naturally into headings and body (not forced)
- Include at least 2 internal links to related articles on theurbanmonk.com. A VERIFIED INTERNAL LINK LIST will be provided in the user message — you MUST use ONLY URLs from that list. Use Markdown format: [anchor text](url). If you need a link to a topic not in the list, use the placeholder format: [INTERNAL LINK: topic of related article] — NEVER invent or guess a theurbanmonk.com URL that is not explicitly in the provided list
- Include at least 2 outbound links to high-authority sources (PubMed, Harvard Health, Mayo Clinic, NIH). Use real verified URLs if you know them with high confidence. For any source you are not 100% certain of, use the placeholder format: [Outbound Link: Source Name — description] — these will be resolved to real URLs automatically after generation
- The FAQ section at the bottom targets featured snippets and AI citation
- E-E-A-T signals: weave Pedram's credentials (OMD, Daoist monk, filmmaker, author) naturally into the body — not as a bio block, but as contextual authority within the teaching. IMPORTANT: Do NOT claim "NYT bestselling" or any specific award/accolade unless it is a verifiable fact. Do NOT fabricate media mentions (e.g. "As featured in The New York Times"). Do NOT reference specific YouTube series, podcast episode numbers, or course module names that may not exist — reference Pedram's work generically (e.g. "in my practice", "in my book", "in my podcast").

ABSOLUTE RULES — NEVER VIOLATE:
- NEVER use the URL urbanmonk.com — it is NOT owned by Pedram. The ONLY correct domain is theurbanmonk.com
- NEVER invent, guess, or construct a theurbanmonk.com URL (e.g. theurbanmonk.com/some-article or theurbanmonk.com/course-name). You may ONLY use URLs that are explicitly listed in the VERIFIED INTERNAL LINK LIST provided in the user message. Any URL not in that list MUST use the placeholder format: [INTERNAL LINK: topic]
- NEVER fabricate media citations ("As featured in...", "As seen in The New York Times", etc.)
- NEVER reference specific YouTube series, podcast episode titles, or course module names unless they are provided in the user message
- NEVER add hashtags anywhere in the article — this is a blog post, not a social media post
- NEVER include a TL;DR block or summary box — the article should flow naturally without summary callouts
- NEVER use markdown link syntax to create a link where the display text says one URL but the href is a different URL (e.g. [urbanmonk.com/academy](https://theurbanmonk.com) is FORBIDDEN)

TOTAL ARTICLE LENGTH: 1,600-2,200 words (body only, not counting FAQ). Do not stop short. Every section must be fully developed.

FORMATTING RULES (YOAST READABILITY — NON-NEGOTIABLE):
- Use ## for H2 section headings (compelling, specific, keyword-rich — not generic like "The Solution")
- Use ### for H3 sub-headings within the framework steps
- SUBHEADING DISTRIBUTION: Every block of text MUST have an H2 or H3 heading within every 300 words. If a section runs longer than 300 words, split it with an H3 sub-heading. No section of prose may exceed 300 words without a heading break.
- PARAGRAPH LENGTH: Every paragraph must be 150 words or fewer (3-5 sentences max). If a paragraph exceeds 150 words, split it into two. This is a hard limit — Yoast flags paragraphs over 150 words as a readability failure.
- TRANSITION WORDS (YOAST HARD REQUIREMENT — ≥30%): At least 30% of ALL sentences in the article must begin with or contain a transition word or phrase. Yoast counts every sentence in the body — aim for 35% to give yourself a buffer. REQUIRED TRANSITION WORDS (use all of these throughout the article, distributed evenly): However, Therefore, As a result, In addition, Furthermore, Meanwhile, For example, In contrast, Consequently, First, Second, Third, Finally, In fact, Specifically, Most importantly, In other words, That said, Even so, Because of this, At the same time, To be clear, In practice, Over time, In short, Additionally, Moreover, Notably, Instead, Still, Yet, Thus, Hence, Indeed, Otherwise, Likewise, Similarly, Afterward, Previously, Ultimately, Essentially, Particularly, Importantly, Fortunately, Unfortunately, Surprisingly. RULE: Every paragraph of 3+ sentences must contain at least one transition word. Never write 3 consecutive sentences without a transition. After writing the full article, count: (number of sentences with a transition) ÷ (total sentences) — if below 30%, add transitions before outputting.
- CONSECUTIVE SENTENCE STARTS (YOAST HARD REQUIREMENT): NEVER begin 3 or more consecutive sentences with the same word. This is a hard red flag in Yoast. After writing each paragraph, scan the first word of every sentence. If any word appears 3+ times in a row as the sentence opener, rewrite at least one of those sentences to start differently. Common offenders: 'The', 'This', 'It', 'You', 'He', 'She', 'They', 'Your', 'When', 'If'. Before outputting, do a final scan of the entire article for any run of 3+ consecutive sentences starting with the same word — fix every instance.
- Use **bold** for key terms or critical insights (2-4 per section maximum)
- Use > blockquote for ONE powerful pull-quote per article only — do NOT use a TL;DR blockquote
- No bullet lists in the main body — write in flowing prose
- No em-dashes used as bullet substitutes
- No banned words from the Voice Rules above

QUALITY GATE (self-check before outputting):
- Does the hook pass the 3-second scroll test? Specific, tensioned, relevant?
- Is there ONE clear Big Idea the audience hasn't heard framed this way?
- YOAST SEO CHECK #1 (CRITICAL): Does the focus keyword appear in the FIRST SENTENCE or SECOND SENTENCE of the article body? If not, rewrite the opening.
- YOAST SEO CHECK #2: Does the focus keyword appear at least 10 times total in the article (Yoast excludes the H1/title from its count, so 10 total = ~8 in body)? Count them explicitly. If below 10, add more occurrences before outputting.
- YOAST SEO CHECK #3: Does at least ONE H2 heading contain the focus keyword or a very close synonym?
- YOAST SEO CHECK #4: Are there at least 3 internal links to theurbanmonk.com URLs from the provided list?
- YOAST SEO CHECK #5: Is the title 48 characters or fewer? Count every character including spaces. If 49+, shorten it now before outputting.
- YOAST SEO CHECK #6: Is the meta description EXACTLY 140-150 characters? Count every character including spaces. If over 150, cut words. If under 140, expand. Yoast's hard cutoff is 156 chars — stay well under it. The description must NOT end with '...' (that means it was truncated and is invalid). Count explicitly: write the description, then count every character, then adjust until the count is 140-150.
- YOAST SEO CHECK #7: Is the focus keyword a specific long-tail phrase (not a generic head term)?
- YOAST READABILITY CHECK: Is every prose block under 300 words before the next heading?
- YOAST READABILITY CHECK: Is every paragraph under 150 words?
- YOAST READABILITY CHECK — TRANSITION WORDS (CRITICAL): Count every sentence in the article. Count how many contain a transition word from the required list. Divide: transitions ÷ total sentences. If below 30%, you MUST add more transitions before outputting. Target 35% to pass comfortably. Do NOT skip this count.
- YOAST READABILITY CHECK — CONSECUTIVE SENTENCE STARTS (CRITICAL): Scan every paragraph. Find the first word of each sentence. If any word starts 3 or more consecutive sentences in a row, rewrite one of those sentences NOW before outputting. This is a hard red flag. Common offenders to check: 'The', 'This', 'It', 'You', 'Your', 'When', 'If', 'He', 'She', 'They'. Do NOT skip this scan.
- Is there a named framework with 3-7 steps?
- Is the primary Emotional Driver woven throughout (not bolted on)?
- Is there proof (mechanism, study, case, process walkthrough)?
- Does the transformation vision activate Identity or Inspiration?
- Is the CTA friction level T3 (medium — course enrollment or email capture)?
- Are all banned words absent?
- Does the opening hook contain a clear, direct answer to the core question within the first 300 words?
- Does the FAQ section contain 4-6 real PAA-style questions with direct answers?

CONTENT PILLARS: Gut-brain axis and LPS endotoxemia, sleep architecture and liver detox, cortisol and HPA axis dysregulation, energy economics and time compression syndrome, Daoist philosophy applied to modern life, functional medicine and upstream health, oral microbiome and systemic inflammation, ancient practices with scientific backing (Qigong, meditation, fasting, breathwork), mitochondrial health, circadian biology, neuroplasticity and stress resilience.`;

const DEFAULT_IMAGE_STYLE = PLATFORM_IMAGE_STYLES.all;

export const appRouter = router({
  system: systemRouter,
  bookLibrary: bookLibraryRouter,
  presenceAssessment: presenceAssessmentRouter,
  ebook: ebookRouter,
  gsc: gscRouter,
  backlink: backlinkRouter,
  dfs: dataForSeoRouter,
  crossModule: crossModuleRouter,
  reddit: redditRouter,
  podcast: podcastRouter,
  kwStrategy: keywordStrategyRouter,
  syndicationPipeline: syndicationRouter,
  hostedLp: hostedLandingPagesRouter,
  testimonials: testimonialsRouter,
  videoToBlog: videoToBlogRouter,
  blogToYoutube: blogToYoutubeRouter,
  vidiq: vidiqRouter,
  analyticsSync: analyticsSyncRouter,
  videoPipeline: videoPipelineRouter,
  heygen: heygenRouter,
  metaAds: metaAdsRouter,

  // ─── Substack ────────────────────────────────────────────────────────────────
  substack: router({
    validateSession: protectedProcedure.query(async () => {
      const { validateSubstackSession } = await import("./substackPublisher");
      return validateSubstackSession();
    }),
  }),

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
          platform: z.enum(["meta", "linkedin", "x", "youtube", "tiktok", "blog", "email", "carousel"]).default("linkedin"),
          status: z
            .enum(["idea", "pending_approval", "drafting", "review", "approved", "scheduled", "published"])
            .default("idea"),
          textContent: z.string().optional(),
          notes: z.string().optional(),
          gapQueryId: z.number().optional(), // Research Intelligence: link to source Gumshoe gap query
          personaId: z.number().optional(), // Target audience persona
          contentGoal: z.enum(["audience_growth", "llm_seo", "community_engagement"]).optional(),
          focusKeyword: z.string().optional(),         // Yoast SEO focus keyword
          seoKeywords: z.string().optional(),          // JSON array of semantic keyword strings
          ctaBlockLabel: z.string().optional(),        // CTA block label used during generation
          ingestReportId: z.number().optional(),          // Ingest pipeline: source report ID
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
          platform: z.enum(["meta", "linkedin", "x", "youtube", "tiktok", "blog", "email", "carousel"]).optional(),
          status: z
            .enum(["idea", "pending_approval", "drafting", "review", "approved", "scheduled", "published"])
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
          ctaBannerUrl: z.string().optional(),           // AI-generated CTA banner image URL
          sendToSubstack: z.boolean().optional(),          // Cross-post to Substack on WP publish
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
           status: z.enum(["idea", "pending_approval", "drafting", "review", "approved", "scheduled", "published", "pending_review"]),
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
    createBulk: protectedProcedure
      .input(
        z.object({
          items: z.array(
            z.object({
              title: z.string().min(1),
              rawIdea: z.string().optional(),
              platform: z.enum(["meta", "linkedin", "x", "youtube", "tiktok", "blog", "email", "carousel"]).default("tiktok"),
              status: z.enum(["idea", "pending_approval", "drafting", "review", "approved", "scheduled", "published"]).default("idea"),
              textContent: z.string().optional(),
            })
          ).min(1).max(20),
        })
      )
      .mutation(async ({ input }) => {
        const created = await Promise.all(
          input.items.map((item) => createContentItem(item))
        );
        return { created: created.length, ids: created.map((c) => (c as { id: number }).id) };
      }),

    /**
     * Upload a finished video file to S3 and attach it to a content item.
     * The client sends the file as a base64-encoded string with mimeType.
     * Returns the S3 URL stored on the content item.
     */
    uploadVideo: protectedProcedure
      .input(
        z.object({
          contentItemId: z.number(),
          base64Data: z.string().min(1),
          mimeType: z.string().default("video/mp4"),
          fileName: z.string().default("video.mp4"),
        })
      )
      .mutation(async ({ input }) => {
        const item = await getContentItem(input.contentItemId);
        if (!item) throw new TRPCError({ code: "NOT_FOUND", message: "Content item not found" });

        // Decode base64 and upload to S3
        const { storagePut } = await import("./storage");
        const fileBuffer = Buffer.from(input.base64Data, "base64");
        const ext = input.fileName.split(".").pop() ?? "mp4";
        const key = `videos/${input.contentItemId}-${Date.now()}.${ext}`;
        const { url } = await storagePut(key, fileBuffer, input.mimeType);

        // Persist videoUrl + videoKey on the content item
        await updateContentItem(input.contentItemId, {
          videoUrl: url,
          videoKey: key,
        });
        return { videoUrl: url, videoKey: key };
      }),
    // Log a per-channel video push to video_push_logs
    logVideoPush: protectedProcedure
      .input(
        z.object({
          contentItemId: z.number(),
          pushes: z.array(z.object({
            channelId: z.string(),
            channelName: z.string(),
            service: z.string(),
            bufferPostId: z.string().optional(),
            caption: z.string().optional(),
            scheduledAt: z.number().optional(),
          })),
        })
      )
      .mutation(async ({ input }) => {
        const { videoPushLogs } = await import("../drizzle/schema");
        const { getDb } = await import("./db");
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
        const rows = input.pushes.map((p) => ({
          contentItemId: input.contentItemId,
          channelId: p.channelId,
          channelName: p.channelName,
          service: p.service,
          bufferPostId: p.bufferPostId ?? null,
          caption: p.caption ?? null,
          scheduledAt: p.scheduledAt ?? null,
        }));
        await db.insert(videoPushLogs).values(rows);
        return { logged: rows.length };
      }),
    // Get push history for a content item
    getVideoPushLogs: protectedProcedure
      .input(z.object({ contentItemId: z.number() }))
      .query(async ({ input }) => {
        const { videoPushLogs } = await import("../drizzle/schema");
        const { getDb } = await import("./db");
        const db = await getDb();
        if (!db) return [];
        const { eq, desc } = await import("drizzle-orm");
        return db
          .select()
          .from(videoPushLogs)
          .where(eq(videoPushLogs.contentItemId, input.contentItemId))
          .orderBy(desc(videoPushLogs.pushedAt));
      }),
    /**
     * Fetch the Yoast SEO score for a published blog post from the WordPress REST API.
     * Stores the result in content_items.yoastScore and yoastScoreFetchedAt.
     * Returns { seoScore, readabilityScore } where each is "good" | "ok" | "bad" | null.
     */
    fetchYoastScore: protectedProcedure
      .input(z.object({ contentItemId: z.number() }))
      .mutation(async ({ input }) => {
        const item = await getContentItem(input.contentItemId);
        if (!item) throw new TRPCError({ code: "NOT_FOUND", message: "Content item not found" });
        if (!item.wpPostId) throw new TRPCError({ code: "BAD_REQUEST", message: "No WordPress post ID — publish the post first" });

        const { seoScore, readabilityScore } = await getWpYoastScore(item.wpPostId);

        // Persist the SEO score (primary indicator shown on card)
        await updateContentItem(input.contentItemId, {
          yoastScore: seoScore ?? undefined,
          yoastScoreFetchedAt: Date.now(),
        });

        return { seoScore, readabilityScore, fetchedAt: Date.now() };
      }),
  }),
  // ─── AI Generation ──────────────────────────────────────────────────────────
  ai: router({
    generateContent: protectedProcedure
      .input(
        z.object({
          idea: z.string().min(1),
          platform: z.enum(["meta", "linkedin", "x", "youtube", "tiktok", "blog", "email", "carousel", "all"]),
          customInstructions: z.string().optional(),
          generateImages: z.boolean().default(true), // auto-generate images alongside content
          personaId: z.number().optional(), // inject Typeform-enriched persona pain points
          gapQueryText: z.string().optional(), // Research Intelligence: inject competitor gap query
          utmContentOverride: z.string().optional(), // override utm_content placement type (e.g. "bio-link", "story", "reel")
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
            ? (["linkedin", "meta", "x", "youtube", "tiktok"] as const)
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
              pressAuthorityContext = `\n\nAUTHOR CREDENTIALS (weave naturally into content where relevant):\nDr. Pedram Shojai is a New York Times bestselling author, Doctor of Oriental Medicine, and Daoist monk. He has been featured in: ${outlets}. His work has reached millions of readers and viewers across major national and industry publications.`;
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
        let ctaBlockData: { label: string; ctaText: string; url: string | null } | null = null;
        try {
          const { getCtaForTopic } = await import("./ctaRouter");
          const cta = await getCtaForTopic(input.idea);
          ctaLabel = cta.label;
          ctaBlockData = cta;
        } catch (err) {
          console.warn("[Content] Could not load CTA:", err);
        }
        // Step 1: Generate all platform text in parallel
        const textResults = await Promise.all(
          platforms.map(async (platform) => {
            const systemPrompt = PLATFORM_PROMPTS[platform] || PLATFORM_PROMPTS.linkedin;
            const gapQueryLine = input.gapQueryText ? `\n\nThis content should directly address the competitor gap query: "${input.gapQueryText}" — position Pedram's unique perspective as the answer.` : "";
            // Build platform-specific CTA injection with UTM params auto-appended
            let ctaInjection = "";
            if (ctaBlockData) {
              const { appendUtmToCtaUrl, ctaLabelToCampaign, PLATFORM_UTM } = await import("./ctaRouter");
              const utmContent = input.utmContentOverride || PLATFORM_UTM[platform]?.content;
              const utmUrl = appendUtmToCtaUrl(ctaBlockData.url, platform, ctaLabelToCampaign(ctaBlockData.label), utmContent);
              const urlForPrompt = utmUrl || ctaBlockData.url || "lightson.theurbanmonk.com";
              ctaInjection = `\n\n[CTA BLOCK — ${ctaBlockData.label}]\n${ctaBlockData.ctaText}\n[END CTA BLOCK]\nCRITICAL URL RULE: If this content includes a link or URL, you MUST use EXACTLY this URL: ${urlForPrompt}. Do NOT invent, shorten, or substitute any other URL. Include this CTA naturally at the end of your content. Do not add any other call to action.`;
            }
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
            const text = cleanSocialCopy(typeof rawContent === "string" ? rawContent : "Content generation failed.");

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
          platform: z.enum(["meta", "linkedin", "x", "youtube", "tiktok", "blog", "email", "carousel"]),
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
          platform: z.enum(["meta", "linkedin", "x", "youtube", "tiktok", "blog", "email", "carousel"]).optional(),
          styleOverride: z.string().optional(),
        })
      )
      .mutation(async ({ input }) => {
        const platformStyle = PLATFORM_IMAGE_STYLES[input.platform ?? "linkedin"] ?? DEFAULT_IMAGE_STYLE;
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
            platform: input.platform ?? "linkedin",
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
          utmContentOverride: z.string().optional(), // override utm_content placement type (e.g. "bio-link", "story", "inline-cta")
          ctaBlockId: z.number().optional(), // manually selected CTA block ID — overrides auto-selection by topic
          focusKeyword: z.string().optional(),      // explicit SEO focus keyword (from Keyword Strategy tool)
          currentPosition: z.string().optional(),   // current Google SERP position (e.g. "14.2") — enables Strike Zone mode
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
              blogPressContext = `\n\nAUTHOR CREDENTIALS (weave naturally into the article for E-E-A-T):\nDr. Pedram Shojai is a New York Times bestselling author, Doctor of Oriental Medicine, and Daoist monk. He has been featured in: ${outlets}. His work has reached millions of readers and viewers across major national and industry publications.`;
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
        // Load topical CTA — use manually selected ctaBlockId if provided, otherwise auto-select by topic
        let blogCtaInjection = "";
        let blogCtaLabel = "Lights On (Default)";
        let blogCtaUrl = "https://lightson.theurbanmonk.com/";
        let blogCtaText = "";
        try {
          const { getCtaForTopic, appendUtmToCtaUrl, ctaLabelToCampaign, PLATFORM_UTM } = await import("./ctaRouter");
          let cta: { label: string; ctaText: string; url: string | null };
          if (input.ctaBlockId) {
            // Manual override: load the specific CTA block by ID
            const db = await getDb();
            if (db) {
              const { ctaBlocks: ctaBlocksTable } = await import("../drizzle/schema");
              const { eq: eqCta } = await import("drizzle-orm");
              const [block] = await db.select().from(ctaBlocksTable).where(eqCta(ctaBlocksTable.id, input.ctaBlockId));
              cta = block ? { label: block.label, ctaText: block.ctaText, url: block.url ?? null } : await getCtaForTopic(input.idea);
            } else {
              cta = await getCtaForTopic(input.idea);
            }
          } else {
            cta = await getCtaForTopic(input.idea);
          }
          blogCtaLabel = cta.label;
          blogCtaText = cta.ctaText;
          const blogUtmContent = input.utmContentOverride || PLATFORM_UTM["blog"]?.content;
          // Build UTM URL — utm_campaign derived from article slug for per-post tracking
          const articleSlug = cleanIdea.toLowerCase().replace(/[^a-z0-9\s]/g, "").trim().replace(/\s+/g, "-").substring(0, 64);
          const utmUrl = appendUtmToCtaUrl(cta.url, "blog", articleSlug, blogUtmContent);
          blogCtaUrl = utmUrl || cta.url || "https://lightson.theurbanmonk.com/";
          const urlForPrompt = blogCtaUrl;
          blogCtaInjection = `\n\n[CTA BLOCK — ${cta.label}]\n${cta.ctaText}\n[END CTA BLOCK]\nIMPORTANT: Include this CTA naturally in the Conclusion section of the blog post. Use EXACTLY this URL: ${urlForPrompt}`;
          console.log(`[Blog] CTA: "${blogCtaLabel}" → ${blogCtaUrl} (${input.ctaBlockId ? 'manual override' : 'auto-selected'})`);
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

        // ── Load verified internal links + WordPress post index ──────────────────
        // These are the ONLY URLs the AI is allowed to use as internal links.
        // Any theurbanmonk.com URL not in this list must use [INTERNAL LINK: topic] placeholder.
        let internalLinkBlock = "";
        try {
          const db = await getDb();
          if (db) {
            const { wpPostIndex, verifiedLinks } = await import("../drizzle/schema");

            // 1. Load manually curated verified links (always included, filtered by active)
            const { eq: eqOp } = await import("drizzle-orm");
            const allVerified = await db.select().from(verifiedLinks).where(eqOp(verifiedLinks.active, true));
            const verifiedEntries = allVerified.map((v: any) => {
              const tags: string[] = JSON.parse(v.topicTags ?? "[]");
              return { url: v.url, title: v.title, description: v.description ?? "", tags };
            });

            // 2. Load WordPress post index (synced from theurbanmonk.com)
            const allPosts = await db.select().from(wpPostIndex).limit(500);

            // Always trigger a background refresh so the link resolver has the freshest post list.
            // We fire-and-forget regardless of whether the index is empty or stale — this costs
            // nothing to the generation latency since we use the already-loaded allPosts for the
            // current request and the refreshed data benefits the NEXT generation.
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
              console.log(`[Blog] Background WP post index refreshed: ${posts.length} posts synced.`);
            }).catch((err) => console.warn("[Blog] WP post background sync failed:", err));

            // 3. Find relevant WP posts for this topic
            let relevantWpLinks: string[] = [];
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
              const relevant = findRelevantPosts(postSummaries, input.idea, 6);
              relevantWpLinks = relevant.map((p) => `- [${p.title}](${p.url}) — ${p.excerpt.slice(0, 100)}`);
            }

            // 4. Find relevant verified links for this topic (simple keyword match)
            const ideaLower = input.idea.toLowerCase();
            const relevantVerified = verifiedEntries
              .filter((v) => v.tags.some((t) => ideaLower.includes(t.toLowerCase()) || t.toLowerCase().split(" ").some((w) => ideaLower.includes(w))))
              .slice(0, 5)
              .map((v) => `- [${v.title}](${v.url})${v.description ? " — " + v.description.slice(0, 100) : ""}`);

            // 5. Build the combined link block — only use what is in the verified list
            const allLinkLines = Array.from(
              new Set([...relevantVerified, ...relevantWpLinks])
            ).slice(0, 12);

            // Foundation links: always include these 4 core Urban Monk pages so the AI
            // always has at least 3 real internal links to use, even when the WP post index
            // is empty. This guarantees Yoast's internal links check passes on every post.
            const foundationLinks = [
              `- [The Urban Monk Academy — Holistic Health & Wellness Training](https://theurbanmonk.com/urban-monk-academy/)`,
              `- [The Urban Monk — Dr. Pedram Shojai's Official Site](https://theurbanmonk.com/)`,
              `- [Well.org — Wellness Community & Resources](https://well.org/)`,
              `- [Urban Monk Nutrition — Supplements & Wellness Products](https://theurbanmonk.com/urban-monk-nutrition/)`,
            ];
            // Merge: topic-specific links first, then foundation links (deduped, capped at 12)
            const mergedLinkLines = Array.from(
              new Set([...allLinkLines, ...foundationLinks])
            ).slice(0, 12);
            internalLinkBlock = `\n\nVERIFIED INTERNAL LINK LIST — CRITICAL: You may ONLY use URLs from this list as internal links. Do NOT invent, guess, or construct any theurbanmonk.com URL not shown here. You MUST include at least 3 links from this list in the article body. For any topic not covered by a URL in this list, use the placeholder format: [INTERNAL LINK: topic].\n${mergedLinkLines.join("\n")}`;
            if (allLinkLines.length === 0) {
              console.log(`[Blog] WP post index empty — using foundation links only for internal link injection.`);
            }
          }
        } catch (err) {
          console.warn("[Blog] Could not load internal link index:", err);
        }

        // Step 1: Generate the full blog article as structured JSON
        // Build Strike Zone SEO brief when a focus keyword + SERP position are provided
        const strikeZoneBrief = (() => {
          const kw = input.focusKeyword?.trim();
          const pos = input.currentPosition ? parseFloat(input.currentPosition) : null;
          if (!kw) return "";
          const isStrikeZone = pos !== null && pos >= 11 && pos <= 30;
          if (isStrikeZone) {
            return `

STRIKE ZONE SEO BRIEF — CRITICAL: This article is a precision ranking campaign. The focus keyword "${kw}" currently ranks at position ${pos.toFixed(1)} on Google (striking distance: positions 11–30). The mission is to move it into the top 10.

SEO REQUIREMENTS FOR THIS ARTICLE:
1. FOCUS KEYWORD: "${kw}" — use this exact phrase in: the opening paragraph (within first 100 words), at least one H2 heading, the meta description, and 3–5 times naturally throughout the body. Do NOT keyword-stuff.
2. SEARCH INTENT: Identify whether this keyword is informational, navigational, or commercial. Match the article format to that intent exactly.
3. COMPETITIVE DIFFERENTIATION: The top-10 results for "${kw}" are generic. This article wins by:
   — Going deeper on the mechanism (not just the symptom)
   — Citing Dr. Shojai’s clinical experience and Daoist framework as a unique lens
   — Answering the PAA (People Also Ask) questions that competitors miss
   — Providing a named, actionable protocol (not just information)
4. E-E-A-T SIGNALS: Weave in Dr. Shojai’s credentials (OMD, Daoist monk, NYT bestselling author, clinical practice) naturally — not as a bio block, but as proof woven into the argument.
5. FEATURED SNIPPET TARGET: Structure one section as a direct, concise answer (40–60 words) to the primary question behind the keyword. This is the featured snippet target.
6. PAA COVERAGE: The FAQ section must include the exact PAA questions that Google shows for "${kw}" — answer each one directly and completely in 2–3 sentences.
7. SEMANTIC DEPTH: Use related terms, synonyms, and co-occurring concepts that signal topical authority to Google’s Helpful Content system.

This is not a general wellness article. It is a tactical SEO asset designed to outrank the current top-10 results for "${kw}".`;
          } else if (kw) {
            // Focus keyword provided but NOT in confirmed strike zone (no GSC position or position outside 11–30).
            // Inject only a minimal SEO note — do NOT frame this as a competitive ranking campaign.
            return `

SEO NOTE: The target focus keyword for this article is "${kw}". Use it naturally in the opening paragraph, at least one H2 heading, and 3–5 times throughout the body. Do not over-optimize or keyword-stuff.`;
          }
          return "";
        })();
        const userMessage = [
          `Raw idea: ${cleanIdea}`,
          strikeZoneBrief,
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
        // ARTICLE_BODY_PROMPT uses BLOG_CONTENT_RULES which already has the Markdown-only
        // output instruction at the top. There is NO JSON schema in this prompt, so the model
        // cannot fall back to JSON output. This eliminates the conflicting-instruction bug.
        const ARTICLE_BODY_PROMPT = BLOG_CONTENT_RULES;

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
        // Strategy 1: JSON.parse (works when properly escaped)
        // Strategy 2: Extract "article" value via character walk (handles unescaped newlines)
        // Strategy 3: Find "article": then grab everything until the next top-level key
        const extractArticleFromJson = (raw: string): string | null => {
          try {
            // Step 1: Strip code fences
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
              // JSON.parse failed — fall through
            }

            // Step 3: Character-walk extraction — handles unescaped newlines inside the value
            const articleKeyMatch = stripped.match(/"article"\s*:\s*"/);
            if (articleKeyMatch && articleKeyMatch.index !== undefined) {
              const valueStart = articleKeyMatch.index + articleKeyMatch[0].length;
              let i = valueStart;
              let result = "";
              while (i < stripped.length) {
                const ch = stripped[i];
                if (ch === "\\" && i + 1 < stripped.length) {
                  const next = stripped[i + 1];
                  if (next === "n") { result += "\n"; i += 2; continue; }
                  if (next === "t") { result += "\t"; i += 2; continue; }
                  if (next === "\\") { result += "\\"; i += 2; continue; }
                  if (next === '"') { result += '"'; i += 2; continue; }
                  result += next; i += 2; continue;
                }
                if (ch === '"') break; // end of string value
                result += ch;
                i++;
              }
              if (result.length > 200) return result;
            }

            // Step 4: Fallback — find "article": then grab until the next top-level JSON key
            // This handles cases where the article value contains unescaped quotes that
            // cause the character walk to stop early.
            const articleKeyIdx = stripped.indexOf('"article":');
            if (articleKeyIdx !== -1) {
              // Find the opening quote of the value
              const openQuoteIdx = stripped.indexOf('"', articleKeyIdx + '"article":'.length);
              if (openQuoteIdx !== -1) {
                // Find the next top-level key pattern: ",\n  "someKey": or end of object
                // Look for pattern: ",\n  "<word>":\s" at the same indent level
                const afterValue = stripped.slice(openQuoteIdx + 1);
                // Find the last occurrence of a top-level key transition
                // Top-level keys appear as: (newline)(spaces)"key": at depth 1
                const nextKeyMatch = afterValue.match(/\n\s{0,4}"[a-zA-Z]+"\s*:/);
                if (nextKeyMatch && nextKeyMatch.index !== undefined) {
                  // Walk back from nextKeyMatch.index to find the closing quote + comma
                  const candidateEnd = nextKeyMatch.index;
                  // The article value ends just before the comma that precedes the next key
                  const commaIdx = afterValue.lastIndexOf(',', candidateEnd);
                  const endIdx = commaIdx !== -1 ? commaIdx : candidateEnd;
                  let articleValue = afterValue.slice(0, endIdx);
                  // Strip trailing quote if present
                  if (articleValue.endsWith('"')) articleValue = articleValue.slice(0, -1);
                  // Decode escape sequences
                  articleValue = articleValue
                    .replace(/\\n/g, "\n")
                    .replace(/\\t/g, "\t")
                    .replace(/\\\\/g, "\\")
                    .replace(/\\"/g, '"');
                  if (articleValue.length > 200) return articleValue;
                } else {
                  // No next key — article is the last field; grab until closing }
                  let articleValue = afterValue;
                  // Strip trailing "} or "\n}
                  articleValue = articleValue.replace(/"?\s*\}\s*$/, "");
                  if (articleValue.endsWith('"')) articleValue = articleValue.slice(0, -1);
                  articleValue = articleValue
                    .replace(/\\n/g, "\n")
                    .replace(/\\t/g, "\t")
                    .replace(/\\\\/g, "\\")
                    .replace(/\\"/g, '"');
                  if (articleValue.length > 200) return articleValue;
                }
              }
            }

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
            // Last resort: if extraction failed but body is JSON, make a second LLM call
            // asking it to output just the article body as plain Markdown
            console.warn("[Blog] JSON extraction failed — making a recovery LLM call for plain Markdown output.");
            try {
              const recoveryResponse = await safeLLM({
                messages: [
                  { role: "system", content: "You are a content formatter. Extract and output ONLY the article body text from the JSON below. Output clean Markdown only — no JSON, no code fences, no explanation. Start with the first paragraph of the article." },
                  { role: "user", content: articleBody.substring(0, 8000) },
                ],
              });
              const recoveryText = (String(recoveryResponse.choices?.[0]?.message?.content ?? "")).trim();
              if (recoveryText && recoveryText.length > 500 && !/^\s*\{/.test(recoveryText)) {
                console.log("[Blog] Recovery call succeeded, length:", recoveryText.length);
                articleBody = recoveryText;
              }
            } catch (recoveryErr) {
              console.error("[Blog] Recovery call also failed:", recoveryErr);
            }
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

        // ── INTERNAL URL SCRUBBER ──────────────────────────────────────────────────────────────────────────
        // Strip any hallucinated theurbanmonk.com URLs not in the verified list.
        try {
          const db2 = await getDb();
          if (db2) {
            const { verifiedLinks: vlTable } = await import("../drizzle/schema");
            const { eq: eqOp2 } = await import("drizzle-orm");
            const activeLinks = await db2.select({ url: vlTable.url }).from(vlTable).where(eqOp2(vlTable.active, true));
            const { wpPostIndex: wpiTable } = await import("../drizzle/schema");
            const wpPosts = await db2.select({ url: wpiTable.url }).from(wpiTable).limit(500);
            const allowedUrls = [
              ...activeLinks.map((l: any) => l.url as string),
              ...wpPosts.map((p: any) => p.url as string),
            ];
            const scrubResult = scrubHallucinatedUrls(articleBody, allowedUrls);
            articleBody = scrubResult.body;
            if (scrubResult.removed.length > 0) {
              console.warn(`[URLScrubber] Removed ${scrubResult.removed.length} hallucinated URL(s):`, scrubResult.removed);
            }

            // ── Resolve [INTERNAL LINK: topic] placeholders ───────────────────────
            // After scrubbing, any remaining [INTERNAL LINK: topic] placeholders are
            // matched against the full WP post index. Matches get a real link;
            // unmatched placeholders are stripped to plain text so they never reach
            // the published post as raw bracket syntax.
            const allWpPostsForResolution = (await db2
              .select({ title: wpiTable.title, url: wpiTable.url, excerpt: wpiTable.excerpt })
              .from(wpiTable)
              .limit(700)).map((p: any) => ({ title: p.title as string, url: p.url as string, excerpt: (p.excerpt ?? undefined) as string | undefined }));
            const resolveResult = resolvePlaceholderLinks(articleBody, allWpPostsForResolution);
            articleBody = resolveResult.body;
            if (resolveResult.resolved.length > 0) {
              console.log(`[LinkResolver] Resolved ${resolveResult.resolved.length} placeholder(s) to real URLs:`, resolveResult.resolved.map((r) => r.url));
            }
            if (resolveResult.stripped.length > 0) {
              console.log(`[LinkResolver] Stripped ${resolveResult.stripped.length} unresolvable placeholder(s):`, resolveResult.stripped);
            }
          }
        } catch (scrubErr) {
          console.warn("[URLScrubber] Could not run URL scrubber:", scrubErr);
        }

        // ── READABILITY AUTO-REPAIR: Fix consecutive sentence starts ────────────────
        // Runs after URL scrubbing. Scans every paragraph for runs of 3+ consecutive
        // sentences starting with the same word and injects a transition word to break
        // the run. This is a deterministic fix — no LLM call required.
        try {
          const REPAIR_TRANSITIONS = [
            "Furthermore,", "Additionally,", "Moreover,", "In fact,",
            "Notably,", "Meanwhile,", "Consequently,", "That said,",
            "In practice,", "Importantly,", "Ultimately,", "Essentially,",
          ];
          let repairIdx = 0;
          const paragraphs = articleBody.split(/\n{2,}/);
          const repairedParagraphs = paragraphs.map((para) => {
            // Skip headings, code blocks, blockquotes, lists
            const trimmed = para.trim();
            if (trimmed.startsWith("#") || trimmed.startsWith(">") || trimmed.startsWith("-") || trimmed.startsWith("|") || trimmed.startsWith("```")) return para;
            // Split paragraph into sentences
            const sentenceRegex = /(?<=[.!?])\s+(?=[A-Z"])/g;
            const sentences = para.split(sentenceRegex);
            if (sentences.length < 3) return para;
            // Find and fix runs of 3+ consecutive same-start sentences
            let i = 0;
            while (i < sentences.length) {
              const firstWord = sentences[i].match(/^([A-Za-z]+)/)?.[1]?.toLowerCase() ?? "";
              if (!firstWord) { i++; continue; }
              let runEnd = i + 1;
              while (runEnd < sentences.length && (sentences[runEnd].match(/^([A-Za-z]+)/)?.[1]?.toLowerCase() ?? "") === firstWord) {
                runEnd++;
              }
              const runLength = runEnd - i;
              if (runLength >= 3) {
                // Fix the third sentence in the run by prepending a transition word
                const fixIdx = i + 2;
                const transition = REPAIR_TRANSITIONS[repairIdx % REPAIR_TRANSITIONS.length];
                repairIdx++;
                // Only prepend if the sentence doesn't already start with a transition
                const alreadyHasTransition = /^(However|Therefore|Furthermore|Additionally|Moreover|Meanwhile|Consequently|That said|In fact|Notably|Importantly|Ultimately|Essentially|In practice|First|Second|Third|Finally|In addition|For example|In contrast|Because|Although|Since|While|After|Before|Despite)/i.test(sentences[fixIdx]);
                if (!alreadyHasTransition) {
                  // Lowercase the first word of the original sentence
                  sentences[fixIdx] = transition + " " + sentences[fixIdx].charAt(0).toLowerCase() + sentences[fixIdx].slice(1);
                  console.log(`[ReadabilityRepair] Fixed run of ${runLength} '${firstWord}' starts at sentence ${fixIdx}`);
                }
                i = fixIdx + 1; // skip past the fixed run
              } else {
                i++;
              }
            }
            return sentences.join(" ");
          });
          articleBody = repairedParagraphs.join("\n\n");
        } catch (repairErr) {
          console.warn("[ReadabilityRepair] Auto-repair failed (non-fatal):", repairErr);
        }
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
                  title: { type: "string", description: "H1 headline, HARD MAX 48 chars including spaces, must contain primary keyword — count every character" },
                  slug: { type: "string", description: "URL-friendly slug, max 60 chars" },
                  metaDescription: { type: "string", description: "Meta description: STRICT 130-148 chars total (count every character including spaces). RULE 1: Start with the focus keyword as the very first words. RULE 2: Stay between 130-148 chars — shorter is better than longer. RULE 3: Never end with ellipsis. RULE 4: Write a complete compelling sentence that includes the focus keyword naturally in the first 20 chars." },
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

         // ── Step 3: Generate CTA visual banner ──────────────────────────────────
        // Generate a branded clickable banner image that links to the CTA URL.
        // The image is embedded in the article body as an HTML anchor wrapping an img tag.
        let ctaBannerUrl: string | undefined;
        let articleWithCtaBanner = blogData.article;
        try {
          const ctaBannerPromptResponse = await safeLLM({
            messages: [
              {
                role: "system",
                content: `You are a graphic designer for The Urban Monk brand. Write a concise image generation prompt (max 80 words) for a wide-format (16:9) CTA infographic banner. The banner must look like a polished marketing graphic — NOT a photo. It should include: a bold headline area at the top in warm cream/ivory text, a central visual metaphor (e.g. glowing lantern, lotus, ancient compass, DNA helix merging with nature), a prominent CTA button shape in deep amber/gold at the bottom with space for text, and a rich dark background (deep forest green, midnight navy, or warm charcoal). Brand aesthetic: premium wellness, ancient wisdom meets modern science, clean typography, no human faces. Return ONLY the prompt.`,
              },
              {
                role: "user",
                content: `CTA label: ${blogCtaLabel}\nCTA headline: ${blogCtaText.split(".")[0]}\nArticle topic: ${cleanIdea}`,
              },
            ],
          });
          const rawBannerPrompt = ctaBannerPromptResponse.choices?.[0]?.message?.content;
          const bannerImagePrompt = typeof rawBannerPrompt === "string" ? rawBannerPrompt.trim() : `Premium wellness infographic banner: bold cream headline area at top, glowing golden lotus central motif, deep forest green background, amber CTA button shape at bottom, ancient wisdom meets modern science aesthetic, no faces, clean graphic design style`;
          const { url: rawBannerUrlMaybe } = await generateImage({ prompt: bannerImagePrompt });
          const rawBannerUrl: string = rawBannerUrlMaybe ?? "";
          // Composite headline + button label text onto the generated image
          const ctaHeadline = blogCtaText.split(".")[0].trim().replace(/[*_#]/g, "");
          const ctaBtnLabel = blogCtaLabel.replace(/[()]/g, "").trim().substring(0, 50);
          try {
            const composited = await compositeCtaBanner({
              imageUrl: rawBannerUrl,
              headline: ctaHeadline || "Transform Your Health Today",
              ctaButtonLabel: ctaBtnLabel || "Learn More",
              keyPrefix: "cta-banners/blog",
            });
            ctaBannerUrl = composited.url;
          } catch (compErr) {
            console.warn("[Blog] Banner composite failed, using raw image:", compErr);
            ctaBannerUrl = rawBannerUrl;
          }
          // Inject the CTA banner as a clickable HTML block at the end of the article body,
          // just before the FAQ section (or at the very end if no FAQ).
          const ctaBannerBlock = `\n\n<div class="um-cta-banner" style="margin:2.5rem 0;text-align:center;">\n  <a href="${blogCtaUrl}" target="_blank" rel="noopener noreferrer" style="display:inline-block;text-decoration:none;">\n    <img src="${ctaBannerUrl}" alt="${blogCtaLabel}" style="width:100%;max-width:800px;border-radius:12px;box-shadow:0 4px 24px rgba(0,0,0,0.15);" />\n    <div style="margin-top:0.75rem;font-size:1rem;font-weight:600;color:#7c5c2e;letter-spacing:0.02em;">${blogCtaText.slice(0, 120)}${blogCtaText.length > 120 ? '\u2026' : ''}</div>\n  </a>\n</div>`;
          // Insert before FAQ section if present, otherwise append
          const faqMatch = articleWithCtaBanner.match(/\n##\s*(Frequently Asked Questions|FAQ)/i);
          if (faqMatch && faqMatch.index !== undefined) {
            articleWithCtaBanner = articleWithCtaBanner.slice(0, faqMatch.index) + ctaBannerBlock + articleWithCtaBanner.slice(faqMatch.index);
          } else {
            articleWithCtaBanner = articleWithCtaBanner + ctaBannerBlock;
          }
        } catch (bannerErr) {
          console.warn("[Blog] CTA banner generation failed (non-fatal):", bannerErr);
        }

        // ── PASS 2b: Keyphrase Density Feedback Loop ────────────────────────────
        // After metadata extraction, count how many times the focus keyphrase appears
        // in the article body. If fewer than 8 occurrences (amber/red), run a targeted
        // second LLM pass that adds natural keyphrase occurrences without changing the
        // article structure, tone, or headings.
        let densityBoosted = false;
        const focusKwForDensity = blogData.focusKeyword?.toLowerCase() ?? "";
        if (focusKwForDensity) {
          const escaped = focusKwForDensity.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
          const occurrences = (blogData.article.toLowerCase().match(new RegExp(escaped, "g")) ?? []).length;
          if (occurrences < 8) {
            console.log(`[Blog] Keyphrase density: ${occurrences} occurrences (target: 8+) — running density boost pass`);
            try {
              const densityBoostResponse = await safeLLM({
                messages: [
                  {
                    role: "system",
                    content: `You are an SEO editor for Dr. Pedram Shojai (The Urban Monk). Your ONLY task is to increase the natural occurrence of the focus keyphrase in the article body to reach at least 8 occurrences. Rules:
- Do NOT change any headings (H1, H2, H3)
- Do NOT change the introduction paragraph
- Do NOT add new sections or remove content
- Do NOT change the tone, voice, or meaning
- Add the keyphrase naturally into existing sentences — vary the phrasing slightly (e.g. "${blogData.focusKeyword}", "your ${blogData.focusKeyword}", "understanding ${blogData.focusKeyword}")
- Return the COMPLETE article with your additions — do not truncate
- Return ONLY the article body, no preamble or explanation`,
                  },
                  {
                    role: "user",
                    content: `Focus keyphrase: "${blogData.focusKeyword}" (currently appears ${occurrences} times, need at least 8)\n\nARTICLE:\n${blogData.article}`,
                  },
                ],
              });
              const boostedBody = String(densityBoostResponse.choices?.[0]?.message?.content ?? "").trim();
              if (boostedBody.length > blogData.article.length * 0.7) {
                // Sanity check: boosted body must be at least 70% of original length
                const boostedOccurrences = (boostedBody.toLowerCase().match(new RegExp(escaped, "g")) ?? []).length;
                if (boostedOccurrences > occurrences) {
                  blogData.article = boostedBody;
                  densityBoosted = true;
                  console.log(`[Blog] Density boost: ${occurrences} → ${boostedOccurrences} occurrences`);
                }
              }
            } catch (densityErr) {
              console.warn("[Blog] Density boost pass failed (non-fatal):", densityErr);
            }
          }
        }

        // Estimate read time (avg 200 words/min)
        // NOTE: Use clean articleBody (without CTA HTML) for word count and storage.
        // The CTA HTML block is stored separately as ctaBannerHtml and injected at
        // WordPress publish time — it should NOT appear in the editable textarea.
        const wordCount = blogData.article.split(/\s+/).length;
        const readTime = Math.max(1, Math.round(wordCount / 200));

        // Extract the CTA HTML block that was injected into articleWithCtaBanner
        // so we can pass it to the frontend separately (for WP publish injection only).
        // IMPORTANT: Do NOT use String.replace(articleBody, "") — the article body contains
        // regex special characters (parentheses, dots, asterisks) that corrupt the match.
        // Instead, extract the CTA block directly from ctaBannerUrl/ctaBannerBlock.
        const ctaBannerHtmlBlock: string | undefined = ctaBannerUrl
          ? `<div class="um-cta-banner" style="margin:2.5rem 0;text-align:center;"><a href="${blogCtaUrl}" target="_blank" rel="noopener noreferrer" style="display:inline-block;text-decoration:none;"><img src="${ctaBannerUrl}" alt="${blogCtaLabel}" style="width:100%;max-width:800px;border-radius:12px;box-shadow:0 4px 24px rgba(0,0,0,0.15);" /><div style="margin-top:0.75rem;font-size:1rem;font-weight:600;color:#7c5c2e;letter-spacing:0.02em;">${blogCtaText.slice(0, 120)}${blogCtaText.length > 120 ? '\u2026' : ''}</div></a></div>`
          : undefined;

        return {
          ...blogData,
          article: blogData.article,  // Clean Markdown only — no embedded HTML
          ctaBannerHtml: ctaBannerHtmlBlock,  // CTA HTML block for WP publish injection
          heroImageUrl,
          ctaBannerUrl,
          ctaUrl: blogCtaUrl,
          wordCount,
          readTime,
          semanticKeywords: blogData.semanticKeywords ?? [],
          hookFamily: blogData.hookFamily ?? "",
          emotionalDriver: blogData.emotionalDriver ?? "",
          faqSection: blogData.faqSection ?? "",
          waterfallMap: blogData.waterfallMap ?? "",
          ctaLabel: blogCtaLabel,
          densityBoosted,  // true if a second LLM pass was run to boost keyphrase density
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

        // Load CTA with UTM params
        let ctaInjection = "";
        try {
          const { getCtaForTopic, appendUtmToCtaUrl, ctaLabelToCampaign, PLATFORM_UTM } = await import("./ctaRouter");
          const cta = await getCtaForTopic(cleanIdea);
          const utmUrl = appendUtmToCtaUrl(cta.url, input.platform, ctaLabelToCampaign(cta.label), PLATFORM_UTM[input.platform]?.content);
          const urlForPrompt = utmUrl || cta.url || "lightson.theurbanmonk.com";
          ctaInjection = `\n\n[CTA BLOCK — ${cta.label}]\n${cta.ctaText}\n[END CTA BLOCK]\nCRITICAL URL RULE: Use EXACTLY this URL: ${urlForPrompt} — do NOT substitute any other URL.`;
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

        const systemPrompt = `You are a professional teleprompter scriptwriter for Dr. Pedram Shojai (The Urban Monk), OMD — a Daoist monk, functional medicine doctor, and bestselling author. You write in his exact voice: warm, authoritative, grounded in Eastern wisdom and Western science, never preachy, always practical.

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
- CTA must mention the Lights On Course () at lightson.theurbanmonk.com or a relevant free resource
- Length: 8-12 minutes of spoken content (approximately 1,200-1,800 words)
- Voice: conversational, like Pedram is talking directly to one person
- Weave in his credentials naturally (OMD, Daoist training, functional medicine) without bragging
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
              scriptPressContext = `\n\nAUTHOR CREDENTIALS (reference naturally when establishing authority):\nDr. Pedram Shojai has been featured in: ${outlets}. New York Times bestselling author, Doctor of Oriental Medicine, Daoist monk.`;
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
          const { getCtaForTopic, appendUtmToCtaUrl, ctaLabelToCampaign, PLATFORM_UTM } = await import("./ctaRouter");
          const cta = await getCtaForTopic(input.title);
          const utmUrl = appendUtmToCtaUrl(cta.url, input.platform, ctaLabelToCampaign(cta.label), PLATFORM_UTM[input.platform]?.content);
          const urlForPrompt = utmUrl || cta.url || "lightson.theurbanmonk.com";
          scriptCtaInjection = `\n\n[CTA BLOCK — ${cta.label}]\n${cta.ctaText}\n[END CTA BLOCK]\nIMPORTANT: Include this CTA naturally at the end of the script, in the closing call-to-action section. Use EXACTLY this URL: ${urlForPrompt}`;
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
- If including a URL, use ONLY lightson.theurbanmonk.com — never substitute or invent a different URL
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
          const { getCtaForTopic, appendUtmToCtaUrl, ctaLabelToCampaign, PLATFORM_UTM } = await import("./ctaRouter");
          const cta = await getCtaForTopic(input.title);
          const utmUrl = appendUtmToCtaUrl(cta.url, input.platform, ctaLabelToCampaign(cta.label), PLATFORM_UTM[input.platform]?.content);
          const urlForPrompt = utmUrl || cta.url || "lightson.theurbanmonk.com";
          postCtaInjection = `\n\n[CTA BLOCK — ${cta.label}]\n${cta.ctaText}\n[END CTA BLOCK]\nIMPORTANT: Include this CTA naturally at the end of the post. Use EXACTLY this URL: ${urlForPrompt}`;
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
          post: cleanSocialCopy(postMatch?.[1]?.trim() ?? rawContent),
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
        const reframeCtaText = "Ready to reclaim your energy? Join the Lights On course — lightson.theurbanmonk.com";

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
          videoUrl: z.string().optional(), // S3 URL of finished video — used for video posts
          scheduledAt: z.number().optional(),
          platform: z.string().optional(), // used for platform-specific limits (e.g. X = 280 chars)
          metaPostType: z.enum(["post", "story", "reel"]).optional(), // required for facebook/instagram
          channelServiceMap: z.record(z.string(), z.string()).optional(), // channelId → service
          ctaUrl: z.string().optional(), // UTM-tracked CTA URL — sent as Instagram first comment
        })
      )
      .mutation(async ({ input }) => {
        // For Instagram posts: resolve the UTM-tracked CTA URL to send as first comment.
        // If the caller already provides a ctaUrl, use it; otherwise auto-resolve from CTA blocks.
        let resolvedCtaUrl = input.ctaUrl;
        if (!resolvedCtaUrl && input.platform === "meta") {
          try {
            const { getCtaForTopic, appendUtmToCtaUrl, ctaLabelToCampaign, PLATFORM_UTM } = await import("./ctaRouter");
            const cta = await getCtaForTopic(input.text.slice(0, 200));
            if (cta.url) {
              resolvedCtaUrl = appendUtmToCtaUrl(cta.url, "instagram", ctaLabelToCampaign(cta.label), PLATFORM_UTM["instagram"]?.content) || cta.url;
            }
          } catch {
            // Non-fatal: proceed without first comment if CTA lookup fails
          }
        }

        const result = await pushToBuffer({
          text: input.text,
          profileIds: input.profileIds,
          imageUrl: input.imageUrl,
          videoUrl: input.videoUrl,
          scheduledAt: input.scheduledAt,
          platform: input.platform,
          metaPostType: input.metaPostType,
          channelServiceMap: input.channelServiceMap,
          ctaUrl: resolvedCtaUrl,
        });

        // If successful, update the content item status to 'scheduled'
        // Also store the Buffer post ID and the dueAt time so the heartbeat
        // sync job can auto-advance the card to 'published' once the post goes live.
        if (result.success) {
          const dueAtMs = result.dueAt ? new Date(result.dueAt).getTime() : undefined;
          await updateContentItem(input.contentItemId, {
            status: "scheduled",
            notes: `Buffer ID: ${result.bufferId ?? "queued"}`,
            bufferPostId: result.bufferId ?? undefined,
            // Store the Buffer-scheduled time so the heartbeat can auto-advance to published.
            // If Buffer returned a dueAt, use it; otherwise fall back to the caller's scheduledAt
            // or a 30-minute window from now (Buffer's default queue slot estimate).
            scheduledAt: dueAtMs ?? input.scheduledAt ?? (Date.now() + 30 * 60 * 1000),
          });
        }

        return result;
      }),

    // Update the pushedChannels field for a content item after a successful Buffer push
    // channels: array of { id, name, service } objects
    updatePushedChannels: protectedProcedure
      .input(
        z.object({
          contentItemId: z.number(),
          channels: z.array(
            z.object({
              id: z.string(),
              name: z.string(),
              service: z.string(),
            })
          ),
        })
      )
      .mutation(async ({ input }) => {
        await updateContentItem(input.contentItemId, {
          pushedChannels: JSON.stringify(input.channels),
        });
        return { ok: true };
      }),

    // Get the saved default channel IDs for all platforms
    getChannelDefaults: protectedProcedure.query(async () => {
      const { getDb } = await import("./db");
      const { bufferChannelDefaults } = await import("../drizzle/schema");
      const db = await getDb();
      if (!db) return {} as Record<string, string[]>;
      const rows = await db.select().from(bufferChannelDefaults);
      // Return as a map: platform -> profileIds[]
      const result: Record<string, string[]> = {};
      for (const row of rows) {
        try {
          result[row.platform] = row.defaultProfileIds ? JSON.parse(row.defaultProfileIds) : [];
        } catch {
          result[row.platform] = [];
        }
      }
      return result;
    }),

    // Save default channel IDs for a platform (upsert)
    setChannelDefaults: protectedProcedure
      .input(
        z.object({
          platform: z.string().min(1),
          profileIds: z.array(z.string()),
        })
      )
      .mutation(async ({ input }) => {
        const { getDb } = await import("./db");
        const { bufferChannelDefaults } = await import("../drizzle/schema");
        const db = await getDb();
        if (!db) throw new Error("Database unavailable");
        const json = JSON.stringify(input.profileIds);
        // Upsert: insert or update on duplicate platform key
        await db
          .insert(bufferChannelDefaults)
          .values({ platform: input.platform, defaultProfileIds: json })
          .onDuplicateKeyUpdate({ set: { defaultProfileIds: json } });
        return { ok: true };
      }),
  }),

  // ─── Research Intelligence (Gumshoe AI) ─────────────────────────────────────────────────
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
              pressCtx = `\n\nAUTHOR CREDENTIALS: Dr. Pedram Shojai is a New York Times bestselling author, Doctor of Oriental Medicine, and Daoist monk. Featured in: ${outlets}.`;
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

        const systemPrompt = `You are a professional teleprompter scriptwriter for Dr. Pedram Shojai (The Urban Monk), OMD — a Daoist monk, functional medicine doctor, and bestselling author. You write in his exact voice: warm, authoritative, grounded in Eastern wisdom and Western science, never preachy, always practical.

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
- CTA must mention the Lights On Course () at lightson.theurbanmonk.com or a relevant free resource
- Length: 8-12 minutes of spoken content (approximately 1,200-1,800 words)
- Voice: conversational, like Pedram is talking directly to one person
- Weave in his credentials naturally (OMD, Daoist training, functional medicine) without bragging
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
              scriptPressContext = `\n\nAUTHOR CREDENTIALS (reference naturally when establishing authority):\nDr. Pedram Shojai has been featured in: ${outlets}. New York Times bestselling author, Doctor of Oriental Medicine, Daoist monk.`;
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
          const { getCtaForTopic, appendUtmToCtaUrl, ctaLabelToCampaign, PLATFORM_UTM } = await import("./ctaRouter");
          const cta = await getCtaForTopic(input.title);
          const utmUrl = appendUtmToCtaUrl(cta.url, input.platform, ctaLabelToCampaign(cta.label), PLATFORM_UTM[input.platform]?.content);
          const urlForPrompt = utmUrl || cta.url || "lightson.theurbanmonk.com";
          scriptCtaInjection = `\n\n[CTA BLOCK — ${cta.label}]\n${cta.ctaText}\n[END CTA BLOCK]\nIMPORTANT: Include this CTA naturally at the end of the script, in the closing call-to-action section. Use EXACTLY this URL: ${urlForPrompt}`;
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
    // AI: generate a YouTube teleprompter script adapted FROM an existing blog post.
    // Unlike generateTeleprompterScript (which works from a title/topic), this procedure
    // receives the full article body and uses it as the authoritative source material so
    // the video script is tightly aligned with the published post.
    generateYouTubeScriptFromBlog: protectedProcedure
      .input(
        z.object({
          title: z.string(),
          focusKeyword: z.string().optional(),
          articleBody: z.string(),
          publishUrl: z.string().optional(),
        })
      )
      .mutation(async ({ input }) => {
        const systemPrompt = `You are a professional teleprompter scriptwriter for Dr. Pedram Shojai (The Urban Monk), OMD — a Daoist monk, functional medicine doctor, and bestselling author. You write in his exact voice: warm, authoritative, grounded in Eastern wisdom and Western science, never preachy, always practical.

Your task: Adapt the blog post below into a FULL teleprompter-ready YouTube video script. The blog post is the authoritative source — use its structure, insights, and examples. Do NOT invent new claims; stay true to the article's content while making it feel natural and conversational for video.

Blog Post Title: "${input.title}"
${input.focusKeyword ? `Focus Keyword / Topic: "${input.focusKeyword}"` : ""}

SCRIPT REQUIREMENTS:
- Open with a compelling hook (first 15 seconds are critical for retention) — adapt the blog's opening hook for video
- Use teleprompter formatting: short paragraphs, natural speech rhythm, no jargon
- Include [PAUSE] markers for emphasis at natural breath points
- Include [B-ROLL: description] cues for the editor at key visual moments
- Structure mirrors the blog: Hook → Problem → Pedram's unique insight → Evidence/story → Practical steps → CTA
- CTA must mention the Urban Monk Academy or a relevant resource${input.publishUrl ? ` — reference the full blog post at: ${input.publishUrl}` : ""}
- Length: 8-12 minutes of spoken content (approximately 1,200-1,800 words)
- Voice: conversational, like Pedram is talking directly to one person
- Weave in his credentials naturally (OMD, Daoist training, functional medicine) without bragging
- Format with clear section headers in [BRACKETS] for the teleprompter operator

GREETING RULE: If the script opens with a greeting to the audience, ALWAYS say "Hello Urban Monks" — NEVER "Hello Urban Monk Nation" or any other variation.

IMPORTANT: This is a VIDEO script, not a blog post. Convert written prose into spoken language. Break up long sentences. Add natural transitions ("Now, here's the thing...", "Let me give you an example...", "So what does this mean for you?").`;

        const articleExcerpt = input.articleBody.slice(0, 6000);

        let ctaInjection = "";
        try {
          const { getCtaForTopic } = await import("./ctaRouter");
          const cta = await getCtaForTopic(input.focusKeyword ?? input.title);
          if (cta?.ctaText && cta?.url) {
            ctaInjection = `\n\n[CTA BLOCK \u2014 ${cta.label}]\n${cta.ctaText}\n[END CTA BLOCK]\nIMPORTANT: Include this CTA naturally at the end of the script. Use EXACTLY this URL: ${cta.url}`;
          }
        } catch {
          // CTA not available — proceed without it
        }

        const response = await safeLLM({
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: `Adapt this blog post into a YouTube teleprompter script:\n\n---\n${articleExcerpt}\n---${ctaInjection}` },
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
- If including a URL, use ONLY lightson.theurbanmonk.com — never substitute or invent a different URL
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
          const { getCtaForTopic, appendUtmToCtaUrl, ctaLabelToCampaign, PLATFORM_UTM } = await import("./ctaRouter");
          const cta = await getCtaForTopic(input.title);
          const utmUrl = appendUtmToCtaUrl(cta.url, input.platform, ctaLabelToCampaign(cta.label), PLATFORM_UTM[input.platform]?.content);
          const urlForPrompt = utmUrl || cta.url || "lightson.theurbanmonk.com";
          postCtaInjection = `\n\n[CTA BLOCK — ${cta.label}]\n${cta.ctaText}\n[END CTA BLOCK]\nIMPORTANT: Include this CTA naturally at the end of the post. Use EXACTLY this URL: ${urlForPrompt}`;
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
          post: cleanSocialCopy(postMatch?.[1]?.trim() ?? rawContent),
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
          ctaBannerHtml: z.string().optional(),        // CTA HTML block to inject before FAQ section
          wpCategoryOverride: z.number().optional(),    // Manual WP category ID override (subcategory)
        })
      )
      .mutation(async ({ input, ctx }) => {
        const wpBaseUrl = (process.env.WORDPRESS_URL ?? "").replace(/\/$/, "");

        // Step 0a: Sanitize and guarantee a clean permalink slug
        // WordPress falls back to ?p=<id> URLs when the slug is empty, contains
        // special characters, or conflicts with an existing post.
        const sanitizeSlug = (raw: string): string => {
          return raw
            .toLowerCase()
            .replace(/[^a-z0-9\s-]/g, "")   // strip non-alphanumeric (keep spaces + hyphens)
            .replace(/\s+/g, "-")            // spaces → hyphens
            .replace(/-{2,}/g, "-")          // collapse multiple hyphens
            .replace(/^-+|-+$/g, "")         // trim leading/trailing hyphens
            .slice(0, 60);                   // WP recommends ≤60 chars for slugs
        };
        const baseSlug = sanitizeSlug(input.slug || input.title);
        // Append a short timestamp suffix to guarantee uniqueness and avoid 301 redirect
        // collisions with existing posts that share the same slug.
        const slugSuffix = Date.now().toString(36).slice(-4); // e.g. "k7xq"
        const safeSlug = `${baseSlug}-${slugSuffix}`;
        // Override input.slug with the sanitized, unique version for all downstream use
        const publishInput = { ...input, slug: safeSlug };

        // Step 0: GA4 campaign slug validation — warn if campaign slug is not in the canonical list
        let campaignValidationWarning: string | null = null;
        try {
          const { validateCampaignSlug, ctaLabelToCampaign } = await import("./ctaRouter");
          // Extract campaign slug from the body (look for utm_campaign= in any URL)
          const campaignMatch = input.body.match(/utm_campaign=([^&"'\s]+)/);
          if (campaignMatch) {
            const slug = decodeURIComponent(campaignMatch[1]);
            campaignValidationWarning = validateCampaignSlug(slug);
            if (campaignValidationWarning) {
              console.warn(`[WP Publish] GA4 campaign validation: ${campaignValidationWarning}`);
            }
          }
        } catch (err) {
          console.warn("[WP Publish] Campaign validation check failed (non-fatal):", err);
        }

        // Step 1: Upload hero image to WordPress media library (if provided)
        let featuredMediaId: number | undefined;
        let wpImageUrl: string | undefined;
        if (publishInput.heroImageUrl) {
          try {
            console.log("[WP] Uploading hero image:", publishInput.heroImageUrl);
            // Derive file extension from URL or default to jpg
            const ext = publishInput.heroImageUrl.toLowerCase().endsWith(".png") ? "png" : "jpg";
            const filename = `${publishInput.slug}-hero.${ext}`;
            const media = await uploadMediaFromUrl(
              publishInput.heroImageUrl,
              filename,
              `${publishInput.title} — The Urban Monk` // SEO-optimized alt text
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
        let wpStatus = publishInput.status;
        let wpDate: string | undefined;
        if (publishInput.scheduledAt && publishInput.scheduledAt > Date.now()) {
          wpStatus = "future";
          wpDate = new Date(publishInput.scheduledAt).toISOString();
        }

        // Step 2: Convert Markdown → WordPress HTML
        // - Extracts trailing #hashtags and converts them to <strong> bold text
        // - Converts all Markdown formatting (##, **, >, etc.) to HTML
        // Strip any previously-embedded CTA HTML blocks from the body before conversion.
        // These were injected in older versions of the pipeline and should not appear
        // as raw HTML in the Markdown source.
        const cleanedBody = publishInput.body
          .replace(/<div[^>]*class=["']um-cta-banner["'][\s\S]*?<\/div>\s*/gi, "")
          .trim();
        let wpHtmlBody = markdownToWpHtml(cleanedBody);

        // Step 2b: Inject CTA banner HTML block (if provided)
        // The CTA HTML was generated during blog creation but kept separate from the
        // Markdown body so the edit textarea stays clean. We inject it here at publish
        // time — before the FAQ section if present, otherwise at the very end.
        if (publishInput.ctaBannerHtml) {
          const faqHtmlMatch = wpHtmlBody.match(/<h2[^>]*>\s*(?:Frequently Asked Questions|FAQ)\s*<\/h2>/i);
          if (faqHtmlMatch && faqHtmlMatch.index !== undefined) {
            wpHtmlBody = wpHtmlBody.slice(0, faqHtmlMatch.index) + publishInput.ctaBannerHtml + "\n\n" + wpHtmlBody.slice(faqHtmlMatch.index);
          } else {
            wpHtmlBody = wpHtmlBody + "\n\n" + publishInput.ctaBannerHtml;
          }
        }

        // Step 2c: H2/H3 keyphrase auto-fix (Yoast subheading check)
        // Yoast requires the focus keyphrase to appear as an EXACT PHRASE in at least one
        // H2 or H3 subheading. We check both levels and inject if missing.
        //
        // CRITICAL: This fix operates on wpHtmlBody (HTML), NOT on cleanedBody (Markdown).
        // Operating on Markdown and re-converting would discard the CTA banner HTML that
        // was injected in Step 2b. We patch the HTML directly instead.
        //
        // Rules:
        // 1. Check <h2> AND <h3> tags in the HTML (Yoast accepts either)
        // 2. Use word-boundary regex — NOT includes() — to avoid false positives from partial matches
        // 3. If missing, rewrite the BEST available <h2> to START with the keyphrase
        //    ("<h2>Keyphrase: Original Text</h2>") — placing it first guarantees Yoast finds it
        // 4. Handle articles with only 1 H2 by falling back to the first H2
        // 5. If the heading would exceed 80 chars, use just the keyphrase as the heading text
        if (publishInput.focusKeyword) {
          const kw = publishInput.focusKeyword.toLowerCase();
          // Escape special regex chars in the keyphrase
          const kwEscaped = kw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
          // Match the keyphrase as a contiguous exact phrase (word boundaries on both sides)
          const kwRegex = new RegExp(`(?:^|[^a-z0-9])${kwEscaped}(?:[^a-z0-9]|$)`, "i");

          // Collect all <h2> and <h3> tags from the HTML.
          // The inner content may contain child tags like <strong> or <em>, so we
          // capture everything between the opening and closing tag (including HTML),
          // then strip tags to get the plain text for keyphrase matching.
          // Use [\ \S] instead of . with s-flag to match across newlines (avoids ES2018 requirement)
          const htmlHeadingRegex = /<(h[23])(\s[^>]*)?>((?:[\s\S])*?)<\/h[23]>/gi;
          const htmlHeadings = Array.from(wpHtmlBody.matchAll(htmlHeadingRegex));
          const htmlH2s = htmlHeadings.filter((m) => m[1].toLowerCase() === "h2");

          // Strip HTML tags to get plain text for keyphrase matching
          const stripTags = (s: string) => s.replace(/<[^>]+>/g, "").trim();

          // Check if the keyphrase already appears in any <h2> or <h3> plain text
          const keyphraseInSubheading = htmlHeadings.some((m) => kwRegex.test(stripTags(m[3])));

          if (!keyphraseInSubheading) {
            // Choose the target <h2> to rewrite:
            // Prefer the 3rd H2 (index 2) → 2nd H2 (index 1) → 1st H2 (index 0)
            // This avoids rewriting the intro H2 which often contains the article title.
            const targetIndex = htmlH2s.length >= 3 ? 2 : htmlH2s.length >= 2 ? 1 : 0;
            const targetMatch = htmlH2s[targetIndex] ?? htmlHeadings[0]; // ultimate fallback

            if (targetMatch) {
              const originalTag = targetMatch[0]; // e.g. "<h2><strong>Key Takeaways</strong></h2>"
              const tagName = targetMatch[1]; // "h2" or "h3"
              const tagAttrs = targetMatch[2] ?? ""; // any class/id attributes
              const headingText = stripTags(targetMatch[3]); // plain text (no HTML tags)
              const kwCapitalised = publishInput.focusKeyword.charAt(0).toUpperCase() + publishInput.focusKeyword.slice(1);

              // Strategy: start the heading text with the keyphrase so Yoast cannot miss it.
              // Format: "<h2>Keyphrase: Original Heading Text</h2>" (plain text, no child tags)
              // If that exceeds 80 chars, use just the keyphrase as the heading text.
              const candidateText = `${kwCapitalised}: ${headingText}`;
              const finalText = candidateText.length <= 80 ? candidateText : kwCapitalised;
              const finalTag = `<${tagName}${tagAttrs}>${finalText}</${tagName}>`;

              // Replace only the first occurrence of this exact tag in the HTML
              const escapedOriginal = originalTag.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
              wpHtmlBody = wpHtmlBody.replace(new RegExp(escapedOriginal), finalTag);
              console.log(`[SEO H2 Fix] Injected keyphrase "${publishInput.focusKeyword}" into <${tagName}>: "${headingText}" → "${finalText}"`);
            }
          }
        }

        // Step 3: Build Article + FAQ JSON-LD schema blocks (GhostLink OS B15 AEO)
        const { articleSchema, faqSchema } = buildBlogSchemas({
          title: publishInput.title,
          slug: publishInput.slug,
          metaDescription: publishInput.metaDescription ?? "",
          heroImageUrl: wpImageUrl ?? publishInput.heroImageUrl,
          faqSection: publishInput.faqSection,
          baseUrl: wpBaseUrl,
          datePublished: wpDate ?? new Date().toISOString(),
        });

        // Step 4: Build SEO title for Yoast
        // Yoast requires the EXACT focus keyphrase at the START of the SEO title for a green score.
        // Format: "Focus Keyphrase: Article Title | The Urban Monk" (keyphrase leads)
        // If an explicit override was set in SeoKeywordEditor, use it as-is.
        // Otherwise, auto-generate with keyphrase-first format.
        let seoTitle: string;
        if (publishInput.yoastSeoTitle) {
          seoTitle = publishInput.yoastSeoTitle;
        } else if (publishInput.focusKeyword) {
          const kw = publishInput.focusKeyword;
          const titleLower = publishInput.title.toLowerCase();
          const kwLower = kw.toLowerCase();
          // If the title already starts with the keyphrase, don't duplicate it
          if (titleLower.startsWith(kwLower)) {
            seoTitle = `${publishInput.title} | The Urban Monk`;
          } else {
            // Capitalise the keyphrase for the SEO title
            const kwCapitalised = kw.charAt(0).toUpperCase() + kw.slice(1);
            seoTitle = `${kwCapitalised}: ${publishInput.title} | The Urban Monk`;
          }
        } else {
          seoTitle = `${publishInput.title} | The Urban Monk`;
        }

        // Step 4a-ii: Hard-enforce SEO title under 60 chars (Yoast green zone)
        // If the auto-built title exceeds 60 chars, fall back to a shorter format:
        // "Focus Keyphrase | The Urban Monk" (drops the article title entirely)
        if (seoTitle.length > 60 && publishInput.focusKeyword) {
          const kw = publishInput.focusKeyword;
          const kwCapitalised = kw.charAt(0).toUpperCase() + kw.slice(1);
          const shortTitle = `${kwCapitalised} | The Urban Monk`;
          if (shortTitle.length <= 60) {
            seoTitle = shortTitle;
          } else {
            // Last resort: truncate keyphrase to fit
            const maxKwLen = 60 - " | The Urban Monk".length;
            seoTitle = `${kwCapitalised.slice(0, maxKwLen)} | The Urban Monk`;
          }
        } else if (seoTitle.length > 60) {
          // No keyphrase — truncate at last word boundary before 57 chars
          let trimmed = seoTitle.slice(0, 57);
          const lastSpace = trimmed.lastIndexOf(" ");
          if (lastSpace > 20) trimmed = trimmed.slice(0, lastSpace);
          seoTitle = trimmed.trimEnd() + "...";
        }

        // Step 4b: Enforce keyphrase in meta description + hard length limit
        // Yoast requires:
        //   (a) the focus keyphrase to appear verbatim in the meta description
        //   (b) the meta description to be ≤155 chars (green zone: 140-155)
        // We handle BOTH in a single atomic pass so the keyphrase injection never
        // pushes the result back over the length limit.
        let metaDesc = publishInput.yoastMetaDescription ?? publishInput.metaDescription ?? "";

        // Helper: trim to ≤maxLen at a word boundary, no ellipsis.
        // Always finds the last space to avoid cutting mid-word.
        // Falls back to hard slice only if no space exists in the string.
        const trimToWordBoundary = (s: string, maxLen: number): string => {
          if (s.length <= maxLen) return s;
          let t = s.slice(0, maxLen);
          const sp = t.lastIndexOf(" ");
          // Always trim to last word boundary (sp > 0 means a space was found)
          if (sp > 0) t = t.slice(0, sp);
          return t.trimEnd().replace(/[,;:\-\u2013\u2014]$/, "").trimEnd();
        };

        if (publishInput.focusKeyword && metaDesc) {
          const kwLower = publishInput.focusKeyword.toLowerCase();
          const hasKw = metaDesc.toLowerCase().includes(kwLower);

          if (!hasKw) {
            // Keyphrase is missing — we need to inject it.
            // Strategy: prepend "[Keyphrase]: " then trim the TAIL of the description
            // so the total stays ≤152 chars. This guarantees the keyphrase survives.
            const prefix = `${publishInput.focusKeyword}: `;
            const maxBodyLen = 148 - prefix.length; // chars available for the rest (148 = safe buffer under Yoast 156 threshold)
            const trimmedBody = trimToWordBoundary(metaDesc, maxBodyLen);
            metaDesc = (prefix + trimmedBody).trimEnd().replace(/[,;:\-–—]$/, "").trimEnd();
          } else {
            // Keyphrase is already present — just enforce the length limit
            metaDesc = trimToWordBoundary(metaDesc, 148);
          }
        } else {
          // No keyphrase — just enforce the length limit
          metaDesc = trimToWordBoundary(metaDesc, 148);
        }

        // Hard safety net — force-truncate if somehow still over 155 (should never happen)
        if (metaDesc.length > 155) {
          const sp = metaDesc.slice(0, 148).lastIndexOf(' ');
          metaDesc = (sp > 0 ? metaDesc.slice(0, sp) : metaDesc.slice(0, 148)).trimEnd().replace(/[,;:\-\u2013\u2014]$/, '').trimEnd();
          console.warn(`[SEO] Meta description force-truncated to ${metaDesc.length} chars for "${publishInput.title}"`);
        }
        console.log(`[SEO] Final meta description: ${metaDesc.length} chars — "${metaDesc.slice(0, 60)}..."`);
        console.log(`[SEO] Focus keyword: "${publishInput.focusKeyword}" | metaDesc contains kw: ${metaDesc.toLowerCase().includes((publishInput.focusKeyword ?? '').toLowerCase())}`);

        // Step 4c: Keyphrase deduplication check
        // Warn if this focus keyword was already used on a previously published post.
        // Yoast flags "previously used keyphrase" when the same focuskw appears on 2+ posts.
        // We check the wpPostIndex table (synced from WP) for a matching focus keyword.
        let keyphraseAlreadyUsed = false;
        let keyphraseConflictUrl: string | null = null;
        if (publishInput.focusKeyword) {
          try {
            const db3 = await getDb();
            if (db3) {
              // Check content_items table for any published post with the same focusKeyword
              const { contentItems } = await import("../drizzle/schema");
              const { and, eq: eqOp, ne, like } = await import("drizzle-orm");
              const existing = await db3
                .select({ id: contentItems.id, publishUrl: contentItems.publishUrl, focusKeyword: contentItems.focusKeyword })
                .from(contentItems)
                .where(
                  and(
                    eqOp(contentItems.status, "published"),
                    ne(contentItems.id, publishInput.contentItemId),
                    like(contentItems.focusKeyword, publishInput.focusKeyword)
                  )
                )
                .limit(1);
              if (existing.length > 0) {
                keyphraseAlreadyUsed = true;
                keyphraseConflictUrl = existing[0].publishUrl ?? null;
                console.warn(`[SEO] Focus keyphrase "${publishInput.focusKeyword}" was already used on post ${existing[0].id} (${keyphraseConflictUrl}). Yoast will flag this.`);
              }
            }
          } catch (kpErr) {
            // Non-fatal — dedup check failure should not block the publish
            console.warn("[SEO] Keyphrase dedup check failed (non-fatal):", kpErr);
          }
        }

        // Step 4d: Determine WordPress category IDs
        // Strategy: assign the parent "Health and Wellness" (ID 19) PLUS the matching
        // cluster subcategory (if one exists). Never assign the duplicate ID 941.
        // If the user provided an explicit wpCategoryId override, use that as the subcategory.
        const wpCategoryIds = await resolveWpCategories({
          focusKeyword: publishInput.focusKeyword,
          wpCategoryOverride: publishInput.wpCategoryOverride,
          baseUrl: wpBaseUrl,
          authHeader: (() => {
            const u = process.env.WORDPRESS_USERNAME ?? "";
            const p = process.env.WORDPRESS_APP_PASSWORD ?? "";
            return "Basic " + Buffer.from(`${u}:${p}`).toString("base64");
          })(),
        });

        // Step 5: Resolve SEO keywords as WordPress tags (create if they don't exist)
        const { authHeader: wpAuthHeader } = (() => {
          const username = process.env.WORDPRESS_USERNAME ?? "";
          const appPassword = process.env.WORDPRESS_APP_PASSWORD ?? "";
          return { authHeader: "Basic " + Buffer.from(`${username}:${appPassword}`).toString("base64") };
        })();

        const allKeywords = [
          ...(publishInput.focusKeyword ? [publishInput.focusKeyword] : []),
          ...(publishInput.semanticKeywords ?? []),
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
          title: publishInput.title,
          slug: publishInput.slug,
          content: wpHtmlBody,
          excerpt: metaDesc,
          status: wpStatus,
          featuredMediaId,
          categories: wpCategoryIds,
          tags: wpTagIds.length > 0 ? wpTagIds : undefined,
          metaDescription: metaDesc,
          focusKeyword: publishInput.focusKeyword,
          seoTitle,
          canonicalUrl: `${wpBaseUrl}/${publishInput.slug}/`,
          articleSchema,
          faqSchema: faqSchema ?? undefined,
          date: wpDate,
        });

        // Step 7: Update the content item status + persist Yoast SEO fields to DB
        // Always mark as "published" once sent to WP — even if sent as a draft.
        // This prevents confusion about what has already been pushed to WordPress.
        const newStatus = wpStatus === "future" ? "scheduled" : "published";
        await updateContentItem(publishInput.contentItemId, {
          status: newStatus,
          publishUrl: post.link,
          wpPostId: post.id,  // Save WP post ID so the edit URL can be constructed on the frontend
          yoastSeoTitle: seoTitle,
          yoastMetaDescription: metaDesc,
        });

        // Step 7b: Fire-and-forget Yoast score fetch (non-blocking)
        // Yoast calculates the score when the post is opened in the editor, so
        // the score may not be available immediately after publish. We attempt
        // a fetch after a short delay; if it returns null, the user can refresh
        // manually from the Kanban card.
        setTimeout(async () => {
          try {
            const { seoScore } = await getWpYoastScore(post.id);
            if (seoScore) {
              await updateContentItem(publishInput.contentItemId, {
                yoastScore: seoScore,
                yoastScoreFetchedAt: Date.now(),
              });
            }
          } catch {
            // Non-fatal — score will be null until user refreshes manually
          }
        }, 5_000);

        // Step 7c: Auto-fix Yoast issues (H2 keyphrase + meta desc) — non-blocking, fires 5 s after publish
        // This ensures every newly published post always has the keyphrase in an H2 and in the meta desc,
        // without requiring a manual "Fix Yoast Issues" button click.
        if (newStatus !== "scheduled") {
          setTimeout(async () => {
            try {
              const { fetchSingleWpPost } = await import("./wordpress");
              const livePost = await fetchSingleWpPost(post.id);
              let wpHtmlBody = livePost.content;
              const focusKw = publishInput.focusKeyword;
              let metaDesc = publishInput.metaDescription ?? livePost.metaDescription ?? "";
              const seoTitle = publishInput.yoastSeoTitle ?? livePost.seoTitle ?? `${publishInput.title} | The Urban Monk`;
              const trimToWordBoundary = (s: string, maxLen: number): string => {
                if (s.length <= maxLen) return s;
                let t = s.slice(0, maxLen);
                const sp = t.lastIndexOf(" ");
                if (sp > 0) t = t.slice(0, sp);
                return t.trimEnd().replace(/[,;:\-\u2013\u2014]$/, "").trimEnd();
              };

              // H2 keyphrase injection
              if (focusKw && wpHtmlBody) {
                const kw = focusKw.toLowerCase();
                const kwEscaped = kw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
                const kwRegex = new RegExp(`(?:^|[^a-z0-9])${kwEscaped}(?:[^a-z0-9]|$)`, "i");
                const htmlHeadingRegex = /<(h[23])(\s[^>]*)?>((?:[\s\S])*?)<\/h[23]>/gi;
                const htmlHeadings = Array.from(wpHtmlBody.matchAll(htmlHeadingRegex));
                const htmlH2s = htmlHeadings.filter((m) => m[1].toLowerCase() === "h2");
                const stripTags = (s: string) => s.replace(/<[^>]+>/g, "").trim();
                const keyphraseInSubheading = htmlHeadings.some((m) => kwRegex.test(stripTags(m[3])));
                if (!keyphraseInSubheading && (htmlH2s.length > 0 || htmlHeadings.length > 0)) {
                  const targetIndex = htmlH2s.length >= 3 ? 2 : htmlH2s.length >= 2 ? 1 : 0;
                  const targetMatch = htmlH2s[targetIndex] ?? htmlHeadings[0];
                  if (targetMatch) {
                    const originalTag = targetMatch[0];
                    const tagName = targetMatch[1];
                    const tagAttrs = targetMatch[2] ?? "";
                    const headingText = stripTags(targetMatch[3]);
                    const kwCapitalised = focusKw.charAt(0).toUpperCase() + focusKw.slice(1);
                    const candidateText = `${kwCapitalised}: ${headingText}`;
                    const finalText = candidateText.length <= 80 ? candidateText : kwCapitalised;
                    const finalTag = `<${tagName}${tagAttrs}>${finalText}</${tagName}>`;
                    const escapedOriginal = originalTag.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
                    wpHtmlBody = wpHtmlBody.replace(new RegExp(escapedOriginal), finalTag);
                    await updateWpPostContent(post.id, wpHtmlBody);
                  }
                }
              }

              // Meta description keyphrase enforcement
              if (focusKw && metaDesc) {
                const kwLower = focusKw.toLowerCase();
                if (!metaDesc.toLowerCase().includes(kwLower)) {
                  const prefix = `${focusKw}: `;
                  const maxBodyLen = 148 - prefix.length;
                  metaDesc = (prefix + trimToWordBoundary(metaDesc, maxBodyLen)).trimEnd().replace(/[,;:\-\u2013\u2014]$/, "").trimEnd();
                } else {
                  metaDesc = trimToWordBoundary(metaDesc, 148);
                }
                if (metaDesc.length > 155) {
                  const sp = metaDesc.slice(0, 148).lastIndexOf(" ");
                  metaDesc = (sp > 0 ? metaDesc.slice(0, sp) : metaDesc.slice(0, 148)).trimEnd().replace(/[,;:\-\u2013\u2014]$/, "").trimEnd();
                }
                await updateWpPostYoast({ wpPostId: post.id, seoTitle: seoTitle || undefined, metaDescription: metaDesc || undefined, focusKeyword: focusKw || undefined });
                await updateContentItem(publishInput.contentItemId, { yoastMetaDescription: metaDesc });
              }
            } catch (autoFixErr) {
              // Non-fatal — auto-fix failure should never block the publish response
              console.error("[WP] Auto-fix Yoast issues failed (non-fatal):", autoFixErr);
            }
          }, 5_000);
        }

        // Step 8: Keyword Strategy publish-back
        // If this post was created from a keyword target, flip its status to "published"
        // and record the live URL so the Keyword Strategy dashboard shows it as done.
        if (publishInput.focusKeyword && newStatus !== "scheduled") {
          try {
            const { keywordTargets } = await import("../drizzle/schema");
            const { eq, like } = await import("drizzle-orm");
            const db2 = await getDb();
            if (db2) {
              // Match by exact focus keyword (case-insensitive via LIKE)
              await db2
                .update(keywordTargets)
                .set({
                  contentStatus: "published",
                  publishedUrl: post.link,
                })
                .where(
                  like(keywordTargets.keyword, publishInput.focusKeyword)
                );
            }
          } catch (kErr) {
            // Non-fatal — keyword strategy publish-back failure should not block the publish
            console.error("[WP] Keyword target publish-back failed (non-fatal):", kErr);
          }
        }

        // Step 9b: Internal Link Optimizer — fire-and-forget (non-blocking)
        // Injects 2–3 contextual internal links into the new post and adds the new post
        // to the Related Reading section of the pillar page in the same keyword campaign.
        if (newStatus !== "scheduled" && publishInput.focusKeyword && wpHtmlBody) {
          runInternalLinkOptimizer({
            newPostWpId: post.id,
            newPostHtmlBody: wpHtmlBody,
            newPostFocusKeyword: publishInput.focusKeyword,
            newPostTitle: publishInput.title ?? "",
            newPostUrl: post.link ?? "",
            userId: ctx.user.id,
          }).then((linkResult) => {
            console.log(`[InternalLinks] Injected ${linkResult.linksInjected} links, pillarUpdated=${linkResult.pillarUpdated}`);
            if (linkResult.errors.length > 0) console.warn("[InternalLinks] Errors:", linkResult.errors);
          }).catch((e) => console.error("[InternalLinks] Fatal error:", e));
        }

        // Step 9c: GSC Auto-Indexing — fire-and-forget (non-blocking)
        // Pings Google Search Console Indexing API so the new post is crawled immediately
        // rather than waiting for Google's natural crawl schedule (can take days).
        // Every submission (success or failure) is logged to gsc_indexing_log for auditability.
        if (newStatus !== "scheduled" && post.link) {
          (async () => {
            try {
              const { userCredentials: ucTable, gscIndexingLog: gscLogTable } = await import("../drizzle/schema");
              const { requestIndexing } = await import("./googleSearchConsole");
              const { eq: eqGsc } = await import("drizzle-orm");
              const db9c = await getDb();
              if (db9c) {
                const [creds] = await db9c.select().from(ucTable).where(eqGsc(ucTable.userId, ctx.user.id));
                if (creds?.gscRefreshToken) {
                  const result = await requestIndexing(creds.gscRefreshToken, post.link!);
                  console.log(`[GSC] Indexing ping for ${post.link}: ${result.message}`);
                  // Log the submission so we can audit what was indexed
                  await db9c.insert(gscLogTable).values({
                    userId: String(ctx.user.id),
                    url: post.link!,
                    wpPostId: post.id ?? undefined,
                    success: result.success,
                    message: result.message,
                    source: "auto_publish",
                    submittedAt: Date.now(),
                  }).catch((logErr: unknown) => {
                    console.warn("[GSC] Failed to write indexing log (non-fatal):", logErr);
                  });
                } else {
                  console.log("[GSC] No GSC refresh token — skipping indexing ping (connect GSC in settings)");
                }
              }
            } catch (e) {
              console.error("[GSC] Indexing ping failed (non-fatal):", e);
            }
          })();
        }

        // Step 9: Upsert wp_post_index with topicCluster so the scoreboard badge
        // survives page refreshes without re-running keyword matching on the client.
        if (newStatus !== "scheduled") {
          try {
            const { wpPostIndex: wpiTable } = await import("../drizzle/schema");
            const { detectCluster: dc } = await import("./wpContentUtils");
            const db4 = await getDb();
            if (db4) {
              const cluster = publishInput.focusKeyword ? dc(publishInput.focusKeyword) : null;
              await db4
                .insert(wpiTable)
                .values({
                  wpPostId: post.id,
                  title: publishInput.title,
                  slug: publishInput.slug,
                  url: post.link,
                  topicCluster: cluster?.label ?? null,
                  publishedAt: new Date(),
                  syncedAt: new Date(),
                })
                .onDuplicateKeyUpdate({
                  set: {
                    title: publishInput.title,
                    url: post.link,
                    topicCluster: cluster?.label ?? null,
                    syncedAt: new Date(),
                  },
                });
            }
          } catch (idxErr) {
            // Non-fatal — index update failure should not block the publish response
            console.error("[WP] wp_post_index upsert failed (non-fatal):", idxErr);
          }
        }

        // Step 9d: YouTube Embed Auto-Trigger — fire-and-forget (non-blocking)
        // After the post is live on WordPress, automatically search Pedram's YouTube channel
        // for a video matching the focus keyword and embed it into the article body.
        // This closes the article-video triangle: article → YouTube embed → GSC signal.
        let youtubeEmbedResult: { embedded: boolean; videoId?: string; videoTitle?: string; message: string } = { embedded: false, message: "skipped" };
        if (newStatus !== "scheduled" && post.id && publishInput.focusKeyword) {
          try {
            const searchQuery = publishInput.focusKeyword;
            // Search Pedram's channel for a matching video using Supadata
            const { getSupadata } = await import("./youtubeRouter");
            const supadata = getSupadata();
            if (supadata) {
              const searchResults = await supadata.youtube.search({
                query: `${searchQuery} Urban Monk Pedram Shojai`,
                limit: 5,
              });
              const videos = (searchResults as any)?.results ?? [];
              // Find the first video from Pedram's channel (UCxxx) or best match
              const bestVideo = videos.find((v: any) =>
                v.channelId === "UCFjivNnMnVAMvHBvHJnBqRg" || // Urban Monk channel ID
                (v.channelTitle ?? "").toLowerCase().includes("urban monk") ||
                (v.channelTitle ?? "").toLowerCase().includes("pedram")
              ) ?? videos[0];

              if (bestVideo?.id) {
                const videoId = bestVideo.id;
                const embedBlock = `\n\n<figure class="wp-block-embed is-type-video is-provider-youtube wp-block-embed-youtube wp-embed-aspect-16-9 wp-has-aspect-ratio"><div class="wp-block-embed__wrapper"><iframe width="560" height="315" src="https://www.youtube.com/embed/${videoId}" title="${(bestVideo.title ?? "").replace(/"/g, "&quot;")}" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe></div></figure>\n\n`;

                // Inject after the second </p> tag for maximum dwell time
                const wpBaseUrl2 = (process.env.WORDPRESS_URL ?? "").replace(/\/$/, "");
                const u2 = process.env.WORDPRESS_USERNAME ?? "";
                const p2 = process.env.WORDPRESS_APP_PASSWORD ?? "";
                const authHeader2 = "Basic " + Buffer.from(`${u2}:${p2}`).toString("base64");

                // Fetch current post content and inject embed
                const wpPostRes = await fetch(`${wpBaseUrl2}/wp-json/wp/v2/posts/${post.id}`, {
                  headers: { Authorization: authHeader2 },
                });
                if (wpPostRes.ok) {
                  const wpPostData = await wpPostRes.json() as any;
                  const currentContent: string = wpPostData?.content?.raw ?? wpPostData?.content?.rendered ?? "";
                  // Find second </p> and inject after it
                  let injectedContent = currentContent;
                  const secondPClose = (() => {
                    let count = 0;
                    let idx = 0;
                    while (idx < currentContent.length) {
                      const found = currentContent.indexOf("</p>", idx);
                      if (found === -1) break;
                      count++;
                      if (count === 2) return found + 4;
                      idx = found + 4;
                    }
                    return -1;
                  })();
                  if (secondPClose > 0) {
                    injectedContent = currentContent.slice(0, secondPClose) + embedBlock + currentContent.slice(secondPClose);
                  } else {
                    injectedContent = currentContent + embedBlock;
                  }

                  // Update the WP post with the embed
                  await fetch(`${wpBaseUrl2}/wp-json/wp/v2/posts/${post.id}`, {
                    method: "POST",
                    headers: { Authorization: authHeader2, "Content-Type": "application/json" },
                    body: JSON.stringify({ content: injectedContent }),
                  });

                  // Save embed status to DB
                  const db9d = await getDb();
                  if (db9d) {
                    const { contentItems: ciTable9d } = await import("../drizzle/schema");
                    const { eq: eq9d } = await import("drizzle-orm");
                    await db9d.update(ciTable9d).set({
                      embeddedYoutubeVideoId: videoId,
                      embeddedYoutubeEmbedStatus: "embedded",
                    }).where(eq9d(ciTable9d.id, publishInput.contentItemId));
                  }

                  youtubeEmbedResult = { embedded: true, videoId, videoTitle: bestVideo.title ?? "", message: `Embedded: ${bestVideo.title}` };
                  console.log(`[YT Embed] Auto-embedded video ${videoId} into post ${post.id}`);
                }
              } else {
                youtubeEmbedResult = { embedded: false, message: "No matching video found on channel" };
              }
            }
          } catch (ytEmbedErr) {
            // Non-fatal — embed failure should never block the publish response
            console.error("[YT Embed] Auto-embed failed (non-fatal):", ytEmbedErr);
            youtubeEmbedResult = { embedded: false, message: "Embed search failed" };
          }
        }

        // Step 9e: Syndication pipeline — enqueue staggered jobs for Substack (Day 1), Medium (Day 2), Quora (Day 3)
        // NOTE: Simultaneous Substack push has been REPLACED by the staggered syndication pipeline.
        // Substack now receives a distinct founder letter (not a copy of the WP post) 24 hours after WP publish.
        // This ensures WordPress is indexed by Google first (canonical origin) and Substack subscribers
        // receive unique content that drives traffic back to the site.
        let substackResult: { published: boolean; postUrl?: string; postId?: string; message: string } = { published: false, message: "queued_for_syndication" };
        if (newStatus !== "scheduled") {
          try {
            const { syndicationRouter: syndicationRouterModule } = await import("./syndicationRouter");
            // Enqueue via direct DB insert (bypasses tRPC auth for server-side use)
            const { syndicationJobs: sjTable } = await import("../drizzle/schema");
            const dbSyn = await getDb();
            if (dbSyn) {
              const DAY_MS = 24 * 60 * 60 * 1000;
              const now = Date.now();
              const wpCanonicalUrl = post.link;
              // Check for existing jobs to avoid duplicates on re-publish
              const { eq: eqSyn, inArray: inArraySyn } = await import("drizzle-orm");
              const existing = await dbSyn.select({ platform: sjTable.platform })
                .from(sjTable)
                .where(eqSyn(sjTable.contentItemId, publishInput.contentItemId));
              const existingPlatforms = new Set(existing.map((j: { platform: string }) => j.platform));
              const platforms = ["substack", "medium", "quora"] as const;
              const delays: Record<string, number> = { substack: 1 * DAY_MS, medium: 2 * DAY_MS, quora: 3 * DAY_MS };
              const toCreate = platforms.filter((p) => !existingPlatforms.has(p));
              if (toCreate.length > 0) {
                await dbSyn.insert(sjTable).values(
                  toCreate.map((platform) => ({
                    contentItemId: publishInput.contentItemId,
                    wordpressUrl: wpCanonicalUrl,
                    wordpressTitle: publishInput.title,
                    wordpressBodyHtml: wpHtmlBody,
                    wordpressMetaDescription: publishInput.metaDescription ?? null,
                    wordpressFocusKeyword: publishInput.focusKeyword ?? null,
                    platform,
                    status: "pending" as const,
                    scheduledAt: now + delays[platform],
                  }))
                );
                substackResult = { published: false, message: `Syndication queued: Substack in 24h, Medium in 48h, Quora in 72h` };
                console.log(`[Syndication] Enqueued ${toCreate.length} jobs for content item ${publishInput.contentItemId}`);
              } else {
                substackResult = { published: false, message: "Syndication jobs already exist for this post" };
              }
            }
          } catch (synErr) {
            // Non-fatal — syndication enqueue failure should never block the WP publish response
            console.error("[Syndication] Enqueue failed (non-fatal):", synErr);
            substackResult = { published: false, message: `Syndication enqueue failed: ${(synErr as Error).message}` };
          }
        }

        return {
          success: true,
          postId: post.id,
          postUrl: post.link,
          editUrl: post.editLink,
          wpImageUrl,
          wpStatus,
          imageUploaded: !!featuredMediaId,
          campaignValidationWarning: campaignValidationWarning ?? null,
          keyphraseAlreadyUsed,
          keyphraseConflictUrl,
          wpCategories: wpCategoryIds,
          youtubeEmbedResult,
          substackResult,
        };
      }),

    // Sync WordPress post index (for internal link injection in blog generation)
    // Fetch all WordPress categories (for the publish dialog category dropdown)
    getWpCategories: protectedProcedure
      .query(async () => {
        const wpBaseUrl = (process.env.WORDPRESS_URL ?? "").replace(/\/$/, "");
        const u = process.env.WORDPRESS_USERNAME ?? "";
        const p = process.env.WORDPRESS_APP_PASSWORD ?? "";
        const authHeader = "Basic " + Buffer.from(`${u}:${p}`).toString("base64");
        const categories = await fetchWpCategories(authHeader, wpBaseUrl);
        return categories;
      }),

    syncPostIndex: protectedProcedure
      .mutation(async () => {
        const posts = await fetchAllWpPosts();
        if (posts.length === 0) {
          return { synced: 0, message: "No published posts found in WordPress." };
        }
        const db = await getDb();
        if (!db) throw new Error("Database unavailable");
        const { wpPostIndex } = await import("../drizzle/schema");
        const { detectCluster: dc } = await import("./wpContentUtils");
        let upserted = 0;
        for (const p of posts) {
          // Derive cluster from keyword matching against the post title and excerpt.
          // The WP sync API doesn't return the Yoast focus keyword directly,
          // so we match against title + excerpt text.
          const clusterSource = `${p.title} ${p.excerpt}`;
          const cluster = clusterSource ? dc(clusterSource) : null;
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
              topicCluster: cluster?.label ?? null,
            })
            .onDuplicateKeyUpdate({
              set: {
                title: p.title,
                url: p.url,
                excerpt: p.excerpt,
                topicCluster: cluster?.label ?? null,
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
seoTitle: { type: "string", description: "SEO title HARD MAX 48 chars — count every character" },
                   metaDescription: { type: "string", description: "Meta description: EXACTLY 140-150 chars. Count every character including spaces. If over 150, cut words. If under 140, expand. Must include focus keyword in first 25 chars. Must NOT end with ellipsis" },
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
        let fields: { seoTitle: string; metaDescription: string; focusKeyphrase: string; semanticKeywords: string[] };
        try {
          // Strip markdown code fences if present
          const cleaned = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
          fields = JSON.parse(cleaned);
        } catch {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "The AI service returned an invalid response. Please try again.",
          });
        }

        // Persist to DB immediately
        await updateContentItem(input.contentItemId, {
          yoastSeoTitle: fields.seoTitle,
          yoastMetaDescription: fields.metaDescription,
          focusKeyword: fields.focusKeyphrase,
          seoKeywords: JSON.stringify(fields.semanticKeywords),
        });

        return fields;
      }),

    // Test WordPress connection — verifies credentials and returns site info
    testWpConnection: protectedProcedure
      .query(async () => {
        const baseUrl = (process.env.WORDPRESS_URL ?? "").replace(/\/$/, "");
        const username = process.env.WORDPRESS_USERNAME ?? "";
        const appPassword = process.env.WORDPRESS_APP_PASSWORD ?? "";
        const authHeader = "Basic " + Buffer.from(`${username}:${appPassword}`).toString("base64");

        try {
          const res = await fetch(`${baseUrl}/wp-json/wp/v2/users/me`, {
            headers: { Authorization: authHeader },
            signal: AbortSignal.timeout(10_000),
          });
          if (!res.ok) {
            return { ok: false, message: `WordPress returned HTTP ${res.status}. Check credentials.` };
          }
          const data = await res.json() as { id?: number; name?: string; roles?: string[] };
          if (!data.id) {
            return { ok: false, message: "WordPress responded but did not return a valid user." };
          }
          return {
            ok: true,
            message: `Connected as ${data.name} (${data.roles?.join(", ") ?? "unknown role"}) on ${baseUrl}`,
          };
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          return { ok: false, message: `Connection failed: ${msg}` };
        }
      }),

    // Diagnostic: check whether the wp-yoast-rest-meta.php snippet is installed
    // Returns { installed: boolean, metaKeys: string[], message: string }
    checkYoastSnippet: protectedProcedure
      .query(async () => {
        const baseUrl = (process.env.WORDPRESS_URL ?? "").replace(/\/$/, "");
        const username = process.env.WORDPRESS_USERNAME ?? "";
        const appPassword = process.env.WORDPRESS_APP_PASSWORD ?? "";
        const authHeader = "Basic " + Buffer.from(`${username}:${appPassword}`).toString("base64");

        // Detect whether WPCode Lite is active (preferred installation method)
        let wpCodeActive = false;
        try {
          const pluginsRes = await fetch(`${baseUrl}/wp-json/wp/v2/plugins?per_page=100`, { headers: { Authorization: authHeader } });
          if (pluginsRes.ok) {
            const plugins = await pluginsRes.json() as Array<{ plugin: string; status: string }>;
            wpCodeActive = plugins.some(p => p.status === "active" && (p.plugin ?? "").includes("insert-headers-and-footers"));
          }
        } catch { /* non-fatal */ }

        // Fetch the most recent published post with edit context
        const listRes = await fetch(
          `${baseUrl}/wp-json/wp/v2/posts?per_page=1&status=publish&context=edit`,
          { headers: { Authorization: authHeader } }
        );
        if (!listRes.ok) {
          return { installed: false, metaKeys: [], wpCodeActive, message: `WordPress API error: ${listRes.status}` };
        }
        const posts = await listRes.json() as Array<{ id: number; meta?: Record<string, unknown> }>;
        if (!posts || posts.length === 0) {
          return { installed: false, metaKeys: [], wpCodeActive, message: "No published posts found to test against" };
        }

        const meta = posts[0].meta ?? {};
        const metaKeys = Object.keys(meta);
        const yoastKeys = ["_yoast_wpseo_focuskw", "_yoast_wpseo_metadesc", "_yoast_wpseo_title", "_yoast_wpseo_canonical"];
        const installed = yoastKeys.some(k => metaKeys.includes(k));
        const foundYoastKeys = metaKeys.filter(k => yoastKeys.includes(k));

        const installMethod = wpCodeActive
          ? "WPCode Lite is active on your site — use it instead of functions.php (safer and more reliable)."
          : "Add the snippet to Appearance → Theme File Editor → functions.php (active theme: Hello Elementor)."

        return {
          installed,
          metaKeys,
          foundYoastKeys,
          wpCodeActive,
          message: installed
            ? `Snippet active. Yoast meta keys found: ${foundYoastKeys.join(", ")}`
            : `Snippet not detected in REST API. Current meta keys: ${metaKeys.join(", ") || "(none)"}. ${installMethod}`,
        };
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

    // Batch generate Yoast SEO fields for all Drafting blog posts
    generateYoastForDrafts: protectedProcedure
      .mutation(async () => {
        const db = await getDb();
        const { contentItems } = await import('../drizzle/schema');
        const { eq, and, isNotNull } = await import('drizzle-orm');

        if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Database not available' });

        // Get all blog posts in Drafting status that have body content
        const drafts = await db
          .select()
          .from(contentItems)
          .where(
            and(
              eq(contentItems.platform, 'blog'),
              eq(contentItems.status, 'drafting'),
              isNotNull(contentItems.textContent)
            )
          );

        const results: Array<{ id: number; title: string; success: boolean; error?: string }> = [];

        for (const item of drafts) {
          try {
            const response = await safeLLM({
              messages: [
                {
                  role: 'system',
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
                  role: 'user',
                  content: `Blog post title: ${item.title}\n\nBlog post content (first 2000 chars):\n${(item.textContent ?? '').substring(0, 2000)}`,
                },
              ],
              response_format: {
                type: 'json_schema',
                json_schema: {
                  name: 'yoast_seo_fields',
                  strict: true,
                  schema: {
                    type: 'object',
                    properties: {
                      seoTitle: { type: 'string', description: 'SEO title max 60 chars' },
                      metaDescription: { type: 'string', description: 'Meta description: EXACTLY 140-150 chars. Count every character. If over 150, cut words. Must NOT end with ellipsis' },
                      focusKeyphrase: { type: 'string', description: 'Primary focus keyword phrase' },
                      semanticKeywords: { type: 'array', items: { type: 'string' }, description: 'Related keywords' },
                    },
                    required: ['seoTitle', 'metaDescription', 'focusKeyphrase', 'semanticKeywords'],
                    additionalProperties: false,
                  },
                },
              },
            });

            const raw = String(response.choices?.[0]?.message?.content ?? '{}');
            let fields: { seoTitle: string; metaDescription: string; focusKeyphrase: string; semanticKeywords: string[] };
            try {
              const cleaned = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
              fields = JSON.parse(cleaned);
            } catch {
              throw new Error('AI returned invalid JSON for Yoast fields');
            }

            await updateContentItem(item.id, {
              yoastSeoTitle: fields.seoTitle,
              yoastMetaDescription: fields.metaDescription,
              focusKeyword: fields.focusKeyphrase,
              seoKeywords: JSON.stringify(fields.semanticKeywords),
            });

            results.push({ id: item.id, title: item.title, success: true });
          } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : String(err);
            results.push({ id: item.id, title: item.title, success: false, error: msg });
          }
        }

        const succeeded = results.filter((r) => r.success).length;
        const failed = results.filter((r) => !r.success).length;
        return { results, succeeded, failed, total: drafts.length };
      }),

    // Generate Yoast SEO fields for published posts that are missing them
    generateYoastForPublished: protectedProcedure
      .mutation(async () => {
        const db = await getDb();
        const { contentItems } = await import('../drizzle/schema');
        const { eq, and, isNotNull, or, isNull } = await import('drizzle-orm');

        if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Database not available' });

        // Get all published blog posts that are missing focus keyword or seo title
        const published = await db
          .select()
          .from(contentItems)
          .where(
            and(
              eq(contentItems.platform, 'blog'),
              eq(contentItems.status, 'published'),
              isNotNull(contentItems.textContent),
              or(
                isNull(contentItems.focusKeyword),
                isNull(contentItems.yoastSeoTitle)
              )
            )
          );

        const results: Array<{ id: number; title: string; success: boolean; error?: string }> = [];

        for (const item of published) {
          // Skip if already has both focus keyword and seo title
          if (item.focusKeyword && item.yoastSeoTitle) continue;
          try {
            const response = await safeLLM({
              messages: [
                {
                  role: 'system',
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
                  role: 'user',
                  content: `Blog post title: ${item.title}\n\nBlog post content (first 2000 chars):\n${(item.textContent ?? '').substring(0, 2000)}`,
                },
              ],
              response_format: {
                type: 'json_schema',
                json_schema: {
                  name: 'yoast_seo_fields',
                  strict: true,
                  schema: {
                    type: 'object',
                    properties: {
                      seoTitle: { type: 'string', description: 'SEO title max 60 chars' },
                      metaDescription: { type: 'string', description: 'Meta description: EXACTLY 140-150 chars. Count every character. If over 150, cut words. Must NOT end with ellipsis' },
                      focusKeyphrase: { type: 'string', description: 'Primary focus keyword phrase' },
                      semanticKeywords: { type: 'array', items: { type: 'string' }, description: 'Related keywords' },
                    },
                    required: ['seoTitle', 'metaDescription', 'focusKeyphrase', 'semanticKeywords'],
                    additionalProperties: false,
                  },
                },
              },
            });

            const raw = String(response.choices?.[0]?.message?.content ?? '{}');
            let fields: { seoTitle: string; metaDescription: string; focusKeyphrase: string; semanticKeywords: string[] };
            try {
              const cleaned = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
              fields = JSON.parse(cleaned);
            } catch {
              throw new Error('AI returned invalid JSON for Yoast fields');
            }

            await updateContentItem(item.id, {
              yoastSeoTitle: fields.seoTitle,
              yoastMetaDescription: fields.metaDescription,
              focusKeyword: fields.focusKeyphrase,
              seoKeywords: JSON.stringify(fields.semanticKeywords),
            });

            results.push({ id: item.id, title: item.title, success: true });
          } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : String(err);
            results.push({ id: item.id, title: item.title, success: false, error: msg });
          }
        }

        const succeeded = results.filter((r) => r.success).length;
        const failed = results.filter((r) => !r.success).length;
        return { results, succeeded, failed, total: published.length };
      }),

    // Batch backfill Yoast SEO fields on all Published WordPress posts
    // Applies the same keyphrase-first SEO title and meta desc enforcement as the publish procedure
    backfillYoastInWordPress: protectedProcedure
      .mutation(async () => {
        const db = await getDb();
        const { contentItems } = await import('../drizzle/schema');
        const { eq, and, isNotNull } = await import('drizzle-orm');

        if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Database not available' });

        // Get all published blog posts that have a wpPostId
        const published = await db
          .select()
          .from(contentItems)
          .where(
            and(
              eq(contentItems.platform, 'blog'),
              eq(contentItems.status, 'published'),
              isNotNull(contentItems.wpPostId)
            )
          );

        const results: Array<{ id: number; title: string; wpPostId: number; success: boolean; fixed: string[]; error?: string }> = [];

        for (const item of published) {
          if (!item.wpPostId) continue;
          const fixed: string[] = [];
          try {
            const focusKw = item.focusKeyword ?? '';
            let seoTitle = item.yoastSeoTitle ?? item.title ?? '';
            let metaDesc = item.yoastMetaDescription ?? '';

            // Fix 1: SEO title must start with the focus keyphrase
            if (focusKw && seoTitle) {
              const kwLower = focusKw.toLowerCase();
              const titleLower = seoTitle.toLowerCase();
              if (!titleLower.startsWith(kwLower)) {
                // Check if the title already contains the keyphrase — if so, don't double-prefix
                if (!titleLower.includes(kwLower)) {
                  const baseTitle = seoTitle.replace(/\s*\|.*$/, '').trim();
                  seoTitle = `${focusKw}: ${baseTitle} | The Urban Monk`;
                  fixed.push('seo_title_keyphrase_first');
                }
              }
            }

            // Fix 2: Meta description must contain the focus keyphrase
            if (focusKw && metaDesc) {
              const kwLower = focusKw.toLowerCase();
              if (!metaDesc.toLowerCase().includes(kwLower)) {
                metaDesc = `${focusKw}: ${metaDesc}`;
                fixed.push('meta_desc_keyphrase_added');
              }
            }

            // Persist fixed values to DB
            if (fixed.length > 0) {
              await updateContentItem(item.id, {
                yoastSeoTitle: seoTitle,
                yoastMetaDescription: metaDesc,
              });
            }

            await updateWpPostYoast({
              wpPostId: item.wpPostId,
              seoTitle: seoTitle || undefined,
              metaDescription: metaDesc || undefined,
              focusKeyword: focusKw || undefined,
            });
            results.push({ id: item.id, title: item.title, wpPostId: item.wpPostId, success: true, fixed });
          } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : String(err);
            results.push({ id: item.id, title: item.title, wpPostId: item.wpPostId, success: false, fixed, error: msg });
          }
        }

        const succeeded = results.filter((r) => r.success).length;
        const failed = results.filter((r) => !r.success).length;
        const totalFixed = results.reduce((acc, r) => acc + r.fixed.length, 0);
        return { results, succeeded, failed, total: published.length, totalFixed };
      }),

    // Bulk-fix SEO titles (>70 chars) and meta descriptions (>160 chars) using LLM
    bulkFixSeoLength: protectedProcedure
      .mutation(async () => {
        const db = await getDb();
        const { contentItems } = await import('../drizzle/schema');
        const { eq, and, isNotNull } = await import('drizzle-orm');

        if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Database not available' });

        // Get all blog posts (published + draft) that have oversized SEO fields
        const allPosts = await db
          .select()
          .from(contentItems)
          .where(eq(contentItems.platform, 'blog'));

        // Filter to only those with issues
        const needsFix = allPosts.filter(item => {
          const titleTooLong = item.yoastSeoTitle && item.yoastSeoTitle.length > 70;
          const descTooLong = item.yoastMetaDescription && item.yoastMetaDescription.length > 160;
          return titleTooLong || descTooLong;
        });

        const results: Array<{ id: number; title: string; wpPostId: number | null; success: boolean; fixed: string[]; newSeoTitle?: string; newMetaDesc?: string; error?: string }> = [];

        for (const item of needsFix) {
          const fixed: string[] = [];
          try {
            let seoTitle = item.yoastSeoTitle ?? '';
            let metaDesc = item.yoastMetaDescription ?? '';
            const focusKw = item.focusKeyword ?? '';

            const titleTooLong = seoTitle.length > 70;
            const descTooLong = metaDesc.length > 160;

            if (titleTooLong || descTooLong) {
              // Use LLM to generate properly-sized versions
              const prompt = [
                `You are an SEO expert. Rewrite the following Yoast SEO fields to meet strict character limits.`,
                ``,
                `Focus Keyphrase: ${focusKw || '(none)'}`,
                `Article Title: ${item.title}`,
                titleTooLong ? `Current SEO Title (${seoTitle.length} chars — TOO LONG, must be ≤60 chars): ${seoTitle}` : `Current SEO Title (OK): ${seoTitle}`,
                descTooLong ? `Current Meta Description (${metaDesc.length} chars — TOO LONG, must be 140-155 chars): ${metaDesc}` : `Current Meta Description (OK): ${metaDesc}`,
                ``,
                `RULES:`,
                `1. SEO Title: must be 50-60 characters total including " | The Urban Monk" suffix (18 chars). So the title portion before the suffix must be 32-42 chars. Do NOT include the focus keyphrase as a prefix — just write a natural, compelling title.`,
                `2. Meta Description: must be 140-155 characters. Include the focus keyphrase naturally. Make it compelling and click-worthy.`,
                `3. Return ONLY valid JSON with keys: seoTitle, metaDescription`,
                `4. Do not include any explanation or preamble.`,
              ].join('\n');

              const llmResp = await safeLLM({
                messages: [
                  { role: 'system', content: 'You are an SEO expert. Return only valid JSON.' },
                  { role: 'user', content: prompt },
                ],
                response_format: {
                  type: 'json_schema',
                  json_schema: {
                    name: 'seo_fields',
                    strict: true,
                    schema: {
                      type: 'object',
                      properties: {
                        seoTitle: { type: 'string', description: 'SEO title, 50-60 chars total' },
                        metaDescription: { type: 'string', description: 'Meta description: EXACTLY 140-150 chars. Count every character. If over 150, cut words. Must NOT end with ellipsis' },
                      },
                      required: ['seoTitle', 'metaDescription'],
                      additionalProperties: false,
                    },
                  },
                },
              });

              const parsed = JSON.parse(llmResp.choices[0].message.content as string) as { seoTitle: string; metaDescription: string };

              if (titleTooLong && parsed.seoTitle) {
                seoTitle = parsed.seoTitle;
                fixed.push(`seo_title_shortened (${seoTitle.length} chars)`);
              }
              if (descTooLong && parsed.metaDescription) {
                metaDesc = parsed.metaDescription;
                fixed.push(`meta_desc_shortened (${metaDesc.length} chars)`);
              }
            }

            // Save to DB
            if (fixed.length > 0) {
              await updateContentItem(item.id, {
                yoastSeoTitle: seoTitle,
                yoastMetaDescription: metaDesc,
              });
            }

            // Push to WordPress if published
            if (item.wpPostId && fixed.length > 0) {
              await updateWpPostYoast({
                wpPostId: item.wpPostId,
                seoTitle: seoTitle || undefined,
                metaDescription: metaDesc || undefined,
                focusKeyword: focusKw || undefined,
              });
            }

            results.push({ id: item.id, title: item.title, wpPostId: item.wpPostId ?? null, success: true, fixed, newSeoTitle: seoTitle, newMetaDesc: metaDesc });
          } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : String(err);
            results.push({ id: item.id, title: item.title, wpPostId: item.wpPostId ?? null, success: false, fixed, error: msg });
          }
        }

        const succeeded = results.filter((r) => r.success).length;
        const failed = results.filter((r) => !r.success).length;
        return { results, succeeded, failed, total: needsFix.length };
      }),

    // Sync missing WordPress post IDs for published blog posts
    syncMissingWpIds: protectedProcedure
      .mutation(async () => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Database not available' });
        const { contentItems } = await import('../drizzle/schema');
        const { eq, isNull, and } = await import('drizzle-orm');

        // Get all published blog posts with no wpPostId
        const missing = await db
          .select()
          .from(contentItems)
          .where(
            and(
              eq(contentItems.platform, 'blog'),
              eq(contentItems.status, 'published'),
              isNull(contentItems.wpPostId)
            )
          );

        const results: Array<{ id: number; title: string; wpPostId: number | null; found: boolean; error?: string }> = [];

        for (const item of missing) {
          try {
            // Search WordPress by title — strip special chars so WP search works reliably
            const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
            const itemNorm = normalize(item.title);
            // Try multiple search strategies: first 8 plain words, then first 5 words
            const plainWords = item.title.replace(/[^a-zA-Z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim().split(' ');
            const searchQuery1 = plainWords.slice(0, 8).join(' ');
            const searchQuery2 = plainWords.slice(0, 5).join(' ');
            const authHeader = 'Basic ' + Buffer.from(`${process.env.WORDPRESS_USERNAME}:${process.env.WORDPRESS_APP_PASSWORD}`).toString('base64');

            let posts: Array<{ id: number; title: { rendered: string }; link: string; status: string }> = [];
            for (const q of [searchQuery1, searchQuery2]) {
              if (!q.trim()) continue;
              const searchUrl = `${process.env.WORDPRESS_URL}/wp-json/wp/v2/posts?search=${encodeURIComponent(q)}&per_page=10&_fields=id,title,link,status`;
              const resp = await fetch(searchUrl, { headers: { Authorization: authHeader } });
              if (resp.ok) {
                const batch: typeof posts = await resp.json();
                posts = batch;
                if (posts.length > 0) break;
              }
            }

            if (posts.length === 0) {
              results.push({ id: item.id, title: item.title, wpPostId: null, found: false, error: 'No matching WP post found' });
              continue;
            }

            // Find best match: exact normalized title, then highest word overlap
            const wordOverlap = (a: string, b: string) => {
              const wa = new Set(a.toLowerCase().split(/\s+/));
              const wb = b.toLowerCase().split(/\s+/);
              return wb.filter(w => wa.has(w)).length;
            };
            const exactMatch = posts.find(p => normalize(p.title.rendered) === itemNorm);
            const match = exactMatch ?? posts.sort((a, b) => wordOverlap(item.title, b.title.rendered) - wordOverlap(item.title, a.title.rendered))[0];
            if (!match) {
              results.push({ id: item.id, title: item.title, wpPostId: null, found: false, error: 'No matching WP post found' });
              continue;
            }
            // Update DB
            await db
              .update(contentItems)
              .set({ wpPostId: match.id, publishUrl: match.link })
              .where(eq(contentItems.id, item.id));
            results.push({ id: item.id, title: item.title, wpPostId: match.id, found: true });
          } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : String(err);
            results.push({ id: item.id, title: item.title, wpPostId: null, found: false, error: msg });
          }
        }

        const found = results.filter(r => r.found).length;
        const notFound = results.filter(r => !r.found).length;
        return { results, found, notFound, total: missing.length };
      }),

    // Rewrite a blog post in an accessible, engaging voice for a general audience
    createReaderVersion: protectedProcedure
      .input(z.object({
        contentItemId: z.number(),
        articleText: z.string().min(50),
      }))
      .mutation(async ({ input }) => {
        const READER_VERSION_SYSTEM = `You are a gifted health and wellness writer who specialises in making complex science feel warm, accessible, and genuinely useful for busy, curious adults who are NOT scientists or doctors.

Your job is to rewrite the article below in a friendlier, more engaging voice — the kind of piece someone would actually want to read on a Sunday morning with their coffee.

STRICT RULES:
1. PRESERVE every citation exactly as written — [1], [2], [^1], (Smith et al., 2021), etc. Do NOT remove, renumber, or paraphrase any citation marker.
2. PRESERVE the References / Sources section at the end, word-for-word.
3. PRESERVE all factual claims, statistics, and study findings — just explain them in plain English.
4. PRESERVE all URLs that appear in the text — do not add, change, or remove any links.
5. Keep the same overall structure (intro, sections, conclusion, CTA) but make headings feel like a conversation starter, not a textbook chapter title.
6. Write at a 7th–8th grade reading level. Use short sentences, active voice, relatable analogies, and occasional rhetorical questions to pull the reader forward.
7. Pedram's voice: warm, wise, slightly irreverent, grounded in both ancient wisdom and modern science. He speaks to you like a knowledgeable friend, not a lecturer.
8. Do NOT add new claims, new URLs, or new citations that weren't in the original.
9. Return ONLY the rewritten article in clean Markdown — no preamble, no commentary, no "Here is the rewritten version:" intro.`;

        const response = await safeLLM({
          messages: [
            { role: 'system', content: READER_VERSION_SYSTEM },
            { role: 'user', content: input.articleText },
          ],
        });
        const rawContent = response.choices?.[0]?.message?.content;
        const rewrittenText = typeof rawContent === 'string' ? rawContent : Array.isArray(rawContent) ? rawContent.map((p: { type: string; text?: string }) => p.type === 'text' ? (p.text ?? '') : '').join('') : '';
        if (!rewrittenText) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'LLM returned empty response' });
        return { rewrittenText };
      }),

    // Regenerate CTA banner for an existing blog content item
    regenerateBanner: protectedProcedure
      .input(z.object({
        contentItemId: z.number(),
        ctaLabel: z.string().optional(),   // CTA block label (e.g. "Lights On Course")
        ctaText: z.string().optional(),    // CTA descriptive text
        ctaUrl: z.string().optional(),     // CTA destination URL
        articleTopic: z.string().optional(), // Brief topic hint for the image prompt
      }))
      .mutation(async ({ input }) => {
        const item = await getContentItem(input.contentItemId);
        if (!item) throw new TRPCError({ code: 'NOT_FOUND', message: 'Content item not found' });

        // Resolve CTA details — fall back to stored ctaBlockLabel or defaults
        const ctaLabel = input.ctaLabel ?? item.ctaBlockLabel ?? 'Lights On';
        const ctaText = input.ctaText ?? 'Transform your health and wellbeing with Dr. Pedram Shojai';
        const ctaUrl = input.ctaUrl ?? 'https://lightson.theurbanmonk.com/';
        const articleTopic = input.articleTopic ?? item.title ?? 'wellness and ancient wisdom';

        // Step 1: Generate a visual prompt via LLM
        const ctaBannerPromptResponse = await safeLLM({
          messages: [
            {
              role: 'system',
              content: `You are a graphic designer for The Urban Monk brand. Write a concise image generation prompt (max 80 words) for a wide-format (16:9) CTA infographic banner. The banner must look like a polished marketing graphic — NOT a photo. It should include: a bold headline area at the top in warm cream/ivory text, a central visual metaphor (e.g. glowing lantern, lotus, ancient compass, DNA helix merging with nature), a prominent CTA button shape in deep amber/gold at the bottom with space for text, and a rich dark background (deep forest green, midnight navy, or warm charcoal). Brand aesthetic: premium wellness, ancient wisdom meets modern science, clean typography, no human faces. Return ONLY the prompt.`,
            },
            {
              role: 'user',
              content: `CTA label: ${ctaLabel}\nCTA headline: ${ctaText.split('.')[0]}\nArticle topic: ${articleTopic}`,
            },
          ],
        });
        const rawBannerPrompt = ctaBannerPromptResponse.choices?.[0]?.message?.content;
        const bannerImagePrompt = typeof rawBannerPrompt === 'string' ? rawBannerPrompt.trim() : `Premium wellness infographic banner: bold cream headline area at top, glowing golden lotus central motif, deep forest green background, amber CTA button shape at bottom, ancient wisdom meets modern science aesthetic, no faces, clean graphic design style`;

        // Step 2: Generate the banner image
        const { url: rawNewBannerUrlMaybe } = await generateImage({ prompt: bannerImagePrompt });
        const rawNewBannerUrl: string = rawNewBannerUrlMaybe ?? "";

        // Step 2b: Composite headline + button label text onto the image
        let newBannerUrl = rawNewBannerUrl;
        try {
          const ctaHeadline = ctaText.split('.')[0].trim().replace(/[*_#]/g, '');
          const ctaBtnLabel = ctaLabel.replace(/[()]/g, '').trim().substring(0, 50);
          const composited = await compositeCtaBanner({
            imageUrl: rawNewBannerUrl,
            headline: ctaHeadline || 'Transform Your Health Today',
            ctaButtonLabel: ctaBtnLabel || 'Learn More',
            keyPrefix: 'cta-banners/regen',
          });
          newBannerUrl = composited.url;
        } catch (compErr) {
          console.warn('[Blog] Regen banner composite failed, using raw image:', compErr);
        }

        // Step 3: Persist only the new banner URL — do NOT embed CTA HTML in textContent.
        // The CTA HTML is injected at WordPress publish time only (see publishToWordPress procedure).
        // Also strip any previously-embedded CTA HTML block from textContent if present.
        let updatedTextContent = (item.textContent ?? '')
          .replace(/<div[^>]*class=["']um-cta-banner["'][\s\S]*?<\/div>\s*<\/div>/gi, '')
          .trim();

        // Step 4: Persist the new banner URL and cleaned textContent
        await updateContentItem(input.contentItemId, {
          ctaBannerUrl: newBannerUrl,
          textContent: updatedTextContent,
        });

        return { ctaBannerUrl: newBannerUrl, imagePrompt: bannerImagePrompt };
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

    // Replace utm_campaign= in a blog post's textContent with a corrected known slug
    fixCampaignSlug: protectedProcedure
      .input(z.object({
        contentItemId: z.number(),
        newCampaignSlug: z.string().min(1).max(64),
      }))
      .mutation(async ({ input }) => {
        const item = await getContentItem(input.contentItemId);
        if (!item) throw new TRPCError({ code: "NOT_FOUND", message: "Content item not found" });
        if (!item.textContent) return { updated: false, message: "No text content to update" };

        // Replace all utm_campaign= values in the text content with the corrected slug
        const updated = item.textContent.replace(
          /utm_campaign=([^&"'\s]+)/g,
          `utm_campaign=${input.newCampaignSlug}`
        );

        if (updated === item.textContent) {
          return { updated: false, message: "No utm_campaign parameters found to replace" };
        }

        await updateContentItem(input.contentItemId, { textContent: updated });
        return { updated: true, newSlug: input.newCampaignSlug };
      }),

    // ── Image Regeneration ─────────────────────────────────────────────────────────────────────────────
    // Suggest 6 visually distinct image themes for a blog post hero image
    suggestImageThemes: protectedProcedure
      .input(z.object({
        contentItemId: z.number(),
        title: z.string(),
        focusKeyword: z.string().optional(),
        topic: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const THEME_SYSTEM = `You are a world-class art director for a premium health and wellness brand. Given a blog article title and topic, suggest 6 visually DISTINCT hero image themes. Each theme must look completely different from the others — different color palette, different photographic style, different subject matter, different mood.

The brand is The Urban Monk (Dr. Pedram Shojai) — bridges ancient Daoist wisdom with modern functional medicine. Audience: educated professionals 30-55, health-conscious, skeptical of hype.

CRITICAL: Do NOT default to "warm golden sunrise yoga retreat" imagery. That is the cliché to avoid. Push for specificity, contrast, and visual surprise.

For each theme provide:
- name: 2-4 word evocative label (e.g. "Clinical Cold Light", "Ancient Stone & Ink", "Documentary Realism")
- description: 1-2 sentences describing the visual mood, color palette, and subject matter
- imagePrompt: A precise 60-80 word image generation prompt. Include: subject, lighting, color palette, photographic style, mood, composition. Do NOT include text overlay instructions. End with "16:9 aspect ratio, no text."

Return ONLY a valid JSON array of 6 objects with keys: name, description, imagePrompt. No preamble.`;

        const response = await safeLLM({
          messages: [
            { role: 'system', content: THEME_SYSTEM },
            { role: 'user', content: `Title: ${input.title}\nFocus keyword: ${input.focusKeyword ?? ''}\nTopic: ${input.topic ?? input.title}` },
          ],
          response_format: {
            type: 'json_schema',
            json_schema: {
              name: 'image_themes',
              strict: true,
              schema: {
                type: 'object',
                properties: {
                  themes: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        name: { type: 'string' },
                        description: { type: 'string' },
                        imagePrompt: { type: 'string' },
                      },
                      required: ['name', 'description', 'imagePrompt'],
                      additionalProperties: false,
                    },
                  },
                },
                required: ['themes'],
                additionalProperties: false,
              },
            },
          },
        });

        const raw = response.choices?.[0]?.message?.content;
        const text = typeof raw === 'string' ? raw : Array.isArray(raw) ? raw.map((p: { type: string; text?: string }) => p.type === 'text' ? (p.text ?? '') : '').join('') : '';
        let themes: Array<{ name: string; description: string; imagePrompt: string }> = [];
        try {
          const parsed = JSON.parse(text);
          themes = Array.isArray(parsed) ? parsed : (parsed.themes ?? []);
        } catch {
          throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to parse theme suggestions' });
        }
        return { themes };
      }),

    // Regenerate the hero image for a blog post with a chosen theme
    regenerateBlogHeroImage: protectedProcedure
      .input(z.object({
        contentItemId: z.number(),
        imagePrompt: z.string().min(10),
        themeName: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const item = await getContentItem(input.contentItemId);
        if (!item) throw new TRPCError({ code: 'NOT_FOUND', message: 'Content item not found' });

        // Generate the new hero image
        let newImageUrl: string | undefined;
        try {
          const { url } = await generateImage({ prompt: input.imagePrompt });
          newImageUrl = url;
        } catch (err) {
          throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: `Image generation failed: ${err instanceof Error ? err.message : String(err)}` });
        }

        if (!newImageUrl) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Image generation returned no URL' });

        // Update the content item with the new image
        await updateContentItem(input.contentItemId, {
          imageUrl: newImageUrl,
          imagePrompt: input.imagePrompt,
        });

        return { imageUrl: newImageUrl, themeName: input.themeName ?? 'Custom' };
      }),

    // Bulk validate all published blog posts and fix mismatched utm_campaign slugs
    bulkFixCampaigns: protectedProcedure
      .input(z.object({
        dryRun: z.boolean().optional().default(false),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
        const { contentItems } = await import("../drizzle/schema");
        const { eq, and, isNotNull } = await import("drizzle-orm");
        const { validateCampaignSlug, ctaLabelToCampaign } = await import("./ctaRouter");
        // Fetch all published blog posts with text content
        const posts = await db.select().from(contentItems).where(
          and(
            eq(contentItems.platform, "blog"),
            isNotNull(contentItems.textContent)
          )
        );
        let fixed = 0;
        let skipped = 0;
        const results: Array<{ id: number; title: string; oldSlug: string; newSlug: string }> = [];
        for (const post of posts) {
          if (!post.textContent) { skipped++; continue; }
          const matches = post.textContent.match(/utm_campaign=([^&"'\s]+)/g);
          if (!matches) { skipped++; continue; }
          const currentSlug = matches[0].replace("utm_campaign=", "");
          if (validateCampaignSlug(currentSlug)) { skipped++; continue; }
          // Derive the correct slug from the post title/ctaBlockLabel
          const correctSlug = ctaLabelToCampaign(post.ctaBlockLabel ?? post.title ?? "");
          if (!input.dryRun) {
            const updated = post.textContent.replace(
              /utm_campaign=([^&"'\s]+)/g,
              `utm_campaign=${correctSlug}`
            );
            await updateContentItem(post.id, { textContent: updated });
          }
          results.push({ id: post.id, title: post.title, oldSlug: currentSlug, newSlug: correctSlug });
          fixed++;
        }
        return { fixed, skipped, total: posts.length, results, dryRun: input.dryRun ?? false };
      }),

    // ── Pre-Publish SEO Validator ─────────────────────────────────────────────────────────────────────
    // Returns a structured SEO score for a content item before it is published to WordPress.
    // Each check returns a status of "green" | "amber" | "red" and a human-readable message.
    // Used by the Kanban card SEO badge panel and the card detail publish section.
    validateSeo: protectedProcedure
      .input(z.object({
        contentItemId: z.number(),
      }))
      .query(async ({ input }) => {
        const { getContentItem } = await import("./db");
        const item = await getContentItem(input.contentItemId);
        if (!item) throw new TRPCError({ code: "NOT_FOUND", message: "Content item not found" });

        type SeoStatus = "green" | "amber" | "red";
        type SeoCheck = { status: SeoStatus; label: string; value: string; message: string };

        const checks: SeoCheck[] = [];

        // 1. SEO Title length (Yoast green: ≤60 chars, amber: 61-70, red: >70 or missing)
        const seoTitle = item.yoastSeoTitle ?? `${item.title} | The Urban Monk`;
        const titleLen = seoTitle.length;
        checks.push({
          status: titleLen <= 60 ? "green" : titleLen <= 70 ? "amber" : "red",
          label: "SEO Title",
          value: `${titleLen} chars`,
          message: titleLen <= 60
            ? `${titleLen} chars — perfect`
            : titleLen <= 70
            ? `${titleLen} chars — slightly long (aim for ≤60)`
            : `${titleLen} chars — too long (Yoast red zone, must be ≤60)`,
        });

        // 2. Meta description length (green: 140-155, amber: 120-139 or 156-160, red: <120 or >160 or missing)
        const metaDesc = item.yoastMetaDescription ?? "";
        const metaLen = metaDesc.length;
        const metaStatus: SeoStatus = !metaDesc
          ? "red"
          : metaLen >= 140 && metaLen <= 155
          ? "green"
          : metaLen >= 120 && metaLen <= 160
          ? "amber"
          : "red";
        checks.push({
          status: metaStatus,
          label: "Meta Desc",
          value: metaDesc ? `${metaLen} chars` : "missing",
          message: !metaDesc
            ? "Missing — required for Yoast green"
            : metaLen >= 140 && metaLen <= 155
            ? `${metaLen} chars — perfect`
            : metaLen > 155 && metaLen <= 160
            ? `${metaLen} chars — slightly over (trim to ≤155)`
            : metaLen > 160
            ? `${metaLen} chars — too long (Yoast red zone)`
            : `${metaLen} chars — too short (aim for 140-155)`,
        });

        // 3. Focus keyphrase in body (green: present ≥8 times, amber: 3-7, red: 0-2 or missing keyphrase)
        const focusKw = item.focusKeyword ?? null;
        if (!focusKw) {
          checks.push({
            status: "red",
            label: "Keyphrase",
            value: "missing",
            message: "No focus keyphrase set — required for Yoast",
          });
        } else {
          const body = item.textContent ?? "";
          const kwLower = focusKw.toLowerCase();
          const occurrences = (body.toLowerCase().match(new RegExp(kwLower.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g")) ?? []).length;
          const kwStatus: SeoStatus = occurrences >= 8 ? "green" : occurrences >= 3 ? "amber" : "red";
          checks.push({
            status: kwStatus,
            label: "Keyphrase",
            value: `${occurrences}×`,
            message: occurrences >= 8
              ? `Found ${occurrences} times — good density`
              : occurrences >= 3
              ? `Found ${occurrences} times — aim for 8+`
              : `Found only ${occurrences} times — needs more occurrences`,
          });
        }

        // 4. Keyphrase in H2 subheadings (green: at least 1 H2 contains it, red: none do)
        // Supports both Markdown (## heading) and HTML (<h2>/<h3>) content
        if (!focusKw) {
          checks.push({
            status: "red",
            label: "H2 Subheading",
            value: "no keyphrase",
            message: "Set a focus keyphrase first",
          });
        } else {
          const body = item.textContent ?? "";
          const kwLower = focusKw.toLowerCase();
          // Check Markdown headings (## and ###)
          const mdH2Lines = body.split("\n").filter((l) => l.startsWith("## ") || l.startsWith("### "));
          const keyphraseInMdH2 = mdH2Lines.some((l) => l.toLowerCase().includes(kwLower));
          // Check HTML headings (<h2> and <h3>)
          const htmlHeadingRegex = /<h[23][^>]*>(.*?)<\/h[23]>/gi;
          const htmlHeadingTexts = Array.from(body.matchAll(htmlHeadingRegex)).map((m) =>
            m[1].replace(/<[^>]+>/g, "").toLowerCase()
          );
          const keyphraseInHtmlH2 = htmlHeadingTexts.some((t) => t.includes(kwLower));
          const keyphraseInH2 = keyphraseInMdH2 || keyphraseInHtmlH2;
          checks.push({
            status: keyphraseInH2 ? "green" : "red",
            label: "H2 Subheading",
            value: keyphraseInH2 ? "found" : "missing",
            message: keyphraseInH2
              ? "Keyphrase found in at least one H2"
              : "Keyphrase missing from all H2 headings — click Fix Now to auto-inject",
          });
        }

        // 5. Meta description contains focus keyphrase (green: yes, red: no)
        if (focusKw && metaDesc) {
          const kwInMeta = metaDesc.toLowerCase().includes(focusKw.toLowerCase());
          checks.push({
            status: kwInMeta ? "green" : "amber",
            label: "Keyphrase in Meta",
            value: kwInMeta ? "yes" : "no",
            message: kwInMeta
              ? "Keyphrase found in meta description"
              : "Keyphrase missing from meta desc — auto-prepended at publish time",
          });
        }

        const overallStatus: SeoStatus = checks.some((c) => c.status === "red")
          ? "red"
          : checks.some((c) => c.status === "amber")
          ? "amber"
          : "green";

        return { checks, overallStatus, focusKeyword: focusKw, title: item.title };
      }),

    // ── Bulk H2 Keyphrase Backfill ──────────────────────────────────────────────────────────────────
    // Scans all published blog posts, finds those where the focus keyphrase is missing
    // from all H2 headings, rewrites the 3rd H2 to include it, saves to DB, and pushes
    // the updated HTML to WordPress. Safe to run multiple times (idempotent).
    bulkFixH2Keyphrases: protectedProcedure
      .input(z.object({ dryRun: z.boolean().optional().default(false) }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
        const { contentItems } = await import("../drizzle/schema");
        const { eq, and, isNotNull } = await import("drizzle-orm");

        const published = await db
          .select()
          .from(contentItems)
          .where(and(
            eq(contentItems.platform, "blog"),
            eq(contentItems.status, "published"),
            isNotNull(contentItems.wpPostId),
            isNotNull(contentItems.textContent),
            isNotNull(contentItems.focusKeyword),
          ));

        type FixResult = { id: number; title: string; wpPostId: number; status: "fixed" | "already_ok" | "skipped" | "error"; reason?: string };
        const results: FixResult[] = [];
        let fixed = 0;
        let alreadyOk = 0;
        let skipped = 0;
        let errors = 0;

        for (const item of published) {
          if (!item.wpPostId || !item.textContent || !item.focusKeyword) {
            skipped++;
            results.push({ id: item.id, title: item.title ?? "", wpPostId: item.wpPostId ?? 0, status: "skipped", reason: "missing wpPostId, textContent, or focusKeyword" });
            continue;
          }

          const kw = item.focusKeyword.toLowerCase();
          const h2Lines = item.textContent.split("\n").filter((l) => l.startsWith("## "));
          const keyphraseInH2 = h2Lines.some((l) => l.toLowerCase().includes(kw));

          if (keyphraseInH2) {
            alreadyOk++;
            results.push({ id: item.id, title: item.title ?? "", wpPostId: item.wpPostId, status: "already_ok" });
            continue;
          }

          // Apply the same fix logic as Step 2c in blog.publish
          const h2Regex = /^## .+$/gm;
          const h2Matches = Array.from(item.textContent.matchAll(h2Regex));
          if (h2Matches.length < 2) {
            skipped++;
            results.push({ id: item.id, title: item.title ?? "", wpPostId: item.wpPostId, status: "skipped", reason: "fewer than 2 H2s — cannot safely inject" });
            continue;
          }

          const targetIndex = h2Matches.length >= 3 ? 2 : 1;
          const targetMatch = h2Matches[targetIndex];
          const originalH2 = targetMatch[0];
          const headingText = originalH2.replace(/^## /, "").trim();
          const kwCapitalised = item.focusKeyword.charAt(0).toUpperCase() + item.focusKeyword.slice(1);
          const newHeading = `## ${kwCapitalised}: ${headingText}`;
          const finalHeading = newHeading.length <= 80 ? newHeading : `## How ${kwCapitalised} ${headingText}`;
          const escapedOriginal = originalH2.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
          const patchedBody = item.textContent.replace(new RegExp(escapedOriginal, "m"), finalHeading);
          const patchedHtml = markdownToWpHtml(patchedBody);

          if (!input.dryRun) {
            try {
              await updateContentItem(item.id, { textContent: patchedBody });
              await updateWpPostContent(item.wpPostId, patchedHtml);
              fixed++;
              results.push({ id: item.id, title: item.title ?? "", wpPostId: item.wpPostId, status: "fixed", reason: `"${originalH2}" → "${finalHeading}"` });
            } catch (err: unknown) {
              errors++;
              const msg = err instanceof Error ? err.message : String(err);
              results.push({ id: item.id, title: item.title ?? "", wpPostId: item.wpPostId, status: "error", reason: msg });
            }
          } else {
            fixed++; // count as "would fix" in dry run
            results.push({ id: item.id, title: item.title ?? "", wpPostId: item.wpPostId, status: "fixed", reason: `DRY RUN: "${originalH2}" → "${finalHeading}"` });
          }
        }

        return { fixed, alreadyOk, skipped, errors, total: published.length, dryRun: input.dryRun, results };
      }),

    // ── Fix SEO Issues (Fix Now button) ─────────────────────────────────────────────────────────
    // Triggered by the "Fix Now" button on red/amber SEO badges in the card detail panel.
    // Runs all available auto-fixes for a single content item and pushes to WordPress.
    fixSeoIssues: protectedProcedure
      .input(z.object({ contentItemId: z.number() }))
      .mutation(async ({ input }) => {
        const { getContentItem } = await import("./db");
        const item = await getContentItem(input.contentItemId);
        if (!item) throw new TRPCError({ code: "NOT_FOUND", message: "Content item not found" });

        const fixed: string[] = [];
        let seoTitle = item.yoastSeoTitle ?? `${item.title} | The Urban Monk`;
        let metaDesc = item.yoastMetaDescription ?? "";
        const focusKw = item.focusKeyword ?? null;
        let patchedBody = item.textContent ?? "";

        // Fix 1: SEO title — trim to ≤60 chars
        if (seoTitle.length > 60) {
          if (focusKw) {
            // Rebuild as "Keyphrase | The Urban Monk" (guaranteed ≤60)
            const kwCapitalised = focusKw.charAt(0).toUpperCase() + focusKw.slice(1);
            const candidate = `${kwCapitalised} | The Urban Monk`;
            seoTitle = candidate.length <= 60 ? candidate : candidate.slice(0, 57) + "…";
          } else {
            seoTitle = seoTitle.slice(0, 57) + "…";
          }
          fixed.push("seo_title_trimmed");
        }

        // Fix 2: Meta description — trim to 140-155 chars
        if (metaDesc.length > 155) {
          // Trim at last word boundary before 155
          const trimmed = metaDesc.slice(0, 155);
          const lastSpace = trimmed.lastIndexOf(" ");
          metaDesc = lastSpace > 100 ? trimmed.slice(0, lastSpace) : trimmed;
          fixed.push("meta_desc_trimmed");
        } else if (!metaDesc && focusKw && item.textContent) {
          // Generate a basic meta desc from the first paragraph if missing
          const firstPara = item.textContent.split("\n").find((l) => l.trim().length > 80 && !l.startsWith("#") && !l.startsWith("-"));
          if (firstPara) {
            const candidate = `${focusKw.charAt(0).toUpperCase() + focusKw.slice(1)}: ${firstPara.trim()}`;
            metaDesc = candidate.length <= 155 ? candidate : candidate.slice(0, 152) + "…";
            fixed.push("meta_desc_generated");
          }
        }

        // Fix 3: Ensure focus keyphrase is in meta desc
        if (focusKw && metaDesc && !metaDesc.toLowerCase().includes(focusKw.toLowerCase())) {
          const candidate = `${focusKw}: ${metaDesc}`;
          metaDesc = candidate.length <= 155 ? candidate : candidate.slice(0, 152) + "…";
          fixed.push("meta_desc_keyphrase_added");
        }

        // Fix 4: H2 keyphrase injection
        // For published posts (wpPostId present): fetch live HTML from WP and patch HTML headings.
        // For draft posts: patch the Markdown in textContent.
        let patchedWpHtml: string | null = null;
        if (focusKw && patchedBody) {
          const kw = focusKw.toLowerCase();
          const kwEsc = kw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
          const kwRegex = new RegExp(`(?:^|[^a-z0-9])${kwEsc}(?:[^a-z0-9]|$)`, "i");

          if (item.wpPostId) {
            // Published post — fetch live HTML and patch HTML headings
            try {
              const { fetchSingleWpPost } = await import("./wordpress");
              const livePost = await fetchSingleWpPost(item.wpPostId);
              let wpHtml = livePost.content;
              const htmlHeadingRegex = /<(h[23])(\s[^>]*)?>((?:[\s\S])*?)<\/h[23]>/gi;
              const htmlHeadings = Array.from(wpHtml.matchAll(htmlHeadingRegex));
              const stripTags = (s: string) => s.replace(/<[^>]+>/g, "").trim();
              const keyphraseInHtmlH2 = htmlHeadings.some((m) => kwRegex.test(stripTags(m[3])));
              if (!keyphraseInHtmlH2 && htmlHeadings.length > 0) {
                const htmlH2s = htmlHeadings.filter((m) => m[1].toLowerCase() === "h2");
                const targetIndex = htmlH2s.length >= 3 ? 2 : htmlH2s.length >= 2 ? 1 : 0;
                const targetMatch = htmlH2s[targetIndex] ?? htmlHeadings[0];
                const originalTag = targetMatch[0];
                const tagName = targetMatch[1];
                const tagAttrs = targetMatch[2] ?? "";
                const headingText = stripTags(targetMatch[3]);
                const kwCapitalised = focusKw.charAt(0).toUpperCase() + focusKw.slice(1);
                const candidateText = `${kwCapitalised}: ${headingText}`;
                const finalText = candidateText.length <= 80 ? candidateText : kwCapitalised;
                const finalTag = `<${tagName}${tagAttrs}>${finalText}</${tagName}>`;
                const escapedOriginal = originalTag.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
                wpHtml = wpHtml.replace(new RegExp(escapedOriginal), finalTag);
                patchedWpHtml = wpHtml;
                fixed.push("h2_keyphrase_injected");
              }
            } catch (e) {
              console.warn("[fixSeoIssues] Could not fetch live WP post for H2 fix:", e);
            }
          } else {
            // Draft post — patch Markdown headings in textContent
            const h2Regex = /^## .+$/gm;
            const h2Matches = Array.from(patchedBody.matchAll(h2Regex));
            const keyphraseInH2 = h2Matches.some((m) => m[0].toLowerCase().includes(kw));
            if (!keyphraseInH2 && h2Matches.length >= 2) {
              const targetIndex = h2Matches.length >= 3 ? 2 : 1;
              const originalH2 = h2Matches[targetIndex][0];
              const headingText = originalH2.replace(/^## /, "").trim();
              const kwCapitalised = focusKw.charAt(0).toUpperCase() + focusKw.slice(1);
              const newHeading = `## ${kwCapitalised}: ${headingText}`;
              const finalHeading = newHeading.length <= 80 ? newHeading : `## How ${kwCapitalised} ${headingText}`;
              const escapedOriginal = originalH2.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
              patchedBody = patchedBody.replace(new RegExp(escapedOriginal, "m"), finalHeading);
              fixed.push("h2_keyphrase_injected");
            }
          }
        }

        if (fixed.length === 0) {
          return { fixed, message: "No issues found — all checks already passing" };
        }

        // Persist to DB
        await updateContentItem(item.id, {
          yoastSeoTitle: seoTitle,
          yoastMetaDescription: metaDesc,
          ...(!item.wpPostId && fixed.includes("h2_keyphrase_injected") ? { textContent: patchedBody } : {}),
        });

        // Push to WordPress if the post is already published there
        if (item.wpPostId) {
          await updateWpPostYoast({
            wpPostId: item.wpPostId,
            seoTitle,
            metaDescription: metaDesc,
            focusKeyword: focusKw ?? undefined,
          });
          if (patchedWpHtml) {
            await updateWpPostContent(item.wpPostId, patchedWpHtml);
          }
        }

        return { fixed, message: `Fixed: ${fixed.join(", ")}` };
      }),

    // ── Fix Yoast Issues (one-click button for live WP posts) ──────────────────────────────────────
    // Re-runs Step 2c (H2 keyphrase injection) and Step 4b (meta description enforcement)
    // on the LIVE WordPress post without regenerating the full article.
    // Fetches the current HTML from WordPress, applies both fixes, and writes back.
    fixYoastIssues: protectedProcedure
      .input(z.object({
        contentItemId: z.number(),
        wpPostId: z.number(),
      }))
      .mutation(async ({ input }) => {
        const { fetchSingleWpPost } = await import("./wordpress");
        const item = await getContentItem(input.contentItemId);
        if (!item) throw new TRPCError({ code: "NOT_FOUND", message: "Content item not found" });

        // Use the focus keyword from DB (most authoritative source)
        const focusKw = item.focusKeyword ?? null;

        // Fetch the live HTML from WordPress
        const livePost = await fetchSingleWpPost(input.wpPostId);
        let wpHtmlBody = livePost.content;

        // Determine meta description: prefer DB value, fall back to live WP value
        let metaDesc = item.yoastMetaDescription ?? livePost.metaDescription ?? "";
        let seoTitle = item.yoastSeoTitle ?? livePost.seoTitle ?? `${item.title} | The Urban Monk`;

        const fixed: string[] = [];

        // ── Re-run Step 2c: H2/H3 keyphrase injection ────────────────────────────
        if (focusKw && wpHtmlBody) {
          const kw = focusKw.toLowerCase();
          const kwEscaped = kw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
          const kwRegex = new RegExp(`(?:^|[^a-z0-9])${kwEscaped}(?:[^a-z0-9]|$)`, "i");
          const htmlHeadingRegex = /<(h[23])(\s[^>]*)?>((?:[\s\S])*?)<\/h[23]>/gi;
          const htmlHeadings = Array.from(wpHtmlBody.matchAll(htmlHeadingRegex));
          const htmlH2s = htmlHeadings.filter((m) => m[1].toLowerCase() === "h2");
          const stripTags = (s: string) => s.replace(/<[^>]+>/g, "").trim();
          const keyphraseInSubheading = htmlHeadings.some((m) => kwRegex.test(stripTags(m[3])));

          if (!keyphraseInSubheading && (htmlH2s.length > 0 || htmlHeadings.length > 0)) {
            const targetIndex = htmlH2s.length >= 3 ? 2 : htmlH2s.length >= 2 ? 1 : 0;
            const targetMatch = htmlH2s[targetIndex] ?? htmlHeadings[0];
            if (targetMatch) {
              const originalTag = targetMatch[0];
              const tagName = targetMatch[1];
              const tagAttrs = targetMatch[2] ?? "";
              const headingText = stripTags(targetMatch[3]);
              const kwCapitalised = focusKw.charAt(0).toUpperCase() + focusKw.slice(1);
              const candidateText = `${kwCapitalised}: ${headingText}`;
              const finalText = candidateText.length <= 80 ? candidateText : kwCapitalised;
              const finalTag = `<${tagName}${tagAttrs}>${finalText}</${tagName}>`;
              const escapedOriginal = originalTag.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
              wpHtmlBody = wpHtmlBody.replace(new RegExp(escapedOriginal), finalTag);
              fixed.push(`h2_keyphrase_injected: "${headingText}" → "${finalText}"`);
            }
          } else if (keyphraseInSubheading) {
            fixed.push("h2_already_ok");
          }
        }

        // ── Re-run Step 4b: meta description enforcement ─────────────────────────
        const trimToWordBoundary = (s: string, maxLen: number): string => {
          if (s.length <= maxLen) return s;
          let t = s.slice(0, maxLen);
          const sp = t.lastIndexOf(" ");
          if (sp > 0) t = t.slice(0, sp);
          return t.trimEnd().replace(/[,;:\-\u2013\u2014]$/, "").trimEnd();
        };

        if (focusKw && metaDesc) {
          const kwLower = focusKw.toLowerCase();
          const hasKw = metaDesc.toLowerCase().includes(kwLower);
          if (!hasKw) {
            const prefix = `${focusKw}: `;
            const maxBodyLen = 148 - prefix.length;
            const trimmedBody = trimToWordBoundary(metaDesc, maxBodyLen);
            metaDesc = (prefix + trimmedBody).trimEnd().replace(/[,;:\-\u2013\u2014]$/, "").trimEnd();
            fixed.push("meta_desc_keyphrase_prepended");
          } else {
            metaDesc = trimToWordBoundary(metaDesc, 148);
            if (metaDesc !== (item.yoastMetaDescription ?? "")) fixed.push("meta_desc_trimmed");
          }
        } else if (metaDesc) {
          metaDesc = trimToWordBoundary(metaDesc, 148);
        }
        // Hard safety net
        if (metaDesc.length > 155) {
          const sp = metaDesc.slice(0, 148).lastIndexOf(" ");
          metaDesc = (sp > 0 ? metaDesc.slice(0, sp) : metaDesc.slice(0, 148)).trimEnd().replace(/[,;:\-\u2013\u2014]$/, "").trimEnd();
          fixed.push("meta_desc_force_truncated");
        }

        // ── Push both fixes to WordPress ─────────────────────────────────────────
        await updateWpPostContent(input.wpPostId, wpHtmlBody);
        await updateWpPostYoast({
          wpPostId: input.wpPostId,
          seoTitle: seoTitle || undefined,
          metaDescription: metaDesc || undefined,
          focusKeyword: focusKw ?? undefined,
        });

        // ── Persist updated meta desc to DB ──────────────────────────────────────
        await updateContentItem(input.contentItemId, {
          yoastMetaDescription: metaDesc,
        });

        // ── Refresh Yoast score after a short delay ───────────────────────────────
        setTimeout(async () => {
          try {
            const { getWpYoastScore } = await import("./wordpress");
            const { seoScore } = await getWpYoastScore(input.wpPostId);
            if (seoScore) {
              await updateContentItem(input.contentItemId, {
                yoastScore: seoScore,
                yoastScoreFetchedAt: Date.now(),
              });
            }
          } catch { /* non-fatal */ }
        }, 5_000);

        return {
          success: true,
          fixed,
          message: fixed.filter(f => !f.endsWith("_already_ok")).length === 0
            ? "No issues found — H2 keyphrase and meta description are already correct"
            : `Fixed: ${fixed.filter(f => !f.endsWith("_already_ok")).join(", ")}`,
          metaDesc,
        };
      }),

    // ── Bulk Fix Yoast Issues ──────────────────────────────────────────────────────────────────────
    // Iterates all published blog posts that have a wpPostId and runs fixYoastIssues on each.
    // Same logic as the single-post fixYoastIssues but batched.
    bulkFixYoastIssues: protectedProcedure
      .mutation(async () => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
        const { contentItems } = await import("../drizzle/schema");
        const { eq, and, isNotNull } = await import("drizzle-orm");
        const { fetchSingleWpPost } = await import("./wordpress");

        const published = await db
          .select()
          .from(contentItems)
          .where(and(
            eq(contentItems.platform, "blog"),
            eq(contentItems.status, "published"),
            isNotNull(contentItems.wpPostId),
            isNotNull(contentItems.focusKeyword),
          ));

        type BulkResult = { id: number; title: string; wpPostId: number; status: "fixed" | "already_ok" | "error"; fixed: string[]; error?: string };
        const results: BulkResult[] = [];
        let fixedCount = 0;
        let alreadyOkCount = 0;
        let errorCount = 0;

        const trimToWordBoundary = (s: string, maxLen: number): string => {
          if (s.length <= maxLen) return s;
          let t = s.slice(0, maxLen);
          const sp = t.lastIndexOf(" ");
          if (sp > 0) t = t.slice(0, sp);
          return t.trimEnd().replace(/[,;:\-\u2013\u2014]$/, "").trimEnd();
        };

        // Process a single post — returns a BulkResult
        const processPost = async (item: (typeof published)[number]): Promise<BulkResult> => {
          if (!item.wpPostId || !item.focusKeyword) {
            return { id: item.id, title: item.title, wpPostId: item.wpPostId ?? 0, status: "already_ok", fixed: [] };
          }
          const fixedFields: string[] = [];
          try {
            const livePost = await fetchSingleWpPost(item.wpPostId);
            let wpHtmlBody = livePost.content;
            const focusKw = item.focusKeyword;
            let metaDesc = item.yoastMetaDescription ?? livePost.metaDescription ?? "";
            const seoTitle = item.yoastSeoTitle ?? livePost.seoTitle ?? `${item.title} | The Urban Monk`;

            // Step 2c: H2 keyphrase injection
            if (focusKw && wpHtmlBody) {
              const kw = focusKw.toLowerCase();
              const kwEscaped = kw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
              const kwRegex = new RegExp(`(?:^|[^a-z0-9])${kwEscaped}(?:[^a-z0-9]|$)`, "i");
              const htmlHeadingRegex = /<(h[23])(\s[^>]*)?>((?: [\s\S])*?)<\/h[23]>/gi;
              const htmlHeadings = Array.from(wpHtmlBody.matchAll(htmlHeadingRegex));
              const htmlH2s = htmlHeadings.filter((m) => m[1].toLowerCase() === "h2");
              const stripTags = (s: string) => s.replace(/<[^>]+>/g, "").trim();
              const keyphraseInSubheading = htmlHeadings.some((m) => kwRegex.test(stripTags(m[3])));

              if (!keyphraseInSubheading && (htmlH2s.length > 0 || htmlHeadings.length > 0)) {
                const targetIndex = htmlH2s.length >= 3 ? 2 : htmlH2s.length >= 2 ? 1 : 0;
                const targetMatch = htmlH2s[targetIndex] ?? htmlHeadings[0];
                if (targetMatch) {
                  const originalTag = targetMatch[0];
                  const tagName = targetMatch[1];
                  const tagAttrs = targetMatch[2] ?? "";
                  const headingText = stripTags(targetMatch[3]);
                  const kwCapitalised = focusKw.charAt(0).toUpperCase() + focusKw.slice(1);
                  const candidateText = `${kwCapitalised}: ${headingText}`;
                  const finalText = candidateText.length <= 80 ? candidateText : kwCapitalised;
                  const finalTag = `<${tagName}${tagAttrs}>${finalText}</${tagName}>`;
                  const escapedOriginal = originalTag.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
                  wpHtmlBody = wpHtmlBody.replace(new RegExp(escapedOriginal), finalTag);
                  fixedFields.push(`h2_keyphrase_injected`);
                }
              }
            }

            // Step 4b: meta description enforcement
            if (focusKw && metaDesc) {
              const kwLower = focusKw.toLowerCase();
              const hasKw = metaDesc.toLowerCase().includes(kwLower);
              if (!hasKw) {
                const prefix = `${focusKw}: `;
                const maxBodyLen = 148 - prefix.length;
                const trimmedBody = trimToWordBoundary(metaDesc, maxBodyLen);
                metaDesc = (prefix + trimmedBody).trimEnd().replace(/[,;:\-\u2013\u2014]$/, "").trimEnd();
                fixedFields.push("meta_desc_keyphrase_prepended");
              } else {
                const trimmed = trimToWordBoundary(metaDesc, 148);
                if (trimmed !== metaDesc) { metaDesc = trimmed; fixedFields.push("meta_desc_trimmed"); }
              }
            } else if (metaDesc) {
              metaDesc = trimToWordBoundary(metaDesc, 148);
            }
            if (metaDesc.length > 155) {
              const sp = metaDesc.slice(0, 148).lastIndexOf(" ");
              metaDesc = (sp > 0 ? metaDesc.slice(0, sp) : metaDesc.slice(0, 148)).trimEnd().replace(/[,;:\-\u2013\u2014]$/, "").trimEnd();
              fixedFields.push("meta_desc_force_truncated");
            }

            // Push to WordPress — run content + Yoast updates in parallel
            const now = Date.now();
            await Promise.all([
              updateWpPostContent(item.wpPostId, wpHtmlBody),
              updateWpPostYoast({
                wpPostId: item.wpPostId,
                seoTitle: seoTitle || undefined,
                metaDescription: metaDesc || undefined,
                focusKeyword: focusKw || undefined,
              }),
            ]);

            // Mark as fixed in DB
            await updateContentItem(item.id, {
              yoastMetaDescription: metaDesc,
              yoastFixedAt: now,
            });

            if (fixedFields.length === 0) {
              return { id: item.id, title: item.title, wpPostId: item.wpPostId, status: "already_ok", fixed: [] };
            } else {
              return { id: item.id, title: item.title, wpPostId: item.wpPostId, status: "fixed", fixed: fixedFields };
            }
          } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : String(err);
            return { id: item.id, title: item.title, wpPostId: item.wpPostId ?? 0, status: "error", fixed: [], error: msg };
          }
        };

        // Process in parallel batches of 5 to stay well within gateway timeouts
        // (5 posts × ~2s each = ~10s per batch; 69 posts / 5 = ~14 batches = ~140s total)
        const BATCH_SIZE = 5;
        for (let i = 0; i < published.length; i += BATCH_SIZE) {
          const batch = published.slice(i, i + BATCH_SIZE);
          const batchResults = await Promise.all(batch.map(processPost));
          for (const r of batchResults) {
            results.push(r);
            if (r.status === "fixed") fixedCount++;
            else if (r.status === "already_ok") alreadyOkCount++;
            else errorCount++;
          }
        }

        return { results, fixedCount, alreadyOkCount, errorCount, total: published.length };
      }),

    // ── Readability Analysis ───────────────────────────────────────────────────────────────────────
    // Analyses the Markdown body of a content item for Yoast readability checks:
    //   1. Transition word percentage (Yoast green ≥30%)
    //   2. Consecutive sentence starts (Yoast red: any word starts 3+ sentences in a row)
    // Returns structured results for the SeoValidatorPanel.
    analyzeReadability: protectedProcedure
      .input(z.object({ contentItemId: z.number() }))
      .query(async ({ input }) => {
        const item = await getContentItem(input.contentItemId);
        if (!item || !item.textContent) return null;

        const body = item.textContent;

        // ── Sentence tokenisation ────────────────────────────────────────────────
        // Split on sentence-ending punctuation followed by whitespace or end-of-string.
        // Exclude heading lines (starting with #) and blank lines.
        const lines = body.split("\n").filter((l) => {
          const t = l.trim();
          return t.length > 0 && !t.startsWith("#") && !t.startsWith("-") && !t.startsWith("|") && !t.startsWith(">");
        });
        const rawText = lines.join(" ");
        // Split on . ! ? followed by space or end
        const sentences = rawText
          .split(/(?<=[.!?])\s+/)
          .map((s) => s.trim())
          .filter((s) => s.length > 10); // ignore very short fragments

        const totalSentences = sentences.length;

        // ── Transition word check ────────────────────────────────────────────────
        const TRANSITION_WORDS = [
          "however", "therefore", "as a result", "in addition", "furthermore",
          "meanwhile", "for example", "in contrast", "consequently", "first",
          "second", "third", "finally", "in fact", "specifically", "most importantly",
          "in other words", "that said", "even so", "because of this", "at the same time",
          "to be clear", "in practice", "over time", "in short", "additionally",
          "moreover", "notably", "instead", "still", "yet", "thus", "hence",
          "indeed", "otherwise", "likewise", "similarly", "afterward", "previously",
          "ultimately", "essentially", "particularly", "importantly", "fortunately",
          "unfortunately", "surprisingly", "although", "while", "since", "because",
          "unless", "until", "when", "after", "before", "also", "but", "so",
        ];
        let transitionCount = 0;
        for (const s of sentences) {
          const lower = s.toLowerCase();
          if (TRANSITION_WORDS.some((tw) => lower.includes(tw))) transitionCount++;
        }
        const transitionPct = totalSentences > 0 ? Math.round((transitionCount / totalSentences) * 100) : 0;
        const transitionStatus: "green" | "amber" | "red" =
          transitionPct >= 30 ? "green" : transitionPct >= 20 ? "amber" : "red";

        // ── Consecutive sentence starts check ────────────────────────────────────
        // Find the first word of each sentence and look for runs of 3+
        const firstWords = sentences.map((s) => {
          const m = s.match(/^([A-Za-z]+)/);
          return m ? m[1].toLowerCase() : "";
        }).filter(Boolean);

        let maxRun = 1;
        let currentRun = 1;
        let worstWord = "";
        let violationCount = 0;
        for (let i = 1; i < firstWords.length; i++) {
          if (firstWords[i] === firstWords[i - 1]) {
            currentRun++;
            if (currentRun >= 3 && currentRun > maxRun) {
              maxRun = currentRun;
              worstWord = firstWords[i];
            }
            if (currentRun === 3) violationCount++; // count each new violation group
          } else {
            currentRun = 1;
          }
        }
        const consecutiveStatus: "green" | "amber" | "red" =
          maxRun < 3 ? "green" : maxRun === 3 ? "amber" : "red";

        return {
          totalSentences,
          transitionCount,
          transitionPct,
          transitionStatus,
          consecutiveStatus,
          maxRun,
          worstWord: worstWord || null,
          violationCount,
        };
      }),

    // ── Bulk Readability Audit ────────────────────────────────────────────────
    // Returns readability scores for ALL published blog posts in one query.
    // Used by the Readability Audit table and the Kanban card R-badge.
    bulkAnalyzeReadability: protectedProcedure
      .query(async () => {
        const db = await getDb();
        if (!db) throw new Error("Database unavailable");
        const { contentItems } = await import("../drizzle/schema");
        const { eq, and, isNotNull } = await import("drizzle-orm");

        const posts = await db
          .select()
          .from(contentItems)
          .where(
            and(
              eq(contentItems.platform, "blog"),
              eq(contentItems.status, "published"),
              isNotNull(contentItems.textContent),
            )
          );

        const TRANSITION_WORDS = [
          "however", "therefore", "as a result", "in addition", "furthermore",
          "meanwhile", "for example", "in contrast", "consequently", "first",
          "second", "third", "finally", "in fact", "specifically", "most importantly",
          "in other words", "that said", "even so", "because of this", "at the same time",
          "to be clear", "in practice", "over time", "in short", "additionally",
          "moreover", "notably", "instead", "still", "yet", "thus", "hence",
          "indeed", "otherwise", "likewise", "similarly", "afterward", "previously",
          "ultimately", "essentially", "particularly", "importantly", "fortunately",
          "unfortunately", "surprisingly", "although", "while", "since", "because",
          "unless", "until", "when", "after", "before", "also", "but", "so",
        ];

        const analyzeOne = (body: string) => {
          const lines = body.split("\n").filter((l) => {
            const t = l.trim();
            return t.length > 0 && !t.startsWith("#") && !t.startsWith("-") && !t.startsWith("|") && !t.startsWith(">");
          });
          const rawText = lines.join(" ");
          const sentences = rawText
            .split(/(?<=[.!?])\s+/)
            .map((s) => s.trim())
            .filter((s) => s.length > 10);

          const totalSentences = sentences.length;
          let transitionCount = 0;
          for (const s of sentences) {
            const lower = s.toLowerCase();
            if (TRANSITION_WORDS.some((tw) => lower.includes(tw))) transitionCount++;
          }
          const transitionPct = totalSentences > 0 ? Math.round((transitionCount / totalSentences) * 100) : 0;
          const transitionStatus: "green" | "amber" | "red" =
            transitionPct >= 30 ? "green" : transitionPct >= 20 ? "amber" : "red";

          const firstWords = sentences.map((s) => {
            const m = s.match(/^([A-Za-z]+)/);
            return m ? m[1].toLowerCase() : "";
          }).filter(Boolean);

          let maxRun = 1;
          let currentRun = 1;
          let worstWord = "";
          let violationCount = 0;
          for (let i = 1; i < firstWords.length; i++) {
            if (firstWords[i] === firstWords[i - 1]) {
              currentRun++;
              if (currentRun >= 3 && currentRun > maxRun) {
                maxRun = currentRun;
                worstWord = firstWords[i];
              }
              if (currentRun === 3) violationCount++;
            } else {
              currentRun = 1;
            }
          }
          const consecutiveStatus: "green" | "amber" | "red" =
            maxRun < 3 ? "green" : maxRun === 3 ? "amber" : "red";

          // Overall readability badge: worst of the two checks
          const overall: "green" | "amber" | "red" =
            transitionStatus === "red" || consecutiveStatus === "red" ? "red"
            : transitionStatus === "amber" || consecutiveStatus === "amber" ? "amber"
            : "green";

          return { totalSentences, transitionCount, transitionPct, transitionStatus, consecutiveStatus, maxRun, worstWord: worstWord || null, violationCount, overall };
        };

        const results = posts.map((p) => ({
          id: p.id,
          title: p.title,
          focusKeyword: p.focusKeyword,
          publishUrl: p.publishUrl,
          wpPostId: p.wpPostId,
          ...analyzeOne(p.textContent ?? ""),
        }));

        // Persist scores back to DB for instant Kanban badge loading
        const now = Date.now();
        for (const r of results) {
          await db.update(contentItems)
            .set({
              readabilityScore: r.overall,
              readabilityTransitionPct: r.transitionPct,
              readabilityMaxRun: r.maxRun,
              readabilityUpdatedAt: now,
            })
            .where(eq(contentItems.id, r.id));
        }

        // Take a daily snapshot for the trend sparkline
        // Only write one snapshot per calendar day (UTC)
        const { readabilityHistory } = await import("../drizzle/schema");
        const todayLabel = new Date().toISOString().slice(0, 10); // "2026-05-27"
        const existing = await db.select().from(readabilityHistory)
          .where(eq(readabilityHistory.dateLabel, todayLabel))
          .limit(1);
        const counts = { green: 0, amber: 0, red: 0 };
        for (const r of results) counts[r.overall]++;
        if (existing.length === 0) {
          await db.insert(readabilityHistory).values({
            dateLabel: todayLabel,
            greenCount: counts.green,
            amberCount: counts.amber,
            redCount: counts.red,
            totalCount: results.length,
            snapshotAt: now,
          });
        } else {
          // Update today’s snapshot with latest counts
          await db.update(readabilityHistory)
            .set({ greenCount: counts.green, amberCount: counts.amber, redCount: counts.red, totalCount: results.length, snapshotAt: now })
            .where(eq(readabilityHistory.dateLabel, todayLabel));
        }

        return results;
      }),

    // ── Readability Trend ───────────────────────────────────────────────────
    // Returns the last 30 days of readability snapshots for the trend sparkline.
    readabilityTrend: protectedProcedure
      .query(async () => {
        const db = await getDb();
        if (!db) return [];
        const { readabilityHistory } = await import("../drizzle/schema");
        const { desc } = await import("drizzle-orm");
        const rows = await db.select().from(readabilityHistory)
          .orderBy(desc(readabilityHistory.dateLabel))
          .limit(30);
        // Return oldest-first for the chart
        return rows.reverse();
      }),
    // -- Generate Share Copy --
    generateShareCopy: protectedProcedure
      .input(z.object({
        contentItemId: z.number(),
        platform: z.enum(["linkedin", "twitter", "facebook", "instagram"]),
        blogUrl: z.string(),
        title: z.string(),
        focusKeyword: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const { invokeLLM } = await import("./_core/llm");
        const platformRules: Record<string, string> = {
          linkedin: "Write a 150-200 word LinkedIn post. Professional but warm tone. Open with a compelling insight or question. 2-3 short paragraphs. End with a clear CTA to read the full article. Include 3-5 relevant hashtags at the end. Append the blog URL on its own line at the very end.",
          twitter: "Write a punchy X/Twitter post under 280 characters total. Lead with the most surprising or contrarian insight. End with the blog URL. No hashtags unless they fit naturally within the character limit.",
          facebook: "Write a 100-150 word Facebook post. Conversational, warm, community-focused tone. Ask a question or share a relatable scenario. End with a CTA to read more and include the blog URL.",
          instagram: "Write an Instagram caption (150-200 words). Start with a bold hook sentence. Use line breaks for readability. End with a CTA and the blog URL. Include 5-8 relevant hashtags on the last line.",
        };
        const systemPrompt = "You are a social media copywriter for Dr. Pedram Shojai (The Urban Monk). Write in his voice: wise, direct, grounded, and empowering. Never use structural labels. Output only the final post copy - nothing else.";
        const userPrompt = "Write a " + input.platform + " post promoting this blog article:\n\nTitle: " + input.title + "\nFocus keyword: " + (input.focusKeyword ?? "wellness") + "\nBlog URL: " + input.blogUrl + "\n\nPlatform rules: " + platformRules[input.platform];
        const response = await invokeLLM({
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
        });
        const rawContent = response.choices?.[0]?.message?.content ?? "";
        const raw = typeof rawContent === "string" ? rawContent : "";
        const cleaned = raw
          .replace(/^(Hook|CTA|Body|Intro|Outro|Caption|Post|Copy):\s*/gim, "")
          .replace(/^-{3,}\s*$/gm, "")
          .trim();
        return { copy: cleaned };
      }),

    /**
     * Returns all focus keywords already used on published blog posts.
     * Used by the Keyword Strategy UI to flag keyphrase cannibalization
     * before a new post is created — so you never compete with yourself.
     */
    // ── Keith Item 5: Human Review Gate ─────────────────────────────────────────
    // Submit a blog post for human review before it goes to WordPress.
    // Moves the content item to pending_review status.
    submitForReview: protectedProcedure
      .input(z.object({ contentItemId: z.number() }))
      .mutation(async ({ input }) => {
        const item = await getContentItem(input.contentItemId);
        if (!item) throw new TRPCError({ code: "NOT_FOUND", message: "Content item not found" });
        await updateContentItem(input.contentItemId, { status: "pending_review" });
        // Notify owner that a post is awaiting review
        const { notifyOwner } = await import("./_core/notification");
        await notifyOwner({
          title: `Blog Post Awaiting Review: ${item.title}`,
          content: `A new blog post is ready for your review before publishing to WordPress.\n\n**Title:** ${item.title}\n**Focus Keyword:** ${item.focusKeyword ?? "(not set)"}\n\nLog in to the Content Hub to approve or reject it.`,
        });
        return { success: true, newStatus: "pending_review" };
      }),

    // List all content items in pending_review status
    listPendingReview: protectedProcedure.query(async () => {
      const db = await getDb();
      if (!db) return { items: [] };
      const { contentItems } = await import("../drizzle/schema");
      const { eq } = await import("drizzle-orm");
      const items = await db.select().from(contentItems).where(eq(contentItems.status, "pending_review"));
      return { items };
    }),

    // Approve a pending_review post and trigger WordPress publish
    // This is a thin wrapper — it moves status to approved so the existing
    // blog.publish flow can be triggered from the review queue UI.
    approveForPublish: protectedProcedure
      .input(z.object({
        contentItemId: z.number(),
        reviewNotes: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const item = await getContentItem(input.contentItemId);
        if (!item) throw new TRPCError({ code: "NOT_FOUND", message: "Content item not found" });
        await updateContentItem(input.contentItemId, {
          status: "approved",
          reviewNotes: input.reviewNotes ?? "Approved for publish",
        });
        return { success: true, newStatus: "approved" };
      }),

    // Reject a pending_review post and send it back to drafting with feedback
    rejectReview: protectedProcedure
      .input(z.object({
        contentItemId: z.number(),
        reviewNotes: z.string().min(1, "Please provide rejection notes"),
      }))
      .mutation(async ({ input }) => {
        const item = await getContentItem(input.contentItemId);
        if (!item) throw new TRPCError({ code: "NOT_FOUND", message: "Content item not found" });
        await updateContentItem(input.contentItemId, {
          status: "drafting",
          reviewNotes: input.reviewNotes,
        });
        return { success: true, newStatus: "drafting", reviewNotes: input.reviewNotes };
      }),

    // ── Keith Item 6: Article → YouTube Embed Automation ─────────────────────────
    // Search Pedram's YouTube channel for a video matching the article topic.
    // Uses the YouTube Data API v3 search endpoint.
    findMatchingVideo: protectedProcedure
      .input(z.object({
        contentItemId: z.number(),
        searchQuery: z.string().min(3).max(200),
      }))
      .mutation(async ({ input }) => {
        const { getYTClient } = await import("./youtubeRouter");
        const yt = await getYTClient();

        // Search Pedram's channel specifically
        const PEDRAM_CHANNEL_ID = "UCfh9ouEHMBBCGMSJBMiGPrQ"; // The Urban Monk channel

        const searchRes = await yt.search.list({
          part: ["snippet"],
          q: input.searchQuery,
          type: ["video"],
          channelId: PEDRAM_CHANNEL_ID,
          maxResults: 5,
          order: "relevance",
        });

        const items = searchRes.data.items ?? [];
        if (items.length === 0) {
          // Also try a broader search without channel filter
          const broadRes = await yt.search.list({
            part: ["snippet"],
            q: `${input.searchQuery} Pedram Shojai Urban Monk`,
            type: ["video"],
            maxResults: 5,
            order: "relevance",
          });
          const broadItems = broadRes.data.items ?? [];
          if (broadItems.length === 0) {
            await updateContentItem(input.contentItemId, { embeddedYoutubeEmbedStatus: "no_match" });
            return { found: false, videos: [] };
          }
          const videos = broadItems.map((v: any) => ({
            videoId: v.id?.videoId ?? "",
            title: v.snippet?.title ?? "",
            channelTitle: v.snippet?.channelTitle ?? "",
            thumbnail: v.snippet?.thumbnails?.medium?.url ?? "",
            publishedAt: v.snippet?.publishedAt ?? "",
            url: `https://www.youtube.com/watch?v=${v.id?.videoId}`,
          })).filter((v: any) => v.videoId);
          return { found: videos.length > 0, videos };
        }

        const videos = items.map((v: any) => ({
          videoId: v.id?.videoId ?? "",
          title: v.snippet?.title ?? "",
          channelTitle: v.snippet?.channelTitle ?? "",
          thumbnail: v.snippet?.thumbnails?.medium?.url ?? "",
          publishedAt: v.snippet?.publishedAt ?? "",
          url: `https://www.youtube.com/watch?v=${v.id?.videoId}`,
        })).filter((v: any) => v.videoId);

        return { found: videos.length > 0, videos };
      }),

    // Embed a YouTube video into an already-published WordPress post.
    // Injects a responsive YouTube embed block before the first H2 heading.
    embedYouTubeVideo: protectedProcedure
      .input(z.object({
        contentItemId: z.number(),
        videoId: z.string().min(5).max(20),
        videoTitle: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const item = await getContentItem(input.contentItemId);
        if (!item) throw new TRPCError({ code: "NOT_FOUND", message: "Content item not found" });
        if (!item.wpPostId) throw new TRPCError({ code: "BAD_REQUEST", message: "This post has not been published to WordPress yet" });

        const { fetchSingleWpPost, updateWpPostContent } = await import("./wordpress");

        // Fetch the current live post HTML from WordPress
        const livePost = await fetchSingleWpPost(item.wpPostId);
        let html = livePost.content ?? "";

        // Build a responsive YouTube embed block
        const embedHtml = `\n<!-- YouTube Embed: ${input.videoTitle ?? input.videoId} -->\n<figure class="wp-block-embed is-type-video is-provider-youtube wp-block-embed-youtube wp-embed-aspect-16-9 wp-has-aspect-ratio"><div class="wp-block-embed__wrapper">\nhttps://www.youtube.com/watch?v=${input.videoId}\n</div></figure>\n`;

        // Inject before the first <h2> heading (after the intro paragraph)
        const h2Match = html.match(/<h2[\s>]/);
        if (h2Match && h2Match.index !== undefined && h2Match.index > 100) {
          html = html.slice(0, h2Match.index) + embedHtml + html.slice(h2Match.index);
        } else {
          // Fallback: inject after the first </p>
          const pMatch = html.match(/<\/p>/);
          if (pMatch && pMatch.index !== undefined) {
            html = html.slice(0, pMatch.index + 4) + embedHtml + html.slice(pMatch.index + 4);
          } else {
            html = embedHtml + html;
          }
        }

        // Push updated HTML to WordPress
        await updateWpPostContent(item.wpPostId, html);

        // Persist embed status to DB
        await updateContentItem(input.contentItemId, {
          embeddedYoutubeVideoId: input.videoId,
          embeddedYoutubeEmbedStatus: "embedded",
        });

        return {
          success: true,
          videoId: input.videoId,
          wpPostId: item.wpPostId,
          embedUrl: `https://www.youtube.com/watch?v=${input.videoId}`,
        };
      }),

    // Mark a post as skipped for YouTube embed (user chose not to embed)
    skipYouTubeEmbed: protectedProcedure
      .input(z.object({ contentItemId: z.number() }))
      .mutation(async ({ input }) => {
        await updateContentItem(input.contentItemId, { embeddedYoutubeEmbedStatus: "skipped" });
        return { success: true };
      }),

    getUsedFocusKeywords: protectedProcedure.query(async ({ ctx }) => {
      const db = await getDb();
      if (!db) return { keywords: [] };
      const { contentItems } = await import("../drizzle/schema");
      const { eq, and, isNotNull } = await import("drizzle-orm");
      const rows = await db
        .select({
          focusKeyword: contentItems.focusKeyword,
          title: contentItems.title,
          publishUrl: contentItems.publishUrl,
          wpPostId: contentItems.wpPostId,
        })
        .from(contentItems)
        .where(
          and(
            eq(contentItems.platform, "blog"),
            isNotNull(contentItems.focusKeyword),
            // Only flag keywords that are on PUBLISHED posts (live on WordPress).
            // Drafts and in-progress posts should not count as duplicates.
            isNotNull(contentItems.wpPostId)
          )
        );
      // Return normalised lowercase keywords with their post context
      const keywords = rows
        .filter((r: any) => r.focusKeyword)
        .map((r: any) => ({
          keyword: (r.focusKeyword as string).toLowerCase().trim(),
          title: r.title as string,
          publishUrl: r.publishUrl as string | null,
        }));
      return { keywords };
    }),

    // Keith Item 6: Search published blog posts by keyword for the Video Production embed flow
    searchPublishedPosts: protectedProcedure
      .input(z.object({ query: z.string().min(1) }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) return { posts: [] };
        const { like, eq, and, isNotNull } = await import("drizzle-orm");
        const { contentItems } = await import("../drizzle/schema");
        const rows = await db
          .select({
            id: contentItems.id,
            title: contentItems.title,
            wpPostId: contentItems.wpPostId,
            focusKeyword: contentItems.focusKeyword,
            embeddedYoutubeEmbedStatus: contentItems.embeddedYoutubeEmbedStatus,
            embeddedYoutubeVideoId: contentItems.embeddedYoutubeVideoId,
          })
          .from(contentItems)
          .where(
            and(
              eq(contentItems.platform, "blog"),
              eq(contentItems.status, "published"),
              like(contentItems.title, `%${input.query}%`)
            )
          )
          .limit(10);
        return { posts: rows };
      }),

    // ── Edit & Sync: fetch live WP content into the Hub editor ──────────────────
    getWpContent: protectedProcedure
      .input(z.object({ contentItemId: z.number() }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
        const { contentItems } = await import("../drizzle/schema");
        const { eq } = await import("drizzle-orm");
        const [item] = await db.select({ wpPostId: contentItems.wpPostId, title: contentItems.title })
          .from(contentItems).where(eq(contentItems.id, input.contentItemId)).limit(1);
        if (!item?.wpPostId) throw new TRPCError({ code: "NOT_FOUND", message: "No WordPress post linked to this item" });
        const { fetchSingleWpPost } = await import("./wordpress");
        const wpData = await fetchSingleWpPost(item.wpPostId);
        return {
          wpPostId: item.wpPostId,
          title: item.title,
          content: wpData.content,
          focusKeyword: wpData.focusKeyword,
          metaDescription: wpData.metaDescription,
          seoTitle: wpData.seoTitle,
        };
      }),

    // ── Edit & Sync: push edited content back to WordPress ──────────────────────
    syncToWordPress: protectedProcedure
      .input(z.object({
        contentItemId: z.number(),
        htmlContent: z.string(),
        focusKeyword: z.string().optional(),
        metaDescription: z.string().optional(),
        seoTitle: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
        const { contentItems } = await import("../drizzle/schema");
        const { eq } = await import("drizzle-orm");
        const [item] = await db.select({ wpPostId: contentItems.wpPostId })
          .from(contentItems).where(eq(contentItems.id, input.contentItemId)).limit(1);
        if (!item?.wpPostId) throw new TRPCError({ code: "NOT_FOUND", message: "No WordPress post linked to this item" });
        const { updateWpPostContent, updateWpPostYoast } = await import("./wordpress");
        await updateWpPostContent(item.wpPostId, input.htmlContent);
        if (input.focusKeyword !== undefined || input.metaDescription !== undefined || input.seoTitle !== undefined) {
          await updateWpPostYoast({
            wpPostId: item.wpPostId,
            focusKeyword: input.focusKeyword,
            metaDescription: input.metaDescription,
            seoTitle: input.seoTitle,
          });
        }
        // Keep the local content item in sync
        await db.update(contentItems)
          .set({ textContent: input.htmlContent })
          .where(eq(contentItems.id, input.contentItemId));
        return { success: true, wpPostId: item.wpPostId };
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
  utm: utmRouter,
  ingest: ingestGenerateRouter,
  newsfeed: newsfeedRouter,
  viralStudio: viralStudioRouter,
  videoVariant: videoVariantRouter,
  videoSession: videoSessionRouter,
  // ── Verified Internal Linkss ──────────────────────────────────────────────────────────────────────────
  // Curated whitelist of real URLs the AI may use as internal links in blog posts.
  verifiedLinks: router({
    list: protectedProcedure.query(async () => {
      const db = await getDb();
      if (!db) return [];
      const { verifiedLinks } = await import("../drizzle/schema");
      const { asc } = await import("drizzle-orm");
      return db.select().from(verifiedLinks).orderBy(asc(verifiedLinks.createdAt));
    }),

    create: protectedProcedure
      .input(z.object({
        url: z.string().url(),
        title: z.string().min(1).max(512),
        description: z.string().optional(),
        topicTags: z.array(z.string()).optional(),
        active: z.boolean().optional().default(true),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
        const { verifiedLinks } = await import("../drizzle/schema");
        await db.insert(verifiedLinks).values({
          url: input.url,
          title: input.title,
          description: input.description ?? null,
          topicTags: JSON.stringify(input.topicTags ?? []),
          active: input.active ?? true,
        });
        return { success: true };
      }),

    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        url: z.string().url().optional(),
        title: z.string().min(1).max(512).optional(),
        description: z.string().optional(),
        topicTags: z.array(z.string()).optional(),
        active: z.boolean().optional(),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
        const { verifiedLinks } = await import("../drizzle/schema");
        const { eq } = await import("drizzle-orm");
        const updates: Record<string, unknown> = {};
        if (input.url !== undefined) updates.url = input.url;
        if (input.title !== undefined) updates.title = input.title;
        if (input.description !== undefined) updates.description = input.description;
        if (input.topicTags !== undefined) updates.topicTags = JSON.stringify(input.topicTags);
        if (input.active !== undefined) updates.active = input.active;
        await db.update(verifiedLinks).set(updates).where(eq(verifiedLinks.id, input.id));
        return { success: true };
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
        const { verifiedLinks } = await import("../drizzle/schema");
        const { eq } = await import("drizzle-orm");
        await db.delete(verifiedLinks).where(eq(verifiedLinks.id, input.id));
        return { success: true };
      }),

    toggleActive: protectedProcedure
      .input(z.object({ id: z.number(), active: z.boolean() }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
        const { verifiedLinks } = await import("../drizzle/schema");
        const { eq } = await import("drizzle-orm");
        await db.update(verifiedLinks).set({ active: input.active }).where(eq(verifiedLinks.id, input.id));
        return { success: true };
      }),
  }),

  /**
   * Content Scoreboard — aggregates all published blog posts with their
   * Yoast scores, GSC traffic (clicks/impressions/position), social push
   * history, and a computed health signal for the scoreboard page.
   */
  scoreboard: router({
    /**
     * Return all published blog content items enriched with their
     * stored Yoast score, pushed channels, live GSC traffic data,
     * and position trend (up/down/flat) computed from stored history.
     */
    getPublishedPosts: protectedProcedure.query(async ({ ctx }) => {
      const db = await getDb();
      if (!db) return [];
      const { contentItems: ci, gscPositionHistory, userCredentials } = await import("../drizzle/schema");
      const { eq, and, isNotNull, desc, inArray } = await import("drizzle-orm");

      // Fetch all published blog posts that have a WordPress post ID
      const posts = await db
        .select()
        .from(ci)
        .where(
          and(
            eq(ci.status, "published"),
            eq(ci.platform, "blog"),
            isNotNull(ci.wpPostId)
          )
        );

      // Build a map of wpPostId -> topicCluster from the wp_post_index table
      const { wpPostIndex: wpiTable } = await import("../drizzle/schema");
      const wpiRows = await db.select({ wpPostId: wpiTable.wpPostId, topicCluster: wpiTable.topicCluster }).from(wpiTable);
      const clusterByWpId = new Map<number, string | null>();
      for (const row of wpiRows) {
        clusterByWpId.set(row.wpPostId, row.topicCluster ?? null);
      }

      // Try to fetch live GSC data
      let gscPageMap: Map<string, { clicks: number; impressions: number; ctr: number; position: number }> = new Map();
      let gscConnected = false;
      try {
        const { getOwnerCredentials } = await import("./db");
        const creds = await getOwnerCredentials();
        if (creds?.gscRefreshToken && creds?.gscSiteUrl) {
          gscConnected = true;
          const { getTopPages: gscGetTopPages } = await import("./googleSearchConsole");
          const gscPages = await gscGetTopPages(creds.gscRefreshToken, creds.gscSiteUrl, 100);
          for (const p of gscPages) {
            const key = p.page.replace(/\/$/, "").toLowerCase();
            gscPageMap.set(key, { clicks: p.clicks, impressions: p.impressions, ctr: p.ctr, position: p.position });
          }
        }
      } catch {
        // GSC not connected — proceed without traffic data
      }

      // Fetch position history for all posts (last 2 snapshots per URL)
      const postIds = posts.map((p: any) => p.id).filter(Boolean);
      let historyRows: any[] = [];
      if (postIds.length > 0) {
        historyRows = await db
          .select()
          .from(gscPositionHistory)
          .where(inArray(gscPositionHistory.contentItemId, postIds))
          .orderBy(desc(gscPositionHistory.recordedAt));
      }

      // Group history by contentItemId, keep last 2 snapshots
      const historyByItem = new Map<number, any[]>();
      for (const row of historyRows) {
        const id = row.contentItemId;
        if (!id) continue;
        if (!historyByItem.has(id)) historyByItem.set(id, []);
        const arr = historyByItem.get(id)!;
        if (arr.length < 2) arr.push(row);
      }

      // If we have live GSC data, record a new snapshot for each post
      if (gscConnected && gscPageMap.size > 0) {
        const now = Date.now();
        for (const post of posts as any[]) {
          const url = (post.publishUrl ?? "").replace(/\/$/, "").toLowerCase();
          const gsc = gscPageMap.get(url);
          if (!gsc) continue;
          // Only snapshot once per hour to avoid flooding the table
          const existing = historyByItem.get(post.id)?.[0];
          const oneHourAgo = now - 3_600_000;
          if (existing && existing.recordedAt > oneHourAgo) continue;
          await db.insert(gscPositionHistory).values({
            contentItemId: post.id,
            url,
            clicks: gsc.clicks,
            impressions: gsc.impressions,
            ctr: String(gsc.ctr),
            position: String(gsc.position),
            recordedAt: now,
          });
        }
      }

      return (posts as any[]).map((post) => {
        const url = (post.publishUrl ?? "").replace(/\/$/, "").toLowerCase();
        const gsc = gscPageMap.get(url) ?? null;

        // Parse pushed channels
        let pushedChannels: { id: string; name: string; service: string }[] = [];
        try {
          if (post.pushedChannels) pushedChannels = JSON.parse(post.pushedChannels);
        } catch {}

        // Compute position trend from last 2 snapshots
        const history = historyByItem.get(post.id) ?? [];
        let trendDirection: "up" | "down" | "flat" | null = null;
        let trendDelta: number | null = null;
        if (history.length >= 2) {
          const latest = parseFloat(history[0].position ?? "0");
          const prev = parseFloat(history[1].position ?? "0");
          if (!isNaN(latest) && !isNaN(prev) && prev > 0) {
            const delta = prev - latest; // positive = improved (lower position number = better)
            trendDelta = Math.abs(parseFloat(delta.toFixed(1)));
            if (Math.abs(delta) < 0.5) trendDirection = "flat";
            else if (delta > 0) trendDirection = "up";   // position improved
            else trendDirection = "down";                  // position worsened
          }
        }

        // Health signal
        // A post is "green" if Yoast score is good AND it has GSC clicks.
        // A post is "red" if Yoast score is bad/missing AND it has NOT been fixed recently.
        // A post is "amber" if Yoast score is bad/missing BUT yoastFixedAt is set
        //   (meaning we pushed the fix to WP and are waiting for Yoast to recalculate).
        let health: "green" | "amber" | "red" = "amber";
        if (post.yoastScore === "good" && gsc && gsc.clicks > 0) health = "green";
        else if (post.yoastScore === "bad" || !post.yoastScore) {
          // Check if we've already pushed a fix — if so, show amber (pending recalculation)
          health = post.yoastFixedAt ? "amber" : "red";
        }

        // Resolve topicCluster: prefer DB value (persisted on publish/sync),
        // fall back to client-side keyword matching if not yet in the index.
        const dbCluster = post.wpPostId ? (clusterByWpId.get(post.wpPostId) ?? null) : null;

        return {
          id: post.id,
          title: post.title,
          publishUrl: post.publishUrl,
          wpPostId: post.wpPostId,
          publishedAt: post.publishedAt,
          focusKeyword: post.focusKeyword,
          yoastScore: post.yoastScore,
          yoastScoreFetchedAt: post.yoastScoreFetchedAt,
          yoastFixedAt: post.yoastFixedAt ?? null,
          pushedChannels,
          gscClicks: gsc?.clicks ?? null,
          gscImpressions: gsc?.impressions ?? null,
          gscCtr: gsc?.ctr ?? null,
          gscPosition: gsc?.position ?? null,
          trendDirection,
          trendDelta,
          health,
          topicCluster: dbCluster,
          imageUrl: (post as any).imageUrl ?? null,
        };
      });
    }),

    /**
     * Publish Next Recommendations
     * ─────────────────────────────
     * Scores keyword opportunities by combining:
     *  1. Striking-distance keywords (GSC pos 4-20) not yet covered by a published post
     *  2. Semantic keyword families adjacent to posts that are trending up or have high clicks
     *  3. DataForSEO search volume for each candidate keyword
     *  4. LLM-generated rationale and suggested title for the top 10
     */
    getPublishNextRecommendations: protectedProcedure.query(async ({ ctx }) => {
      const db = await getDb();
      if (!db) return [];
      const { contentItems: ci, userCredentials } = await import("../drizzle/schema");
      const { eq, and } = await import("drizzle-orm");

      // Get all published blog post keywords to know what's already covered
      const publishedPosts = await db
        .select({ focusKeyword: ci.focusKeyword, title: ci.title, publishUrl: ci.publishUrl })
        .from(ci)
        .where(and(eq(ci.status, "published"), eq(ci.platform, "blog")));

      const coveredKeywords = new Set(
        publishedPosts.map((p: any) => (p.focusKeyword ?? "").toLowerCase().trim()).filter(Boolean)
      );

      // Fetch GSC striking-distance keywords (pos 4-20, impressions > 50)
      let strikingKeywords: { keyword: string; position: number; impressions: number; clicks: number }[] = [];
      try {
        const { getOwnerCredentials } = await import("./db");
        const creds = await getOwnerCredentials();
        if (creds?.gscRefreshToken && creds?.gscSiteUrl) {
          const { getTopQueries: gscGetTopQueries } = await import("./googleSearchConsole");
          const allKws = await gscGetTopQueries(creds.gscRefreshToken, creds.gscSiteUrl, 200);
          strikingKeywords = allKws
            .filter((k: any) => k.position >= 4 && k.position <= 20 && k.impressions >= 50)
            .map((k: any) => ({ keyword: k.query, position: k.position, impressions: k.impressions, clicks: k.clicks }))
            .filter((k: any) => !coveredKeywords.has(k.keyword.toLowerCase().trim()));
        }
      } catch {
        // GSC not available
      }

      // Score striking-distance keywords:
      // Score = impressions × (1 / position) × 10  (higher impressions + better position = higher score)
      const scored = strikingKeywords
        .map((k) => ({ ...k, score: k.impressions * (1 / k.position) * 10 }))
        .sort((a, b) => b.score - a.score)
        .slice(0, 15);

      const publishedTitles = publishedPosts.map((p: any) => p.title).slice(0, 15).join(", ");

      // ── LLM enrichment: titles + rationale + topic cluster ─────────────────
      // Handles both GSC-sourced and fallback LLM-sourced recommendations
      const TOPIC_PILLARS = ["Sleep", "Gut Health", "Stress & Anxiety", "Energy", "Detox", "Longevity", "Mindfulness", "Nutrition", "Breathwork", "Other"];

      if (scored.length === 0) {
        // Fallback: LLM suggests keyword families
        const fallbackTitles = publishedPosts.map((p: any) => p.title).slice(0, 20).join("\n");
        const fallbackResponse = await safeLLM({
          messages: [
            {
              role: "system",
              content: `You are an SEO strategist for The Urban Monk (Dr. Pedram Shojai). Based on the published blog posts listed below, suggest 10 keyword opportunities that are semantically related but not yet covered. For each, assign a topicCluster from: ${TOPIC_PILLARS.join(", ")}.

Published posts:\n${fallbackTitles}

Return JSON: {"recommendations": [{"keyword": string, "suggestedTitle": string, "rationale": string, "estimatedDifficulty": "low"|"medium"|"high", "topicCluster": string, "priority": number}]}`,
            },
            { role: "user", content: "Suggest the next 10 blog posts to publish for maximum SEO momentum." },
          ],
          response_format: {
            type: "json_schema",
            json_schema: {
              name: "publish_next_v2",
              strict: true,
              schema: {
                type: "object",
                properties: {
                  recommendations: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        keyword: { type: "string" },
                        suggestedTitle: { type: "string" },
                        rationale: { type: "string" },
                        estimatedDifficulty: { type: "string", enum: ["low", "medium", "high"] },
                        topicCluster: { type: "string" },
                        priority: { type: "number" },
                      },
                      required: ["keyword", "suggestedTitle", "rationale", "estimatedDifficulty", "topicCluster", "priority"],
                      additionalProperties: false,
                    },
                  },
                },
                required: ["recommendations"],
                additionalProperties: false,
              },
            },
          },
        });
        try {
          const parsed = JSON.parse(fallbackResponse.choices[0].message.content as string);
          return (parsed.recommendations ?? []).map((r: any, i: number) => ({
            rank: i + 1,
            keyword: r.keyword,
            suggestedTitle: r.suggestedTitle,
            rationale: r.rationale,
            estimatedDifficulty: r.estimatedDifficulty,
            topicCluster: r.topicCluster ?? "Other",
            gscPosition: null,
            gscImpressions: null,
            gscClicks: null,
            competitorDomain: null,
            competitorTitle: null,
            source: "llm_family",
          }));
        } catch {
          return [];
        }
      }

      // Build initial enriched list (generic titles as fallback)
      let enriched: any[] = scored.map((k, i) => ({
        rank: i + 1,
        keyword: k.keyword,
        suggestedTitle: `${k.keyword.charAt(0).toUpperCase() + k.keyword.slice(1)}: A Complete Guide`,
        rationale: `Ranking at position ${k.position.toFixed(1)} with ${k.impressions} monthly impressions — a targeted post could move this into the top 3.`,
        estimatedDifficulty: k.position <= 8 ? "low" : k.position <= 14 ? "medium" : "high",
        topicCluster: "Other",
        gscPosition: k.position,
        gscImpressions: k.impressions,
        gscClicks: k.clicks,
        competitorDomain: null,
        competitorTitle: null,
        source: "gsc_striking_distance",
      }));

      // LLM enrichment: titles + rationale + topic cluster in one call
      const kwList = scored.map((k, i) => `${i + 1}. "${k.keyword}" (pos ${k.position.toFixed(1)}, ${k.impressions} impressions)`).join("\n");
      try {
        const llmResponse = await safeLLM({
          messages: [
            {
              role: "system",
              content: `You are an SEO content strategist for The Urban Monk (Dr. Pedram Shojai). He has published these blog posts: ${publishedTitles}.

Below are keywords where his site is ranking on page 1-2 of Google (positions 4-20) but not yet getting clicks. For each keyword:
1. Suggest a compelling blog post title in Pedram's voice (bridges ancient wisdom + modern science, health-focused, practical)
2. Write a 1-sentence rationale for why publishing this now would drive traffic
3. Assign a topicCluster from: ${TOPIC_PILLARS.join(", ")}

Return JSON: {"enriched": [{"keyword": string, "suggestedTitle": string, "rationale": string, "topicCluster": string}]}`,
            },
            { role: "user", content: `Keywords to enrich:\n${kwList}` },
          ],
          response_format: {
            type: "json_schema",
            json_schema: {
              name: "enrich_keywords_v2",
              strict: true,
              schema: {
                type: "object",
                properties: {
                  enriched: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        keyword: { type: "string" },
                        suggestedTitle: { type: "string" },
                        rationale: { type: "string" },
                        topicCluster: { type: "string" },
                      },
                      required: ["keyword", "suggestedTitle", "rationale", "topicCluster"],
                      additionalProperties: false,
                    },
                  },
                },
                required: ["enriched"],
                additionalProperties: false,
              },
            },
          },
        });
        const parsed = JSON.parse(llmResponse.choices[0].message.content as string);
        const llmMap = new Map<string, any>((parsed.enriched ?? []).map((e: any) => [e.keyword.toLowerCase(), e]));
        enriched = enriched.map((item) => {
          const llm = llmMap.get(item.keyword.toLowerCase());
          if (llm) {
            return {
              ...item,
              suggestedTitle: llm.suggestedTitle as string,
              rationale: llm.rationale as string,
              topicCluster: llm.topicCluster as string ?? item.topicCluster,
            };
          }
          return item;
        });
      } catch {
        // LLM enrichment failed — return scored list with generic titles
      }

      // ── Competitor gap: DataForSEO SERP top-1 for each keyword ─────────────
      try {
        const { getSerpTop1 } = await import("./dataForSeo");
        const keywords = enriched.map((e: any) => e.keyword);
        const serpResults = await getSerpTop1(keywords);
        const serpMap = new Map(serpResults.map((r) => [r.keyword.toLowerCase(), r]));
        enriched = enriched.map((item: any) => {
          const serp = serpMap.get(item.keyword.toLowerCase());
          if (serp) {
            return { ...item, competitorDomain: serp.domain, competitorTitle: serp.title };
          }
          return item;
        });
      } catch {
        // DataForSEO unavailable — proceed without competitor data
      }

      return enriched.slice(0, 10);
    }),

    /**
     * Cluster Coverage — returns how many of the nine topic clusters have at
     * least one published post, using the persisted topicCluster column in
     * wp_post_index (falls back to keyword matching on contentItems).
     * Used by the Scoreboard header stat card.
     */
    getClusterCoverage: protectedProcedure.query(async ({ ctx }) => {
      const db = await getDb();
      if (!db) return { covered: 0, total: 9, clusters: [] };

      const ALL_CLUSTERS = [
        "Gut Health & Digestion",
        "Stress & Mental Wellness",
        "Sleep & Recovery",
        "Energy & Vitality",
        "Detox & Cleansing",
        "Mindfulness & Meditation",
        "Nutrition & Diet",
        "Fitness & Movement",
        "Longevity & Anti-Aging",
      ];

      // Prefer the persisted topicCluster from wp_post_index
      const { wpPostIndex: wpiTable } = await import("../drizzle/schema");
      const { isNotNull } = await import("drizzle-orm");
      const wpiRows = await db
        .select({ topicCluster: wpiTable.topicCluster })
        .from(wpiTable)
        .where(isNotNull(wpiTable.topicCluster));

      const coveredSet = new Set<string>();
      for (const row of wpiRows) {
        if (row.topicCluster) coveredSet.add(row.topicCluster);
      }

      // Also check contentItems focusKeyword for posts not yet in the index
      if (coveredSet.size < ALL_CLUSTERS.length) {
        const { contentItems } = await import("../drizzle/schema");
        const { and, eq } = await import("drizzle-orm");
        const { detectCluster: dc } = await import("./wpContentUtils");
        const posts = await db
          .select({ focusKeyword: contentItems.focusKeyword, title: contentItems.title })
          .from(contentItems)
          .where(and(eq(contentItems.status, "published"), eq(contentItems.platform, "blog")));
        for (const p of posts) {
          const src = `${p.focusKeyword ?? ""} ${p.title ?? ""}`;
          const cluster = dc(src);
          if (cluster) coveredSet.add(cluster.label);
        }
      }

      const clusters = ALL_CLUSTERS.map((name) => ({
        name,
        covered: coveredSet.has(name),
      }));

      return {
        covered: clusters.filter((c) => c.covered).length,
        total: ALL_CLUSTERS.length,
        clusters,
      };
    }),

    /**
     * Pillar Coverage — group all published blog posts by topic pillar
     * using keyword heuristics. Returns count per pillar so the Scoreboard
     * can show which content pillars are underserved.
     */
    getPillarCoverage: protectedProcedure.query(async ({ ctx }) => {
      const db = await getDb();
      if (!db) return [];

      const { contentItems } = await import("../drizzle/schema");
      const { and, eq } = await import("drizzle-orm");

      // Fetch all published blog posts with their focus keyword and title
      const posts = await db
        .select({
          id: contentItems.id,
          title: contentItems.title,
          focusKeyword: contentItems.focusKeyword,
        })
        .from(contentItems)
        .where(
          and(
            eq(contentItems.status, "published"),
            eq(contentItems.platform, "blog")
          )
        );

      if (posts.length === 0) return [];

      // Keyword heuristics for pillar assignment
      const PILLAR_KEYWORDS: Record<string, string[]> = {
        "Sleep": ["sleep", "insomnia", "melatonin", "circadian", "rest", "fatigue", "tired"],
        "Gut Health": ["gut", "microbiome", "digestion", "probiotic", "prebiotic", "leaky gut", "ibs", "bloat"],
        "Stress & Anxiety": ["stress", "anxiety", "cortisol", "nervous system", "panic", "worry", "calm", "overwhelm"],
        "Energy": ["energy", "fatigue", "adrenal", "mitochondria", "caffeine", "vitality", "exhaustion"],
        "Detox": ["detox", "cleanse", "toxin", "liver", "heavy metal", "fasting", "purify"],
        "Longevity": ["longevity", "aging", "anti-aging", "lifespan", "telomere", "senescence", "biohack"],
        "Mindfulness": ["mindfulness", "meditation", "presence", "awareness", "monk", "stillness", "zen"],
        "Nutrition": ["nutrition", "diet", "food", "eating", "nutrient", "vitamin", "mineral", "supplement"],
        "Breathwork": ["breath", "breathing", "pranayama", "oxygen", "co2", "hyperventilat", "wim hof"],
      };

      function assignPillar(title: string, keyword: string | null): string {
        const text = `${title} ${keyword ?? ""}`.toLowerCase();
        for (const [pillar, terms] of Object.entries(PILLAR_KEYWORDS)) {
          if (terms.some((t) => text.includes(t))) return pillar;
        }
        return "Other";
      }

      const counts = new Map<string, number>();
      for (const post of posts) {
        const pillar = assignPillar(post.title, post.focusKeyword);
        counts.set(pillar, (counts.get(pillar) ?? 0) + 1);
      }

      // Return all known pillars (including zeros) plus any "Other" bucket
      const ALL_PILLARS = ["Sleep", "Gut Health", "Stress & Anxiety", "Energy", "Detox", "Longevity", "Mindfulness", "Nutrition", "Breathwork"];
      const result = ALL_PILLARS.map((pillar) => ({
        pillar,
        count: counts.get(pillar) ?? 0,
      }));
      if (counts.has("Other") && (counts.get("Other") ?? 0) > 0) {
        result.push({ pillar: "Other", count: counts.get("Other")! });
      }

      return result.sort((a, b) => b.count - a.count);
    }),

    /**
     * Generate a social-media-ready image for a published blog post.
     * Uses the post title + focus keyword to craft a prompt, then calls
     * the image generation service. The resulting URL is stored on the
     * content item so the QuickShareDialog can attach it automatically.
     */
    generateSocialImage: protectedProcedure
      .input(
        z.object({
          contentItemId: z.number(),
          title: z.string().min(1),
          focusKeyword: z.string().optional(),
          platform: z.enum(["instagram", "facebook", "twitter", "linkedin"]).default("instagram"),
        })
      )
      .mutation(async ({ input }) => {
        const keyword = input.focusKeyword ?? input.title;
        const platformStyles: Record<string, string> = {
          instagram: "warm golden-hour light, editorial wellness lifestyle, sage greens and warm earth tones, cinematic depth of field, aspirational and serene",
          facebook: "warm, inviting, editorial wellness, natural light, clean composition, approachable and trustworthy",
          twitter: "bold, high-contrast, clean typographic composition, striking visual metaphor, modern wellness aesthetic",
          linkedin: "professional editorial, soft natural light, authoritative wellness expert, clean minimalist composition, warm neutrals",
        };
        const style = platformStyles[input.platform] ?? platformStyles.instagram;

        const prompt = [
          `A compelling social media hero image for a wellness article titled "${input.title}".`,
          `The image should visually represent the concept of "${keyword}" through symbolic, editorial imagery.`,
          `Style: ${style}.`,
          `No text overlays. No logos. Photorealistic or high-quality editorial illustration.`,
          `Dr. Pedram Shojai's Urban Monk brand: ancient wisdom meets modern science, calm confidence, natural world.`,
          `Aspect ratio: square (1:1). High resolution.`,
        ].join(" ");

        const { url } = await generateImage({ prompt });

        // Persist the generated image URL on the content item so the Share dialog can use it
        await updateContentItem(input.contentItemId, { imageUrl: url });

        return { imageUrl: url };
      }),
  }),

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

