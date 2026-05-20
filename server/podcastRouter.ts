/**
 * podcastRouter.ts
 *
 * Handles all Podcast Production operations:
 *  - createEpisode   — save guest intake form
 *  - generateReport  — call Claude with the BINGE-framework prompt and store sections
 *  - getEpisodes     — list all episodes for the current user
 *  - getEpisode      — get a single episode by ID
 *  - updateEpisode   — update intake fields (before report is generated)
 *  - deleteEpisode   — remove an episode
 */

import { TRPCError } from "@trpc/server";
import { desc, eq, and } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "./db";
import { podcastEpisodes } from "../drizzle/schema";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { invokeLLM } from "./_core/llm";
import { notifyOwner } from "./_core/notification";

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Build the full BINGE-framework prompt for Claude.
 * Mirrors the user's base prompt exactly, filling in the episode context fields.
 */
function buildBingePrompt(params: {
  guestName: string;
  guestRole?: string | null;
  guestCompany?: string | null;
  whyNow?: string | null;
  backgroundUrls?: string | null;
  backgroundText?: string | null;
  episodeLengthMin: number;
  showName: string;
  showDescription?: string | null;
  audienceDescription?: string | null;
}): string {
  const guestLabel = [params.guestName, params.guestRole, params.guestCompany]
    .filter(Boolean)
    .join(", ");

  const showLine = params.showDescription
    ? `${params.showName} — ${params.showDescription}`
    : params.showName;

  const audienceLine =
    params.audienceDescription ||
    "Health-conscious adults seeking practical wisdom on longevity, mindfulness, and peak performance.";

  const backgroundSection =
    [
      params.backgroundUrls
        ? `Background URLs to research:\n${params.backgroundUrls}`
        : null,
      params.backgroundText
        ? `Additional background / bio notes:\n${params.backgroundText}`
        : null,
    ]
      .filter(Boolean)
      .join("\n\n") || "No additional background provided — please conduct thorough web research.";

  return `You are my podcast producer and lead researcher. We record guest interviews. My #1 priority is walking in genuinely well-researched, and every episode must be structured using the BINGE framework (below) so the show has a consistent, compelling arc.

THE BINGE FRAMEWORK (Evolved Podcasting) — the spine of every episode:
  B — Bring attention to a big pain or challenge the guest is addressing
  I — Insert an emotional, hook-worthy story
  N — Name the pain again (sharpen it, make the listener feel it)
  G — Give them a way forward through the conversation
  E — Empower them to take action

EPISODE CONTEXT
- Show: ${showLine}
- Audience: ${audienceLine}
- Episode length: ${params.episodeLengthMin} min
- Guest: ${guestLabel}
${params.whyNow ? `- Why this guest, why now: ${params.whyNow}` : ""}

BACKGROUND RESEARCH MATERIAL
${backgroundSection}

DELIVER IN THIS ORDER — use these EXACT section headers (they are parsed programmatically):

## 1. GUEST DOSSIER
   - Background & career arc: how they actually got here, not the bio-blurb
   - Their best/most important work, with specifics
   - Strong opinions & beliefs they're known for (quote where possible)
   - Recurring stories they reuse elsewhere — so I can avoid the tired ones and push for fresh territory
   - Recent activity: last 6-12 months — launches, posts, news, changes
   - Contrarian / surprising / under-covered angles about them
   - 3 things most interviewers MISS or never ask them about
   - Any sensitivities to handle with care
   - Source links for everything, and flag what I should fact-check

## 2. THE BIG PAIN (B)
   Name the single biggest pain or challenge this guest helps solve. One sentence. This is what the whole episode orbits.

## 3. THE THROUGH-LINE
   One sentence: what this episode is really about — the idea a listener repeats to a friend afterward.

## 4. INTERVIEW OUTLINE — mapped to BINGE
   - Cold open / hook
   - B — Bring attention to the big pain: how we open the problem, why it matters to the listener right now
   - I — Insert the story: the emotional, hook-worthy story to draw out of the guest (name the specific story from the dossier to aim for)
   - N — Name the pain again: how we re-sharpen the stakes mid-episode so the listener feels the cost of NOT solving it
   - G — Give the way forward: the guest's framework / solution / steps — the meat of the value
   - E — Empower action: the concrete next step the listener takes today
   - Closing thought + call to action

## 5. QUESTION BANK (ranked best to worst), tagged by BINGE stage
   12-15 questions: warm openers, the meat, 3-4 "go deeper" follow-ups tied to the dossier, and 1-2 bold questions only someone who did the research could ask. Tag each question with its BINGE letter (B/I/N/G/E).

## 6. SOUNDBITE SETUPS
   3 moments most likely to produce a clip-worthy answer — ideally one from the "I" story and one from the "E" empowerment moment.

Do real research — don't guess or generalize. Be specific, cite sources, and flag anything I should verify.`;
}

/**
 * Parse the Claude response into named sections using the numbered headers.
 */
function parseSections(markdown: string): {
  dossier: string;
  bigPain: string;
  throughLine: string;
  outline: string;
  questionBank: string;
  soundbites: string;
} {
  const sectionMap: Record<string, string> = {};
  const sectionOrder = [
    { key: "dossier", pattern: /##\s*1\.\s*GUEST DOSSIER/i },
    { key: "bigPain", pattern: /##\s*2\.\s*THE BIG PAIN/i },
    { key: "throughLine", pattern: /##\s*3\.\s*THE THROUGH-LINE/i },
    { key: "outline", pattern: /##\s*4\.\s*INTERVIEW OUTLINE/i },
    { key: "questionBank", pattern: /##\s*5\.\s*QUESTION BANK/i },
    { key: "soundbites", pattern: /##\s*6\.\s*SOUNDBITE SETUPS/i },
  ];

  // Split on any ## N. header
  const lines = markdown.split("\n");
  let currentKey: string | null = null;
  let currentLines: string[] = [];

  for (const line of lines) {
    let matched = false;
    for (const { key, pattern } of sectionOrder) {
      if (pattern.test(line)) {
        if (currentKey) sectionMap[currentKey] = currentLines.join("\n").trim();
        currentKey = key;
        currentLines = [line];
        matched = true;
        break;
      }
    }
    if (!matched && currentKey) {
      currentLines.push(line);
    }
  }
  if (currentKey) sectionMap[currentKey] = currentLines.join("\n").trim();

  return {
    dossier: sectionMap["dossier"] ?? "",
    bigPain: sectionMap["bigPain"] ?? "",
    throughLine: sectionMap["throughLine"] ?? "",
    outline: sectionMap["outline"] ?? "",
    questionBank: sectionMap["questionBank"] ?? "",
    soundbites: sectionMap["soundbites"] ?? "",
  };
}

// ─── Router ───────────────────────────────────────────────────────────────────

export const podcastRouter = router({
  /** Create a new episode record from the intake form (no generation yet). */
  createEpisode: protectedProcedure
    .input(
      z.object({
        guestName: z.string().min(1),
        guestRole: z.string().optional(),
        guestCompany: z.string().optional(),
        whyNow: z.string().optional(),
        backgroundUrls: z.string().optional(),
        backgroundText: z.string().optional(),
        episodeLengthMin: z.number().min(10).max(180).default(45),
        showName: z.string().default("The Urban Monk Podcast"),
        showDescription: z.string().optional(),
        audienceDescription: z.string().optional(),
        episodeNumber: z.number().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      const [result] = await db.insert(podcastEpisodes).values({
        userId: ctx.user.id,
        guestName: input.guestName,
        guestRole: input.guestRole ?? null,
        guestCompany: input.guestCompany ?? null,
        whyNow: input.whyNow ?? null,
        backgroundUrls: input.backgroundUrls ?? null,
        backgroundText: input.backgroundText ?? null,
        episodeLengthMin: input.episodeLengthMin,
        showName: input.showName,
        showDescription: input.showDescription ?? null,
        audienceDescription: input.audienceDescription ?? null,
        episodeNumber: input.episodeNumber ?? null,
        status: "pending",
      });

      const insertId = (result as unknown as { insertId: number }).insertId;
      const [episode] = await db
        .select()
        .from(podcastEpisodes)
        .where(eq(podcastEpisodes.id, insertId));

      return episode;
    }),

  /** Generate the full BINGE-framework research report using Claude. */
  generateReport: protectedProcedure
    .input(z.object({ episodeId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      const [episode] = await db
        .select()
        .from(podcastEpisodes)
        .where(and(eq(podcastEpisodes.id, input.episodeId), eq(podcastEpisodes.userId, ctx.user.id)));

      if (!episode) throw new TRPCError({ code: "NOT_FOUND", message: "Episode not found" });

      // Mark as generating
      await db
        .update(podcastEpisodes)
        .set({ status: "generating", errorMessage: null })
        .where(eq(podcastEpisodes.id, input.episodeId));

      try {
        const prompt = buildBingePrompt({
          guestName: episode.guestName,
          guestRole: episode.guestRole,
          guestCompany: episode.guestCompany,
          whyNow: episode.whyNow,
          backgroundUrls: episode.backgroundUrls,
          backgroundText: episode.backgroundText,
          episodeLengthMin: episode.episodeLengthMin ?? 45,
          showName: episode.showName ?? "The Urban Monk Podcast",
          showDescription: episode.showDescription,
          audienceDescription: episode.audienceDescription,
        });

        const response = await invokeLLM({
          messages: [
            {
              role: "system",
              content:
                "You are an expert podcast producer and researcher. You produce thorough, specific, well-sourced research reports. Never generalize — always be specific with names, dates, quotes, and sources.",
            },
            { role: "user", content: prompt },
          ],
        });

        const rawContent = response?.choices?.[0]?.message?.content ?? "";
        const reportMarkdown: string = typeof rawContent === "string" ? rawContent : "";

        const sections = parseSections(reportMarkdown);

        await db
          .update(podcastEpisodes)
          .set({
            status: "complete",
            reportMarkdown,
            sectionDossier: sections.dossier,
            sectionBigPain: sections.bigPain,
            sectionThroughLine: sections.throughLine,
            sectionOutline: sections.outline,
            sectionQuestionBank: sections.questionBank,
            sectionSoundbites: sections.soundbites,
            errorMessage: null,
          })
          .where(eq(podcastEpisodes.id, input.episodeId));

        const [updated] = await db
          .select()
          .from(podcastEpisodes)
          .where(eq(podcastEpisodes.id, input.episodeId));

        return updated;
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Unknown error";
        await db
          .update(podcastEpisodes)
          .set({ status: "failed", errorMessage: message })
          .where(eq(podcastEpisodes.id, input.episodeId));
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Report generation failed: ${message}`,
        });
      }
    }),

  /** List all episodes for the current user, newest first. */
  getEpisodes: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

    return db
      .select()
      .from(podcastEpisodes)
      .where(eq(podcastEpisodes.userId, ctx.user.id))
      .orderBy(desc(podcastEpisodes.createdAt));
  }),

  /** Get a single episode by ID (must belong to current user). */
  getEpisode: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      const [episode] = await db
        .select()
        .from(podcastEpisodes)
        .where(and(eq(podcastEpisodes.id, input.id), eq(podcastEpisodes.userId, ctx.user.id)));

      if (!episode) throw new TRPCError({ code: "NOT_FOUND", message: "Episode not found" });
      return episode;
    }),

  /** Update intake fields (only allowed when status is pending or failed). */
  updateEpisode: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        guestName: z.string().min(1).optional(),
        guestRole: z.string().optional(),
        guestCompany: z.string().optional(),
        whyNow: z.string().optional(),
        backgroundUrls: z.string().optional(),
        backgroundText: z.string().optional(),
        episodeLengthMin: z.number().min(10).max(180).optional(),
        showName: z.string().optional(),
        showDescription: z.string().optional(),
        audienceDescription: z.string().optional(),
        episodeNumber: z.number().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      const { id, ...fields } = input;
      const updateData: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(fields)) {
        if (v !== undefined) updateData[k] = v;
      }
      // Reset to pending so report can be regenerated with new data
      updateData.status = "pending";
      updateData.reportMarkdown = null;
      updateData.sectionDossier = null;
      updateData.sectionBigPain = null;
      updateData.sectionThroughLine = null;
      updateData.sectionOutline = null;
      updateData.sectionQuestionBank = null;
      updateData.sectionSoundbites = null;

      await db
        .update(podcastEpisodes)
        .set(updateData)
        .where(and(eq(podcastEpisodes.id, id), eq(podcastEpisodes.userId, ctx.user.id)));

      const [updated] = await db
        .select()
        .from(podcastEpisodes)
        .where(eq(podcastEpisodes.id, id));

      return updated;
    }),

  /** Delete an episode. */
  deleteEpisode: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      await db
        .delete(podcastEpisodes)
        .where(and(eq(podcastEpisodes.id, input.id), eq(podcastEpisodes.userId, ctx.user.id)));

      return { success: true };
    }),

  /**
   * Generate (or regenerate) a unique intake token for an episode and return
   * the shareable URL. The token is a UUID v4 stored on the episode row.
   */
  generateIntakeLink: protectedProcedure
    .input(z.object({ id: z.number(), origin: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      // Verify ownership
      const [episode] = await db
        .select()
        .from(podcastEpisodes)
        .where(and(eq(podcastEpisodes.id, input.id), eq(podcastEpisodes.userId, ctx.user.id)));
      if (!episode) throw new TRPCError({ code: "NOT_FOUND", message: "Episode not found" });

      // Reuse existing token or generate a new UUID v4
      const token = episode.intakeToken ?? crypto.randomUUID();

      await db
        .update(podcastEpisodes)
        .set({ intakeToken: token, intakeStatus: "sent" })
        .where(eq(podcastEpisodes.id, input.id));

      const url = `${input.origin}/podcast-intake/${token}`;
      return { token, url };
    }),

  /**
   * Public — fetch the intake form data by token (no auth required).
   * Returns only the fields the guest needs to see/fill in.
   */
  getIntakeForm: publicProcedure
    .input(z.object({ token: z.string().min(1) }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      const [episode] = await db
        .select()
        .from(podcastEpisodes)
        .where(eq(podcastEpisodes.intakeToken, input.token));

      if (!episode) throw new TRPCError({ code: "NOT_FOUND", message: "Intake form not found. Please check the link and try again." });

      // Return only the fields needed for the public form — never expose userId or report data
      return {
        id: episode.id,
        guestName: episode.guestName,
        guestRole: episode.guestRole,
        guestCompany: episode.guestCompany,
        showName: episode.showName,
        showDescription: episode.showDescription,
        episodeLengthMin: episode.episodeLengthMin,
        intakeStatus: episode.intakeStatus,
        intakeSubmittedAt: episode.intakeSubmittedAt,
      };
    }),

  /**
   * Public — submit the guest intake form by token (no auth required).
   * Saves the guest-provided data, marks the form submitted, and triggers
   * async BINGE report generation in the background.
   */
  submitIntakeForm: publicProcedure
    .input(
      z.object({
        token: z.string().min(1),
        guestName: z.string().min(1, "Your name is required"),
        guestRole: z.string().optional(),
        guestCompany: z.string().optional(),
        whyNow: z.string().optional(),
        backgroundUrls: z.string().optional(),
        backgroundText: z.string().min(10, "Please provide at least a brief bio or background"),
        episodeLengthMin: z.number().min(10).max(180).optional(),
        showDescription: z.string().optional(),
        audienceDescription: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      const [episode] = await db
        .select()
        .from(podcastEpisodes)
        .where(eq(podcastEpisodes.intakeToken, input.token));

      if (!episode) throw new TRPCError({ code: "NOT_FOUND", message: "Intake form not found." });

      if (episode.intakeStatus === "submitted") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "This intake form has already been submitted." });
      }

      const { token: _token, ...fields } = input;

      // Save guest data and mark submitted
      await db
        .update(podcastEpisodes)
        .set({
          ...fields,
          intakeStatus: "submitted",
          intakeSubmittedAt: new Date(),
          status: "pending",
          // Clear any previous report so it regenerates fresh
          reportMarkdown: null,
          sectionDossier: null,
          sectionBigPain: null,
          sectionThroughLine: null,
          sectionOutline: null,
          sectionQuestionBank: null,
          sectionSoundbites: null,
          errorMessage: null,
        })
        .where(eq(podcastEpisodes.intakeToken, input.token));

      // Kick off BINGE report generation asynchronously (fire-and-forget)
      // We re-fetch the updated episode to pass full context to the generator
      const [updated] = await db
        .select()
        .from(podcastEpisodes)
        .where(eq(podcastEpisodes.intakeToken, input.token));

      if (updated) {
        // Notify the owner that a guest has submitted their intake form
        notifyOwner({
          title: `🎙️ Intake form submitted: ${updated.guestName}`,
          content: [
            `**Guest:** ${updated.guestName}${updated.guestRole ? ` — ${updated.guestRole}` : ""}${updated.guestCompany ? ` at ${updated.guestCompany}` : ""}`,
            `**Episode:** ${updated.showName ?? "The Urban Monk Podcast"}`,
            updated.whyNow ? `**Why now:** ${updated.whyNow}` : "",
            ``,
            `The BINGE research report is now generating in the background.`,
          ]
            .filter(Boolean)
            .join("\n"),
        }).catch(() => {
          // Notification failure is non-critical — swallow silently
        });

        // Fire-and-forget: generate the report in the background
        (async () => {
          try {
            await db
              .update(podcastEpisodes)
              .set({ status: "generating" })
              .where(eq(podcastEpisodes.id, updated.id));

            const prompt = buildBingePrompt({
              guestName: updated.guestName,
              guestRole: updated.guestRole,
              guestCompany: updated.guestCompany,
              whyNow: updated.whyNow,
              backgroundUrls: updated.backgroundUrls,
              backgroundText: updated.backgroundText,
              episodeLengthMin: updated.episodeLengthMin ?? 45,
              showName: updated.showName ?? "The Urban Monk Podcast",
              showDescription: updated.showDescription,
              audienceDescription: updated.audienceDescription,
            });

            const response = await invokeLLM({
              messages: [
                {
                  role: "system",
                  content:
                    "You are an expert podcast producer and researcher. You produce thorough, specific, well-sourced research reports. Never generalize — always be specific with names, dates, quotes, and sources.",
                },
                { role: "user", content: prompt },
              ],
            });

            const rawContent = response?.choices?.[0]?.message?.content ?? "";
            const reportMarkdown: string = typeof rawContent === "string" ? rawContent : "";
            const sections = parseSections(reportMarkdown);

            await db
              .update(podcastEpisodes)
              .set({
                status: "complete",
                reportMarkdown,
                sectionDossier: sections.dossier,
                sectionBigPain: sections.bigPain,
                sectionThroughLine: sections.throughLine,
                sectionOutline: sections.outline,
                sectionQuestionBank: sections.questionBank,
                sectionSoundbites: sections.soundbites,
                errorMessage: null,
              })
              .where(eq(podcastEpisodes.id, updated.id));
          } catch (err) {
            await db
              .update(podcastEpisodes)
              .set({ status: "failed", errorMessage: String(err) })
              .where(eq(podcastEpisodes.id, updated.id));
          }
        })();
      }

      return { success: true, message: "Thank you! Your information has been submitted. We'll be in touch soon." };
    }),

  /**
   * generateShowNotes
   * Generates a concise, paste-ready show notes block for a completed episode:
   *   - 200-word summary paragraph
   *   - 3 key takeaways (bullet points)
   *   - CTA paragraph pointing to the Urban Monk Academy
   * Saves the result to the showNotes column.
   */
  generateShowNotes: protectedProcedure
    .input(z.object({ episodeId: z.number().int().positive() }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      const [episode] = await db
        .select()
        .from(podcastEpisodes)
        .where(and(eq(podcastEpisodes.id, input.episodeId), eq(podcastEpisodes.userId, ctx.user.id)));

      if (!episode) throw new TRPCError({ code: "NOT_FOUND", message: "Episode not found." });

      if (episode.status !== "complete" || !episode.reportMarkdown) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Generate the BINGE report first before creating show notes.",
        });
      }

      const guestLabel = [episode.guestName, episode.guestRole, episode.guestCompany]
        .filter(Boolean)
        .join(", ");

      const prompt = [
        `You are writing show notes for a podcast episode of The Urban Monk Podcast, hosted by Dr. Pedram Shojai, OMD.`,
        ``,
        `Guest: ${guestLabel}`,
        episode.whyNow ? `Why this guest, why now: ${episode.whyNow}` : "",
        ``,
        `Here is the full BINGE-framework research report for this episode:`,
        `---`,
        episode.reportMarkdown,
        `---`,
        ``,
        `Using the report above, write show notes in this exact structure:`,
        ``,
        `## Episode Summary`,
        `Write a compelling 200-word summary paragraph in Pedram's warm, direct, wisdom-forward voice. `,
        `Highlight the guest's expertise, the core problem they solve, and 1-2 surprising insights from the conversation.`,
        `No bullet points in this section — flowing prose only.`,
        ``,
        `## Key Takeaways`,
        `List exactly 3 key takeaways as concise, actionable bullet points. Each should be a complete sentence.`,
        `Format as:`,
        `- [Takeaway 1]`,
        `- [Takeaway 2]`,
        `- [Takeaway 3]`,
        ``,
        `## Connect & Go Deeper`,
        `Write a 2-3 sentence CTA paragraph inviting listeners to join the Urban Monk Academy at theurbanmonk.com/academy `,
        `for deeper teachings, community, and tools to apply what they learned in this episode.`,
        `Keep it warm and genuine — not salesy.`,
        ``,
        `Output ONLY the three sections above with their ## headers. No preamble, no meta-commentary.`,
      ]
        .filter((l) => l !== undefined)
        .join("\n");

      const response = await invokeLLM({
        messages: [
          {
            role: "system",
            content:
              "You are an expert podcast producer and copywriter. You write show notes that are engaging, specific, and conversion-focused without being pushy.",
          },
          { role: "user", content: prompt },
        ],
      });

      const rawContent = response?.choices?.[0]?.message?.content ?? "";
      const showNotes: string = typeof rawContent === "string" ? rawContent : "";

      await db
        .update(podcastEpisodes)
        .set({ showNotes })
        .where(eq(podcastEpisodes.id, input.episodeId));

      return { showNotes };
    }),
});
