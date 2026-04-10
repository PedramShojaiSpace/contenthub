/**
 * Webinar Funnel Builder — tRPC Router
 *
 * 4-step wizard:
 *   Step 1 (Setup)        → topic, CTA, Zoom link, personas, target length
 *   Step 2 (Outline)      → generateOutline → AI webinar outline + hook script
 *   Step 3 (Landing Page) → generateLandingCopy → AI copy → publishToGamma
 *   Step 4 (Thank You)    → generateThankYouCopy + Wistia/Typeform inputs → exportKajabiPlan
 */
import { eq } from "drizzle-orm";
import { z } from "zod";
import { invokeLLM } from "./_core/llm";
import { protectedProcedure, router } from "./_core/trpc";
import { getDb } from "./db";
import { personas, webinarSessions } from "../drizzle/schema";

// ─── DB helpers ───────────────────────────────────────────────────────────────

async function createWebinar(data: {
  topic: string;
  cta?: string;
  personaIds?: string;
  targetLengthMinutes?: number;
  registrationUrl?: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(webinarSessions).values({
    topic: data.topic,
    cta: data.cta ?? null,
    personaIds: data.personaIds ?? null,
    targetLengthMinutes: data.targetLengthMinutes ?? 60,
    registrationUrl: data.registrationUrl ?? null,
    status: "draft",
  });
  return result;
}

async function getWebinar(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const rows = await db.select().from(webinarSessions).where(eq(webinarSessions.id, id));
  return rows[0] ?? null;
}

async function listWebinars() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(webinarSessions).orderBy(webinarSessions.createdAt);
}

async function updateWebinar(id: number, data: Partial<typeof webinarSessions.$inferInsert>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(webinarSessions).set({ ...data, updatedAt: new Date() }).where(eq(webinarSessions.id, id));
}

// ─── Gamma API helpers (shared pattern from landingPagesRouter) ───────────────

const GAMMA_API_BASE = "https://public-api.gamma.app/v1.0";
const URBAN_MONK_THEME_ID = "4v2cznur3cs7d35";

async function startGammaWebinarPage(copyBody: string, title: string, personaNames: string): Promise<string> {
  const apiKey = process.env.GAMMA_API_KEY;
  if (!apiKey) throw new Error("GAMMA_API_KEY is not configured");
  const additionalInstructions = `
This is a webinar registration landing page for The Urban Monk (Dr. Pedram Shojai).
Target audience: ${personaNames}.
Design guidelines:
- Warm, earthy, wellness aesthetic — cream/parchment backgrounds, terracotta and sage green accents
- Clean, modern layout with generous white space
- Large hero headline with urgency (date/time of webinar)
- Prominent registration CTA button in warm terracotta/amber
- Trust signals: Dr. Pedram Shojai credentials, book covers, media logos
- Professional but approachable — ancient wisdom meets modern science
- The Urban Monk brand voice: authoritative, warm, direct
`.trim();
  const response = await fetch(`${GAMMA_API_BASE}/generations`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-API-KEY": apiKey },
    body: JSON.stringify({
      inputText: `# ${title}\n\n${copyBody}`,
      textMode: "preserve",
      format: "webpage",
      numCards: 6,
      additionalInstructions,
      textOptions: { amount: "detailed", tone: "warm, authoritative, urgent, inspiring", audience: personaNames },
      imageOptions: { source: "aiGenerated", style: "warm, earthy, wellness photography, golden light, sage greens, parchment tones" },
      sharingOptions: { externalAccess: "view" },
      themeId: URBAN_MONK_THEME_ID,
    }),
  });
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gamma API error ${response.status}: ${errorText}`);
  }
  const data = (await response.json()) as { generationId: string };
  return data.generationId;
}

async function pollGamma(generationId: string): Promise<{ status: "pending" | "completed" | "failed"; gammaUrl?: string; error?: string }> {
  const apiKey = process.env.GAMMA_API_KEY;
  if (!apiKey) throw new Error("GAMMA_API_KEY is not configured");
  const response = await fetch(`${GAMMA_API_BASE}/generations/${generationId}`, {
    headers: { "X-API-KEY": apiKey },
  });
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gamma poll error ${response.status}: ${errorText}`);
  }
  const data = (await response.json()) as { status: string; gammaUrl?: string; error?: string };
  if (data.status === "completed") return { status: "completed", gammaUrl: data.gammaUrl };
  if (data.status === "failed") return { status: "failed", error: data.error ?? "Generation failed" };
  return { status: "pending" };
}

// ─── Persona loader ───────────────────────────────────────────────────────────

async function loadPersonasForIds(ids: number[]): Promise<Array<{ id: number; name: string; painPoints: string; aspirations: string; topQuestions: string }>> {
  if (ids.length === 0) return [];
  const db = await getDb();
  if (!db) return [];
  const rows = await db.select().from(personas);
  return rows
    .filter((p) => ids.includes(p.id))
    .map((p) => ({
      id: p.id,
      name: p.name,
      painPoints: p.painPoints ?? "[]",
      aspirations: p.aspirations ?? "[]",
      topQuestions: p.topQuestions ?? "[]",
    }));
}

// ─── Router ───────────────────────────────────────────────────────────────────

export const webinarRouter = router({
  // List all webinar sessions
  list: protectedProcedure.query(async () => {
    return listWebinars();
  }),

  // Get a single webinar session
  get: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      return getWebinar(input.id);
    }),

  // Step 1: Create a new webinar session
  create: protectedProcedure
    .input(
      z.object({
        topic: z.string().min(1, "Topic is required"),
        cta: z.string().optional(),
        personaIds: z.array(z.number()).default([]),
        targetLengthMinutes: z.number().min(15).max(180).default(60),
        registrationUrl: z.string().url().optional().or(z.literal("")),
      })
    )
    .mutation(async ({ input }) => {
      const result = await createWebinar({
        topic: input.topic,
        cta: input.cta,
        personaIds: JSON.stringify(input.personaIds),
        targetLengthMinutes: input.targetLengthMinutes,
        registrationUrl: input.registrationUrl || undefined,
      });
      const insertId = (result as { insertId?: number })?.insertId ?? 0;
      return { id: insertId };
    }),

  // Update basic fields
  update: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        topic: z.string().optional(),
        cta: z.string().optional(),
        personaIds: z.array(z.number()).optional(),
        targetLengthMinutes: z.number().optional(),
        registrationUrl: z.string().optional(),
        notes: z.string().optional(),
        status: z.enum(["draft", "ready", "live", "completed"]).optional(),
        thankYouWistiaId: z.string().optional(),
        thankYouTypeformUrl: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const { id, personaIds, ...rest } = input;
      await updateWebinar(id, {
        ...rest,
        ...(personaIds !== undefined ? { personaIds: JSON.stringify(personaIds) } : {}),
      });
      return { success: true };
    }),

  // Delete a webinar session
  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      await db.delete(webinarSessions).where(eq(webinarSessions.id, input.id));
      return { success: true };
    }),

  // Step 2: Generate AI webinar outline + hook script
  generateOutline: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        topic: z.string().min(1),
        cta: z.string().default(""),
        personaIds: z.array(z.number()).default([]),
        targetLengthMinutes: z.number().default(60),
        registrationUrl: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      // Load persona intelligence
      const personaData = await loadPersonasForIds(input.personaIds);
      const personaNames = personaData.map((p) => p.name).join(", ") || "high-performing health-conscious professionals";
      const personaPains = personaData
        .flatMap((p) => {
          try { return JSON.parse(p.painPoints) as string[]; } catch { return []; }
        })
        .slice(0, 8)
        .join("; ");
      const personaQuestions = personaData
        .flatMap((p) => {
          try { return JSON.parse(p.topQuestions) as string[]; } catch { return []; }
        })
        .slice(0, 6)
        .join("; ");

      // Load avatar intelligence context
      let avatarContext = "";
      try {
        const { getAvatarContextBlockForPersona } = await import("./avatarRouter");
        avatarContext = await getAvatarContextBlockForPersona(input.topic, personaNames);
      } catch { /* non-fatal */ }

      // Load media authority context
      let mediaContext = "";
      try {
        const { getMediaContextBlock } = await import("./mediaRouter");
        mediaContext = await getMediaContextBlock(input.topic);
      } catch { /* non-fatal */ }

      // Load CTA intelligence
      let ctaContext = "";
      try {
        const { getCtaForTopic } = await import("./ctaRouter");
        const ctaResult = await getCtaForTopic(input.topic);
        if (ctaResult?.ctaText) ctaContext = `Best CTA for this topic: ${ctaResult.ctaText}`;
      } catch { /* non-fatal */ }

      const systemPrompt = `You are Dr. Pedram Shojai's expert webinar strategist and copywriter. You write in Pedram's voice: warm, authoritative, direct, grounded in ancient wisdom and modern science. You understand internet marketing deeply — you know how to structure a webinar that educates, builds trust, and converts.

AUDIENCE: ${personaNames}
AUDIENCE PAIN POINTS: ${personaPains || "chronic fatigue, stress, poor sleep, gut issues, feeling stuck despite doing everything right"}
AUDIENCE TOP QUESTIONS: ${personaQuestions || "Why am I still tired? What's the root cause of my health issues?"}

${avatarContext ? `\n=== AVATAR INTELLIGENCE ===\n${avatarContext}\n` : ""}
${mediaContext ? `\n=== PEDRAM'S AUTHORITY SIGNALS ===\n${mediaContext}\n` : ""}
${ctaContext ? `\n=== CTA INTELLIGENCE ===\n${ctaContext}\n` : ""}

WEBINAR TOPIC: ${input.topic}
CTA / OFFER: ${input.cta || "The Upstream Bundle — $399 test kit + course"}
TARGET LENGTH: ${input.targetLengthMinutes} minutes
REGISTRATION LINK: ${input.registrationUrl || "(to be added)"}

Generate a complete, professional webinar outline. Structure it as follows:

## 🎯 Webinar Title
(Compelling title that speaks to the audience's pain)

## 🪝 Opening Hook (0–5 min)
(The first 5 minutes — pattern interrupt, bold claim, or story that grabs attention)

## 📖 Hook Script
(Write the actual word-for-word opening hook script — 3–5 paragraphs in Pedram's voice)

## 📋 Webinar Outline

### Section 1: The Problem (5–15 min)
- Key points to cover
- Stories or data to use
- Audience engagement moment

### Section 2: The Root Cause Reveal (15–30 min)
- The "aha moment" — what most people miss
- Pedram's unique framework
- Science + wisdom integration

### Section 3: The Solution Framework (30–45 min)
- The methodology / approach
- What makes this different from everything else they've tried
- Proof points and case examples

### Section 4: The Offer (45–55 min)
- Transition to the offer
- What's included, what it costs, why now
- Objection handling (3 key objections)

### Section 5: Q&A + Close (55–${input.targetLengthMinutes} min)
- Anticipated questions
- Final CTA push

## 💡 Key Teaching Points
(5–7 bullet points — the core ideas the audience will walk away with)

## 🚨 Urgency & Scarcity Angles
(2–3 legitimate reasons to act now)

## 📣 Pre-Webinar Promotion Angles
(3 social media / email hooks to drive registrations)`;

      const response = await invokeLLM({
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Generate the complete webinar outline for: "${input.topic}"` },
        ],
      });

      const rawContent = response.choices?.[0]?.message?.content;
      const outline = typeof rawContent === "string" ? rawContent : "";
      if (!outline) throw new Error("Outline generation failed — no content returned.");

      // Extract hook script section
      const hookMatch = outline.match(/##\s+🪝[^\n]*\n([\s\S]*?)(?=##\s+📋|$)/);
      const hookScript = hookMatch ? hookMatch[1].trim() : "";

      // Save to DB
      await updateWebinar(input.id, { outline, hookScript });

      return { outline, hookScript };
    }),

  // Step 3: Generate landing page copy for the webinar
  generateLandingCopy: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        topic: z.string().min(1),
        cta: z.string().default(""),
        personaIds: z.array(z.number()).default([]),
        registrationUrl: z.string().optional(),
        outline: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const personaData = await loadPersonasForIds(input.personaIds);
      const personaNames = personaData.map((p) => p.name).join(", ") || "high-performing professionals";
      const personaPains = personaData
        .flatMap((p) => { try { return JSON.parse(p.painPoints) as string[]; } catch { return []; } })
        .slice(0, 6).join("; ");

      let avatarContext = "";
      try {
        const { getAvatarContextBlockForPersona } = await import("./avatarRouter");
        avatarContext = await getAvatarContextBlockForPersona(input.topic, personaNames);
      } catch { /* non-fatal */ }

      let mediaContext = "";
      try {
        const { getMediaContextBlock } = await import("./mediaRouter");
        mediaContext = await getMediaContextBlock(input.topic);
      } catch { /* non-fatal */ }

      const systemPrompt = `You are Dr. Pedram Shojai's expert copywriter. Write a high-converting webinar registration landing page in Pedram's voice.

AUDIENCE: ${personaNames}
PAIN POINTS: ${personaPains || "chronic fatigue, stress, gut issues, feeling stuck"}
WEBINAR TOPIC: ${input.topic}
CTA / OFFER: ${input.cta || "Register Free"}
REGISTRATION LINK: ${input.registrationUrl || "[REGISTRATION LINK]"}
${input.outline ? `\nWEBINAR OUTLINE SUMMARY:\n${input.outline.slice(0, 800)}\n` : ""}
${avatarContext ? `\n=== AVATAR INTELLIGENCE ===\n${avatarContext}\n` : ""}
${mediaContext ? `\n=== AUTHORITY SIGNALS ===\n${mediaContext}\n` : ""}

Write a complete landing page in Markdown with these sections:

# [Compelling Headline — speaks to the pain]

## [Subheadline — the promise]

### What You'll Discover on This Free Webinar:
- (3–5 specific, benefit-driven bullet points)

### Who This Is For:
(2–3 sentences describing the ideal attendee)

### Meet Your Host: Dr. Pedram Shojai
(3–4 sentences — credentials, books, media, why he's qualified)

### What Attendees Are Saying:
(2–3 short testimonial-style quotes — keep them authentic, not hypey)

### Reserve Your Free Seat:
[REGISTER NOW — It's Free →](${input.registrationUrl || "[REGISTRATION LINK]"})

(Date, time, and "seats are limited" urgency note)

### Frequently Asked Questions:
Q: Is this really free?
Q: Will there be a replay?
Q: What do I need to prepare?

Keep the tone warm, direct, and authoritative. No hype. No false promises. Pedram's voice is the voice of a trusted doctor and teacher.`;

      const response = await invokeLLM({
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Write the webinar landing page for: "${input.topic}"` },
        ],
      });

      const rawContent = response.choices?.[0]?.message?.content;
      const landingPageCopy = typeof rawContent === "string" ? rawContent : "";
      if (!landingPageCopy) throw new Error("Landing page copy generation failed.");

      await updateWebinar(input.id, { landingPageCopy });
      return { landingPageCopy };
    }),

  // Step 3b: Publish landing page to Gamma
  publishToGamma: protectedProcedure
    .input(z.object({
      id: z.number(),
      landingPageCopy: z.string().min(1),
      topic: z.string().min(1),
      personaNames: z.string().default("high-performing professionals"),
    }))
    .mutation(async ({ input }) => {
      const titleLine = input.landingPageCopy.split("\n").find((l) => l.startsWith("#"));
      const title = titleLine ? titleLine.replace(/^#+\s*/, "").trim().slice(0, 200) : input.topic;
      const generationId = await startGammaWebinarPage(input.landingPageCopy, title, input.personaNames);
      await updateWebinar(input.id, { gammaGenerationId: generationId });
      return { generationId };
    }),

  // Step 3c: Poll Gamma for generation status
  pollGamma: protectedProcedure
    .input(z.object({ id: z.number(), generationId: z.string() }))
    .query(async ({ input }) => {
      const result = await pollGamma(input.generationId);
      if (result.status === "completed" && result.gammaUrl) {
        await updateWebinar(input.id, { gammaUrl: result.gammaUrl });
      }
      return result;
    }),

  // Step 4: Generate thank you page copy
  generateThankYouCopy: protectedProcedure
    .input(z.object({
      id: z.number(),
      topic: z.string().min(1),
      cta: z.string().default(""),
      personaIds: z.array(z.number()).default([]),
      wistiaId: z.string().optional(),
      typeformUrl: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const personaData = await loadPersonasForIds(input.personaIds);
      const personaNames = personaData.map((p) => p.name).join(", ") || "high-performing professionals";

      const systemPrompt = `You are Dr. Pedram Shojai's copywriter. Write a warm, engaging Thank You page for someone who just registered for a free webinar.

WEBINAR TOPIC: ${input.topic}
AUDIENCE: ${personaNames}
CTA AFTER REGISTRATION: ${input.cta || "Watch this short video from Dr. Pedram while you wait"}
${input.wistiaId ? `WISTIA VIDEO: Embed video ID ${input.wistiaId} — write a compelling intro for it` : ""}
${input.typeformUrl ? `TYPEFORM SURVEY: Include a prompt to fill out a short survey to help us personalize the webinar` : ""}

Write the Thank You page in Markdown:

# You're In! See You on the Webinar.

## [Warm confirmation message — 2–3 sentences]

${input.wistiaId ? `## While You Wait — Watch This:\n[Compelling 2–3 sentence intro to the video]\n\n[VIDEO EMBED: ${input.wistiaId}]\n` : ""}

## Add to Your Calendar:
[Google Calendar] | [Apple Calendar] | [Outlook]

${input.typeformUrl ? `## One Quick Question Before the Webinar:\n[2–3 sentence prompt explaining why the survey helps them get more value]\n\n[TYPEFORM EMBED: ${input.typeformUrl}]\n` : ""}

## What to Expect:
(3 bullet points — what they'll learn, what to prepare, what happens after)

## Share With a Friend:
(Short social share prompt)

Keep the tone warm, grateful, and excited. Make them feel they made a great decision.`;

      const response = await invokeLLM({
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Write the thank you page for the webinar: "${input.topic}"` },
        ],
      });

      const rawContent = response.choices?.[0]?.message?.content;
      const thankYouPageCopy = typeof rawContent === "string" ? rawContent : "";
      if (!thankYouPageCopy) throw new Error("Thank you page generation failed.");

      await updateWebinar(input.id, {
        thankYouPageCopy,
        thankYouWistiaId: input.wistiaId ?? undefined,
        thankYouTypeformUrl: input.typeformUrl ?? undefined,
      });
      return { thankYouPageCopy };
    }),

  // Step 4b: Generate Kajabi automation export plan
  exportKajabiPlan: protectedProcedure
    .input(z.object({
      id: z.number(),
      topic: z.string().min(1),
      cta: z.string().default(""),
      registrationUrl: z.string().optional(),
      personaIds: z.array(z.number()).default([]),
    }))
    .mutation(async ({ input }) => {
      const personaData = await loadPersonasForIds(input.personaIds);
      const personaNames = personaData.map((p) => p.name).join(", ") || "high-performing professionals";

      const systemPrompt = `You are a Kajabi automation expert and email marketing strategist for Dr. Pedram Shojai. Create a complete Kajabi automation plan for a webinar funnel.

WEBINAR TOPIC: ${input.topic}
AUDIENCE: ${personaNames}
OFFER / CTA: ${input.cta || "The Upstream Bundle — $399"}
REGISTRATION LINK: ${input.registrationUrl || "[REGISTRATION LINK]"}

Generate a complete Kajabi automation plan as a structured JSON object with the following schema:
{
  "pipeline_name": "string",
  "trigger": "string (e.g. 'Webinar Registration Form Submitted')",
  "tags_to_apply": ["string"],
  "email_sequence": [
    {
      "step": number,
      "delay": "string (e.g. 'Immediately', '1 day after', '2 hours before webinar')",
      "subject": "string",
      "preview_text": "string",
      "body_summary": "string (2-3 sentences describing the email content)",
      "cta_text": "string",
      "cta_url": "string"
    }
  ],
  "post_webinar_sequence": [
    {
      "step": number,
      "delay": "string",
      "subject": "string",
      "preview_text": "string",
      "body_summary": "string",
      "cta_text": "string",
      "cta_url": "string"
    }
  ],
  "automation_rules": [
    {
      "trigger": "string",
      "action": "string"
    }
  ],
  "setup_instructions": ["string"]
}

Include:
- 4–5 pre-webinar reminder emails (confirmation, 1 week out, 3 days out, 1 day out, 1 hour out)
- 4–5 post-webinar follow-up emails (replay, offer reminder, objection handler, last chance, nurture)
- Tags for segmentation (registered, attended, no-show, purchased)
- Automation rules (e.g., remove from sequence if purchased)
- Step-by-step Kajabi setup instructions

Return ONLY the JSON object, no markdown wrapping.`;

      const response = await invokeLLM({
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Create the Kajabi automation plan for: "${input.topic}"` },
        ],
        response_format: { type: "json_object" } as any,
      });

      const rawContent = response.choices?.[0]?.message?.content;
      const kajabiExport = typeof rawContent === "string" ? rawContent : "{}";

      await updateWebinar(input.id, { kajabiExport });
      return { kajabiExport: JSON.parse(kajabiExport) };
    }),
});
