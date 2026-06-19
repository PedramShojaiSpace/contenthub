import { z } from "zod";
import { desc, eq, inArray } from "drizzle-orm";
import { router, protectedProcedure } from "./_core/trpc";
import { getDb } from "./db";
import { emailSequences, contentItems } from "../drizzle/schema";

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
        // Optional: manually override which Content Hub email to use as Email 1
        contentHubEmailId: z.number().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const { invokeLLM } = await import("./_core/llm");
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");

      // ── Step 1: Fetch approved Content Hub emails ──────────────────────────
      const hubEmails = await db
        .select({ id: contentItems.id, title: contentItems.title, textContent: contentItems.textContent })
        .from(contentItems)
        .where(
          inArray(contentItems.status, ["approved", "published"])
        )
        .orderBy(desc(contentItems.id))
        .limit(20)
        // Filter to email platform in JS since we can't easily chain .where() with AND here
        .then(rows => rows.filter((r: any) => {
          // We need platform = 'email' — fetch all approved and filter
          return true; // will filter below after getting platform
        }));

      // Re-fetch with platform filter properly
      const hubEmailsFull = await db
        .select({ id: contentItems.id, title: contentItems.title, textContent: contentItems.textContent })
        .from(contentItems)
        .orderBy(desc(contentItems.id))
        .limit(100);

      // Filter to approved/published email platform items
      const approvedEmails = hubEmailsFull.filter((r: any) => {
        // We need to check status and platform — use raw query approach
        return true;
      });

      // Use a raw query to get approved email platform items
      const rawEmails = await db.execute(
        `SELECT id, title, textContent FROM content_items WHERE platform = 'email' AND status IN ('approved', 'published') ORDER BY id DESC LIMIT 20`
      ) as any;

      const emailPool: Array<{ id: number; title: string; textContent: string | null }> =
        Array.isArray(rawEmails) ? rawEmails[0] as any[] : [];

      // ── Step 2: Pick the best Email 1 from the pool ────────────────────────
      let chosenEmail: { id: number; title: string; body: string } | null = null;

      if (input.contentHubEmailId) {
        // Manual override
        const found = emailPool.find((e) => e.id === input.contentHubEmailId);
        if (found && found.textContent) {
          chosenEmail = { id: found.id, title: found.title, body: found.textContent };
        }
      }

      if (!chosenEmail && emailPool.length > 0) {
        // AI picks the most relevant email for this lead's category/context
        if (emailPool.length === 1) {
          const e = emailPool[0];
          chosenEmail = { id: e.id, title: e.title, body: e.textContent ?? "" };
        } else {
          // Ask AI to pick the best match
          const pickPrompt = `You are helping Dr. Pedram Shojai choose the best opening email for a cold outreach.

Lead profile:
- Name: ${input.leadName ?? "Unknown"}
- Title: ${input.leadTitle ?? "Unknown"}
- Company: ${input.leadCompany ?? "Unknown"}
- Category: ${input.category ?? "general"}
- Context: ${input.leadContext ?? "None provided"}

Available emails (return ONLY the id of the best match as a JSON number):
${emailPool.map((e) => `ID ${e.id}: "${e.title}" — ${(e.textContent ?? "").slice(0, 200)}...`).join("\n")}

Return JSON: { "id": <number> }`;

          const pickResponse = await invokeLLM({
            messages: [
              { role: "system", content: "You are a marketing assistant. Return only valid JSON." },
              { role: "user", content: pickPrompt },
            ],
            response_format: {
              type: "json_schema",
              json_schema: {
                name: "email_pick",
                strict: true,
                schema: {
                  type: "object",
                  properties: { id: { type: "number" } },
                  required: ["id"],
                  additionalProperties: false,
                },
              },
            },
          });

          const picked = JSON.parse(pickResponse.choices[0].message.content as string) as { id: number };
          const found = emailPool.find((e) => e.id === picked.id) ?? emailPool[0];
          chosenEmail = { id: found.id, title: found.title, body: found.textContent ?? "" };
        }
      }

      // ── Step 3: Build category context ────────────────────────────────────
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

      // ── Step 4: Generate Emails 2 & 3 (Email 1 comes from Content Hub) ────
      // Build category-specific resource links for Email 2
      const categoryLinks: Record<string, { label: string; url: string }[]> = {
        gut_health: [
          { label: "The Gut-Brain Connection (YouTube)", url: "https://www.youtube.com/@PedramShojai" },
          { label: "Urban Monk Nutrition Guide", url: "https://theurbanmonk.com/resources/" },
        ],
        oral_health: [
          { label: "Oral Health & the Microbiome (YouTube)", url: "https://www.youtube.com/@PedramShojai" },
          { label: "Urban Monk Health Resources", url: "https://theurbanmonk.com/resources/" },
        ],
        meditation: [
          { label: "Morning Meditation Practice (YouTube)", url: "https://www.youtube.com/@PedramShojai" },
          { label: "Urban Monk Meditation Resources", url: "https://theurbanmonk.com/resources/" },
        ],
        stress: [
          { label: "Stress & the Nervous System (YouTube)", url: "https://www.youtube.com/@PedramShojai" },
          { label: "Urban Monk Stress Resources", url: "https://theurbanmonk.com/resources/" },
        ],
        burnout: [
          { label: "Burnout Recovery Framework (YouTube)", url: "https://www.youtube.com/@PedramShojai" },
          { label: "Urban Monk Energy Resources", url: "https://theurbanmonk.com/resources/" },
        ],
        longevity: [
          { label: "Longevity & Healthy Aging (YouTube)", url: "https://www.youtube.com/@PedramShojai" },
          { label: "Urban Monk Longevity Resources", url: "https://theurbanmonk.com/resources/" },
        ],
        supplements: [
          { label: "Adaptogens & Natural Supplements (YouTube)", url: "https://www.youtube.com/@PedramShojai" },
          { label: "Urban Monk Supplement Guide", url: "https://theurbanmonk.com/resources/" },
        ],
        ancient_wisdom: [
          { label: "Daoist Philosophy for Modern Life (YouTube)", url: "https://www.youtube.com/@PedramShojai" },
          { label: "Urban Monk Ancient Wisdom Resources", url: "https://theurbanmonk.com/resources/" },
        ],
      };

      const catKey = input.category ?? "health";
      const resourceLinks = categoryLinks[catKey] ?? [
        { label: "Urban Monk YouTube Channel", url: "https://www.youtube.com/@PedramShojai" },
        { label: "Urban Monk Resources", url: "https://theurbanmonk.com/resources/" },
      ];

      const resourceLinkBlock = resourceLinks
        .map((r) => `- ${r.label}: ${r.url}`)
        .join("\n");

      const systemPrompt = `You are Dr. Pedram Shojai — a doctor of Oriental Medicine, Daoist monk, filmmaker, and bestselling author of "The Urban Monk" and "Work Pray Code." You write warm, genuine, non-salesy emails that lead with value. Your voice is: knowledgeable but accessible, grounded in ancient wisdom and modern science, never pushy, always authentic.

CRITICAL RULES:
- Always spell "Daoist" and "Daoism" with a D (never Taoist/Taoism)
- Emails are FROM Dr. Pedram Shojai, signed as "Pedram" or "Dr. Pedram"
- NEVER use placeholder text like [Link to...] or [Insert URL] — always use the EXACT real URLs provided below
- Email 2: Natural follow-up to Email 1 — reference the theme, add value, and include a natural link back to the Urban Monk homepage (https://theurbanmonk.com) as the CTA. Still no hard pitch. 150-250 words.
- Email 3: Gentle, authentic invitation to join the Urban Monk Academy — use this EXACT link as the CTA: https://lights-on.theurbanmonk.com — Frame it as an invitation, not a sale. Reference the journey from Emails 1 & 2. 150-250 words.
- Subject lines should be personal and curiosity-driven, not clickbait
- Respond ONLY with valid JSON. No markdown fences.

CTA FOR EMAIL 2 (homepage): https://theurbanmonk.com
CTA FOR EMAIL 3 (Academy opt-in): https://lights-on.theurbanmonk.com
YOUTUBE CHANNEL: https://www.youtube.com/@PedramShojai
PODCAST: https://theurbanmonk.com/podcast/`;

      const email1Preview = chosenEmail
        ? `"${chosenEmail.title}" — ${chosenEmail.body.slice(0, 300)}...`
        : "A personal reflection on presence and awareness";

      const userPrompt = `Write follow-up Emails 2 and 3 for this cold outreach sequence.

Lead:
- Name: ${input.leadName ?? "Unknown"}
- Title: ${recipientTitle}${recipientCompany}
- Topic interest: ${topicContext}
${input.leadContext ? `- Context: ${input.leadContext}` : ""}

Email 1 that was already sent (your opening email from the Content Hub):
${email1Preview}

Now write Emails 2 and 3 that naturally follow from Email 1:

Return a JSON object with exactly this structure:
{
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
            name: "email_followups",
            strict: true,
            schema: {
              type: "object",
              properties: {
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
              required: ["email2", "email3"],
              additionalProperties: false,
            },
          },
        },
      });

      const raw = response.choices[0].message.content as string;
      const parsed = JSON.parse(raw) as {
        email2: { subject: string; body: string };
        email3: { subject: string; body: string };
      };

      // Email 1 = chosen Content Hub email (or fallback placeholder if none available)
      const email1 = chosenEmail
        ? { subject: chosenEmail.title, body: chosenEmail.body }
        : { subject: "Something I've been thinking about", body: "No approved email drafts found in Content Hub yet. Please approve some email content there first, or this will be auto-generated." };

      const result = {
        email1,
        email2: parsed.email2,
        email3: parsed.email3,
        contentHubEmailId: chosenEmail?.id ?? null,
        contentHubEmailTitle: chosenEmail?.title ?? null,
      };

      // ── Step 5: Persist ────────────────────────────────────────────────────
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
            email1Subject: email1.subject,
            email1Body: email1.body,
            email2Subject: parsed.email2.subject,
            email2Body: parsed.email2.body,
            email3Subject: parsed.email3.subject,
            email3Body: parsed.email3.body,
            status: "draft",
            updatedAt: now,
          })
          .where(eq(emailSequences.leadId, input.leadId));
        return { success: true, sequenceId: existing[0].id, ...result };
      } else {
        const [insertResult] = await db
          .insert(emailSequences)
          .values({
            leadId: input.leadId,
            leadName: input.leadName ?? null,
            leadEmail: input.leadEmail ?? null,
            leadCompany: input.leadCompany ?? null,
            leadTitle: input.leadTitle ?? null,
            category: input.category ?? null,
            email1Subject: email1.subject,
            email1Body: email1.body,
            email2Subject: parsed.email2.subject,
            email2Body: parsed.email2.body,
            email3Subject: parsed.email3.subject,
            email3Body: parsed.email3.body,
            status: "draft",
            createdAt: now,
            updatedAt: now,
          });
        return { success: true, sequenceId: (insertResult as any).insertId, ...result };
      }
    }),

  // List approved Content Hub emails for manual override picker
  listContentHubEmails: protectedProcedure
    .query(async () => {
      const db = await getDb();
      if (!db) return [];

      const rows = await db.execute(
        `SELECT id, title, LEFT(textContent, 200) as preview FROM content_items WHERE platform = 'email' AND status IN ('approved', 'published') ORDER BY id DESC LIMIT 50`
      ) as any;

      return (Array.isArray(rows) ? rows[0] : []) as Array<{ id: number; title: string; preview: string }>;
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

  // ── Approve & Send: send Email 1 immediately, queue Emails 2 & 3 ──────────
  approveAndSend: protectedProcedure
    .input(z.object({ sequenceId: z.number() }))
    .mutation(async ({ input }) => {
      const { sendGmailOutreach, isGmailAuthorized } = await import("./gmail");
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");

      // Fetch the sequence
      const rows = await db
        .select()
        .from(emailSequences)
        .where(eq(emailSequences.id, input.sequenceId))
        .limit(1);

      if (!rows.length) throw new Error("Sequence not found");
      const seq = rows[0] as any;

      if (!seq.leadEmail) {
        throw new Error("This lead has no email address. Use Find Email first.");
      }

      if (!isGmailAuthorized()) {
        throw new Error("Gmail is not connected. Please connect Gmail in the Backlink Outreach settings.");
      }

      const now = Date.now();
      const DAY_MS = 24 * 60 * 60 * 1000;

      // Send Email 1 immediately
      let email1ThreadId = "";
      let sendError: string | null = null;

      try {
        const result = await sendGmailOutreach({
          to: seq.leadEmail,
          toName: seq.leadName ?? undefined,
          subject: seq.email1Subject,
          body: seq.email1Body,
        });
        email1ThreadId = result.threadId;
      } catch (err: any) {
        sendError = err?.message ?? "Unknown error sending Email 1";
        await db
          .update(emailSequences)
          .set({ send_error: sendError, updatedAt: now } as any)
          .where(eq(emailSequences.id, input.sequenceId));
        throw new Error(`Failed to send Email 1: ${sendError}`);
      }

      // Queue Emails 2 & 3 with scheduled send times
      await db
        .update(emailSequences)
        .set({
          status: "approved",
          email1_sent_at: now,
          email1_thread_id: email1ThreadId,
          email2_send_at: now + 3 * DAY_MS,
          email3_send_at: now + 7 * DAY_MS,
          send_error: null,
          updatedAt: now,
        } as any)
        .where(eq(emailSequences.id, input.sequenceId));

      return {
        success: true,
        email1Sent: true,
        email2ScheduledAt: now + 3 * DAY_MS,
        email3ScheduledAt: now + 7 * DAY_MS,
      };
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
