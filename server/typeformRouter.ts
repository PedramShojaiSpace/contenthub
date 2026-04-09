import { z } from "zod";
import { invokeLLM } from "./_core/llm";
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

      const response = await invokeLLM({
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
      });

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
        })
        .where(eq(personas.id, input.personaId));

      return { success: true, mergedPainCount: mergedPains.length, mergedAspirationCount: mergedAspirations.length };
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
