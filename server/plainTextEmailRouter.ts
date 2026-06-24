import { z } from "zod";
import { protectedProcedure, router } from "./_core/trpc";
import { getDb } from "./db";
import { invokeLLM } from "./_core/llm";
import { plainTextEmails } from "../drizzle/schema";
import { desc, eq } from "drizzle-orm";

// Strip HTML tags and decode common HTML entities to get readable text
function stripHtml(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s{2,}/g, " ")
    .trim();
}

export const plainTextEmailRouter = router({
  // PRIMARY: Paste existing email copy → rewrite as inbox-optimized plain text
  rewrite: protectedProcedure
    .input(
      z.object({
        rawCopy: z.string().min(10, "Please paste your email copy"),
        subjectHint: z.string().optional(), // optional existing subject line
      })
    )
    .mutation(async ({ input }) => {
      // Strip HTML if the user pasted HTML source
      const cleanText = input.rawCopy.includes("<")
        ? stripHtml(input.rawCopy)
        : input.rawCopy;

      const systemPrompt = `You are Dr. Pedram Shojai's email copywriter. Your job is to take existing email copy and rewrite it as a short, personal plain-text email that lands in Gmail's Primary inbox, not Promotions.

REWRITING RULES:
- Keep ALL the original meaning, key points, and links — just rewrite the format and tone
- Write as if from one person to one person — warm, direct, personal
- Remove ALL marketing language: no "Click here!", no "Limited time!", no "Don't miss out!", no "ICYMI"
- Remove ALL ALL CAPS words (except acronyms like DNA, OMD)
- Remove ALL excessive exclamation marks (max 1 per email)
- Keep it under 250 words — brevity signals personal email
- Keep only the most important link (the main CTA link)
- Start with "Hi {{first_name}}," (Kajabi merge tag)
- Write in first person as Pedram — conversational, like a letter from a friend who happens to be a doctor
- If the original email already has a sign-off (e.g. "Pedram", "Dr. Pedram Shojai", "Warmly,") — KEEP IT at the end of the body, rewritten in the same plain-text style
- If the original email already has a P.S. line — KEEP IT, rewritten to remove any promotional language
- If the original email has NO sign-off or P.S. — do NOT add one; the Kajabi template handles the signature
- DO NOT invent new content — only rewrite what's already there

OUTPUT FORMAT — return a JSON object with these exact keys:
{
  "subject_a": "subject line option A (curious/question-based, under 50 chars)",
  "subject_b": "subject line option B (benefit-led, under 50 chars)",
  "subject_c": "subject line option C (personal/story-based, under 50 chars)",
  "body": "the full rewritten plain-text email body"
}`;

      const userPrompt = `Here is the existing email copy to rewrite:

${cleanText.slice(0, 4000)}

${input.subjectHint ? `Existing subject line (for reference): ${input.subjectHint}` : ""}

Rewrite this as a short, personal plain-text email following all the rules above. Keep all the key information and links, just strip the promotional tone and template formatting.`;

      const response = await invokeLLM({
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "plain_text_email",
            strict: true,
            schema: {
              type: "object",
              properties: {
                subject_a: { type: "string" },
                subject_b: { type: "string" },
                subject_c: { type: "string" },
                body: { type: "string" },
              },
              required: ["subject_a", "subject_b", "subject_c", "body"],
              additionalProperties: false,
            },
          },
        },
      });

      const content = response.choices[0].message.content;
      const parsed = JSON.parse(
        typeof content === "string" ? content : JSON.stringify(content)
      );

      // Save to DB
      const db = await getDb();
      await db!.insert(plainTextEmails).values({
        subject: parsed.subject_a,
        episodeTitle: null,
        episodeUrl: null,
        episodeNumber: null,
        seriesName: null,
        keyPoints: cleanText.slice(0, 500),
        callToAction: null,
        generatedText: parsed.body,
        subjectLineA: parsed.subject_a,
        subjectLineB: parsed.subject_b,
        subjectLineC: parsed.subject_c,
      });

      return {
        subjectA: parsed.subject_a,
        subjectB: parsed.subject_b,
        subjectC: parsed.subject_c,
        body: parsed.body,
      };
    }),

  // SECONDARY: Build from scratch using episode details
  generate: protectedProcedure
    .input(
      z.object({
        episodeTitle: z.string().min(1),
        episodeNumber: z.number().optional(),
        seriesName: z.string().optional(),
        episodeUrl: z.string().url().optional(),
        keyPoints: z.string().min(1, "Please enter at least one key point"),
        callToAction: z.string().optional(),
        tone: z.enum(["personal", "educational", "urgent"]).default("personal"),
      })
    )
    .mutation(async ({ input }) => {
      const systemPrompt = `You are Dr. Pedram Shojai's email copywriter. You write personal, conversational emails that land in the Primary inbox, not Promotions.

RULES FOR INBOX-FRIENDLY PLAIN TEXT EMAILS:
- Write as if from one person to one person — warm, direct, personal
- NO marketing language: no "Click here!", no "Limited time!", no "Don't miss out!"
- NO ALL CAPS words
- NO excessive exclamation marks (max 1 per email)
- Keep it under 250 words — brevity signals personal email
- One link only — the episode URL
- Start with "Hi {{first_name}}," (Kajabi merge tag)
- Write in first person as Pedram — conversational, like a letter from a friend who happens to be a doctor
- DO NOT add a sign-off, signature, or closing (no "Pedram", no "Dr. Pedram Shojai", no "Warmly," etc.) — the Kajabi template already adds the signature automatically
- DO NOT add a P.S. line — keep the body clean and let the template handle any extras

OUTPUT FORMAT — return a JSON object with these exact keys:
{
  "subject_a": "subject line option A (curious/question-based, under 50 chars)",
  "subject_b": "subject line option B (benefit-led, under 50 chars)",
  "subject_c": "subject line option C (personal/story-based, under 50 chars)",
  "body": "the full plain-text email body"
}`;

      const userPrompt = `Write a plain-text email for this episode:

Episode: ${input.episodeTitle}${input.episodeNumber ? ` (Episode ${input.episodeNumber})` : ""}${input.seriesName ? ` from the series "${input.seriesName}"` : ""}
${input.episodeUrl ? `Watch link: ${input.episodeUrl}` : ""}

Key points covered in this episode:
${input.keyPoints}

${input.callToAction ? `Call to action: ${input.callToAction}` : "Call to action: Watch the episode"}

Tone: ${input.tone === "personal" ? "warm and personal, like a letter from a trusted friend" : input.tone === "educational" ? "informative but accessible, like a teacher sharing something important" : "timely and relevant, like sharing something the reader needs to know now"}`;

      const response = await invokeLLM({
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "plain_text_email",
            strict: true,
            schema: {
              type: "object",
              properties: {
                subject_a: { type: "string" },
                subject_b: { type: "string" },
                subject_c: { type: "string" },
                body: { type: "string" },
              },
              required: ["subject_a", "subject_b", "subject_c", "body"],
              additionalProperties: false,
            },
          },
        },
      });

      const content = response.choices[0].message.content;
      const parsed = JSON.parse(
        typeof content === "string" ? content : JSON.stringify(content)
      );

      const db = await getDb();
      await db!.insert(plainTextEmails).values({
        subject: parsed.subject_a,
        episodeTitle: input.episodeTitle,
        episodeUrl: input.episodeUrl,
        episodeNumber: input.episodeNumber,
        seriesName: input.seriesName,
        keyPoints: input.keyPoints,
        callToAction: input.callToAction,
        generatedText: parsed.body,
        subjectLineA: parsed.subject_a,
        subjectLineB: parsed.subject_b,
        subjectLineC: parsed.subject_c,
      });

      return {
        subjectA: parsed.subject_a,
        subjectB: parsed.subject_b,
        subjectC: parsed.subject_c,
        body: parsed.body,
      };
    }),

  // List previously generated emails
  list: protectedProcedure.query(async () => {
    const db = await getDb();
    const rows = await db!
      .select()
      .from(plainTextEmails)
      .orderBy(desc(plainTextEmails.id))
      .limit(50);
    return rows;
  }),

  // Delete a saved email
  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      await db!.delete(plainTextEmails).where(eq(plainTextEmails.id, input.id));
      return { success: true };
    }),
});
