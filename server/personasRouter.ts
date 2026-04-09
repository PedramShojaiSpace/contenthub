/**
 * Personas router — CRUD and AI CTA generation for the 8 Urban Monk audience personas.
 */
import { z } from "zod";
import { router, protectedProcedure } from "./_core/trpc";
import { getDb } from "./db";
import { personas } from "../drizzle/schema";
import { invokeLLM } from "./_core/llm";
import { eq, asc } from "drizzle-orm";

export const personasRouter = router({
  list: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];
    return db.select().from(personas).orderBy(asc(personas.name));
  }),

  get: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return null;
      const results = await db.select().from(personas).where(eq(personas.id, input.id));
      return results[0] ?? null;
    }),

  // Returns enrichment summary: how many real survey pain points each persona has
  getEnrichmentSummary: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];
    const rows = await db.select().from(personas).orderBy(asc(personas.name));
    return rows.map((p: any) => {
      let painCount = 0;
      let aspirationCount = 0;
      let enrichedFromForms: string[] = [];
      try {
        const pains = JSON.parse(p.painPoints ?? "[]");
        const aspirations = JSON.parse(p.aspirations ?? "[]");
        painCount = Array.isArray(pains) ? pains.length : 0;
        aspirationCount = Array.isArray(aspirations) ? aspirations.length : 0;
      } catch {
        // raw string pain points (legacy) — count words as proxy
        painCount = p.painPoints ? 1 : 0;
      }
      try {
        enrichedFromForms = JSON.parse(p.enrichedFromForms ?? "[]");
      } catch {
        enrichedFromForms = [];
      }
      return {
        id: p.id,
        name: p.name,
        painCount,
        aspirationCount,
        enrichedFromForms,
        isEnriched: painCount > 3, // >3 pain points means it has real survey data
        enrichedAt: p.enrichedAt ?? null,
        surveySource: p.surveySource ?? null,
        surveyResponseCount: p.surveyResponseCount ?? 0,
      };
    });
  }),

  generateCta: protectedProcedure
    .input(
      z.object({
        personaId: z.number(),
        platform: z.string(),
        contentText: z.string(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      const results = await db.select().from(personas).where(eq(personas.id, input.personaId));
      const persona = results[0];
      if (!persona) throw new Error("Persona not found");

      const response = await invokeLLM({
        messages: [
          {
            role: "system",
            content: `You are a direct-response copywriter for The Urban Monk (Dr. Pedram Shojai). Write a compelling, specific CTA (call-to-action) for a ${input.platform} post targeting the "${persona.name}" persona.

Persona description: ${persona.description}
Persona pain points: ${persona.painPoints}
Persona aspirations: ${persona.aspirations}

The CTA should:
- Be 1-2 sentences maximum
- Speak directly to this persona's deepest pain or aspiration
- Reference the Urban Monk Academy ($297/year)
- Feel personal and urgent, not generic
- End with a clear action (link in bio, comment below, DM me, etc.)

Return ONLY the CTA text, no explanation.`,
          },
          {
            role: "user",
            content: `Write a CTA for this ${input.platform} post targeting ${persona.name}:\n\n${input.contentText.slice(0, 600)}`,
          },
        ],
      });

      const rawContent = response.choices[0]?.message?.content;
      const ctaText = typeof rawContent === "string" ? rawContent : "";
      return { cta: ctaText.trim() };
    }),
});
