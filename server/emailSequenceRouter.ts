import { z } from "zod";
import { desc, eq } from "drizzle-orm";
import { router, protectedProcedure } from "./_core/trpc";
import { getDb } from "./db";
import { emailSequences } from "../drizzle/schema";

// ─── Email Sequence Router ────────────────────────────────────────────────────

export const emailSequenceRouter = router({

  generateEmailSequence: protectedProcedure
    .input(
      z.object({
        leadId: z.number(),
        leadName: z.string().optional(),
        leadEmail: z.string().email().optional(),
        leadCompany: z.string().optional(),
        leadTitle: z.string().optional(),
        category: z.string().optional(),
        leadContext: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const { invokeLLM } = await import("./_core/llm");

      const categoryContext: Record<string, string> = {
        gut_health: "gut health, microbiome optimization, and digestive wellness",
        oral_health: "oral health, the mouth-gut connection, and oral microbiome",
        supplements: "natural supplements, adaptogens, and holistic health optimization",
        health: "holistic health, integrative medicine, and wellness",
        stress: "stress management, cortisol regulation, and nervous system health",
        sleep: "sleep optimization, circadian rhythms, and restorative rest",
        meditation: "meditation, mindfulness, and Daoist practices",
        ancient_wisdom: "ancient wisdom traditions, Daoist philosophy, and modern application",
        longevity: "longevity, anti-aging, and healthy aging protocols",
        brand: "Urban Monk Academy and Dr. Pedram Shojai's work",
        wellness_coach: "wellness coaching, health transformation, and client results",
        functional_med: "functional medicine, root-cause healing, and integrative health",
        nutritionist: "nutrition science, dietary optimization, and metabolic health",
        biohacker: "biohacking, performance optimization, and longevity protocols",
        burnout: "burnout recovery, energy management, and work-life integration",
        meditation_teacher: "meditation instruction, mindfulness practices, and Daoist wisdom",
      };

      const topicContext = categoryContext[input.category ?? ""] ?? "holistic health, wellness, and personal transformation";
      const recipientTitle = input.leadTitle ? `a ${input.leadTitle}` : "a health-conscious professional";
      const recipientCompany = input.leadCompany ? ` at ${input.leadCompany}` : "";

      const systemPrompt = `You are Dr. Pedram Shojai — a doctor of Oriental Medicine, Daoist monk, filmmaker, and bestselling author of "The Urban Monk" and "Work Pray Code." You write warm, genuine, non-salesy emails that lead with value. Your voice is: knowledgeable but accessible, grounded in ancient wisdom and modern science, never pushy, always authentic.

CRITICAL RULES:
- Always spell "Daoist" and "Daoism" with a D (never Taoist/Taoism)
- Emails are FROM Dr. Pedram Shojai, signed as "Pedram" or "Dr. Pedram"
- Email 1: Pure value only — share a specific insight, practice, or perspective. Zero pitch.
- Email 2: Follow up naturally, share a specific Urban Monk resource (article, video, or guide). Still no hard pitch.
- Email 3: Gentle, authentic invitation to Urban Monk Academy ($297/year). Frame it as an invitation, not a sale.
- Keep emails conversational, 150-250 words each
- Subject lines should be personal and curiosity-driven, not clickbait
- Respond ONLY with valid JSON. No markdown fences.`;

      const userPrompt = `Write a 3-email cold outreach sequence for this lead:
- Name: ${input.leadName ?? "Unknown"}
- Title: ${recipientTitle}${recipientCompany}
- Topic interest: ${topicContext}
${input.leadContext ? `- Context: ${input.leadContext}` : ""}

Return a JSON object with exactly this structure:
{
  "email1": { "subject": "...", "body": "..." },
  "email2": { "subject": "...", "body": "..." },
  "email3": { "subject": "...", "body": "..." }
}`;

      const response = await invokeLLM({
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "email_sequence",
            strict: true,
            schema: {
              type: "object",
              properties: {
                email1: {
                  type: "object",
                  properties: { subject: { type: "string" }, body: { type: "string" } },
                  required: ["subject", "body"],
                  additionalProperties: false,
                },
                email2: {
                  type: "object",
                  properties: { subject: { type: "string" }, body: { type: "string" } },
                  required: ["subject", "body"],
                  additionalProperties: false,
                },
                email3: {
                  type: "object",
                  properties: { subject: { type: "string" }, body: { type: "string" } },
                  required: ["subject", "body"],
                  additionalProperties: false,
                },
              },
              required: ["email1", "email2", "email3"],
              additionalProperties: false,
            },
          },
        },
      });

      const raw = response.choices[0].message.content as string;
      const parsed = JSON.parse(raw) as {
        email1: { subject: string; body: string };
        email2: { subject: string; body: string };
        email3: { subject: string; body: string };
      };

      const db = await getDb();
      if (!db) throw new Error("Database unavailable");

      const now = Date.now();

      const existing = await db
        .select()
        .from(emailSequences)
        .where(eq(emailSequences.leadId, input.leadId))
        .limit(1);

      if (existing.length > 0) {
        await db
          .update(emailSequences)
          .set({
            leadName: input.leadName ?? null,
            leadEmail: input.leadEmail ?? null,
            leadCompany: input.leadCompany ?? null,
            leadTitle: input.leadTitle ?? null,
            category: input.category ?? null,
            email1Subject: parsed.email1.subject,
            email1Body: parsed.email1.body,
            email2Subject: parsed.email2.subject,
            email2Body: parsed.email2.body,
            email3Subject: parsed.email3.subject,
            email3Body: parsed.email3.body,
            status: "draft",
            updatedAt: now,
          })
          .where(eq(emailSequences.leadId, input.leadId));
        return { success: true, sequenceId: existing[0].id, ...parsed };
      } else {
        const [result] = await db
          .insert(emailSequences)
          .values({
            leadId: input.leadId,
            leadName: input.leadName ?? null,
            leadEmail: input.leadEmail ?? null,
            leadCompany: input.leadCompany ?? null,
            leadTitle: input.leadTitle ?? null,
            category: input.category ?? null,
            email1Subject: parsed.email1.subject,
            email1Body: parsed.email1.body,
            email2Subject: parsed.email2.subject,
            email2Body: parsed.email2.body,
            email3Subject: parsed.email3.subject,
            email3Body: parsed.email3.body,
            status: "draft",
            createdAt: now,
            updatedAt: now,
          });
        return { success: true, sequenceId: (result as any).insertId, ...parsed };
      }
    }),

  getEmailSequences: protectedProcedure
    .input(z.object({ leadId: z.number().optional() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");

      if (input.leadId !== undefined) {
        return db
          .select()
          .from(emailSequences)
          .where(eq(emailSequences.leadId, input.leadId))
          .orderBy(desc(emailSequences.createdAt));
      }
      return db
        .select()
        .from(emailSequences)
        .orderBy(desc(emailSequences.createdAt))
        .limit(100);
    }),

  saveEmailSequence: protectedProcedure
    .input(
      z.object({
        sequenceId: z.number(),
        email1Subject: z.string().optional(),
        email1Body: z.string().optional(),
        email2Subject: z.string().optional(),
        email2Body: z.string().optional(),
        email3Subject: z.string().optional(),
        email3Body: z.string().optional(),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");

      const update: Record<string, unknown> = { updatedAt: Date.now() };
      if (input.email1Subject !== undefined) update.email1Subject = input.email1Subject;
      if (input.email1Body !== undefined) update.email1Body = input.email1Body;
      if (input.email2Subject !== undefined) update.email2Subject = input.email2Subject;
      if (input.email2Body !== undefined) update.email2Body = input.email2Body;
      if (input.email3Subject !== undefined) update.email3Subject = input.email3Subject;
      if (input.email3Body !== undefined) update.email3Body = input.email3Body;
      if (input.notes !== undefined) update.notes = input.notes;

      await db
        .update(emailSequences)
        .set(update)
        .where(eq(emailSequences.id, input.sequenceId));

      return { success: true };
    }),

  updateEmailSequenceStatus: protectedProcedure
    .input(
      z.object({
        sequenceId: z.number(),
        status: z.enum(["draft", "approved", "sent", "replied"]),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");

      await db
        .update(emailSequences)
        .set({ status: input.status, updatedAt: Date.now() })
        .where(eq(emailSequences.id, input.sequenceId));

      return { success: true };
    }),

  deleteEmailSequence: protectedProcedure
    .input(z.object({ sequenceId: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");

      await db
        .delete(emailSequences)
        .where(eq(emailSequences.id, input.sequenceId));

      return { success: true };
    }),
});
