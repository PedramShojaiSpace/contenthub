/**
 * Viral Studio Router
 * Growthopia-replacement features:
 *   1. Hook Generator (5 psychology frameworks)
 *   2. Full Video Script Generator (Social SEO + DM CTA)
 *   3. Content Repurposing Engine
 *   4. Viral Topic Generator
 *   5. Social SEO Caption Optimizer
 *   6. DM Automation Playbook Generator
 *   7. Performance Analytics Narrative
 *   8. Sub-Account Content Testing System
 */

import { z } from "zod";
import { protectedProcedure, router } from "./_core/trpc";
import { invokeLLM } from "./_core/llm";
import { getDb } from "./db";
import {
  hookGenerations,
  scriptGenerations,
  repurposeJobs,
  viralTopics,
  dmPlaybooks,
  testVariants,
  testResults,
  frameworkPerformance,
  type HookGeneration,
  type ScriptGeneration,
  type RepurposeJob,
  type ViralTopic,
  type DmPlaybook,
  type TestVariant,
  type TestResult,
} from "../drizzle/schema";
import { desc, eq, and, sql } from "drizzle-orm";

// ─── Pedram voice context ─────────────────────────────────────────────────────
const PEDRAM_VOICE = `
You are writing as Dr. Pedram Shojai, OMD — The Urban Monk.
Voice: authoritative but warm, science-backed but accessible, direct and no-fluff.
Audience: health-conscious adults 35-65 who want longevity, energy, and clarity.
Brand: The Urban Monk Academy ($297/year membership), supplements, books.
Never use corporate jargon. Speak like a wise doctor who is also a Taoist monk.
`;

// ─── Hook frameworks ──────────────────────────────────────────────────────────
const HOOK_FRAMEWORKS = `
Generate 5 hooks using EXACTLY these frameworks (one each):

1. CONTRADICTION HOOK: Start with a surprising counter-intuitive statement that challenges common belief.
   Example: "Everything your doctor told you about sleep is wrong."

2. SPECIFICITY HOOK: Use a precise number, timeframe, or statistic to create instant credibility.
   Example: "I've treated 10,000 patients in 20 years. Only 3 things actually move the needle on energy."

3. TIMEFRAME TENSION HOOK: Create urgency by anchoring to a specific time window.
   Example: "If you're over 40, you have a 5-year window to reverse this before it becomes permanent."

4. POV SHIFT HOOK: Challenge the viewer's identity or assumed belief.
   Example: "If you think you're healthy because you exercise, you're missing the biggest piece."

5. CURIOSITY GAP HOOK: Tease a revelation without giving it away.
   Example: "The one thing I tell every patient before they leave my office — and most doctors never say it."

Rules:
- Each hook must be 1-2 sentences max (under 20 words)
- Must feel like Dr. Pedram Shojai speaking, not a copywriter
- Must be platform-native (TikTok/Reels hook = spoken word, LinkedIn = written)
- NO generic wellness platitudes
- NO "Did you know..." openers
`;

// ─── 1. Hook Generator ────────────────────────────────────────────────────────
export const generateHooks = protectedProcedure
  .input(
    z.object({
      topic: z.string().min(3).max(500),
      platform: z.enum(["tiktok", "instagram", "linkedin", "youtube", "x"]).default("tiktok"),
      targetPersona: z.string().optional(),
    })
  )
  .mutation(async ({ input }) => {
    const platformContext = {
      tiktok: "TikTok short-form video (spoken aloud in first 3 seconds)",
      instagram: "Instagram Reels (spoken aloud, also works as caption opener)",
      linkedin: "LinkedIn text post (written, first line before 'see more')",
      youtube: "YouTube video (spoken in first 10 seconds)",
      x: "X/Twitter (written, first line of thread)",
    }[input.platform];

    const personaContext = input.targetPersona
      ? `\nTarget persona: ${input.targetPersona}`
      : "";

    const prompt = `${PEDRAM_VOICE}

Topic: "${input.topic}"
Platform: ${platformContext}${personaContext}

${HOOK_FRAMEWORKS}

Return a JSON object with this exact structure:
{
  "hooks": [
    {
      "framework": "CONTRADICTION",
      "hook": "...",
      "why": "One sentence explaining why this hook works for this topic"
    },
    {
      "framework": "SPECIFICITY",
      "hook": "...",
      "why": "..."
    },
    {
      "framework": "TIMEFRAME_TENSION",
      "hook": "...",
      "why": "..."
    },
    {
      "framework": "POV_SHIFT",
      "hook": "...",
      "why": "..."
    },
    {
      "framework": "CURIOSITY_GAP",
      "hook": "...",
      "why": "..."
    }
  ],
  "topPick": "CONTRADICTION",
  "topPickReason": "One sentence on why this is the strongest hook for this topic and platform"
}`;

    const response = await invokeLLM({
      messages: [
        { role: "system", content: "You are a world-class viral content strategist. Return only valid JSON." },
        { role: "user", content: prompt },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "hooks_response",
          strict: true,
          schema: {
            type: "object",
            properties: {
              hooks: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    framework: { type: "string" },
                    hook: { type: "string" },
                    why: { type: "string" },
                  },
                  required: ["framework", "hook", "why"],
                  additionalProperties: false,
                },
              },
              topPick: { type: "string" },
              topPickReason: { type: "string" },
            },
            required: ["hooks", "topPick", "topPickReason"],
            additionalProperties: false,
          },
        },
      },
    });

    const content = response.choices[0].message.content;
    const parsed = typeof content === "string" ? JSON.parse(content) : content;

    // Persist to DB
    const db = await getDb();
    if (!db) throw new Error("DB unavailable");
    await db.insert(hookGenerations).values({
      topic: input.topic,
      platform: input.platform,
      targetPersona: input.targetPersona ?? null,
      hooksJson: JSON.stringify(parsed.hooks),
      topPick: parsed.topPick,
      topPickReason: parsed.topPickReason,
    });

    return parsed;
  });

export const getRecentHooks = protectedProcedure
  .input(z.object({ limit: z.number().default(20) }))
  .query(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new Error("DB unavailable");
    const rows = await db
      .select()
      .from(hookGenerations)
      .orderBy(desc(hookGenerations.createdAt))
      .limit(input.limit);
    return rows.map((r: HookGeneration) => ({
      ...r,
      hooks: JSON.parse(r.hooksJson ?? "[]"),
    }));
  });

// ─── 2. Video Script Generator ────────────────────────────────────────────────
export const generateScript = protectedProcedure
  .input(
    z.object({
      topic: z.string().min(3).max(500),
      hook: z.string().min(5).max(300),
      platform: z.enum(["tiktok", "instagram", "youtube", "linkedin"]).default("tiktok"),
      targetLengthSeconds: z.number().min(15).max(600).default(60),
      cta: z.string().optional(), // e.g. "Comment MONK to get the free guide"
      socialSeoKeywords: z.array(z.string()).optional(),
      targetPersona: z.string().optional(),
    })
  )
  .mutation(async ({ input }) => {
    const wordCount = Math.round(input.targetLengthSeconds * 2.5); // ~150 wpm
    const personaContext = input.targetPersona
      ? `\nTarget persona: ${input.targetPersona}`
      : "";
    const keywordContext =
      input.socialSeoKeywords && input.socialSeoKeywords.length > 0
        ? `\nSocial SEO keywords to weave naturally into the spoken script (NOT as hashtags — spoken in the audio): ${input.socialSeoKeywords.join(", ")}`
        : "";
    const ctaContext = input.cta
      ? `\nDM Automation CTA: "${input.cta}" — this MUST be the final line of the script, spoken naturally.`
      : "";

    const platformNotes = {
      tiktok: "TikTok: fast-paced, conversational, direct to camera. No pauses. Hook in first 2 seconds.",
      instagram: "Instagram Reels: slightly more polished than TikTok, but still casual and direct.",
      youtube: "YouTube: can breathe more, allow pauses, slightly more educational tone.",
      linkedin: "LinkedIn video: professional but warm, slower pace, more nuanced.",
    }[input.platform];

    const prompt = `${PEDRAM_VOICE}

Topic: "${input.topic}"
Hook (first line — use exactly): "${input.hook}"
Platform: ${platformNotes}
Target length: ~${wordCount} words (~${input.targetLengthSeconds} seconds spoken)${personaContext}${keywordContext}${ctaContext}

Write a complete, ready-to-film video script using this EXACT structure:

[HOOK] — Use the provided hook verbatim as the opening line.

[PROBLEM] — 2-3 sentences. Name the pain or gap the audience is experiencing. Make them feel seen.

[AGITATE] — 1-2 sentences. Deepen the problem. Why does it matter? What's the cost of ignoring it?

[VALUE/SOLUTION] — The core teaching. 3-5 key points or a single powerful insight. This is the meat.

[PROOF] — 1-2 sentences. A patient story, a study reference, or a personal experience that validates the teaching.

[CTA] — The final line. Natural, conversational. If a DM automation trigger was provided, use it exactly.

Rules:
- Write as spoken word — contractions, short sentences, natural rhythm
- Every sentence must earn its place — no filler
- Social SEO keywords must appear naturally in the spoken audio (not forced)
- Do NOT include stage directions like "[pause here]" or "[cut to B-roll]"
- The script should feel like Pedram is talking directly to one person

Return JSON:
{
  "script": {
    "hook": "...",
    "problem": "...",
    "agitate": "...",
    "value": "...",
    "proof": "...",
    "cta": "..."
  },
  "fullScript": "Complete script as a single block of spoken text",
  "estimatedSeconds": 60,
  "wordCount": 150,
  "seoKeywordsUsed": ["keyword1", "keyword2"],
  "captionHook": "First line of caption (same as hook, adapted for written format if needed)",
  "suggestedHashtags": ["#tag1", "#tag2", "#tag3", "#tag4", "#tag5"]
}`;

    const response = await invokeLLM({
      messages: [
        { role: "system", content: "You are a world-class short-form video scriptwriter. Return only valid JSON." },
        { role: "user", content: prompt },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "script_response",
          strict: true,
          schema: {
            type: "object",
            properties: {
              script: {
                type: "object",
                properties: {
                  hook: { type: "string" },
                  problem: { type: "string" },
                  agitate: { type: "string" },
                  value: { type: "string" },
                  proof: { type: "string" },
                  cta: { type: "string" },
                },
                required: ["hook", "problem", "agitate", "value", "proof", "cta"],
                additionalProperties: false,
              },
              fullScript: { type: "string" },
              estimatedSeconds: { type: "number" },
              wordCount: { type: "number" },
              seoKeywordsUsed: { type: "array", items: { type: "string" } },
              captionHook: { type: "string" },
              suggestedHashtags: { type: "array", items: { type: "string" } },
            },
            required: ["script", "fullScript", "estimatedSeconds", "wordCount", "seoKeywordsUsed", "captionHook", "suggestedHashtags"],
            additionalProperties: false,
          },
        },
      },
    });

    const content = response.choices[0].message.content;
    const parsed = typeof content === "string" ? JSON.parse(content) : content;

    // Persist
    const db = await getDb();
    if (!db) throw new Error("DB unavailable");
    await db.insert(scriptGenerations).values({
      topic: input.topic,
      hook: input.hook,
      platform: input.platform,
      targetLengthSeconds: input.targetLengthSeconds,
      cta: input.cta ?? null,
      socialSeoKeywords: JSON.stringify(input.socialSeoKeywords ?? []),
      targetPersona: input.targetPersona ?? null,
      fullScript: parsed.fullScript,
      scriptJson: JSON.stringify(parsed.script),
      captionHook: parsed.captionHook,
      suggestedHashtags: JSON.stringify(parsed.suggestedHashtags),
      wordCount: parsed.wordCount,
      estimatedSeconds: parsed.estimatedSeconds,
    });

    return parsed;
  });

export const getRecentScripts = protectedProcedure
  .input(z.object({ limit: z.number().default(20) }))
  .query(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new Error("DB unavailable");
    const rows = await db
      .select()
      .from(scriptGenerations)
      .orderBy(desc(scriptGenerations.createdAt))
      .limit(input.limit);
    return rows.map((r: ScriptGeneration) => ({
      ...r,
      script: JSON.parse(r.scriptJson ?? "{}"),
      seoKeywords: JSON.parse(r.socialSeoKeywords ?? "[]"),
      hashtags: JSON.parse(r.suggestedHashtags ?? "[]"),
    }));
  });

// ─── 3. Content Repurposing Engine ────────────────────────────────────────────
export const repurposeContent = protectedProcedure
  .input(
    z.object({
      sourceType: z.enum(["book_chapter", "podcast_transcript", "blog_post", "webinar_excerpt", "custom"]),
      sourceTitle: z.string().min(2).max(255),
      sourceText: z.string().min(50).max(8000),
      targetPlatforms: z.array(z.enum(["tiktok", "instagram", "linkedin", "youtube", "x"])).min(1),
      postsPerPlatform: z.number().min(1).max(10).default(3),
    })
  )
  .mutation(async ({ input }) => {
    const platformInstructions = input.targetPlatforms.map((p) => {
      const specs = {
        tiktok: "TikTok: 15-60 second spoken script, hook in first 2 seconds, fast-paced",
        instagram: "Instagram Reels: 30-90 second spoken script, slightly more polished",
        linkedin: "LinkedIn: text post 150-300 words, professional insight format, no hashtag spam",
        youtube: "YouTube Shorts: 60-second script, more educational, slightly slower pace",
        x: "X/Twitter: thread of 3-5 tweets, punchy, each tweet stands alone",
      }[p];
      return `- ${specs}`;
    }).join("\n");

    const prompt = `${PEDRAM_VOICE}

SOURCE TYPE: ${input.sourceType.replace(/_/g, " ")}
SOURCE TITLE: "${input.sourceTitle}"
SOURCE TEXT:
---
${input.sourceText}
---

Extract ${input.postsPerPlatform} distinct content pieces per platform from this source material.
Each piece must stand alone — do not reference "the book" or "the podcast" directly.
Transform the wisdom into native platform content.

Target platforms:
${platformInstructions}

For each piece, identify the core insight and build it into a complete, ready-to-use post.

Return JSON:
{
  "repurposedContent": [
    {
      "platform": "tiktok",
      "postIndex": 1,
      "coreInsight": "The single idea this piece is built around",
      "hook": "Opening hook line",
      "content": "Full script or post text",
      "suggestedHashtags": ["#tag1"],
      "estimatedSeconds": 45
    }
  ],
  "totalPieces": 6,
  "sourceThemes": ["theme1", "theme2", "theme3"]
}`;

    const response = await invokeLLM({
      messages: [
        { role: "system", content: "You are a world-class content repurposing strategist. Return only valid JSON." },
        { role: "user", content: prompt },
      ],
    });

    const content = response.choices[0].message.content;
    let parsed: { repurposedContent: unknown[]; totalPieces: number; sourceThemes: string[] };
    try {
      parsed = JSON.parse(typeof content === "string" ? content : JSON.stringify(content));
    } catch {
      parsed = { repurposedContent: [], totalPieces: 0, sourceThemes: [] };
    }

    // Persist job
    const db = await getDb();
    if (!db) throw new Error("DB unavailable");
    await db.insert(repurposeJobs).values({
      sourceType: input.sourceType,
      sourceTitle: input.sourceTitle,
      sourceTextSnippet: input.sourceText.slice(0, 500),
      targetPlatforms: JSON.stringify(input.targetPlatforms),
      postsPerPlatform: input.postsPerPlatform,
      resultJson: JSON.stringify(parsed),
      totalPieces: parsed.totalPieces,
    });

    return parsed;
  });

export const getRecentRepurposeJobs = protectedProcedure
  .input(z.object({ limit: z.number().default(20) }))
  .query(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new Error("DB unavailable");
    const rows = await db
      .select()
      .from(repurposeJobs)
      .orderBy(desc(repurposeJobs.createdAt))
      .limit(input.limit);
    return rows.map((r: RepurposeJob) => ({
      ...r,
      result: JSON.parse(r.resultJson ?? "{}"),
      platforms: JSON.parse(r.targetPlatforms ?? "[]"),
    }));
  });

// ─── 4. Viral Topic Generator ─────────────────────────────────────────────────
export const generateViralTopics = protectedProcedure
  .input(
    z.object({
      niche: z.string().default("longevity, gut health, sleep, stress, integrative medicine"),
      platform: z.enum(["tiktok", "instagram", "linkedin", "youtube", "all"]).default("all"),
      count: z.number().min(5).max(20).default(10),
      trendingContext: z.string().optional(), // Optional: paste in trending headlines
    })
  )
  .mutation(async ({ input }) => {
    const platformContext = input.platform === "all"
      ? "all short-form platforms (TikTok, Instagram, LinkedIn, YouTube)"
      : input.platform;

    const trendContext = input.trendingContext
      ? `\nCurrent trending context (use to inform relevance):\n${input.trendingContext}`
      : "";

    const prompt = `${PEDRAM_VOICE}

Generate ${input.count} viral content topic ideas for ${platformContext}.
Niche: ${input.niche}${trendContext}

For each topic, provide:
1. A specific, concrete topic (not vague — "Why your morning coffee is destroying your cortisol rhythm" not "Coffee and health")
2. The hook angle that makes it viral
3. The target persona (who specifically needs to hear this)
4. The viral potential score (1-10) and why
5. The best platform for this topic
6. 3 hook options (one per framework: Contradiction, Specificity, Curiosity Gap)

Prioritize topics that:
- Challenge conventional wisdom
- Have a specific, surprising angle
- Connect to a felt pain (fatigue, brain fog, weight, sleep, stress)
- Can be answered in 60 seconds but leave the viewer wanting more
- Are timely OR evergreen (indicate which)

Return JSON:
{
  "topics": [
    {
      "topic": "Why your morning coffee is destroying your cortisol rhythm",
      "hookAngle": "Most people don't know their cortisol peaks at 8am — adding caffeine on top creates a crash by noon",
      "targetPersona": "Busy professional 40+ experiencing afternoon energy crashes",
      "viralScore": 8,
      "viralReason": "Counter-intuitive, specific, solves a felt pain",
      "bestPlatform": "tiktok",
      "contentType": "evergreen",
      "hooks": {
        "contradiction": "...",
        "specificity": "...",
        "curiosityGap": "..."
      }
    }
  ],
  "topPick": "topic title of the highest potential",
  "weeklyTheme": "Suggested weekly theme that ties 3-4 of these together"
}`;

    const response = await invokeLLM({
      messages: [
        { role: "system", content: "You are a viral content strategist for health and wellness creators. Return only valid JSON." },
        { role: "user", content: prompt },
      ],
    });

    const content = response.choices[0].message.content;
    let parsed: { topics: unknown[]; topPick: string; weeklyTheme: string };
    try {
      parsed = JSON.parse(typeof content === "string" ? content : JSON.stringify(content));
    } catch {
      parsed = { topics: [], topPick: "", weeklyTheme: "" };
    }

    // Persist
    const db = await getDb();
    if (!db) throw new Error("DB unavailable");
    await db.insert(viralTopics).values({
      niche: input.niche,
      platform: input.platform,
      topicsJson: JSON.stringify(parsed.topics),
      topPick: parsed.topPick,
      weeklyTheme: parsed.weeklyTheme,
      count: (parsed.topics as unknown[]).length,
    });

    return parsed;
  });

export const getRecentViralTopics = protectedProcedure
  .input(z.object({ limit: z.number().default(10) }))
  .query(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new Error("DB unavailable");
    const rows = await db
      .select()
      .from(viralTopics)
      .orderBy(desc(viralTopics.createdAt))
      .limit(input.limit);
    return rows.map((r: ViralTopic) => ({
      ...r,
      topics: JSON.parse(r.topicsJson ?? "[]"),
    }));
  });

// ─── 5. Social SEO Caption Optimizer ─────────────────────────────────────────
export const optimizeCaption = protectedProcedure
  .input(
    z.object({
      rawCaption: z.string().min(10).max(3000),
      platform: z.enum(["tiktok", "instagram", "linkedin", "youtube", "x"]),
      targetKeywords: z.array(z.string()).min(1).max(10),
      cta: z.string().optional(),
    })
  )
  .mutation(async ({ input }) => {
    const platformSpecs = {
      tiktok: "TikTok: 150-300 chars visible before 'more', keywords in first sentence, 3-5 hashtags max, conversational",
      instagram: "Instagram: 125 chars before 'more', keywords natural, 5-10 hashtags at end or in comment, line breaks for readability",
      linkedin: "LinkedIn: 210 chars before 'see more', professional tone, 3 hashtags max, no emoji spam, keyword in first sentence",
      youtube: "YouTube: 5000 char limit, keyword in first 100 chars, natural keyword density 1-2%, timestamps if relevant",
      x: "X/Twitter: 280 chars, keyword in first 50 chars, 1-2 hashtags max, punchy",
    }[input.platform];

    const prompt = `${PEDRAM_VOICE}

Optimize this caption for Social SEO on ${input.platform}:

ORIGINAL CAPTION:
"${input.rawCaption}"

Platform specs: ${platformSpecs}
Target keywords to integrate naturally: ${input.targetKeywords.join(", ")}
${input.cta ? `CTA to include: "${input.cta}"` : ""}

Rules:
- Keywords must appear naturally in the spoken/written language — NOT stuffed
- The caption must still sound like Pedram, not like SEO copy
- Preserve the core message and voice
- The first sentence must contain the primary keyword naturally
- Hashtags should be a mix of: niche-specific (medium volume), topic-specific (high relevance), brand (#UrbanMonk or #PedramShojai)

Return JSON:
{
  "optimizedCaption": "Full optimized caption text",
  "keywordsPlaced": ["keyword1", "keyword2"],
  "hashtags": ["#tag1", "#tag2"],
  "charCount": 280,
  "firstSentence": "The opening line (most important for SEO)",
  "improvements": ["What was changed and why — 3 bullet points max"]
}`;

    const response = await invokeLLM({
      messages: [
        { role: "system", content: "You are a Social SEO expert for health and wellness content. Return only valid JSON." },
        { role: "user", content: prompt },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "caption_response",
          strict: true,
          schema: {
            type: "object",
            properties: {
              optimizedCaption: { type: "string" },
              keywordsPlaced: { type: "array", items: { type: "string" } },
              hashtags: { type: "array", items: { type: "string" } },
              charCount: { type: "number" },
              firstSentence: { type: "string" },
              improvements: { type: "array", items: { type: "string" } },
            },
            required: ["optimizedCaption", "keywordsPlaced", "hashtags", "charCount", "firstSentence", "improvements"],
            additionalProperties: false,
          },
        },
      },
    });

    const content = response.choices[0].message.content;
    const parsed = typeof content === "string" ? JSON.parse(content) : content;
    return parsed;
  });

// ─── 6. DM Automation Playbook Generator ─────────────────────────────────────
export const generateDMPlaybook = protectedProcedure
  .input(
    z.object({
      videoTopic: z.string().min(5).max(500),
      triggerKeyword: z.string().min(2).max(50), // e.g. "MONK", "SLEEP", "GUT"
      leadMagnet: z.string().min(5).max(255),    // e.g. "The Urban Monk Sleep Protocol PDF"
      leadMagnetUrl: z.string().url().optional(),
      finalCta: z.string().optional(),           // e.g. "Join Urban Monk Academy at $297/year"
      platform: z.enum(["instagram", "tiktok", "facebook"]).default("instagram"),
    })
  )
  .mutation(async ({ input }) => {
    const prompt = `${PEDRAM_VOICE}

Create a complete ManyChat DM automation playbook for this video:

Video Topic: "${input.videoTopic}"
Trigger Keyword: "${input.triggerKeyword}" (viewer comments this to trigger the DM sequence)
Lead Magnet: "${input.leadMagnet}"
${input.leadMagnetUrl ? `Lead Magnet URL: ${input.leadMagnetUrl}` : ""}
${input.finalCta ? `Final CTA: "${input.finalCta}"` : "Final CTA: Join Urban Monk Academy at theurbanmonk.com/academy"}
Platform: ${input.platform}

Create:
1. The VIDEO CTA LINE — the exact words Pedram says at the end of the video to trigger the automation
2. Three DM messages in sequence (sent automatically by ManyChat):
   - Message 1: Immediate delivery (sent within 5 seconds of keyword trigger)
   - Message 2: Value follow-up (sent 24 hours later)
   - Message 3: Soft offer (sent 48 hours later)

Rules for DM messages:
- Message 1: Deliver the lead magnet, warm and personal, 2-3 sentences max
- Message 2: One additional insight related to the video topic, bridge to the offer, 3-4 sentences
- Message 3: Soft pitch for Urban Monk Academy, address one objection, include link, 4-5 sentences
- All messages must feel like Pedram personally wrote them — NOT corporate
- Use the viewer's first name placeholder: {{first_name}}

Return JSON:
{
  "videoCTALine": "Exact words to say at end of video",
  "triggerKeyword": "${input.triggerKeyword}",
  "messages": [
    {
      "messageNumber": 1,
      "delay": "Immediate",
      "subject": "Lead magnet delivery",
      "body": "Full DM text",
      "buttonText": "Get the guide",
      "buttonUrl": "..."
    },
    {
      "messageNumber": 2,
      "delay": "24 hours",
      "subject": "Value follow-up",
      "body": "Full DM text",
      "buttonText": null,
      "buttonUrl": null
    },
    {
      "messageNumber": 3,
      "delay": "48 hours",
      "subject": "Soft offer",
      "body": "Full DM text",
      "buttonText": "Join the Academy",
      "buttonUrl": "https://theurbanmonk.com/academy"
    }
  ],
  "setupInstructions": "3-step ManyChat setup instructions for non-technical user",
  "expectedConversionRate": "Realistic estimate based on industry benchmarks"
}`;

    const response = await invokeLLM({
      messages: [
        { role: "system", content: "You are a ManyChat DM automation expert for content creators. Return only valid JSON." },
        { role: "user", content: prompt },
      ],
    });

    const content = response.choices[0].message.content;
    let parsed: {
      videoCTALine: string;
      triggerKeyword: string;
      messages: unknown[];
      setupInstructions: string;
      expectedConversionRate: string;
    };
    try {
      parsed = JSON.parse(typeof content === "string" ? content : JSON.stringify(content));
    } catch {
      parsed = {
        videoCTALine: "",
        triggerKeyword: input.triggerKeyword,
        messages: [],
        setupInstructions: "",
        expectedConversionRate: "",
      };
    }

    // Persist
    const db = await getDb();
    if (!db) throw new Error("DB unavailable");
    await db.insert(dmPlaybooks).values({
      videoTopic: input.videoTopic,
      triggerKeyword: input.triggerKeyword,
      leadMagnet: input.leadMagnet,
      leadMagnetUrl: input.leadMagnetUrl ?? null,
      platform: input.platform,
      videoCTALine: parsed.videoCTALine,
      messagesJson: JSON.stringify(parsed.messages),
      setupInstructions: parsed.setupInstructions,
    });

    return parsed;
  });

export const getRecentPlaybooks = protectedProcedure
  .input(z.object({ limit: z.number().default(20) }))
  .query(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new Error("DB unavailable");
    const rows = await db
      .select()
      .from(dmPlaybooks)
      .orderBy(desc(dmPlaybooks.createdAt))
      .limit(input.limit);
    return rows.map((r: DmPlaybook) => ({
      ...r,
      messages: JSON.parse(r.messagesJson ?? "[]"),
    }));
  });

// ─── 7. Performance Analytics Narrative ──────────────────────────────────────
export const generateAnalyticsNarrative = protectedProcedure
  .input(
    z.object({
      periodLabel: z.string().default("Last 30 days"),
      topPosts: z.array(z.object({
        platform: z.string(),
        text: z.string(),
        likes: z.number(),
        comments: z.number(),
        shares: z.number(),
        views: z.number(),
      })).max(10),
      totalPosts: z.number(),
      totalReach: z.number().optional(),
      followerGrowth: z.number().optional(),
      topPerformingPlatform: z.string().optional(),
    })
  )
  .mutation(async ({ input }) => {
    const postsContext = input.topPosts.map((p, i) =>
      `${i + 1}. [${p.platform.toUpperCase()}] "${p.text.slice(0, 100)}..." — ${p.views} views, ${p.likes} likes, ${p.comments} comments, ${p.shares} shares`
    ).join("\n");

    const prompt = `${PEDRAM_VOICE}

Analyze this social media performance data and generate a strategic monthly narrative:

Period: ${input.periodLabel}
Total posts published: ${input.totalPosts}
${input.totalReach ? `Total reach: ${input.totalReach.toLocaleString()}` : ""}
${input.followerGrowth ? `Follower growth: +${input.followerGrowth}` : ""}
${input.topPerformingPlatform ? `Top performing platform: ${input.topPerformingPlatform}` : ""}

Top performing posts:
${postsContext || "No post data provided"}

Generate a strategic performance narrative that includes:
1. What worked this period (specific patterns from the data)
2. What didn't work (gaps or underperformers)
3. The top 3 content themes that resonated most
4. Specific recommendations for next month (actionable, not generic)
5. One "double down" recommendation — the single highest-leverage action

Return JSON:
{
  "headline": "One-line summary of the period",
  "whatWorked": ["insight 1", "insight 2", "insight 3"],
  "whatDidnt": ["gap 1", "gap 2"],
  "topThemes": ["theme 1", "theme 2", "theme 3"],
  "nextMonthRecommendations": [
    {"action": "...", "rationale": "...", "priority": "high|medium|low"}
  ],
  "doubleDown": "The single most important action to take next month",
  "narrative": "2-3 paragraph strategic narrative written as a CMO briefing"
}`;

    const response = await invokeLLM({
      messages: [
        { role: "system", content: "You are a CMO-level social media strategist. Return only valid JSON." },
        { role: "user", content: prompt },
      ],
    });

    const content = response.choices[0].message.content;
    let parsed: {
      headline: string;
      whatWorked: string[];
      whatDidnt: string[];
      topThemes: string[];
      nextMonthRecommendations: unknown[];
      doubleDown: string;
      narrative: string;
    };
    try {
      parsed = JSON.parse(typeof content === "string" ? content : JSON.stringify(content));
    } catch {
      parsed = {
        headline: "",
        whatWorked: [],
        whatDidnt: [],
        topThemes: [],
        nextMonthRecommendations: [],
        doubleDown: "",
        narrative: "",
      };
    }

    return parsed;
  });

// ─── 8. Sub-Account Content Testing ──────────────────────────────────────────
export const createTestVariant = protectedProcedure
  .input(
    z.object({
      testName: z.string().min(3).max(255),
      topic: z.string().min(3).max(500),
      platform: z.enum(["tiktok", "instagram", "linkedin", "youtube", "x"]),
      variantType: z.enum(["hook", "cta", "format", "length", "angle"]),
      variantA: z.string().min(5),
      variantB: z.string().min(5),
      variantC: z.string().optional(),
      notes: z.string().optional(),
    })
  )
  .mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new Error("DB unavailable");
    const [result] = await db.insert(testVariants).values({
      testName: input.testName,
      topic: input.topic,
      platform: input.platform,
      variantType: input.variantType,
      variantA: input.variantA,
      variantB: input.variantB,
      variantC: input.variantC ?? null,
      notes: input.notes ?? null,
      status: "active",
    });
    return { id: result.insertId, ...input };
  });

export const recordTestResult = protectedProcedure
  .input(
    z.object({
      variantId: z.number(),
      variant: z.enum(["A", "B", "C"]),
      views: z.number().default(0),
      likes: z.number().default(0),
      comments: z.number().default(0),
      shares: z.number().default(0),
      follows: z.number().default(0),
      dmTriggers: z.number().default(0),
      watchTimePercent: z.number().min(0).max(100).optional(),  // 0-100%
      ctr: z.number().min(0).max(100).optional(),               // click-through rate 0-100%
      accountHandle: z.string().optional(),
      notes: z.string().optional(),
    })
  )
  .mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new Error("DB unavailable");
    await db.insert(testResults).values({
      variantId: input.variantId,
      variant: input.variant,
      views: input.views,
      likes: input.likes,
      comments: input.comments,
      shares: input.shares,
      follows: input.follows,
      dmTriggers: input.dmTriggers,
      accountHandle: input.accountHandle ?? null,
      // Store watchTimePercent and ctr in the notes field as JSON
      notes: JSON.stringify({
        watchTimePercent: input.watchTimePercent ?? null,
        ctr: input.ctr ?? null,
        userNotes: input.notes ?? null,
      }),
      engagementRate: input.views > 0
        ? Math.round(((input.likes + input.comments + input.shares) / input.views) * 10000) / 100
        : 0,
    });
    return { success: true };
  });

export const getTestVariants = protectedProcedure
  .input(z.object({ limit: z.number().default(30), status: z.enum(["active", "completed", "all"]).default("all") }))
  .query(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new Error("DB unavailable");
    const rows = await db
      .select()
      .from(testVariants)
      .orderBy(desc(testVariants.createdAt))
      .limit(input.limit);

    const filtered = input.status === "all" ? rows : rows.filter((r: TestVariant) => r.status === input.status);

    // Attach results for each variant
    const withResults = await Promise.all(
      filtered.map(async (v: TestVariant) => {
        const results = await db
          .select()
          .from(testResults)
          .where(eq(testResults.variantId, v.id));
        return { ...v, results };
      })
    );

    return withResults;
  });

export const declareTestWinner = protectedProcedure
  .input(z.object({
    variantId: z.number(),
    winner: z.enum(["A", "B", "C"]),
    winnerReason: z.string().optional(),
    winnerFramework: z.string().optional(),  // e.g. "contradiction", "curiosityGap", "specificity", "socialProof", "transformation"
    userId: z.number().optional(),
  }))
  .mutation(async ({ input, ctx }) => {
    const db = await getDb();
    if (!db) throw new Error("DB unavailable");

    // Update the test variant
    await db.update(testVariants)
      .set({ status: "completed", winner: input.winner, winnerReason: input.winnerReason ?? null })
      .where(eq(testVariants.id, input.variantId));

    // If a framework is provided, upsert the framework_performance record
    if (input.winnerFramework) {
      const [testRow] = await db.select()
        .from(testVariants)
        .where(eq(testVariants.id, input.variantId))
        .limit(1);

      if (testRow) {
        const uid = ctx.user.id;
        const platform = testRow.platform;
        const framework = input.winnerFramework;

        // Check if a record already exists
        const existing = await db.select()
          .from(frameworkPerformance)
          .where(and(
            eq(frameworkPerformance.userId, uid),
            eq(frameworkPerformance.platform, platform),
            eq(frameworkPerformance.framework, framework)
          ))
          .limit(1);

        if (existing.length > 0) {
          // Increment winCount and totalTests
          await db.update(frameworkPerformance)
            .set({
              winCount: sql`${frameworkPerformance.winCount} + 1`,
              totalTests: sql`${frameworkPerformance.totalTests} + 1`,
              lastWonAt: new Date(),
              updatedAt: new Date(),
            })
            .where(eq(frameworkPerformance.id, existing[0].id));
        } else {
          await db.insert(frameworkPerformance).values({
            userId: uid,
            platform,
            framework,
            winCount: 1,
            totalTests: 1,
            lastWonAt: new Date(),
          });
        }

        // Also increment totalTests for all other frameworks on this platform that were in the test
        // (they participated but didn't win)
        const otherFrameworks = ["contradiction", "curiosityGap", "specificity", "socialProof", "transformation"]
          .filter(f => f !== framework);
        // We only increment totalTests for frameworks that have existing records (they've been tested before)
        for (const otherFw of otherFrameworks) {
          const otherExisting = await db.select()
            .from(frameworkPerformance)
            .where(and(
              eq(frameworkPerformance.userId, uid),
              eq(frameworkPerformance.platform, platform),
              eq(frameworkPerformance.framework, otherFw)
            ))
            .limit(1);
          if (otherExisting.length > 0) {
            await db.update(frameworkPerformance)
              .set({
                totalTests: sql`${frameworkPerformance.totalTests} + 1`,
                updatedAt: new Date(),
              })
              .where(eq(frameworkPerformance.id, otherExisting[0].id));
          }
        }
      }
    }

    return { success: true };
  });

// Returns top 3 frameworks per platform ordered by win rate
export const getTopFrameworks = protectedProcedure
  .input(z.object({ platform: z.string().optional() }))
  .query(async ({ input, ctx }) => {
    const db = await getDb();
    if (!db) return [];
    const rows = await db.select()
      .from(frameworkPerformance)
      .where(
        input.platform
          ? and(
              eq(frameworkPerformance.userId, ctx.user.id),
              eq(frameworkPerformance.platform, input.platform)
            )
          : eq(frameworkPerformance.userId, ctx.user.id)
      )
      .orderBy(desc(frameworkPerformance.winCount))
      .limit(10);
    // Sort by win rate (winCount / totalTests)
    return rows
      .map(r => ({
        ...r,
        winRate: r.totalTests > 0 ? Math.round((r.winCount / r.totalTests) * 100) : 0,
      }))
      .sort((a, b) => b.winRate - a.winRate)
      .slice(0, 3);
  });

// ─── Dashboard Summary (for Command Center widget) ──────────────────────────
export const getDashboardSummary = protectedProcedure
  .query(async () => {
    const db = await getDb();
    if (!db) return { recentHooks: [], winningVariant: null, lastRepurposeBook: null };

    // Last 3 hook generations
    const recentHooks = await db
      .select()
      .from(hookGenerations)
      .orderBy(desc(hookGenerations.createdAt))
      .limit(3);

    // Most recent completed test with a winner
    const completedTests = await db
      .select()
      .from(testVariants)
      .where(eq(testVariants.status, "completed"))
      .orderBy(desc(testVariants.createdAt))
      .limit(1);

    const winningVariant = completedTests.length > 0 ? completedTests[0] : null;

    // Most recently used book in repurpose engine
    const lastRepurposeJobRows = await db
      .select({ sourceTitle: repurposeJobs.sourceTitle })
      .from(repurposeJobs)
      .orderBy(desc(repurposeJobs.createdAt))
      .limit(1);
    const lastRepurposeBook = lastRepurposeJobRows.length > 0 ? lastRepurposeJobRows[0].sourceTitle : null;

    return {
      recentHooks: recentHooks.map((h: HookGeneration) => ({
        id: h.id,
        topic: h.topic,
        platform: h.platform,
        topPick: h.topPick,
        createdAt: h.createdAt,
      })),
      winningVariant: winningVariant
        ? {
            id: (winningVariant as TestVariant).id,
            testName: (winningVariant as TestVariant).testName,
            topic: (winningVariant as TestVariant).topic,
            platform: (winningVariant as TestVariant).platform,
            winner: (winningVariant as TestVariant).winner,
            winnerText:
              (winningVariant as TestVariant).winner === "A"
                ? (winningVariant as TestVariant).variantA
                : (winningVariant as TestVariant).winner === "B"
                ? (winningVariant as TestVariant).variantB
                : ((winningVariant as TestVariant).variantC ?? null),
            winnerReason: (winningVariant as TestVariant).winnerReason,
          }
        : null,
      lastRepurposeBook,
    };
  });

// ─── Regenerate Single Hook ─────────────────────────────────────────────────
export const regenerateSingleHook = protectedProcedure
  .input(
    z.object({
      topic: z.string().min(3).max(500),
      platform: z.enum(["tiktok", "instagram", "linkedin", "youtube", "x"]).default("tiktok"),
      framework: z.string(),
      targetPersona: z.string().optional(),
    })
  )
  .mutation(async ({ input }) => {
    const platformContext = {
      tiktok: "TikTok short-form video (spoken aloud in first 3 seconds)",
      instagram: "Instagram Reels (spoken aloud, also works as caption opener)",
      linkedin: "LinkedIn text post (written, first line before 'see more')",
      youtube: "YouTube video (spoken in first 10 seconds)",
      x: "X/Twitter (written, first line of thread)",
    }[input.platform];

    const personaContext = input.targetPersona
      ? `\nTarget persona: ${input.targetPersona}`
      : "";

    const frameworkDescriptions: Record<string, string> = {
      CONTRADICTION: "Start with a statement that contradicts common belief",
      SPECIFICITY: "Use a hyper-specific number, timeframe, or detail",
      TIMEFRAME_TENSION: "Create urgency with a timeframe or deadline",
      POV_SHIFT: "Reframe the viewer's perspective on a familiar problem",
      CURIOSITY_GAP: "Open a loop that can only be closed by watching",
    };
    const fwDesc = frameworkDescriptions[input.framework.toUpperCase()] ?? "Create a compelling hook";

    const prompt = `${PEDRAM_VOICE}

Topic: "${input.topic}"
Platform: ${platformContext}${personaContext}

Write ONE hook using the ${input.framework} framework: ${fwDesc}

Return a JSON object:
{
  "hook": "...",
  "why": "One sentence explaining why this hook works",
  "score": 4
}`;

    const response = await invokeLLM({
      messages: [
        { role: "system", content: "You are a world-class viral content strategist. Return only valid JSON." },
        { role: "user", content: prompt },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "single_hook_response",
          strict: true,
          schema: {
            type: "object",
            properties: {
              hook: { type: "string" },
              why: { type: "string" },
              score: { type: "number" },
            },
            required: ["hook", "why", "score"],
            additionalProperties: false,
          },
        },
      },
    });

    const content = response.choices[0].message.content;
    const parsed = typeof content === "string" ? JSON.parse(content) : content;
    return { hook: parsed.hook as string, why: parsed.why as string, score: parsed.score as number };
  });

// ─── Router export ────────────────────────────────────────────────────────────
export const viralStudioRouter = router({
  generateHooks,
  regenerateSingleHook,
  getRecentHooks,
  generateScript,
  getRecentScripts,
  repurposeContent,
  getRecentRepurposeJobs,
  generateViralTopics,
  getRecentViralTopics,
  optimizeCaption,
  generateDMPlaybook,
  getRecentPlaybooks,
  generateAnalyticsNarrative,
  createTestVariant,
  recordTestResult,
  getTestVariants,
  declareTestWinner,
  getTopFrameworks,
  getDashboardSummary,
});
