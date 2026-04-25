/**
 * ingestGenerateRouter.ts
 *
 * Provides tRPC procedures for the Ingest Inbox:
 *  - ingest.list          → list all ingested research reports
 *  - ingest.generateFromReport → generate LinkedIn, X, Blog, Email Newsletter from a report
 *  - ingest.saveGenerated → save one or more generated pieces to the Command Center
 */
import { z } from "zod";
import { router, protectedProcedure } from "./_core/trpc";
import { getDb } from "./db";
import { ingestReports, contentItems } from "../drizzle/schema";
import { desc, eq } from "drizzle-orm";
import { invokeLLM } from "./_core/llm";
import { getCtaForTopic, appendUtmToCtaUrl, ctaLabelToCampaign } from "./ctaRouter";

// ── Voice prompts for each channel ────────────────────────────────────────────

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
CONTENT PILLARS: Gut health, sleep optimization, stress physiology, ancient practices, functional medicine, the Urban Monk Academy, personal transformation.`;

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
   * Generate LinkedIn, X, Blog, and Email Newsletter content from an ingested report.
   * Auto-applies CTA block (matched by topic/tags), UTM params, and hashtags.
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

      // 4. Generate all 4 content types in parallel
      const [linkedinResult, xResult, blogResult, emailResult] = await Promise.all([
        // LinkedIn
        invokeLLM({
          messages: [
            { role: "system", content: LINKEDIN_VOICE },
            {
              role: "user",
              content: `Write a LinkedIn post based on this research:\n\n${researchContext}\n\nEnd the post with this CTA (naturally woven in, not bolted on):\n${ctaLine(linkedinCtaUrl)}`,
            },
          ],
        }),
        // X / Twitter
        invokeLLM({
          messages: [
            { role: "system", content: X_VOICE },
            {
              role: "user",
              content: `Write an X post based on this research:\n\n${researchContext}\n\nIf character budget allows, end with: ${xCtaUrl || cta.ctaText}`,
            },
          ],
        }),
        // Blog
        invokeLLM({
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
        }),
        // Email Newsletter
        invokeLLM({
          messages: [
            { role: "system", content: EMAIL_VOICE },
            {
              role: "user",
              content: `Write a weekly email newsletter based on this research:\n\n${researchContext}\n\nInclude this CTA naturally in the email:\n${cta.ctaText} ${emailCtaUrl}`,
            },
          ],
        }),
      ]);

      const extractText = (result: any): string =>
        result?.choices?.[0]?.message?.content ?? "";

      return {
        reportId: report.id,
        reportTitle: report.title,
        topic: report.topic,
        ctaLabel: cta.label,
        campaign,
        linkedin: extractText(linkedinResult),
        x: extractText(xResult),
        blog: extractText(blogResult),
        email: extractText(emailResult),
      };
    }),

  /**
   * Save all 4 generated pieces to the Command Center in one call.
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
        blog: z.string(),
        email: z.string(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");

      const platforms: Array<{ platform: "linkedin" | "x" | "blog" | "all"; key: "linkedin" | "x" | "blog" | "email"; label: string }> = [
        { platform: "linkedin", key: "linkedin", label: "LinkedIn" },
        { platform: "x", key: "x", label: "X / Twitter" },
        { platform: "blog", key: "blog", label: "Blog Post" },
        { platform: "all", key: "email", label: "Email Newsletter" },
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
        platform: z.enum(["linkedin", "x", "blog", "all"]),
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
});
