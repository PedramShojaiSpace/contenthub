import { z } from "zod";
import { protectedProcedure, router } from "./_core/trpc";
import { getDb } from "./db";
import {
  webinarIntelligence,
  webinarSessions,
  WebinarIntelligence,
} from "../drizzle/schema";
import { eq, desc, and } from "drizzle-orm";
import { invokeLLM } from "./_core/llm";

// ─── Webinar Intelligence Router ──────────────────────────────────────────────
// Stores and processes attendee survey data (pre-registration + post-webinar)
// per webinar session. AI extracts themes, pain points, motivations, and exact
// language that feeds into all content generation surfaces.

export const webinarIntelligenceRouter = router({
  // List all intelligence records for a webinar session
  listBySession: protectedProcedure
    .input(z.object({ webinarSessionId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      return db
        .select()
        .from(webinarIntelligence)
        .where(eq(webinarIntelligence.webinarSessionId, input.webinarSessionId))
        .orderBy(desc(webinarIntelligence.importedAt));
    }),

  // Get a single intelligence record
  get: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return null;
      const [row] = await db
        .select()
        .from(webinarIntelligence)
        .where(eq(webinarIntelligence.id, input.id));
      return row ?? null;
    }),

  // Import raw survey responses for a webinar session
  importResponses: protectedProcedure
    .input(
      z.object({
        webinarSessionId: z.number(),
        surveyType: z.enum(["pre_registration", "post_webinar"]),
        rawResponses: z.string().min(10, "Please paste at least some survey responses"),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");

      // Count approximate responses (lines or JSON entries)
      let responseCount = 0;
      try {
        const parsed = JSON.parse(input.rawResponses);
        responseCount = Array.isArray(parsed) ? parsed.length : 1;
      } catch {
        // Not JSON — count non-empty lines as rough proxy
        responseCount = input.rawResponses
          .split("\n")
          .filter((l) => l.trim().length > 0).length;
      }

      const [result] = await db.insert(webinarIntelligence).values({
        webinarSessionId: input.webinarSessionId,
        surveyType: input.surveyType,
        rawResponses: input.rawResponses,
        responseCount,
        notes: input.notes,
      });
      const insertId = (result as { insertId: number }).insertId;
      const [created] = await db
        .select()
        .from(webinarIntelligence)
        .where(eq(webinarIntelligence.id, insertId));
      return created ?? null;
    }),

  // Run AI extraction on a raw import record
  extractIntelligence: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");

      const [record] = await db
        .select()
        .from(webinarIntelligence)
        .where(eq(webinarIntelligence.id, input.id));
      if (!record) throw new Error("Record not found");
      if (!record.rawResponses) throw new Error("No raw responses to extract from");

      // Fetch the webinar session topic for context
      const [session] = await db
        .select()
        .from(webinarSessions)
        .where(eq(webinarSessions.id, record.webinarSessionId));
      const webinarTopic = session?.topic ?? "Urban Monk webinar";
      const surveyTypeLabel =
        record.surveyType === "pre_registration"
          ? "pre-webinar registration form"
          : "post-webinar survey";

      const systemPrompt = `You are a marketing intelligence analyst for Dr. Pedram Shojai (The Urban Monk). Your job is to analyze ${surveyTypeLabel} responses from attendees of his webinar on "${webinarTopic}" and extract actionable intelligence.

Extract the following in JSON format:
- themes: string[] — top 5-10 recurring themes (e.g. "chronic fatigue", "gut health confusion")
- painPoints: string[] — specific problems/struggles mentioned (verbatim-ish, 8-12 items)
- motivations: string[] — why they showed up / what they hoped to get (6-10 items)
- questions: string[] — questions they had or wanted answered (6-10 items)
- language: string[] — exact phrases and words the audience uses to describe their problems (10-15 items — these are gold for copywriting)
- summary: string — a 2-3 paragraph narrative describing who showed up, what drove them, and what this means for content and marketing strategy

Return ONLY valid JSON with these exact keys: themes, painPoints, motivations, questions, language, summary`;

      const response = await invokeLLM({
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: `Here are the ${surveyTypeLabel} responses (${record.responseCount} respondents):\n\n${record.rawResponses.slice(0, 12000)}`,
          },
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "webinar_intelligence",
            strict: true,
            schema: {
              type: "object",
              properties: {
                themes: { type: "array", items: { type: "string" } },
                painPoints: { type: "array", items: { type: "string" } },
                motivations: { type: "array", items: { type: "string" } },
                questions: { type: "array", items: { type: "string" } },
                language: { type: "array", items: { type: "string" } },
                summary: { type: "string" },
              },
              required: ["themes", "painPoints", "motivations", "questions", "language", "summary"],
              additionalProperties: false,
            },
          },
        },
      });

      const rawContent = response.choices?.[0]?.message?.content;
      const rawContentStr = typeof rawContent === "string" ? rawContent : null;
      if (!rawContentStr) throw new Error("AI extraction failed — no response");

      let extracted: {
        themes: string[];
        painPoints: string[];
        motivations: string[];
        questions: string[];
        language: string[];
        summary: string;
      };
      try {
        extracted = JSON.parse(rawContentStr);
      } catch {
        throw new Error("AI returned invalid JSON");
      }

      // Save extracted intelligence back to the record
      await db
        .update(webinarIntelligence)
        .set({
          extractedThemes: JSON.stringify(extracted.themes),
          extractedPainPoints: JSON.stringify(extracted.painPoints),
          extractedMotivations: JSON.stringify(extracted.motivations),
          extractedQuestions: JSON.stringify(extracted.questions),
          extractedLanguage: JSON.stringify(extracted.language),
          aiSummary: extracted.summary,
          extractedAt: new Date(),
        })
        .where(eq(webinarIntelligence.id, input.id));

      const [updated] = await db
        .select()
        .from(webinarIntelligence)
        .where(eq(webinarIntelligence.id, input.id));
      return updated ?? null;
    }),

  // Delete a record
  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      await db.delete(webinarIntelligence).where(eq(webinarIntelligence.id, input.id));
      return { success: true };
    }),
});

// ─── Context Block for Content Generation ────────────────────────────────────
// Returns a formatted string block injected into all AI generation prompts.
// Aggregates the most recent extracted intelligence across all webinar sessions.
export async function getWebinarIntelligenceContextBlock(
  topic: string,
  limit = 3
): Promise<string> {
  try {
    const db = await getDb();
    if (!db) return "";

    // Get the most recently extracted records that have intelligence
    const records = await db
      .select()
      .from(webinarIntelligence)
      .where(
        // Only include records that have been extracted
        and(
          // extractedAt is not null — use a raw check
          eq(webinarIntelligence.surveyType, "pre_registration")
        )
      )
      .orderBy(desc(webinarIntelligence.extractedAt))
      .limit(limit * 2); // fetch more, then filter

    const extracted = records.filter(
      (r) => r.extractedAt && r.extractedPainPoints
    ).slice(0, limit);

    if (extracted.length === 0) return "";

    const allPainPoints: string[] = [];
    const allMotivations: string[] = [];
    const allLanguage: string[] = [];
    const allThemes: string[] = [];

    for (const r of extracted) {
      try {
        if (r.extractedPainPoints) allPainPoints.push(...JSON.parse(r.extractedPainPoints));
        if (r.extractedMotivations) allMotivations.push(...JSON.parse(r.extractedMotivations));
        if (r.extractedLanguage) allLanguage.push(...JSON.parse(r.extractedLanguage));
        if (r.extractedThemes) allThemes.push(...JSON.parse(r.extractedThemes));
      } catch {
        // Skip malformed JSON
      }
    }

    // Deduplicate and limit
    const unique = <T>(arr: T[]) => Array.from(new Set(arr));
    const painPoints = unique(allPainPoints).slice(0, 8);
    const motivations = unique(allMotivations).slice(0, 6);
    const language = unique(allLanguage).slice(0, 10);
    const themes = unique(allThemes).slice(0, 6);

    if (painPoints.length === 0 && motivations.length === 0) return "";

    let block = "\n\n--- WEBINAR INTELLIGENCE (Real Audience Data) ---";
    if (themes.length > 0) {
      block += `\nTop audience themes: ${themes.join("; ")}`;
    }
    if (painPoints.length > 0) {
      block += `\nAudience pain points (use these to frame the problem): ${painPoints.join("; ")}`;
    }
    if (motivations.length > 0) {
      block += `\nWhy they showed up (use these for hooks and CTAs): ${motivations.join("; ")}`;
    }
    if (language.length > 0) {
      block += `\nExact language your audience uses (mirror this in copy): "${language.join('", "')}"`;
    }
    block += "\n--- END WEBINAR INTELLIGENCE ---";

    return block;
  } catch (err) {
    console.warn("[WebinarIntelligence] Could not load context block:", err);
    return "";
  }
}
