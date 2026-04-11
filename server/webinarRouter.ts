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
import {
  Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType,
  BorderStyle, TableCell, TableRow, Table, WidthType, ShadingType,
} from "docx";
import { invokeLLM } from "./_core/llm";
import { protectedProcedure, router } from "./_core/trpc";
import { storagePut } from "./storage";
import { getDb } from "./db";
import { personas, webinarSessions } from "../drizzle/schema";

// ─── DB helpers ───────────────────────────────────────────────────────────────

async function createWebinar(data: {
  topic: string;
  cta?: string;
  personaIds?: string;
  targetLengthMinutes?: number;
  registrationUrl?: string;
  webinarDate?: string;
  webinarTime?: string;
  webinarTimezone?: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(webinarSessions).values({
    topic: data.topic,
    cta: data.cta ?? null,
    personaIds: data.personaIds ?? null,
    targetLengthMinutes: data.targetLengthMinutes ?? 60,
    registrationUrl: data.registrationUrl ?? null,
    webinarDate: data.webinarDate ?? null,
    webinarTime: data.webinarTime ?? null,
    webinarTimezone: data.webinarTimezone ?? null,
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
// 'creme' is a valid Gamma standard theme — warm cream/beige/sand tones that match Urban Monk's earthy aesthetic
const URBAN_MONK_THEME_ID = "creme";

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
        webinarDate: z.string().optional(),      // e.g. "2026-04-17"
        webinarTime: z.string().optional(),      // e.g. "19:00"
        webinarTimezone: z.string().optional(),  // e.g. "America/New_York"
      })
    )
    .mutation(async ({ input }) => {
      const result = await createWebinar({
        topic: input.topic,
        cta: input.cta,
        personaIds: JSON.stringify(input.personaIds),
        targetLengthMinutes: input.targetLengthMinutes,
        registrationUrl: input.registrationUrl || undefined,
        webinarDate: input.webinarDate || undefined,
        webinarTime: input.webinarTime || undefined,
        webinarTimezone: input.webinarTimezone || undefined,
      });
      // Robustly extract insertId — Drizzle MySQL may return it directly or nested
      const rawId = (result as any)?.insertId ?? (result as any)?.[0]?.insertId;
      if (rawId && rawId > 0) {
        return { id: rawId as number };
      }
      // Fallback: query the most recently inserted webinar matching this topic
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const rows = await db
        .select()
        .from(webinarSessions)
        .orderBy(webinarSessions.id)
      const fallbackId = rows[rows.length - 1]?.id;
      if (!fallbackId) throw new Error("Failed to retrieve created webinar ID");
      return { id: fallbackId };
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
        webinarDate: z.string().optional(),
        webinarTime: z.string().optional(),
        webinarTimezone: z.string().optional(),
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
        webinarDate: z.string().optional(),
        webinarTime: z.string().optional(),
        webinarTimezone: z.string().optional(),
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
${input.webinarDate ? `WEBINAR DATE: ${input.webinarDate}` : ""}
${input.webinarTime ? `WEBINAR TIME: ${input.webinarTime} ${input.webinarTimezone ?? "ET"}` : ""}
${input.webinarDate && input.webinarTime ? `FULL DATE/TIME: ${input.webinarDate} at ${input.webinarTime} ${input.webinarTimezone ?? "ET"} — use this EXACT date and time in all urgency copy, countdown references, and promotion angles` : ""}

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
        webinarDate: z.string().optional(),
        webinarTime: z.string().optional(),
        webinarTimezone: z.string().optional(),
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
${input.webinarDate ? `WEBINAR DATE: ${input.webinarDate}` : ""}
${input.webinarTime ? `WEBINAR TIME: ${input.webinarTime} ${input.webinarTimezone ?? "ET"}` : ""}
${input.webinarDate && input.webinarTime ? `FULL DATE/TIME: ${input.webinarDate} at ${input.webinarTime} ${input.webinarTimezone ?? "ET"} — use this EXACT date and time in the urgency note, the FAQ, and the registration CTA section` : ""}
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
      wistiaEmbed: z.string().optional(),  // Full Wistia embed code (script+div)
      typeformUrl: z.string().optional(),  // Typeform URL — rendered as clickable button
    }))
    .mutation(async ({ input }) => {
      const personaData = await loadPersonasForIds(input.personaIds);
      const personaNames = personaData.map((p) => p.name).join(", ") || "high-performing professionals";

      // Extract Wistia video ID from embed code for reference in copy
      let wistiaVideoId = "";
      if (input.wistiaEmbed) {
        const match = input.wistiaEmbed.match(/wistia_async_([a-z0-9]+)/i) ||
                      input.wistiaEmbed.match(/medias\/([a-z0-9]+)/i);
        if (match) wistiaVideoId = match[1];
      }

      const systemPrompt = `You are Dr. Pedram Shojai's copywriter. Write a warm, engaging Thank You page for someone who just registered for a free webinar.

WEBINAR TOPIC: ${input.topic}
AUDIENCE: ${personaNames}
CTA AFTER REGISTRATION: ${input.cta || "Watch this short video from Dr. Pedram while you wait"}
${input.wistiaEmbed ? `WISTIA VIDEO: There is a Wistia video embed on this page. Write a compelling 2–3 sentence intro to the video. Use the placeholder [WISTIA_EMBED] exactly where the video player should appear.` : ""}
${input.typeformUrl ? `TYPEFORM SURVEY: Include a section with a warm 2–3 sentence prompt encouraging them to fill out a short survey. Use the placeholder [TYPEFORM_BUTTON] exactly where the clickable button should appear. The button will link to: ${input.typeformUrl}` : ""}

Write the Thank You page in Markdown. Use these EXACT placeholders where indicated:
- [WISTIA_EMBED] — where the video player goes (only if wistia embed provided)
- [TYPEFORM_BUTTON] — where the survey button goes (only if typeform URL provided)

# You're In! See You on the Webinar.

## [Warm confirmation message — 2–3 sentences]

${input.wistiaEmbed ? `## While You Wait — Watch This:\n[Compelling 2–3 sentence intro to the video]\n\n[WISTIA_EMBED]\n` : ""}

## Add to Your Calendar:
[Google Calendar] | [Apple Calendar] | [Outlook]

${input.typeformUrl ? `## One Quick Question Before the Webinar:\n[2–3 sentence prompt explaining why the survey helps them get more value]\n\n[TYPEFORM_BUTTON]\n` : ""}

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
      let thankYouPageCopy = typeof rawContent === "string" ? rawContent : "";
      if (!thankYouPageCopy) throw new Error("Thank you page generation failed.");

      // Replace placeholders with actual HTML/markdown
      if (input.wistiaEmbed) {
        thankYouPageCopy = thankYouPageCopy.replace(
          /\[WISTIA_EMBED\]/g,
          `\n\n<div class="wistia-embed-wrapper">\n${input.wistiaEmbed}\n</div>\n\n`
        );
      }
      if (input.typeformUrl) {
        thankYouPageCopy = thankYouPageCopy.replace(
          /\[TYPEFORM_BUTTON\]/g,
          `\n\n[Take the Survey →](${input.typeformUrl})\n\n`
        );
      }

      await updateWebinar(input.id, {
        thankYouPageCopy,
        thankYouWistiaEmbed: input.wistiaEmbed ?? undefined,
        thankYouTypeformUrl: input.typeformUrl ?? undefined,
      } as any);
      return { thankYouPageCopy };
    }),

  // Step 4b: Generate Kajabi automation export plan as DOCX
  exportKajabiPlan: protectedProcedure
    .input(z.object({
      id: z.number(),
      topic: z.string().min(1),
      cta: z.string().default(""),
      registrationUrl: z.string().optional(),
      personaIds: z.array(z.number()).default([]),
      webinarDate: z.string().optional(),
      webinarTime: z.string().optional(),
      webinarTimezone: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const personaData = await loadPersonasForIds(input.personaIds);
      const personaNames = personaData.map((p) => p.name).join(", ") || "high-performing professionals";

      const systemPrompt = `You are a Kajabi automation expert and email marketing strategist for Dr. Pedram Shojai. Create a complete Kajabi automation plan for a webinar funnel.

WEBINAR TOPIC: ${input.topic}
AUDIENCE: ${personaNames}
OFFER / CTA: ${input.cta || "The Upstream Bundle — $399"}
REGISTRATION LINK: ${input.registrationUrl || "[REGISTRATION LINK]"}
${input.webinarDate ? `WEBINAR DATE: ${input.webinarDate}` : ""}
${input.webinarTime ? `WEBINAR TIME: ${input.webinarTime} ${input.webinarTimezone ?? "ET"}` : ""}
${input.webinarDate && input.webinarTime ? `FULL DATE/TIME: ${input.webinarDate} at ${input.webinarTime} ${input.webinarTimezone ?? "ET"} — use this EXACT date and time in all email send-timing notes (e.g. "Send 24 hours before the webinar on [date]"), subject lines, and countdown references` : ""}

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
      "body_full": "string (full email body, 150-200 words, in Dr. Pedram Shojai's warm, direct voice)",
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
      "body_full": "string (full email body, 150-200 words, in Dr. Pedram Shojai's warm, direct voice)",
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
- Full email body copy for every email in both sequences

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

      // Build DOCX
      const plan = JSON.parse(kajabiExport) as {
        pipeline_name?: string;
        trigger?: string;
        tags_to_apply?: string[];
        email_sequence?: Array<{ step: number; delay: string; subject: string; preview_text: string; body_summary: string; body_full?: string; cta_text: string; cta_url: string }>;
        post_webinar_sequence?: Array<{ step: number; delay: string; subject: string; preview_text: string; body_summary: string; body_full?: string; cta_text: string; cta_url: string }>;
        automation_rules?: Array<{ trigger: string; action: string }>;
        setup_instructions?: string[];
      };

      const h1 = (text: string) => new Paragraph({ text, heading: HeadingLevel.HEADING_1, spacing: { before: 400, after: 200 } });
      const h2 = (text: string) => new Paragraph({ text, heading: HeadingLevel.HEADING_2, spacing: { before: 300, after: 150 } });
      const h3 = (text: string) => new Paragraph({ text, heading: HeadingLevel.HEADING_3, spacing: { before: 200, after: 100 } });
      const body = (text: string) => new Paragraph({ children: [new TextRun({ text, size: 22 })], spacing: { after: 100 } });
      const label = (key: string, value: string) => new Paragraph({
        children: [
          new TextRun({ text: `${key}: `, bold: true, size: 22 }),
          new TextRun({ text: value, size: 22 }),
        ],
        spacing: { after: 80 },
      });
      const divider = () => new Paragraph({ text: "─".repeat(60), spacing: { before: 200, after: 200 } });

      const emailSection = (title: string, emails: typeof plan.email_sequence) => {
        const items: Paragraph[] = [h2(title)];
        (emails ?? []).forEach((e) => {
          items.push(h3(`Email ${e.step}: ${e.subject}`));
          items.push(label("Timing", e.delay));
          items.push(label("Preview Text", e.preview_text));
          items.push(label("CTA", `${e.cta_text} → ${e.cta_url}`));
          items.push(new Paragraph({ children: [new TextRun({ text: "Email Body:", bold: true, size: 22 })], spacing: { after: 60 } }));
          const bodyText = e.body_full || e.body_summary || "";
          bodyText.split("\n").filter(Boolean).forEach((line) => items.push(body(line)));
          items.push(divider());
        });
        return items;
      };

      const doc = new Document({
        styles: {
          default: {
            document: { run: { font: "Calibri", size: 22 } },
          },
        },
        sections: [{
          properties: {},
          children: [
            h1(`Kajabi Automation Plan: ${plan.pipeline_name ?? input.topic}`),
            label("Webinar Topic", input.topic),
            label("Offer / CTA", input.cta || "The Upstream Bundle — $399"),
            label("Registration Link", input.registrationUrl ?? "[REGISTRATION LINK]"),
            label("Pipeline Trigger", plan.trigger ?? "Webinar Registration Form Submitted"),
            divider(),

            h2("Tags to Apply"),
            ...(plan.tags_to_apply ?? []).map((tag) => body(`• ${tag}`)),
            divider(),

            ...emailSection("PRE-WEBINAR EMAIL SEQUENCE", plan.email_sequence),
            ...emailSection("POST-WEBINAR EMAIL SEQUENCE", plan.post_webinar_sequence),

            h2("Automation Rules"),
            ...(plan.automation_rules ?? []).map((r) =>
              new Paragraph({
                children: [
                  new TextRun({ text: `TRIGGER: `, bold: true, size: 22 }),
                  new TextRun({ text: `${r.trigger}  →  `, size: 22 }),
                  new TextRun({ text: `ACTION: `, bold: true, size: 22 }),
                  new TextRun({ text: r.action, size: 22 }),
                ],
                spacing: { after: 100 },
              })
            ),
            divider(),

            h2("Step-by-Step VA Setup Instructions"),
            ...(plan.setup_instructions ?? []).map((step, i) => body(`${i + 1}. ${step}`)),
          ],
        }],
      });

      const buffer = await Packer.toBuffer(doc);
      const slug = input.topic.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40);
      const fileKey = `kajabi-plans/${slug}-${Date.now()}.docx`;
      const { url } = await storagePut(fileKey, buffer, "application/vnd.openxmlformats-officedocument.wordprocessingml.document");

      return { docxUrl: url, filename: `Kajabi-Plan-${slug}.docx` };
    }),

  // Step 4a: Publish thank you page to Gamma
  publishThankYouToGamma: protectedProcedure
    .input(z.object({
      id: z.number(),
      thankYouPageCopy: z.string().min(1),
      topic: z.string().min(1),
      personaNames: z.string().default("high-performing professionals"),
    }))
    .mutation(async ({ input }) => {
      const titleLine = input.thankYouPageCopy.split("\n").find((l) => l.startsWith("#"));
      const title = titleLine ? titleLine.replace(/^#+\s*/, "").trim().slice(0, 200) : `Thank You — ${input.topic}`;
      const additionalInstructions = `
This is a Thank You / Confirmation page for a webinar registration for The Urban Monk (Dr. Pedram Shojai).
Target audience: ${input.personaNames}.
Design guidelines:
- Warm, celebratory, welcoming tone — cream/parchment backgrounds, terracotta and sage green accents
- Large warm confirmation headline at the top ("You're In!" style)
- Embed video section if a Wistia ID is referenced in the copy
- Typeform survey section if a Typeform URL is referenced
- Calendar add links section
- What to expect bullets
- Clean, generous white space — not cluttered
- The Urban Monk brand voice: warm, grateful, excited, authoritative
`.trim();
      const apiKey = process.env.GAMMA_API_KEY;
      if (!apiKey) throw new Error("GAMMA_API_KEY is not configured");
      const response = await fetch(`${GAMMA_API_BASE}/generations`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-API-KEY": apiKey },
        body: JSON.stringify({
          inputText: `# ${title}\n\n${input.thankYouPageCopy}`,
          textMode: "preserve",
          format: "webpage",
          numCards: 5,
          additionalInstructions,
          textOptions: { amount: "detailed", tone: "warm, grateful, celebratory, inspiring", audience: input.personaNames },
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
      await updateWebinar(input.id, { thankYouGammaGenerationId: data.generationId });
      return { generationId: data.generationId };
    }),

  // Step 4a-poll: Poll Gamma for thank you page generation status
  pollThankYouGamma: protectedProcedure
    .input(z.object({ id: z.number(), generationId: z.string() }))
    .query(async ({ input }) => {
      const result = await pollGamma(input.generationId);
      if (result.status === "completed" && result.gammaUrl) {
        await updateWebinar(input.id, { thankYouGammaUrl: result.gammaUrl });
      }
      return result;
    }),

  // ─── Typeform Survey Builder ──────────────────────────────────────────────

  // Generate AI survey questions based on webinar topic and personas
  generateSurveyQuestions: protectedProcedure
    .input(z.object({
      id: z.number(),
      topic: z.string().min(1),
      cta: z.string().default(""),
      personaIds: z.array(z.number()).default([]),
    }))
    .mutation(async ({ input }) => {
      const personaData = await loadPersonasForIds(input.personaIds);
      const personaNames = personaData.map((p) => p.name).join(", ") || "high-performing professionals";
      const personaPains = personaData
        .flatMap((p) => { try { return JSON.parse(p.painPoints) as string[]; } catch { return []; } })
        .slice(0, 6).join("; ");

      const systemPrompt = `You are a market research expert and conversion strategist for Dr. Pedram Shojai (The Urban Monk). Create a post-webinar survey that qualifies attendees and surfaces their deepest pain points so the sales team can follow up with precision.

WEBINAR TOPIC: ${input.topic}
AUDIENCE: ${personaNames}
OFFER / CTA: ${input.cta || "The Upstream Bundle — $399"}
KNOWN PAIN POINTS: ${personaPains || "chronic fatigue, stress, gut issues, poor sleep, brain fog"}

Generate a survey with exactly 8-10 questions using this framework:
1. What brought you to this webinar? (open text)
2-4. Pain point questions — dig into their specific health struggles (mix of open text and multiple choice)
5. How long have you been dealing with this? (multiple choice)
6. What have you already tried? (multiple choice with "other")
7. What would your life look like if this was resolved? (open text — aspirational)
8. How serious are you about solving this in the next 90 days? (rating 1-10)
9. Would you like a free 15-minute health strategy call? (yes/no)
10. What's the best email to send your personalized plan? (email)

Return a JSON array of question objects. Each object must have:
- "ref": unique snake_case string (e.g. "pain_main")
- "title": the question text (warm, conversational, Pedram's voice)
- "type": one of: "short_text", "long_text", "multiple_choice", "rating", "yes_no", "email"
- "required": boolean
- "choices": array of {"label": string} objects (only for multiple_choice type)
- "properties": object (for rating: {"steps": 10}; for multiple_choice: {"allow_multiple_selection": false, "allow_other_choice": true})

Return ONLY the JSON array, no markdown wrapping.`;

      const response = await invokeLLM({
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Generate the survey questions for the webinar: "${input.topic}"` },
        ],
        response_format: { type: "json_object" } as any,
      });

      const rawMsg = response.choices?.[0]?.message?.content;
      const rawContent = typeof rawMsg === "string" ? rawMsg : "{}";
      let questions: any[] = [];
      try {
        const parsed = JSON.parse(rawContent);
        // Handle both {questions: [...]} and [...] shapes
        questions = Array.isArray(parsed) ? parsed : (parsed.questions ?? parsed.survey_questions ?? []);
      } catch { questions = []; }

      return { questions };
    }),

  // Push approved survey questions to Typeform and return the live URL
  pushToTypeform: protectedProcedure
    .input(z.object({
      id: z.number(),
      title: z.string().min(1),
      questions: z.array(z.object({
        ref: z.string(),
        title: z.string(),
        type: z.string(),
        required: z.boolean().default(false),
        choices: z.array(z.object({ label: z.string() })).optional(),
        properties: z.record(z.string(), z.unknown()).optional(),
      })),
    }))
    .mutation(async ({ input }) => {
      const apiKey = process.env.TYPEFORM_API_KEY;
      if (!apiKey) throw new Error("TYPEFORM_API_KEY is not configured");

      // Typeform-supported field types — anything else falls back to long_text
      const VALID_TF_TYPES = new Set([
        "short_text", "long_text", "multiple_choice", "picture_choice",
        "rating", "opinion_scale", "yes_no", "email", "phone_number",
        "number", "date", "dropdown", "ranking", "matrix", "file_upload",
        "statement", "website",
      ]);

      // Field types that support the 'validations' object in Typeform API
      // All other types (multiple_choice, rating, opinion_scale, yes_no, statement, etc.) reject it with 400
      const TYPES_WITH_VALIDATIONS = new Set([
        "short_text", "long_text", "email", "phone_number", "number", "date", "website",
      ]);

      // Build Typeform fields from question objects
      const fields = input.questions.map((q) => {
        // Sanitize type — fall back to long_text for any unknown/hallucinated type
        const safeType = VALID_TF_TYPES.has(q.type) ? q.type : "long_text";
        const field: any = {
          ref: q.ref,
          title: q.title,
          type: safeType,
        };
        // Only add validations for types that support it
        if (TYPES_WITH_VALIDATIONS.has(safeType)) {
          field.validations = { required: q.required };
        }
        if (safeType === "multiple_choice" && q.choices && q.choices.length > 0) {
          // Only pass known-safe properties to avoid INVALID_JSON errors
          field.properties = {
            choices: q.choices,
            allow_multiple_selection: q.properties?.allow_multiple_selection ?? false,
            allow_other_choice: q.properties?.allow_other_choice ?? true,
          };
        } else if (safeType === "rating" || safeType === "opinion_scale") {
          field.properties = { steps: (q.properties?.steps as number) ?? 10 };
        } else if (safeType === "dropdown" && q.choices && q.choices.length > 0) {
          field.properties = { choices: q.choices };
        } else if (safeType === "ranking" && q.choices && q.choices.length > 0) {
          field.properties = { choices: q.choices };
        }
        return field;
      });

      // Create the Typeform
      const response = await fetch("https://api.typeform.com/forms", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          title: input.title,
          fields,
          settings: {
            is_public: true,
            is_trial: false,
            show_progress_bar: true,
            show_typeform_branding: false,
          },
          thankyou_screens: [{
            ref: "thank_you",
            title: "Thank you for sharing! We'll be in touch shortly with your personalized plan.",
            type: "thankyou_screen",
            properties: { show_button: false, share_icons: false },
          }],
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Typeform API error ${response.status}: ${errorText}`);
      }

      const data = (await response.json()) as { id: string; _links: { display: string } };
      const typeformUrl = data._links?.display ?? `https://theurbanmonk.typeform.com/to/${data.id}`;

      // Save the URL back to the webinar session
      await updateWebinar(input.id, { thankYouTypeformUrl: typeformUrl });

      return { typeformId: data.id, typeformUrl };
    }),
});
