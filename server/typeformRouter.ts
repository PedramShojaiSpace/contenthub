import { z } from "zod";
import { invokeLLM } from "./_core/llm";
import { wrapLLM } from "./llmUtils";
import { publicProcedure, router } from "./_core/trpc";
import { getDb } from "./db";

const TYPEFORM_BASE = "https://api.typeform.com";

function getTypeformHeaders() {
  const key = process.env.TYPEFORM_API_KEY;
  if (!key) throw new Error("TYPEFORM_API_KEY is not configured");
  return { Authorization: `Bearer ${key}`, "Content-Type": "application/json" };
}

async function typeformGet(path: string) {
  const res = await fetch(`${TYPEFORM_BASE}${path}`, {
    headers: getTypeformHeaders(),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Typeform API error ${res.status}: ${text}`);
  }
  return res.json();
}

// Flatten a Typeform response item into readable Q&A pairs
function flattenResponse(item: any, fields: any[]): Record<string, string> {
  const answers: Record<string, string> = {};
  for (const answer of item.answers ?? []) {
    const field = fields.find((f: any) => f.id === answer.field?.id);
    const question = field?.title ?? answer.field?.id ?? "Unknown";
    let value = "";
    switch (answer.type) {
      case "text":
      case "email":
      case "url":
      case "number":
        value = String(answer[answer.type] ?? "");
        break;
      case "choice":
        value = answer.choice?.label ?? "";
        break;
      case "choices":
        value = (answer.choices?.labels ?? []).join(", ");
        break;
      case "boolean":
        value = answer.boolean ? "Yes" : "No";
        break;
      case "date":
        value = answer.date ?? "";
        break;
      case "file_url":
        value = "[file uploaded]";
        break;
      default:
        value = JSON.stringify(answer[answer.type] ?? "");
    }
    answers[question] = value;
  }
  return answers;
}

export const typeformRouter = router({
  // ── List all forms ────────────────────────────────────────────────────────
  listForms: publicProcedure.query(async () => {
    const data = await typeformGet("/forms?page_size=50");
    const forms = (data.items ?? []).map((f: any) => ({
      id: f.id,
      title: f.title,
      lastUpdatedAt: f.last_updated_at,
      selfLink: f._links?.display ?? null,
    }));
    return { forms };
  }),

  // ── Get form questions ────────────────────────────────────────────────────
  getFormFields: publicProcedure
    .input(z.object({ formId: z.string() }))
    .query(async ({ input }) => {
      const data = await typeformGet(`/forms/${input.formId}`);
      const fields = (data.fields ?? []).map((f: any) => ({
        id: f.id,
        title: f.title,
        type: f.type,
        required: f.validations?.required ?? false,
      }));
      return { title: data.title, fields };
    }),

  // ── Get responses (paginated, up to 200 at a time) ────────────────────────
  getResponses: publicProcedure
    .input(
      z.object({
        formId: z.string(),
        pageSize: z.number().min(1).max(200).default(100),
        before: z.string().optional(), // cursor for pagination
      })
    )
    .query(async ({ input }) => {
      const params = new URLSearchParams({
        page_size: String(input.pageSize),
        ...(input.before ? { before: input.before } : {}),
      });
      const data = await typeformGet(`/forms/${input.formId}/responses?${params}`);
      const formMeta = await typeformGet(`/forms/${input.formId}`);
      const fields: any[] = formMeta.fields ?? [];

      const responses = (data.items ?? []).map((item: any) => ({
        responseId: item.response_id,
        submittedAt: item.submitted_at,
        answers: flattenResponse(item, fields),
      }));

      return {
        totalItems: data.total_items ?? 0,
        pageCount: data.page_count ?? 1,
        responses,
        // Cursor for next page
        nextCursor: responses.length > 0 ? responses[responses.length - 1].responseId : null,
      };
    }),

  // ── Analyze audience from form responses ─────────────────────────────────
  analyzeAudience: publicProcedure
    .input(
      z.object({
        formId: z.string(),
        formTitle: z.string(),
        sampleSize: z.number().min(10).max(200).default(100),
      })
    )
    .mutation(async ({ input }) => {
      // Fetch form fields
      const formMeta = await typeformGet(`/forms/${input.formId}`);
      const fields: any[] = formMeta.fields ?? [];

      // Fetch responses
      const data = await typeformGet(
        `/forms/${input.formId}/responses?page_size=${input.sampleSize}`
      );
      const items: any[] = data.items ?? [];
      if (items.length === 0) {
        return {
          summary: "No responses found for this form.",
          painPoints: [],
          aspirations: [],
          demographics: {},
          topThemes: [],
          personaInsights: "",
          responseCount: 0,
        };
      }

      // Build a compact text block of all responses (first 80 for LLM context)
      const sample = items.slice(0, 80);
      const responseText = sample
        .map((item, i) => {
          const answers = flattenResponse(item, fields);
          const lines = Object.entries(answers)
            .map(([q, a]) => `  Q: ${q}\n  A: ${a}`)
            .join("\n");
          return `--- Response ${i + 1} ---\n${lines}`;
        })
        .join("\n\n");

      const systemPrompt = `You are an expert audience intelligence analyst for The Urban Monk brand (Dr. Pedram Shojai, OMD). 
Your job is to analyze Typeform survey responses and extract deep audience insights that will inform marketing copy, content strategy, and persona development.

The Urban Monk serves high-performing professionals who feel depleted — entrepreneurs, executives, parents — who want ancient wisdom + modern science to reclaim their health and vitality.

Analyze the responses and return a JSON object with these exact keys:
- painPoints: array of 5-10 specific pain points mentioned (strings)
- aspirations: array of 5-10 specific aspirations/goals mentioned (strings)  
- demographics: object with keys like ageRange, gender, occupation, healthStatus (strings)
- topThemes: array of 5-8 recurring themes (strings)
- personaInsights: 2-3 paragraph narrative describing who these respondents are, what they're struggling with, what they want, and how Pedram's message resonates with them
- summary: 1 paragraph executive summary of the audience intelligence`;

      const response = await wrapLLM(() => invokeLLM({
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: `Form: "${input.formTitle}" (${items.length} total responses, analyzing ${sample.length})\n\n${responseText}`,
          },
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "audience_analysis",
            strict: true,
            schema: {
              type: "object",
              properties: {
                painPoints: { type: "array", items: { type: "string" } },
                aspirations: { type: "array", items: { type: "string" } },
                demographics: {
                  type: "object",
                  properties: {
                    ageRange: { type: "string" },
                    gender: { type: "string" },
                    occupation: { type: "string" },
                    healthStatus: { type: "string" },
                  },
                  required: ["ageRange", "gender", "occupation", "healthStatus"],
                  additionalProperties: false,
                },
                topThemes: { type: "array", items: { type: "string" } },
                personaInsights: { type: "string" },
                summary: { type: "string" },
              },
              required: ["painPoints", "aspirations", "demographics", "topThemes", "personaInsights", "summary"],
              additionalProperties: false,
            },
          },
        },
      }));

      const raw = response.choices?.[0]?.message?.content;
      const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;

      return {
        ...parsed,
        responseCount: items.length,
      };
    }),

  // ── Enrich a persona with Typeform insights ───────────────────────────────
  enrichPersona: publicProcedure
    .input(
      z.object({
        personaId: z.number(),
        painPoints: z.array(z.string()),
        aspirations: z.array(z.string()),
        personaInsights: z.string(),
        formTitle: z.string(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const { personas } = await import("../drizzle/schema");
      const { eq } = await import("drizzle-orm");

      // Fetch current persona
      const existing = await db.select().from(personas).where(eq(personas.id, input.personaId));
      if (existing.length === 0) throw new Error("Persona not found");
      const persona = existing[0];

      // Merge new pain points and aspirations with existing ones
      const currentPains: string[] = JSON.parse(persona.painPoints ?? "[]");
      const currentAspirations: string[] = JSON.parse(persona.aspirations ?? "[]");

      const mergedPains = Array.from(new Set([...currentPains, ...input.painPoints])).slice(0, 15);
      const mergedAspirations = Array.from(new Set([...currentAspirations, ...input.aspirations])).slice(0, 15);

      // Append Typeform insights to description
      const appendNote = `\n\n[Typeform Intelligence — ${input.formTitle} — ${new Date().toLocaleDateString()}]\n${input.personaInsights}`;
      const updatedDescription = (persona.description ?? "") + appendNote;

      await db.update(personas)
        .set({
          painPoints: JSON.stringify(mergedPains),
          aspirations: JSON.stringify(mergedAspirations),
          description: updatedDescription,
          enrichedAt: new Date(),
          surveySource: `Typeform: ${input.formTitle}`,
          surveyResponseCount: (persona as any).surveyResponseCount ?? 0,
        })
        .where(eq(personas.id, input.personaId));

      return { success: true, mergedPainCount: mergedPains.length, mergedAspirationCount: mergedAspirations.length };
    }),

  // ── Segment Typeform responses by Urban Monk persona ───────────────────────
  segmentByPersona: publicProcedure
    .input(
      z.object({
        formId: z.string(),
        formTitle: z.string(),
        sampleSize: z.number().min(10).max(500).default(200),
      })
    )
    .mutation(async ({ input }) => {
      // Fetch form fields
      const formMeta = await typeformGet(`/forms/${input.formId}`);
      const fields: any[] = formMeta.fields ?? [];

      // Fetch up to sampleSize responses
      const data = await typeformGet(
        `/forms/${input.formId}/responses?page_size=${input.sampleSize}`
      );
      const items: any[] = data.items ?? [];
      if (items.length === 0) throw new Error("No responses found for this form.");

      // Build compact response text (max 150 for segmentation)
      const sample = items.slice(0, 150);
      const responseText = sample
        .map((item, i) => {
          const answers = flattenResponse(item, fields);
          const lines = Object.entries(answers)
            .map(([q, a]) => `  Q: ${q}\n  A: ${a}`)
            .join("\n");
          return `--- Response ${i + 1} ---\n${lines}`;
        })
        .join("\n\n");

      const THE_8_PERSONAS = [
        { id: "burnout-executive", name: "The Burned-Out Executive", description: "High-performing professional, 40-55, running on cortisol and caffeine. Chronic stress, poor sleep, gut issues from travel and bad food. Wants to perform without burning out." },
        { id: "health-seeker", name: "The Awakening Health Seeker", description: "35-50, starting to question conventional medicine. Gut issues, brain fog, fatigue. Wants root-cause solutions, not symptom management." },
        { id: "spiritual-entrepreneur", name: "The Spiritual Entrepreneur", description: "30-45, building a purpose-driven business. Wants to integrate mindfulness, ancient wisdom, and modern performance. Feels scattered and depleted." },
        { id: "midlife-woman", name: "The Midlife Woman in Transition", description: "45-60, navigating hormonal shifts, weight changes, energy crashes. Wants to feel vital and reclaim herself. Open to holistic approaches." },
        { id: "functional-parent", name: "The Functional Parent", description: "35-50, putting family first at the expense of their own health. Exhausted, inflamed, wants energy to show up fully for their kids." },
        { id: "biohacker", name: "The Biohacker & Optimizer", description: "28-45, data-driven, already doing intermittent fasting, cold plunges, supplements. Wants the next level — ancient wisdom meets cutting-edge science." },
        { id: "chronic-illness", name: "The Chronic Illness Warrior", description: "Any age, dealing with autoimmune, IBS, SIBO, Lyme, or mystery symptoms. Frustrated with conventional medicine. Wants a guide who understands complexity." },
        { id: "conscious-professional", name: "The Conscious Professional", description: "30-50, values-driven career in medicine, coaching, or wellness. Wants to deepen their own practice and help clients more effectively." },
      ];

      const systemPrompt = `You are an expert audience segmentation analyst for The Urban Monk brand (Dr. Pedram Shojai, OMD).

You have ${sample.length} Typeform survey responses from "${input.formTitle}" (${items.length} total).

Your task: Segment these responses across the 8 Urban Monk audience personas. For EACH persona:
1. Estimate what % of respondents match this persona (0-100, must sum to ~100)
2. Extract 5-8 specific pain points that respondents in this persona cluster mentioned
3. Extract 4-6 specific aspirations from this cluster
4. Write a 2-sentence "voice of customer" quote that captures how someone in this persona would describe their situation
5. Identify 3-5 content hooks that would resonate with this persona based on the survey data

Return a JSON array of 8 persona segment objects.`;

      const response = await wrapLLM(() => invokeLLM({
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: `The 8 Urban Monk personas:\n${THE_8_PERSONAS.map(p => `- ${p.name}: ${p.description}`).join("\n")}\n\nSurvey responses:\n${responseText}`,
          },
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "persona_segments",
            strict: true,
            schema: {
              type: "object",
              properties: {
                segments: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      personaId: { type: "string" },
                      personaName: { type: "string" },
                      percentMatch: { type: "number" },
                      painPoints: { type: "array", items: { type: "string" } },
                      aspirations: { type: "array", items: { type: "string" } },
                      voiceOfCustomer: { type: "string" },
                      contentHooks: { type: "array", items: { type: "string" } },
                    },
                    required: ["personaId", "personaName", "percentMatch", "painPoints", "aspirations", "voiceOfCustomer", "contentHooks"],
                    additionalProperties: false,
                  },
                },
                overallInsight: { type: "string" },
              },
              required: ["segments", "overallInsight"],
              additionalProperties: false,
            },
          },
        },
      }));

      const raw = response.choices?.[0]?.message?.content;
      const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;

      // Auto-enrich all matching personas in DB
      const db = await getDb();
      const enrichedPersonas: string[] = [];
      if (db) {
        const { personas } = await import("../drizzle/schema");
        const { like, eq } = await import("drizzle-orm");
        const allPersonas = await db.select().from(personas);

        for (const seg of parsed.segments ?? []) {
          if (seg.percentMatch < 5) continue; // skip negligible segments
          // Match by name similarity
          const match = allPersonas.find((p: any) =>
            p.name?.toLowerCase().includes(seg.personaName.split(" ").slice(-1)[0]?.toLowerCase() ?? "")
            || seg.personaName.toLowerCase().includes(p.name?.split(" ").slice(-1)[0]?.toLowerCase() ?? "")
          );
          if (!match) continue;

          const currentPains: string[] = JSON.parse((match as any).painPoints ?? "[]");
          const currentAspirations: string[] = JSON.parse((match as any).aspirations ?? "[]");
          const mergedPains = Array.from(new Set([...currentPains, ...seg.painPoints])).slice(0, 15);
          const mergedAspirations = Array.from(new Set([...currentAspirations, ...seg.aspirations])).slice(0, 15);
          const appendNote = `\n\n[Typeform Segmentation — ${input.formTitle} — ${new Date().toLocaleDateString()} — ${seg.percentMatch}% match]\nVoice of Customer: "${seg.voiceOfCustomer}"\nContent Hooks: ${seg.contentHooks.join(" | ")}`;
          const updatedDescription = ((match as any).description ?? "") + appendNote;

          await db.update(personas)
            .set({
              painPoints: JSON.stringify(mergedPains),
              aspirations: JSON.stringify(mergedAspirations),
              description: updatedDescription,
              enrichedAt: new Date(),
              surveySource: `Typeform: ${input.formTitle}`,
              surveyResponseCount: Math.round((seg.percentMatch / 100) * sample.length),
            })
            .where(eq(personas.id, (match as any).id));

          enrichedPersonas.push(seg.personaName);
        }
      }

      return {
        ...parsed,
        responseCount: items.length,
        analyzedCount: sample.length,
        enrichedPersonas,
      };
    }),

  // ── Validate API key ──────────────────────────────────────────────────────
  validateApiKey: publicProcedure.query(async () => {
    try {
      const data = await typeformGet("/me");
      return { valid: true, email: data.email, alias: data.alias };
    } catch (err: any) {
      return { valid: false, error: err?.message ?? "Unknown error" };
    }
  }),
});
