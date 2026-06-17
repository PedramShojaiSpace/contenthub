/**
 * ingestGenerateRouter.ts
 *
 * Provides tRPC procedures for the Ingest Inbox:
 *  - ingest.list              → list all ingested research reports
 *  - ingest.generateFromReport → generate LinkedIn, X, Meta, YouTube, Blog, Email from a report
 *  - ingest.saveGenerated     → save one generated piece to the Command Center
 *  - ingest.saveAll           → save all 6 generated pieces in one call
 */
import { z } from "zod";
import { router, protectedProcedure } from "./_core/trpc";
import { getDb } from "./db";
import { ingestReports, contentItems, scripts } from "../drizzle/schema";
import { sql, desc, eq } from "drizzle-orm";
import { invokeLLM } from "./_core/llm";
import { wrapLLM } from "./llmUtils";
import { getCtaForTopic, appendUtmToCtaUrl, ctaLabelToCampaign } from "./ctaRouter";

// ── Voice prompts ─────────────────────────────────────────────────────────────

const LINKEDIN_VOICE = `You are a ghostwriter for Dr. Pedram Shojai (The Urban Monk) on LinkedIn. His audience is high-achieving corporate executives, entrepreneurs, and professionals aged 35-55.
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
CONTENT PILLARS: Performance optimization, biological hardware, gut-brain connection, energy management, upstream medicine, the cost of ignoring your health, ancient wisdom applied to modern life.`;

const X_VOICE = `You are a ghostwriter for Dr. Pedram Shojai (The Urban Monk) on X (formerly Twitter). His audience is health-curious professionals and wellness seekers.
VOICE: Punchy, direct, thought-provoking. Every word earns its place. Pedram challenges conventional wisdom with science-backed insights. Slightly provocative but always grounded.
CRITICAL OUTPUT RULES:
- Output ONLY the finished post text — nothing else
- Do NOT include any labels, headers, or structural markers
- Do NOT include any meta-commentary, instructions, or explanations
- The output must be copy-paste ready to publish on X
- Start with the first word of the post itself
POST STRUCTURE (invisible — do not label these):
- COMPLETE self-contained thought, 240 characters or fewer (hard ceiling — no exceptions)
- Write SHORT from the start — aim for 160-200 characters
- The post must begin and end naturally as a full idea
- No ellipses, no cut-off sentences
- Add #urbanmonk at the very end if character budget allows
CONTENT PILLARS: Gut health, sleep, stress physiology, upstream medicine, ancient practices, the one thing most doctors don't tell you.`;

const FACEBOOK_VOICE = `You are a ghostwriter for Dr. Pedram Shojai (The Urban Monk) writing a Facebook post. His audience is health-conscious adults aged 35-60 who value wellness, longevity, and natural living.
VOICE: Warm, conversational, community-oriented. Pedram speaks as a trusted friend who happens to be a doctor. Storytelling-forward. Invites discussion and reflection. Facebook allows longer, more personal posts — use that space.
CRITICAL OUTPUT RULES:
- Output ONLY the finished post text — nothing else
- Do NOT include any labels, headers, or structural markers (no "Hook:", "Caption:", "CTA:", "---", or any similar markup)
- Do NOT include any meta-commentary, instructions, or explanations
- The output must be copy-paste ready to publish on Facebook
- Start with the first word of the post itself
POST STRUCTURE (invisible — do not label these):
- Opening: a personal story, relatable question, or surprising fact (2-3 sentences) — hook the scroll
- 3-5 short paragraphs: the insight, why it matters, a practical takeaway, and a personal reflection
- Closing: an engaging question to invite comments (e.g. "Has this happened to you? Tell me below.")
- 150-250 words total — Facebook rewards longer, more personal content
- Add 3-5 relevant hashtags at the very end on their own line — always include #urbanmonk
- Use line breaks between paragraphs for mobile readability
CONTENT PILLARS: Gut health, sleep, stress relief, natural remedies, mindfulness, longevity, family wellness, ancient wisdom for modern life.`;

const INSTAGRAM_VOICE = `You are a ghostwriter for Dr. Pedram Shojai (The Urban Monk) writing an Instagram caption. His audience is health-conscious adults aged 28-50 who follow wellness, biohacking, and mindfulness content.
VOICE: Punchy, visual, aspirational. Pedram is the wise guide who makes you feel empowered. Short, impactful sentences. Every word earns its place. Instagram is visual-first — the caption supports the image.
CRITICAL OUTPUT RULES:
- Output ONLY the finished caption text — nothing else
- Do NOT include any labels, headers, or structural markers (no "Hook:", "Caption:", "CTA:", "---", or any similar markup)
- Do NOT include any meta-commentary, instructions, or explanations
- The output must be copy-paste ready to publish on Instagram
- Start with the first word of the caption itself
CAPTION STRUCTURE (invisible — do not label these):
- Opening line: a bold, scroll-stopping statement or question (1 sentence max) — this is what shows before "more"
- 2-3 short punchy paragraphs: the key insight, why it matters, one actionable step
- Closing: a brief, warm CTA ("Save this.", "Share with someone who needs it.", or a question)
- 80-130 words total — Instagram rewards concise, punchy captions
- Add 8-12 relevant hashtags at the very end on their own line — always include #urbanmonk #theurbanmonk #wellness
- Use single line breaks between paragraphs for mobile readability
CONTENT PILLARS: Gut health, sleep optimization, stress physiology, mindfulness, longevity, ancient practices, functional medicine.`;

const YOUTUBE_VOICE = `You are a ghostwriter for Dr. Pedram Shojai (The Urban Monk) writing a YouTube video description and hook script. His audience is health-conscious adults who want to understand the root causes of their health issues.
VOICE: Educational, engaging, documentary-style. Pedram is the knowledgeable guide who makes complex science accessible. Builds curiosity and trust. Cinematic and purposeful.
CRITICAL OUTPUT RULES:
- Output ONLY the finished YouTube description — nothing else
- Do NOT include any labels, headers, or structural markers (no "Title:", "Description:", "Hook:", "---", or any similar markup)
- Do NOT include any meta-commentary, instructions, or explanations
- The output must be copy-paste ready to paste into YouTube's description field
- Start with the first sentence of the description
STRUCTURE (invisible — do not label these):
- First 2-3 sentences: the hook — a compelling statement of what viewers will learn and why it matters (this appears in search results)
- 1 paragraph: expand on the key insight and what makes this video different
- 1 paragraph: what viewers will take away / key topics covered (no bullet points — flowing prose)
- CTA paragraph: invite them to subscribe or take the next step toward Lights On (lightson.theurbanmonk.com), Upstream (upstream.theurbanmonk.com), the Gateway to Health test (gth.theurbanmonk.com), or the Sleep Masterclass (theacademy.theurbanmonk.com/the-restorative-sleep-masterclass-replay) — match the CTA to the video topic
- 5-8 relevant hashtags at the very end
- 150-250 words total
CONTENT PILLARS: Gut health, sleep science, stress physiology, ancient practices, functional medicine, longevity, Lights On, Upstream.
IMPORTANT: Also include a 2-3 sentence SPOKEN HOOK at the very top (before the description) that Pedram can say directly to camera to open the video. Label it clearly as "SPOKEN HOOK:" on its own line, then a blank line, then the description. This is the only exception to the no-labels rule.`;

const EMAIL_VOICE = `You are a ghostwriter for Dr. Pedram Shojai (The Urban Monk) writing a weekly email newsletter to his subscriber list of health-conscious professionals and wellness seekers.
VOICE: Warm, personal, educational. Pedram writes like a trusted friend who happens to be a doctor. Conversational but substantive. Mix of personal insight, clinical wisdom, and actionable takeaways.
CRITICAL OUTPUT RULES:
- Output ONLY the finished email body text — nothing else
- Do NOT include any labels, headers, or structural markers (no "Subject:", "Body:", "CTA:", "---", or any similar markup)
- Do NOT include any meta-commentary, instructions, or explanations
- The output must be copy-paste ready to paste into an email platform
- Start with the opening salutation or first sentence of the email body
EMAIL STRUCTURE (invisible — do not label these):
- Opening: a personal, relatable hook (1-2 sentences) — a story, observation, or question
- 3-4 paragraphs: the key insight, why it matters, what to do about it
- A clear, natural call to action paragraph (medium friction — invite to learn more or take a step)
- Closing: warm sign-off as Pedram
- 300-500 words total
- No hashtags, no markdown formatting, no bullet lists — flowing prose only
CONTENT PILLARS: Gut health, sleep optimization, stress physiology, ancient practices, functional medicine, Lights On, Upstream, personal transformation.`;

// ── Procedure ─────────────────────────────────────────────────────────────────

export const ingestGenerateRouter = router({
  /**
   * List all ingested research reports, most recent first.
   */
  list: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];
    const reports = await db
      .select()
      .from(ingestReports)
      .orderBy(desc(ingestReports.pushedAt))
      .limit(100);
    return reports.map((r) => ({
      ...r,
      tags: r.tags ? (JSON.parse(r.tags) as string[]) : [],
      pubmedCitations: r.pubmedCitations
        ? (JSON.parse(r.pubmedCitations) as object[])
        : [],
    }));
  }),

  /**
   * Generate LinkedIn, X, Meta, YouTube, Blog, and Email Newsletter content
   * from an ingested report. Auto-applies CTA block, UTM params, and hashtags.
   */
  generateFromReport: protectedProcedure
    .input(
      z.object({
        reportId: z.number(),
        customInstructions: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");

      // 1. Fetch the report
      const [report] = await db
        .select()
        .from(ingestReports)
        .where(eq(ingestReports.id, input.reportId))
        .limit(1);
      if (!report) throw new Error("Report not found");

      const tags: string[] = report.tags ? JSON.parse(report.tags) : [];
      const topicForCta = `${report.topic} ${tags.join(" ")}`;

      // 2. Get the matching CTA block
      const cta = await getCtaForTopic(topicForCta);
      const campaign = ctaLabelToCampaign(cta.label);

      const linkedinCtaUrl = appendUtmToCtaUrl(cta.url, "linkedin", campaign);
      const xCtaUrl = appendUtmToCtaUrl(cta.url, "x", campaign);
      const metaCtaUrl = appendUtmToCtaUrl(cta.url, "meta", campaign);
      const youtubeCtaUrl = appendUtmToCtaUrl(cta.url, "youtube", campaign);
      const blogCtaUrl = appendUtmToCtaUrl(cta.url, "blog", campaign);
      const emailCtaUrl = appendUtmToCtaUrl(cta.url, "all", campaign);

      const ctaLine = (url: string) =>
        url ? `\n\n${cta.ctaText}${url ? " " + url : ""}` : `\n\n${cta.ctaText}`;

      // 3. Build the research context for the AI
      const researchContext = `
RESEARCH REPORT TITLE: ${report.title}
TOPIC: ${report.topic}
TAGS: ${tags.join(", ")}
WORD COUNT: ${report.wordCount ?? "N/A"} | CITATIONS: ${report.citationCount ?? "N/A"}
SOURCE: ${report.source}

RESEARCH NARRATIVE (use this as the factual foundation — do NOT copy it verbatim, synthesize it into Pedram's voice):
${report.narrativeHtml.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 4000)}
${input.customInstructions ? `\nADDITIONAL INSTRUCTIONS: ${input.customInstructions}` : ""}
`.trim();

      // 4. Generate all 7 content types in parallel (Facebook + Instagram separately).
      // Use allSettled so one failing LLM call doesn't kill all 7 — partial results are returned.
      const [linkedinSettled, xSettled, facebookSettled, instagramSettled, youtubeSettled, blogSettled, emailSettled] = await Promise.allSettled([
        // LinkedIn
        wrapLLM(() => invokeLLM({
          messages: [
            { role: "system", content: LINKEDIN_VOICE },
            {
              role: "user",
              content: `Write a LinkedIn post based on this research:\n\n${researchContext}\n\nEnd the post with this CTA (naturally woven in, not bolted on):\n${ctaLine(linkedinCtaUrl)}`,
            },
          ],
        })),
        // X / Twitter
        wrapLLM(() => invokeLLM({
          messages: [
            { role: "system", content: X_VOICE },
            {
              role: "user",
              content: `Write an X post based on this research:\n\n${researchContext}\n\nIf character budget allows, end with: ${xCtaUrl || cta.ctaText}`,
            },
          ],
        })),
        // Facebook
        wrapLLM(() => invokeLLM({
          messages: [
            { role: "system", content: FACEBOOK_VOICE },
            {
              role: "user",
              content: `Write a Facebook post based on this research:\n\n${researchContext}\n\nEnd the post with this CTA (warm, conversational):\n${ctaLine(metaCtaUrl)}`,
            },
          ],
        })),
        // Instagram
        wrapLLM(() => invokeLLM({
          messages: [
            { role: "system", content: INSTAGRAM_VOICE },
            {
              role: "user",
              content: `Write an Instagram caption based on this research:\n\n${researchContext}\n\nEnd with a brief CTA:\n${ctaLine(metaCtaUrl)}`,
            },
          ],
        })),
        // YouTube description + spoken hook
        wrapLLM(() => invokeLLM({
          messages: [
            { role: "system", content: YOUTUBE_VOICE },
            {
              role: "user",
              content: `Write a YouTube video description and spoken hook based on this research:\n\n${researchContext}\n\nInclude this CTA in the description:\n${cta.ctaText} ${youtubeCtaUrl}`,
            },
          ],
        })),
        // Blog
        wrapLLM(() => invokeLLM({
          messages: [
            {
              role: "system",
              content: `You are a ghostwriter for Dr. Pedram Shojai (The Urban Monk) writing a long-form SEO blog post. His audience is health-conscious professionals and wellness seekers.
VOICE: Educational, authoritative, bridges ancient wisdom with modern science. Pedram is the guide. Conversational but substantive. Mix of personal experience and clinical/scientific backing.
CRITICAL OUTPUT RULES:
- Output ONLY the finished blog post — nothing else
- Start with the title as a # H1 heading, then the body
- Use ## for H2 section headings, ### for H3 sub-headings
- No labels, no meta-commentary, no structural markers outside of headings
- The output must be copy-paste ready for WordPress
STRUCTURE: Title (H1) → Hook paragraph → 5-7 H2 sections with body → CTA paragraph → End
LENGTH: 1,200-1,600 words
SEO: Include the primary topic keyword in the title and first paragraph. Use semantic variants in H2s.
HASHTAGS: None — this is a blog post.`,
            },
            {
              role: "user",
              content: `Write a blog post based on this research:\n\n${researchContext}\n\nEnd the post with this CTA paragraph (natural, non-pushy):\n${cta.ctaText} ${blogCtaUrl}`,
            },
          ],
        })),
        // Email Newsletter
        wrapLLM(() => invokeLLM({
          messages: [
            { role: "system", content: EMAIL_VOICE },
            {
              role: "user",
              content: `Write a weekly email newsletter based on this research:\n\n${researchContext}\n\nInclude this CTA naturally in the email:\n${cta.ctaText} ${emailCtaUrl}`,
            },
          ],
        })),
      ]);

      // Extract text from a settled promise result — returns empty string on failure and logs the error
      const extractSettled = (settled: PromiseSettledResult<any>, label: string): string => {
        if (settled.status === "fulfilled") {
          return settled.value?.choices?.[0]?.message?.content ?? "";
        }
        console.error(`[generateFromReport] ${label} generation failed:`, settled.reason?.message ?? settled.reason);
        return "";
      };

      const linkedin = extractSettled(linkedinSettled, "LinkedIn");
      const x = extractSettled(xSettled, "X/Twitter");
      const facebook = extractSettled(facebookSettled, "Facebook");
      const instagram = extractSettled(instagramSettled, "Instagram");
      const youtube = extractSettled(youtubeSettled, "YouTube");
      const blog = extractSettled(blogSettled, "Blog");
      const email = extractSettled(emailSettled, "Email");

      // Count how many failed so the client can show a warning
      const failedCount = [linkedinSettled, xSettled, facebookSettled, instagramSettled, youtubeSettled, blogSettled, emailSettled]
        .filter(s => s.status === "rejected").length;

      return {
        reportId: report.id,
        reportTitle: report.title,
        topic: report.topic,
        ctaLabel: cta.label,
        campaign,
        linkedin,
        x,
        facebook,
        instagram,
        // Keep meta as Facebook for backward compat (saveGenerated uses meta platform)
        meta: facebook,
        youtube,
        blog,
        email,
        partialFailures: failedCount,
      };
    }),

  /**
   * Save all 6 generated pieces to the Command Center in one call.
   * Used by the "Generate All & Save All" button in IngestInbox.
   */
  saveAll: protectedProcedure
    .input(
      z.object({
        reportId: z.number(),
        reportTitle: z.string(),
        ctaLabel: z.string().optional(),
        linkedin: z.string(),
        x: z.string(),
        meta: z.string(),
        youtube: z.string(),
        blog: z.string(),
        email: z.string(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");

      const platforms: Array<{
        platform: "linkedin" | "x" | "meta" | "youtube" | "blog" | "email";
        key: "linkedin" | "x" | "meta" | "youtube" | "blog" | "email";
        label: string;
      }> = [
        { platform: "linkedin", key: "linkedin", label: "LinkedIn" },
        { platform: "x", key: "x", label: "X / Twitter" },
        { platform: "meta", key: "meta", label: "Meta (Facebook/Instagram)" },
        { platform: "youtube", key: "youtube", label: "YouTube" },
        { platform: "blog", key: "blog", label: "Blog Post" },
        { platform: "email", key: "email", label: "Email Newsletter" },
      ];

      const insertedIds: number[] = [];
      for (const p of platforms) {
        const textContent = input[p.key];
        if (!textContent) continue;
        const [result] = await db.insert(contentItems).values({
          title: `${input.reportTitle} — ${p.label}`,
          rawIdea: `[From Ingest Report #${input.reportId}]`,
          platform: p.platform,
          status: "idea",
          textContent,
          ctaBlockLabel: input.ctaLabel ?? null,
          ingestReportId: input.reportId,
          notes: `Generated from ingested research report #${input.reportId}`,
        });
        insertedIds.push((result as any).insertId as number);
      }

      return { saved: insertedIds.length };
    }),

  /**
   * Save one generated piece to the Command Center as a ContentItem.
   */
  saveGenerated: protectedProcedure
    .input(
      z.object({
        reportId: z.number(),
        platform: z.enum(["linkedin", "x", "meta", "youtube", "blog", "email", "carousel"]),
        title: z.string(),
        textContent: z.string(),
        ctaBlockLabel: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");

      const [result] = await db.insert(contentItems).values({
        title: input.title,
        rawIdea: `[From Ingest Report #${input.reportId}]`,
        platform: input.platform,
        status: "idea",
        textContent: input.textContent,
        ctaBlockLabel: input.ctaBlockLabel ?? null,
        ingestReportId: input.reportId,
        notes: `Generated from ingested research report #${input.reportId}`,
      });

      return { contentItemId: (result as any).insertId as number };
    }),

  /**
   * Generate a full teleprompter script from a YouTube ContentItem and save it
   * to the Script Library. Updates the ContentItem's linkedScriptId.
   * Returns the new script ID so the UI can deep-link to it.
   */
  generateAndSaveScript: protectedProcedure
    .input(
      z.object({
        contentItemId: z.number(),
        reportTitle: z.string(),
        youtubeDescription: z.string(),
        topic: z.string(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");

      // Extract the spoken hook if present (first 2-3 sentences after SPOKEN HOOK:)
      const hookMatch = input.youtubeDescription.match(/SPOKEN HOOK:\s*\n+([\s\S]+?)(?:\n\n|$)/i);
      const spokenHook = hookMatch ? hookMatch[1].trim() : "";

      // Build the script generation prompt
      const systemPrompt = `You are a professional teleprompter scriptwriter for Dr. Pedram Shojai (The Urban Monk), OMD — a Daoist monk, functional medicine doctor, and bestselling author. You write in his exact voice: warm, authoritative, grounded in Eastern wisdom and Western science, never preachy, always practical.

Your task: Write a FULL teleprompter-ready YouTube video script on the topic below.

Topic: "${input.reportTitle}"
${spokenHook ? `Opening hook (use this verbatim to open the video): "${spokenHook}"` : ""}

SCRIPT REQUIREMENTS:
- Open with the provided hook if given, or craft a compelling 15-second hook
- Use teleprompter formatting: short paragraphs, natural speech rhythm, no jargon
- Include [PAUSE] markers for emphasis
- Include [B-ROLL: description] cues for the editor
- Structure: Hook → Problem → Pedram's unique insight → Evidence/story → Practical steps → CTA
- CTA must mention the Lights On Course at lightson.theurbanmonk.com
- Length: 8-12 minutes of spoken content (approximately 1,200-1,800 words)
- Voice: conversational, like Pedram is talking directly to one person
- Reference the YouTube description context below for key points to cover

Format the script with clear section headers in [BRACKETS] for the teleprompter operator.`;

      const response = await wrapLLM(() => invokeLLM({
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Write the full teleprompter script for: "${input.reportTitle}"\n\nYouTube description context:\n${input.youtubeDescription.slice(0, 2000)}` },
        ],
      }));

      const rawContent = response?.choices?.[0]?.message?.content;
      const scriptBody: string = typeof rawContent === "string" ? rawContent : "Script generation failed.";

      // Save to scripts table
      const [scriptResult] = await db.insert(scripts).values({
        title: `${input.reportTitle} — YouTube Script`,
        scriptType: "video",
        platform: "youtube",
        productionStatus: "idea",
        scriptBody,
        notes: `Auto-generated from Ingest Inbox YouTube card (ContentItem #${input.contentItemId})`,
        linkedContentItemId: input.contentItemId,
      });
      const scriptId = (scriptResult as any).insertId as number;

      // Update the ContentItem's linkedScriptId
      await db
        .update(contentItems)
        .set({ linkedScriptId: scriptId })
        .where(eq(contentItems.id, input.contentItemId));

      return { scriptId };
    }),

  /**
   * Count ContentItems per ingestReportId so the Inbox can show a "N cards created" badge.
   */
  countByReport: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];
    const rows = await db
      .select({
        ingestReportId: contentItems.ingestReportId,
        count: sql<number>`count(*)`.as("count"),
      })
      .from(contentItems)
      .groupBy(contentItems.ingestReportId);
    return rows
      .filter((r) => r.ingestReportId !== null)
      .map((r) => ({ reportId: r.ingestReportId as number, count: Number(r.count) }));
  }),
});
