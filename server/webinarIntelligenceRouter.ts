import { z } from "zod";
import { protectedProcedure, router } from "./_core/trpc";
import { getDb } from "./db";
import {
  webinarIntelligence,
  webinarSessions,
  avatarProfiles,
  WebinarIntelligence,
  AvatarProfile,
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

  // Import responses directly from Typeform API
  importFromTypeform: protectedProcedure
    .input(
      z.object({
        webinarSessionId: z.number(),
        typeformId: z.string().min(1, "Typeform form ID is required"),
        surveyType: z.enum(["pre_registration", "post_webinar"]),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");

      const apiKey = process.env.TYPEFORM_API_KEY;
      if (!apiKey) throw new Error("TYPEFORM_API_KEY not configured");

      // Fetch form structure to get field labels
      const formRes = await fetch(`https://api.typeform.com/forms/${input.typeformId}`, {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      if (!formRes.ok) throw new Error(`Typeform API error: ${formRes.status} ${formRes.statusText}`);
      const form = await formRes.json() as {
        title: string;
        fields?: Array<{ id: string; title: string; type: string }>;
      };

      // Build a field ID → label map
      const fieldMap: Record<string, string> = {};
      for (const f of form.fields ?? []) {
        fieldMap[f.id] = f.title;
      }

      // Fetch all responses (paginate up to 1000)
      let allItems: Array<{
        submitted_at: string;
        answers?: Array<{
          type: string;
          field: { id: string };
          text?: string;
          choice?: { label: string };
          choices?: { labels: string[] };
          number?: number;
          boolean?: boolean;
          email?: string;
        }>;
      }> = [];
      let pageToken: string | null = null;
      do {
        const url = `https://api.typeform.com/forms/${input.typeformId}/responses?page_size=200${
          pageToken ? `&before=${pageToken}` : ""
        }`;
        const respRes = await fetch(url, { headers: { Authorization: `Bearer ${apiKey}` } });
        if (!respRes.ok) throw new Error(`Typeform responses error: ${respRes.status}`);
        const page = await respRes.json() as {
          items: typeof allItems;
          page_count: number;
          total_items: number;
        };
        allItems = allItems.concat(page.items ?? []);
        // If we got a full page, there may be more — use last item's token
        pageToken = page.items?.length === 200 ? page.items[page.items.length - 1].submitted_at : null;
      } while (pageToken && allItems.length < 1000);

      const responseCount = allItems.length;

      // Format responses as readable text for AI extraction
      const lines: string[] = [
        `=== ${form.title} ===`,
        `Total responses: ${responseCount}`,
        `Fetched: ${new Date().toISOString()}`,
        "",
      ];

      allItems.forEach((item, idx) => {
        lines.push(`--- Response ${idx + 1} (${new Date(item.submitted_at).toLocaleDateString()}) ---`);
        for (const answer of item.answers ?? []) {
          const label = fieldMap[answer.field.id] ?? answer.field.id;
          let value = "";
          if (answer.type === "text" || answer.type === "short_text" || answer.type === "long_text") {
            value = answer.text ?? "";
          } else if (answer.type === "choice") {
            value = answer.choice?.label ?? "";
          } else if (answer.type === "choices") {
            value = (answer.choices?.labels ?? []).join(", ");
          } else if (answer.type === "number" || answer.type === "rating") {
            value = String(answer.number ?? "");
          } else if (answer.type === "boolean" || answer.type === "yes_no") {
            value = answer.boolean ? "Yes" : "No";
          } else if (answer.type === "email") {
            value = answer.email ?? "";
          }
          if (value.trim()) {
            lines.push(`Q: ${label.substring(0, 100)}`);
            lines.push(`A: ${value}`);
            lines.push("");
          }
        }
      });

      const rawResponses = lines.join("\n");

      const [result] = await db.insert(webinarIntelligence).values({
        webinarSessionId: input.webinarSessionId,
        surveyType: input.surveyType,
        rawResponses,
        responseCount,
        notes: input.notes ?? `Imported from Typeform: ${input.typeformId} — ${responseCount} responses`,
      });
      const insertId = (result as { insertId: number }).insertId;
      const [created] = await db
        .select()
        .from(webinarIntelligence)
        .where(eq(webinarIntelligence.id, insertId));
      return created ?? null;
    }),

  // Ensure a webinar session exists (upsert by topic)
  ensureSession: protectedProcedure
    .input(z.object({
      topic: z.string(),
      webinarDate: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      // Check if a session with this topic already exists
      const existing = await db
        .select()
        .from(webinarSessions)
        .where(eq(webinarSessions.topic, input.topic));
      if (existing.length > 0) return existing[0];
      // Create it
      const [result] = await db.insert(webinarSessions).values({
        topic: input.topic,
        webinarDate: input.webinarDate ?? null,
        status: "draft",
        targetLengthMinutes: 60,
      });
      const insertId = (result as { insertId: number }).insertId;
      const [created] = await db
        .select()
        .from(webinarSessions)
        .where(eq(webinarSessions.id, insertId));
      return created ?? null;
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

  // ─── Avatar Intelligence Repository ───────────────────────────────────────

  // List all avatar profiles
  listAvatarProfiles: protectedProcedure
    .query(async () => {
      const db = await getDb();
      if (!db) return [];
      return db
        .select()
        .from(avatarProfiles)
        .orderBy(desc(avatarProfiles.lastUpdatedAt));
    }),

  // Get a single avatar profile by slug
  getAvatarProfile: protectedProcedure
    .input(z.object({ slug: z.string() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return null;
      const [row] = await db
        .select()
        .from(avatarProfiles)
        .where(eq(avatarProfiles.productSlug, input.slug));
      return row ?? null;
    }),

  // Create a new avatar profile for a product
  createAvatarProfile: protectedProcedure
    .input(
      z.object({
        productName: z.string().min(2),
        productSlug: z.string().min(2),
        productDescription: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      const [result] = await db.insert(avatarProfiles).values({
        productName: input.productName,
        productSlug: input.productSlug,
        productDescription: input.productDescription ?? null,
      });
      const insertId = (result as { insertId: number }).insertId;
      const [created] = await db
        .select()
        .from(avatarProfiles)
        .where(eq(avatarProfiles.id, insertId));
      return created ?? null;
    }),

  // Aggregate extracted intelligence into an avatar profile
  // This is the core "compound intelligence" operation:
  // - Takes one intelligence record (already extracted)
  // - Merges its insights with the existing avatar profile via LLM synthesis
  // - Produces a richer, more accurate cumulative audience profile
  aggregateToAvatarProfile: protectedProcedure
    .input(
      z.object({
        intelligenceId: z.number(),
        avatarProfileId: z.number(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");

      // Load the intelligence record
      const [intel] = await db
        .select()
        .from(webinarIntelligence)
        .where(eq(webinarIntelligence.id, input.intelligenceId));
      if (!intel) throw new Error("Intelligence record not found");
      if (!intel.extractedAt) throw new Error("Run AI extraction first before aggregating");

      // Load the webinar session for context
      const [session] = await db
        .select()
        .from(webinarSessions)
        .where(eq(webinarSessions.id, intel.webinarSessionId));

      // Load the existing avatar profile
      const [profile] = await db
        .select()
        .from(avatarProfiles)
        .where(eq(avatarProfiles.id, input.avatarProfileId));
      if (!profile) throw new Error("Avatar profile not found");

      const parseArr = (json: string | null): string[] => {
        if (!json) return [];
        try { return JSON.parse(json); } catch { return []; }
      };

      // New intelligence from this webinar
      const newPainPoints = parseArr(intel.extractedPainPoints);
      const newMotivations = parseArr(intel.extractedMotivations);
      const newLanguage = parseArr(intel.extractedLanguage);
      const newObjections: string[] = []; // extracted from questions
      const newThemes = parseArr(intel.extractedThemes);
      const newQuestions = parseArr(intel.extractedQuestions);

      // Existing cumulative intelligence
      const existingPainPoints = parseArr(profile.cumulativePainPoints);
      const existingMotivations = parseArr(profile.cumulativeMotivations);
      const existingLanguage = parseArr(profile.cumulativeLanguage);
      const existingObjections = parseArr(profile.cumulativeObjections);
      const existingThemes = parseArr(profile.cumulativeThemes);

      const webinarLabel = session?.topic ?? `Webinar #${(profile.webinarCount ?? 0) + 1}`;
      const newRespondents = intel.responseCount ?? 0;
      const totalRespondents = (profile.totalRespondents ?? 0) + newRespondents;
      const webinarCount = (profile.webinarCount ?? 0) + 1;

      // Build the LLM synthesis prompt
      const systemPrompt = `You are a market research analyst and audience intelligence specialist for Dr. Pedram Shojai's Urban Monk brand. Your job is to synthesize audience intelligence from multiple webinars into a single, ever-improving avatar profile for the "${profile.productName}" product.

You are merging NEW intelligence from a recent webinar ("${webinarLabel}", ${newRespondents} respondents) with the EXISTING cumulative profile (${profile.webinarCount ?? 0} previous webinars, ${profile.totalRespondents ?? 0} total respondents).

Your output must be a JSON object with these exact fields:
- cumulativePainPoints: string[] — top 10 most important, deduplicated, merged pain points (most common/severe first)
- cumulativeMotivations: string[] — top 8 merged motivations (why they show up)
- cumulativeLanguage: string[] — top 15 exact phrases/words the audience uses (most distinctive first)
- cumulativeObjections: string[] — top 6 objections/hesitations/barriers
- cumulativeThemes: string[] — top 8 recurring themes across all webinars
- demographicPatterns: string — 2-3 sentences describing who this audience is (age, profession, life stage, health situation)
- avatarNarrative: string — A vivid 3-4 sentence avatar description in second person ("You are...") that captures who this person is, what they're struggling with, and why they're seeking help
- webinarBriefContext: string — A pre-built context block (300-400 words) that can be injected into any webinar creation prompt to instantly brief the AI on this audience. Include their top pain points, exact language, motivations, and what they need to hear.

Merge intelligently — don't just concatenate. Identify patterns that appear across multiple webinars (those are gold), surface new insights from the latest webinar, and retire insights that no longer appear relevant.`;

      const userMessage = `EXISTING CUMULATIVE PROFILE (${profile.webinarCount ?? 0} webinars, ${profile.totalRespondents ?? 0} respondents):

Pain Points: ${existingPainPoints.join(" | ") || "(none yet — this is the first webinar)"}
Motivations: ${existingMotivations.join(" | ") || "(none yet)"}
Language: ${existingLanguage.join(" | ") || "(none yet)"}
Objections: ${existingObjections.join(" | ") || "(none yet)"}
Themes: ${existingThemes.join(" | ") || "(none yet)"}
Narrative: ${profile.avatarNarrative ?? "(none yet)"}

---

NEW INTELLIGENCE FROM "${webinarLabel}" (${newRespondents} respondents):

Pain Points: ${newPainPoints.join(" | ") || "(none extracted)"}
Motivations: ${newMotivations.join(" | ") || "(none extracted)"}
Language: ${newLanguage.join(" | ") || "(none extracted)"}
Themes: ${newThemes.join(" | ") || "(none extracted)"}
Questions they asked: ${newQuestions.join(" | ") || "(none extracted)"}
AI Summary: ${intel.aiSummary ?? "(no summary)"}

---

Synthesize these into an updated cumulative avatar profile. Return ONLY valid JSON.`;

      const response = await invokeLLM({
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMessage },
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "avatar_profile_synthesis",
            strict: true,
            schema: {
              type: "object",
              properties: {
                cumulativePainPoints: { type: "array", items: { type: "string" } },
                cumulativeMotivations: { type: "array", items: { type: "string" } },
                cumulativeLanguage: { type: "array", items: { type: "string" } },
                cumulativeObjections: { type: "array", items: { type: "string" } },
                cumulativeThemes: { type: "array", items: { type: "string" } },
                demographicPatterns: { type: "string" },
                avatarNarrative: { type: "string" },
                webinarBriefContext: { type: "string" },
              },
              required: [
                "cumulativePainPoints", "cumulativeMotivations", "cumulativeLanguage",
                "cumulativeObjections", "cumulativeThemes", "demographicPatterns",
                "avatarNarrative", "webinarBriefContext",
              ],
              additionalProperties: false,
            },
          },
        },
      });

      const rawContent = response.choices?.[0]?.message?.content;
      const synthesized = typeof rawContent === "string" ? JSON.parse(rawContent) : rawContent;

      // Update the avatar profile with synthesized intelligence
      await db
        .update(avatarProfiles)
        .set({
          cumulativePainPoints: JSON.stringify(synthesized.cumulativePainPoints),
          cumulativeMotivations: JSON.stringify(synthesized.cumulativeMotivations),
          cumulativeLanguage: JSON.stringify(synthesized.cumulativeLanguage),
          cumulativeObjections: JSON.stringify(synthesized.cumulativeObjections),
          cumulativeThemes: JSON.stringify(synthesized.cumulativeThemes),
          demographicPatterns: synthesized.demographicPatterns,
          avatarNarrative: synthesized.avatarNarrative,
          webinarBriefContext: synthesized.webinarBriefContext,
          totalRespondents,
          webinarCount,
          lastUpdatedAt: new Date(),
        })
        .where(eq(avatarProfiles.id, input.avatarProfileId));

      // Mark the intelligence record as aggregated
      await db
        .update(webinarIntelligence)
        .set({
          avatarProfileId: input.avatarProfileId,
          aggregatedAt: new Date(),
        })
        .where(eq(webinarIntelligence.id, input.intelligenceId));

      // Return the updated profile
      const [updated] = await db
        .select()
        .from(avatarProfiles)
        .where(eq(avatarProfiles.id, input.avatarProfileId));

      return {
        profile: updated,
        webinarLabel,
        newRespondents,
        totalRespondents,
        webinarCount,
      };
    }),

  // ─── Rewrite Webinar Outline from Intelligence ────────────────────────────
  // Takes extracted survey intelligence and rewrites the webinar outline to
  // better match what the actual audience needs. Returns both the revised
  // outline and a "what changed and why" commentary block.
  rewriteOutlineFromIntelligence: protectedProcedure
    .input(
      z.object({
        intelligenceId: z.number(),
        webinarSessionId: z.number(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");

      // Load the intelligence record
      const [intel] = await db
        .select()
        .from(webinarIntelligence)
        .where(eq(webinarIntelligence.id, input.intelligenceId));
      if (!intel) throw new Error("Intelligence record not found");
      if (!intel.extractedAt) throw new Error("Run AI extraction first before rewriting the outline");

      // Load the webinar session
      const [session] = await db
        .select()
        .from(webinarSessions)
        .where(eq(webinarSessions.id, input.webinarSessionId));
      if (!session) throw new Error("Webinar session not found");

      // Parse extracted intelligence
      const parseArr = (json: string | null): string[] => {
        if (!json) return [];
        try { return JSON.parse(json); } catch { return []; }
      };
      const themes = parseArr(intel.extractedThemes);
      const painPoints = parseArr(intel.extractedPainPoints);
      const motivations = parseArr(intel.extractedMotivations);
      const questions = parseArr(intel.extractedQuestions);
      const language = parseArr(intel.extractedLanguage);
      const summary = intel.aiSummary ?? "";

      const existingOutline = session.outline ?? "(No existing outline — generate from scratch)";
      const surveyTypeLabel = intel.surveyType === "pre_registration"
        ? "pre-webinar registration form"
        : "post-webinar survey";

      const systemPrompt = `You are Dr. Pedram Shojai's expert webinar strategist. You have just analyzed real ${surveyTypeLabel} responses from ${intel.responseCount ?? "multiple"} attendees of his webinar on "${session.topic}". Your job is to rewrite the webinar outline to directly address what this specific audience actually needs — using their own language, their real pain points, and their stated motivations.

You write in Pedram's voice: warm, authoritative, direct, grounded in ancient wisdom and modern science.

=== REAL AUDIENCE INTELLIGENCE (from ${intel.responseCount ?? "actual"} survey respondents) ===

AUDIENCE SUMMARY:
${summary}

TOP THEMES THEY CARE ABOUT:
${themes.map((t, i) => `${i + 1}. ${t}`).join("\n")}

REAL PAIN POINTS (use these verbatim in the hook and problem section):
${painPoints.map((p, i) => `${i + 1}. ${p}`).join("\n")}

WHY THEY SHOWED UP (use these for hooks and CTAs):
${motivations.map((m, i) => `${i + 1}. ${m}`).join("\n")}

QUESTIONS THEY WANTED ANSWERED (address these explicitly in the outline):
${questions.map((q, i) => `${i + 1}. ${q}`).join("\n")}

EXACT LANGUAGE THEY USE (mirror these phrases in the copy — this is gold):
${language.map((l) => `"${l}"`).join(", ")}

=== EXISTING WEBINAR OUTLINE ===
${existingOutline.slice(0, 3000)}

=== YOUR TASK ===
Rewrite the webinar outline so it speaks directly to THIS audience. For each major section, show:
1. What you changed and why (1–2 sentences referencing the specific intelligence that drove the change)
2. The revised content for that section

Format your response as:

## 🎯 Intelligence-Informed Webinar Outline
**Webinar:** ${session.topic}
**Based on:** ${intel.responseCount ?? 0} real audience responses

---

## 📊 What Changed & Why
(A brief 3–5 sentence executive summary of the key shifts you made and what audience data drove them)

---

## 🪝 Opening Hook (0–5 min) — REVISED
**Change:** [What changed from original and why]
[Revised hook content]

## 📖 Hook Script — REVISED
[Write the actual word-for-word opening hook script in Pedram's voice, using the audience's exact language]

## 📋 Webinar Outline — REVISED

### Section 1: The Problem (5–15 min) — REVISED
**Change:** [What changed and why]
[Revised content]

### Section 2: The Root Cause Reveal (15–30 min) — REVISED
**Change:** [What changed and why]
[Revised content]

### Section 3: The Solution Framework (30–45 min) — REVISED
**Change:** [What changed and why]
[Revised content]

### Section 4: The Offer (45–55 min) — REVISED
**Change:** [What changed and why]
[Revised content]

### Section 5: Q&A + Close (55–${session.targetLengthMinutes ?? 60} min) — REVISED
**Change:** [What changed and why]
[Revised content — include the top questions from the survey]

## 💡 Key Teaching Points — REVISED
(5–7 bullet points using the audience's actual language)

## 🚨 New Urgency Angles (from survey data)
(2–3 urgency angles that directly reference what the audience told you they need)

## 🗣️ Exact Phrases to Use
(Pull 8–10 exact phrases from the survey language and show where in the webinar to use each one)`;

      const response = await invokeLLM({
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: `Rewrite the webinar outline for "${session.topic}" based on the real audience intelligence from ${intel.responseCount ?? 0} survey respondents.`,
          },
        ],
      });

      const rawContent = response.choices?.[0]?.message?.content;
      const revisedOutline = typeof rawContent === "string" ? rawContent : "";
      if (!revisedOutline) throw new Error("Rewrite failed — no content returned");

      // Save the revised outline back to the webinar session
      await db
        .update(webinarSessions)
        .set({
          outline: revisedOutline,
          notes: `[Intelligence-informed rewrite — based on ${intel.responseCount ?? 0} survey responses from Typeform ${new Date().toLocaleDateString()}]\n\n${session.notes ?? ""}`.trim(),
          updatedAt: new Date(),
        })
        .where(eq(webinarSessions.id, input.webinarSessionId));

      return {
        revisedOutline,
        responseCount: intel.responseCount ?? 0,
        webinarSessionId: input.webinarSessionId,
      };
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
