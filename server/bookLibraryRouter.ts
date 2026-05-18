import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { eq, desc, and } from "drizzle-orm";
import { getDb } from "./db";
import {
  uploadedBooks,
  bookSnippets,
  type BookSnippet,
} from "../drizzle/schema";
import { protectedProcedure, router } from "./_core/trpc";
import { invokeLLM } from "./_core/llm";
import { generateImage } from "./_core/imageGeneration";
import { parseLLMJson } from "./llmUtils";
import { pushToBuffer, getBufferProfiles } from "./buffer";

// ─── Voice Profile Extraction ─────────────────────────────────────────────────

const VOICE_PROFILE_PROMPT = `You are a literary analyst studying the writing voice of Dr. Pedram Shojai (The Urban Monk). 
Analyze the provided book excerpt and extract a detailed voice profile.

Return a JSON object with these exact fields:
{
  "tone": ["array of 4-6 tone descriptors, e.g. direct, spiritual, scientific, conversational, urgent, warm"],
  "sentenceStyle": "1-2 sentence description of sentence structure patterns",
  "vocabulary": ["array of 40-60 distinctive words/phrases unique to this author's voice"],
  "themes": ["array of 8-12 recurring themes"],
  "openingPatterns": ["array of 5-8 typical opening sentence patterns or phrases"],
  "closingPatterns": ["array of 5-8 typical closing sentence patterns or phrases"],
  "metaphorStyle": "1-2 sentence description of how the author uses metaphors",
  "authorityMarkers": ["array of 5-8 phrases the author uses to establish credibility"],
  "callToActionStyle": "1-2 sentence description of how the author motivates action",
  "paragraphRhythm": "description of how paragraphs are structured and paced"
}`;

async function extractVoiceProfile(text: string): Promise<object> {
  const third = Math.floor(text.length / 3);
  const sample = [
    text.substring(0, 2000),
    text.substring(third, third + 2000),
    text.substring(text.length - 2000),
  ].join("\n\n---\n\n");

  const result = await invokeLLM({
    messages: [
      { role: "system", content: VOICE_PROFILE_PROMPT },
      { role: "user", content: `Book excerpt:\n\n${sample}` },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "voice_profile",
        strict: true,
        schema: {
          type: "object",
          properties: {
            tone: { type: "array", items: { type: "string" } },
            sentenceStyle: { type: "string" },
            vocabulary: { type: "array", items: { type: "string" } },
            themes: { type: "array", items: { type: "string" } },
            openingPatterns: { type: "array", items: { type: "string" } },
            closingPatterns: { type: "array", items: { type: "string" } },
            metaphorStyle: { type: "string" },
            authorityMarkers: { type: "array", items: { type: "string" } },
            callToActionStyle: { type: "string" },
            paragraphRhythm: { type: "string" },
          },
          required: [
            "tone", "sentenceStyle", "vocabulary", "themes",
            "openingPatterns", "closingPatterns", "metaphorStyle",
            "authorityMarkers", "callToActionStyle", "paragraphRhythm",
          ],
          additionalProperties: false,
        },
      },
    },
  });

  const content = result.choices?.[0]?.message?.content ?? "{}";
  const contentStr = typeof content === "string" ? content : JSON.stringify(content);
  return parseLLMJson(contentStr, "voice profile") as object;
}

// ─── Snippet Extraction (Two-Stage Quality Pipeline) ─────────────────────────

// STAGE 1: Social strategist extracts raw candidate quotes — no quality bar yet,
// just finds passages that COULD be compelling if they pass the editorial filter.
const STAGE1_EXTRACTION_PROMPT = `You are a senior social media strategist who has built audiences of millions for thought leaders.
Your job: scan this book excerpt and pull out every passage that has the RAW POTENTIAL to stop a scroll.

A passage has raw potential if it meets ANY of these criteria:
- It contains a surprising, counterintuitive, or provocative idea
- It names a specific enemy (stress, toxins, bad sleep, modern life) in a vivid way
- It gives a concrete, actionable instruction or reframe
- It captures a universal human feeling in an unusually precise way
- It contains a memorable metaphor or image
- It makes a bold claim backed by the author's expertise

DO NOT include:
- Chapter headings, transitions, or structural text
- Passages that are incomplete thoughts or mid-sentence fragments
- Generic motivational filler ("You can do it!", "Believe in yourself")
- Pure narrative without a transferable insight

Extract 15-25 raw candidates. Return verbatim text only — do NOT paraphrase or clean up.
Return JSON array with fields: passageText, theme, chapter`;

// STAGE 2: Editorial judge scores and rejects — only 7+ scores survive.
const STAGE2_EDITORIAL_PROMPT = `You are a ruthless editorial director at a top wellness media brand.
You have seen thousands of social media quote cards. You know what gets shared and saved — and what gets ignored.

For each candidate quote, score it 1-10 on SOCIAL MEDIA IMPACT using these criteria:

10 — Instant save. People will screenshot this. Specific, surprising, emotionally resonant.
8-9 — Strong share. Clear insight, memorable phrasing, stands alone without context.
6-7 — Decent but generic. Could work with a great image. Borderline.
4-5 — Weak. Vague, cliché, or requires too much context to land.
1-3 — Reject. Generic self-help noise, incomplete thought, or meaningless without the book.

Also classify each as: "share-worthy" (people share it to look smart/caring), "save-worthy" (people save it for personal use), or "both".

Only return quotes with score >= 7. Be strict — it is better to return 5 great quotes than 20 mediocre ones.
Fix any obvious typos in the passageText (repeated words, OCR errors) but do NOT rephrase.

Return JSON array with fields: passageText, theme, platform, chapter, qualityScore (int), shareabilityType (string)`;

type RawCandidate = { passageText: string; theme: string; chapter: string };
type ScoredSnippet = { passageText: string; theme: string; platform: string; chapter: string; qualityScore: number; shareabilityType: string };

async function extractSnippets(
  text: string,
  bookTitle: string
): Promise<ScoredSnippet[]> {
  const chunkSize = 8000;
  const chunks: string[] = [];
  // Process up to 64k chars (roughly a full book) in 8k chunks
  for (let i = 0; i < Math.min(text.length, 64000); i += chunkSize) {
    chunks.push(text.substring(i, i + chunkSize));
  }

  // STAGE 1: Extract raw candidates from all chunks in parallel
  const stage1Results = await Promise.allSettled(
    chunks.map(async (chunk, idx) => {
      const result = await invokeLLM({
        messages: [
          { role: "system", content: STAGE1_EXTRACTION_PROMPT },
          { role: "user", content: `Book: "${bookTitle}" (section ${idx + 1} of ${chunks.length})\n\n${chunk}` },
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "candidates",
            strict: false,
            schema: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  passageText: { type: "string" },
                  theme: { type: "string" },
                  chapter: { type: "string" },
                },
                required: ["passageText", "theme", "chapter"],
              },
            },
          },
        },
      });
      const content = result.choices?.[0]?.message?.content ?? "[]";
      const contentStr = typeof content === "string" ? content : JSON.stringify(content);
      const parsed = parseLLMJson(contentStr, "candidates");
      return Array.isArray(parsed) ? (parsed as RawCandidate[]) : [];
    })
  );

  // Collect all raw candidates, deduplicate by first 80 chars
  const allCandidates: RawCandidate[] = [];
  const seen = new Set<string>();
  for (const result of stage1Results) {
    if (result.status === "fulfilled") {
      for (const c of result.value) {
        const key = c.passageText.substring(0, 80).toLowerCase().trim();
        if (!seen.has(key) && c.passageText.length > 30) {
          seen.add(key);
          allCandidates.push(c);
        }
      }
    }
  }

  console.log(`[bookLibrary] Stage 1: ${allCandidates.length} raw candidates extracted from "${bookTitle}"`);

  if (allCandidates.length === 0) return [];

  // STAGE 2: Editorial scoring — process in batches of 20
  const batchSize = 20;
  const approvedSnippets: ScoredSnippet[] = [];

  for (let i = 0; i < allCandidates.length; i += batchSize) {
    const batch = allCandidates.slice(i, i + batchSize);
    try {
      const result = await invokeLLM({
        messages: [
          { role: "system", content: STAGE2_EDITORIAL_PROMPT },
          {
            role: "user",
            content: `Book: "${bookTitle}" — Score these ${batch.length} candidate quotes:\n\n${batch.map((c, j) => `[${j + 1}] ${c.passageText}`).join("\n\n")}`,
          },
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "scored_snippets",
            strict: false,
            schema: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  passageText: { type: "string" },
                  theme: { type: "string" },
                  platform: { type: "string" },
                  chapter: { type: "string" },
                  qualityScore: { type: "integer" },
                  shareabilityType: { type: "string" },
                },
                required: ["passageText", "theme", "platform", "chapter", "qualityScore", "shareabilityType"],
              },
            },
          },
        },
      });

      const content = result.choices?.[0]?.message?.content ?? "[]";
      const contentStr = typeof content === "string" ? content : JSON.stringify(content);
      const scored = parseLLMJson(contentStr, "scored_snippets");
      if (Array.isArray(scored)) {
        // Only keep quotes that scored 7 or higher
        const approved = (scored as ScoredSnippet[]).filter((s) => (s.qualityScore ?? 0) >= 7);
        approvedSnippets.push(...approved);
      }
    } catch (err) {
      console.error("[bookLibrary] Stage 2 editorial scoring error:", err);
    }
  }

  console.log(`[bookLibrary] Stage 2: ${approvedSnippets.length} snippets approved (score ≥7) from "${bookTitle}"`);
  return approvedSnippets;
}

// ─── Title Card Generation ────────────────────────────────────────────────────

async function generateTitleCardImage(snippet: BookSnippet, bookTitle: string): Promise<string | null> {
  try {
    const prompt = `Create a professional social media quote card for The Urban Monk brand.
Quote: "${snippet.passageText}"
Author: Dr. Pedram Shojai
Book: ${bookTitle}

Style: Dark earthy background (deep forest green or charcoal), elegant serif typography for the quote in white/cream, 
small "- Dr. Pedram Shojai" attribution in gold/amber below the quote, 
"The Urban Monk" branding subtly at the bottom, 
minimalist and sophisticated, suitable for Instagram.
Square format (1:1 ratio). No busy backgrounds, no stock photos of people.`;

    const { url } = await generateImage({ prompt });
    return url ?? null;
  } catch (err) {
    console.error("[bookLibrary] title card generation error:", err);
    return null;
  }
}

// ─── Router ───────────────────────────────────────────────────────────────────

export const bookLibraryRouter = router({
  listBooks: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return [];
    return db
      .select()
      .from(uploadedBooks)
      .where(eq(uploadedBooks.userId, ctx.user.id))
      .orderBy(desc(uploadedBooks.createdAt));
  }),

  getBook: protectedProcedure
    .input(z.object({ bookId: z.number() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      const [book] = await db
        .select()
        .from(uploadedBooks)
        .where(and(eq(uploadedBooks.id, input.bookId), eq(uploadedBooks.userId, ctx.user.id)));
      if (!book) throw new TRPCError({ code: "NOT_FOUND", message: "Book not found" });

      const snippets = await db
        .select()
        .from(bookSnippets)
        .where(eq(bookSnippets.bookId, input.bookId))
        .orderBy(desc(bookSnippets.createdAt));

      return { book, snippets };
    }),

  createBook: protectedProcedure
    .input(
      z.object({
        title: z.string().min(1),
        author: z.string().default("Dr. Pedram Shojai"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      const [book] = await db
        .insert(uploadedBooks)
        .values({
          userId: ctx.user.id,
          title: input.title,
          author: input.author,
          status: "uploading",
        })
        .$returningId();
      return { bookId: book.id };
    }),

  processBook: protectedProcedure
    .input(
      z.object({
        bookId: z.number(),
        s3Key: z.string(),
        s3Url: z.string(),
        extractedText: z.string(),
        pageCount: z.number().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      const [book] = await db
        .select()
        .from(uploadedBooks)
        .where(and(eq(uploadedBooks.id, input.bookId), eq(uploadedBooks.userId, ctx.user.id)));
      if (!book) throw new TRPCError({ code: "NOT_FOUND", message: "Book not found" });

      const wordCount = input.extractedText.split(/\s+/).length;
      await db
        .update(uploadedBooks)
        .set({
          s3Key: input.s3Key,
          s3Url: input.s3Url,
          extractedText: input.extractedText,
          wordCount,
          pageCount: input.pageCount,
          status: "processing",
        })
        .where(eq(uploadedBooks.id, input.bookId));

      let voiceProfileJson: string | null = null;
      try {
        const profile = await extractVoiceProfile(input.extractedText);
        voiceProfileJson = JSON.stringify(profile);
      } catch (err) {
        console.error("[bookLibrary] voice profile extraction failed:", err);
      }

      let snippetCount = 0;
      try {
        const snippets = await extractSnippets(input.extractedText, book.title);
        if (snippets.length > 0) {
          await db.insert(bookSnippets).values(
            snippets.map((s) => ({
              bookId: input.bookId,
              userId: ctx.user.id,
              passageText: s.passageText,
              theme: s.theme,
              platform: (s.platform as "instagram" | "linkedin" | "twitter" | "facebook" | "all") ?? "instagram",
              chapter: s.chapter,
              qualityScore: s.qualityScore ?? null,
              shareabilityType: s.shareabilityType ?? null,
              titleCardStatus: "pending" as const,
              savedToKanban: false,
            }))
          );
          snippetCount = snippets.length;
        }
      } catch (err) {
        console.error("[bookLibrary] snippet extraction failed:", err);
      }

      await db
        .update(uploadedBooks)
        .set({ voiceProfileJson, status: "ready" })
        .where(eq(uploadedBooks.id, input.bookId));

      return { success: true, snippetCount };
    }),

  generateTitleCard: protectedProcedure
    .input(z.object({ snippetId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      const [snippet] = await db
        .select()
        .from(bookSnippets)
        .where(and(eq(bookSnippets.id, input.snippetId), eq(bookSnippets.userId, ctx.user.id)));
      if (!snippet) throw new TRPCError({ code: "NOT_FOUND", message: "Snippet not found" });

      const [book] = await db
        .select({ title: uploadedBooks.title })
        .from(uploadedBooks)
        .where(eq(uploadedBooks.id, snippet.bookId));

      await db
        .update(bookSnippets)
        .set({ titleCardStatus: "generating" })
        .where(eq(bookSnippets.id, input.snippetId));

      const url = await generateTitleCardImage(snippet, book?.title ?? "The Urban Monk");

      if (url) {
        await db
          .update(bookSnippets)
          .set({ titleCardUrl: url, titleCardStatus: "ready" })
          .where(eq(bookSnippets.id, input.snippetId));
        return { success: true, titleCardUrl: url };
      } else {
        await db
          .update(bookSnippets)
          .set({ titleCardStatus: "failed" })
          .where(eq(bookSnippets.id, input.snippetId));
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Title card generation failed." });
      }
    }),

  generateAllTitleCards: protectedProcedure
    .input(z.object({ bookId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      const pendingSnippets = await db
        .select()
        .from(bookSnippets)
        .where(
          and(
            eq(bookSnippets.bookId, input.bookId),
            eq(bookSnippets.userId, ctx.user.id),
            eq(bookSnippets.titleCardStatus, "pending")
          )
        );

      const [book] = await db
        .select({ title: uploadedBooks.title })
        .from(uploadedBooks)
        .where(eq(uploadedBooks.id, input.bookId));

      let generated = 0;
      for (const snippet of pendingSnippets.slice(0, 10)) {
        const url = await generateTitleCardImage(snippet, book?.title ?? "The Urban Monk");
        if (url) {
          await db
            .update(bookSnippets)
            .set({ titleCardUrl: url, titleCardStatus: "ready" })
            .where(eq(bookSnippets.id, snippet.id));
          generated++;
        }
      }

      return { generated, total: pendingSnippets.length };
    }),

  deleteBook: protectedProcedure
    .input(z.object({ bookId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      await db.delete(bookSnippets).where(eq(bookSnippets.bookId, input.bookId));
      await db
        .delete(uploadedBooks)
        .where(and(eq(uploadedBooks.id, input.bookId), eq(uploadedBooks.userId, ctx.user.id)));
      return { success: true };
    }),

  deleteSnippet: protectedProcedure
    .input(z.object({ snippetId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      await db
        .delete(bookSnippets)
        .where(and(eq(bookSnippets.id, input.snippetId), eq(bookSnippets.userId, ctx.user.id)));
      return { success: true };
    }),

  reExtractSnippets: protectedProcedure
    .input(z.object({ bookId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      // Verify ownership
      const [book] = await db
        .select()
        .from(uploadedBooks)
        .where(and(eq(uploadedBooks.id, input.bookId), eq(uploadedBooks.userId, ctx.user.id)));
      if (!book) throw new TRPCError({ code: "NOT_FOUND", message: "Book not found" });
      if (!book.extractedText) throw new TRPCError({ code: "BAD_REQUEST", message: "Book text not available. Please re-upload the PDF." });

      // Purge all existing snippets for this book
      await db.delete(bookSnippets).where(eq(bookSnippets.bookId, input.bookId));
      console.log(`[bookLibrary] Purged old snippets for book ${input.bookId} "${book.title}"`);

      // Mark book as processing
      await db.update(uploadedBooks).set({ status: "processing" }).where(eq(uploadedBooks.id, input.bookId));

      // Run the two-stage quality pipeline
      let snippetCount = 0;
      try {
        const snippets = await extractSnippets(book.extractedText, book.title);
        if (snippets.length > 0) {
          await db.insert(bookSnippets).values(
            snippets.map((s) => ({
              bookId: input.bookId,
              userId: ctx.user.id,
              passageText: s.passageText,
              theme: s.theme,
              platform: (s.platform as "instagram" | "linkedin" | "twitter" | "facebook" | "all") ?? "instagram",
              chapter: s.chapter,
              qualityScore: s.qualityScore ?? null,
              shareabilityType: s.shareabilityType ?? null,
              titleCardStatus: "pending" as const,
              savedToKanban: false,
            }))
          );
          snippetCount = snippets.length;
        }
      } catch (err) {
        console.error("[bookLibrary] re-extraction failed:", err);
        await db.update(uploadedBooks).set({ status: "failed" }).where(eq(uploadedBooks.id, input.bookId));
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Re-extraction failed. Please try again." });
      }

      await db.update(uploadedBooks).set({ status: "ready" }).where(eq(uploadedBooks.id, input.bookId));
      return { success: true, snippetCount };
    }),

  getMasterVoiceProfile: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return null;

    const books = await db
      .select({ voiceProfileJson: uploadedBooks.voiceProfileJson, title: uploadedBooks.title })
      .from(uploadedBooks)
      .where(and(eq(uploadedBooks.userId, ctx.user.id), eq(uploadedBooks.status, "ready")));

    if (books.length === 0) return null;

    const profiles = books
      .filter((b) => b.voiceProfileJson)
      .map((b) => {
        try { return JSON.parse(b.voiceProfileJson!); } catch { return null; }
      })
      .filter(Boolean);

    if (profiles.length === 0) return null;
    if (profiles.length === 1) return profiles[0];

    const merged: Record<string, unknown> = {};
    for (const profile of profiles) {
      for (const [key, value] of Object.entries(profile as Record<string, unknown>)) {
        if (Array.isArray(value)) {
          if (!merged[key]) merged[key] = [];
          (merged[key] as unknown[]).push(...value);
        } else if (!merged[key]) {
          merged[key] = value;
        }
      }
    }
    for (const key of Object.keys(merged)) {
      if (Array.isArray(merged[key])) {
        const arr = merged[key] as string[];
        merged[key] = arr.filter((v, i, a) => a.indexOf(v) === i);
      }
    }
    return merged;
  }),

  listSnippets: protectedProcedure
    .input(
      z.object({
        bookId: z.number().optional(),
        theme: z.string().optional(),
        platform: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) return [];

      const conditions = [eq(bookSnippets.userId, ctx.user.id)];
      if (input.bookId) conditions.push(eq(bookSnippets.bookId, input.bookId));
      if (input.theme) conditions.push(eq(bookSnippets.theme, input.theme));
      if (input.platform) {
        conditions.push(
          eq(bookSnippets.platform, input.platform as "instagram" | "linkedin" | "twitter" | "facebook" | "all")
        );
      }

      return db
        .select()
        .from(bookSnippets)
        .where(and(...conditions))
        .orderBy(desc(bookSnippets.createdAt));
    }),

  // ─── Regenerate Title Card (fixes typos, regenerates image) ─────────────────
  regenerateTitleCard: protectedProcedure
    .input(z.object({
      snippetId: z.number(),
      correctedText: z.string().optional(), // caller can pass a corrected quote
      platform: z.enum(["square", "linkedin", "x", "meta", "instagram_feed", "instagram_reel", "instagram_story"]).default("square"),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      const [snippet] = await db
        .select()
        .from(bookSnippets)
        .where(and(eq(bookSnippets.id, input.snippetId), eq(bookSnippets.userId, ctx.user.id)));
      if (!snippet) throw new TRPCError({ code: "NOT_FOUND", message: "Snippet not found" });
      const [book] = await db
        .select({ title: uploadedBooks.title })
        .from(uploadedBooks)
        .where(eq(uploadedBooks.id, snippet.bookId));
      const bookTitle = book?.title ?? "The Urban Monk";
      const quoteText = input.correctedText ?? snippet.passageText;

      // If corrected text provided, update the snippet text first
      if (input.correctedText && input.correctedText !== snippet.passageText) {
        await db
          .update(bookSnippets)
          .set({ passageText: input.correctedText })
          .where(eq(bookSnippets.id, input.snippetId));
      }

      // Determine dimensions based on platform
      const platformDimensions: Record<string, string> = {
        square: "Square 1:1 format (1080×1080px) — ideal for Instagram/Meta",
        linkedin: "Landscape 1.91:1 format (1200×627px) — ideal for LinkedIn",
        x: "Landscape 16:9 format (1600×900px) — ideal for X/Twitter",
        meta: "Square 1:1 format (1080×1080px) — ideal for Facebook/Instagram",
        instagram_feed: "Square 1:1 format (1080×1080px) — Instagram feed post",
        instagram_reel: "Vertical 9:16 format (1080×1920px) — Instagram Reel or Story cover",
        instagram_story: "Vertical 9:16 format (1080×1920px) — Instagram Story",
      };
      const dimNote = platformDimensions[input.platform] ?? platformDimensions.square;

      await db
        .update(bookSnippets)
        .set({ titleCardStatus: "generating" })
        .where(eq(bookSnippets.id, input.snippetId));

      const prompt = `Create a professional social media quote card for The Urban Monk brand.
Quote: "${quoteText}"
Author: Dr. Pedram Shojai
Book: ${bookTitle}
Format: ${dimNote}
Style: Dark earthy background (deep forest green or rich charcoal), elegant serif typography for the quote in white/cream, small "- Dr. Pedram Shojai" attribution in gold/amber below the quote, "The Urban Monk" branding subtly at the bottom in gold small caps, minimalist and sophisticated. No busy backgrounds, no stock photos of people. The quote text must be rendered EXACTLY as provided — no repeated words, no typos.`;

      try {
        const { url } = await generateImage({ prompt });
        if (!url) throw new Error("No URL returned");
        let platformFields: Partial<typeof bookSnippets.$inferInsert>;
        if (input.platform === "linkedin") {
          platformFields = { titleCardLinkedinUrl: url, titleCardStatus: "ready" };
        } else if (input.platform === "x") {
          platformFields = { titleCardXUrl: url, titleCardStatus: "ready" };
        } else if (input.platform === "meta") {
          platformFields = { titleCardMetaUrl: url, titleCardStatus: "ready" };
        } else if (input.platform === "instagram_feed") {
          platformFields = { titleCardInstagramFeedUrl: url, titleCardStatus: "ready" };
        } else if (input.platform === "instagram_reel") {
          platformFields = { titleCardInstagramReelUrl: url, titleCardStatus: "ready" };
        } else if (input.platform === "instagram_story") {
          platformFields = { titleCardInstagramStoryUrl: url, titleCardStatus: "ready" };
        } else {
          platformFields = { titleCardUrl: url, titleCardStatus: "ready" };
        }
        await db
          .update(bookSnippets)
          .set(platformFields)
          .where(eq(bookSnippets.id, input.snippetId));
        return { success: true, titleCardUrl: url, platform: input.platform };
      } catch (err) {
        await db
          .update(bookSnippets)
          .set({ titleCardStatus: "failed" })
          .where(eq(bookSnippets.id, input.snippetId));
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: `Image generation failed: ${err}` });
      }
    }),

  // ─── Generate Social Copy + Hashtags for all 3 platforms ────────────────────
  generateSocialCopy: protectedProcedure
    .input(z.object({ snippetId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      const [snippet] = await db
        .select()
        .from(bookSnippets)
        .where(and(eq(bookSnippets.id, input.snippetId), eq(bookSnippets.userId, ctx.user.id)));
      if (!snippet) throw new TRPCError({ code: "NOT_FOUND", message: "Snippet not found" });
      const [book] = await db
        .select({ title: uploadedBooks.title })
        .from(uploadedBooks)
        .where(eq(uploadedBooks.id, snippet.bookId));
      const bookTitle = book?.title ?? "The Urban Monk";

      const systemPrompt = `You are the social media voice of Dr. Pedram Shojai, author and founder of The Urban Monk Academy. You write compelling, authentic social posts that drive people to join the Academy at https://theurbanmonk.com/academy ($297/year). Dr. Shojai's voice is: direct, spiritual but practical, science-backed, urgent yet compassionate. He speaks to high-performers who feel burned out and want to reclaim their energy, focus, and purpose.`;

      const userPrompt = `Write social media copy for this quote from "${bookTitle}" by Dr. Pedram Shojai:

"${snippet.passageText}"

Generate copy for FIVE platforms. Return a JSON object with exactly these fields:
{
  "linkedin": "LinkedIn post (1300-1500 chars). Start with a hook line, 2-3 short paragraphs expanding on the quote's insight, end with a CTA to join the Urban Monk Academy. Professional but personal tone. Include 3-5 relevant hashtags at the end.",
  "x": "X/Twitter post (200-260 chars MAXIMUM — this is a hard limit). Punchy, thought-provoking. Include 2-3 hashtags. No URLs.",
  "meta": "Facebook caption (800-1200 chars). Conversational, story-driven, emotionally resonant. Start with the quote or a hook. End with a question to drive comments + CTA to the Academy. Include 5-8 hashtags.",
  "instagram": "Instagram feed caption (800-1200 chars). Visual-first, aspirational, emotionally resonant. Start with a bold hook line or the quote itself. Use line breaks for readability. End with 'Link in bio to join the Urban Monk Academy.' Include 10-15 hashtags at the end on their own line.",
  "instagramReel": "Instagram Reels caption (150-300 chars). Ultra-punchy hook in the first line (this shows before 'more'). 1-2 sentences max. End with 'Link in bio.' Include 3-5 hashtags.",
  "hashtags": ["array of 12-15 hashtags relevant to this snippet's theme, without the # symbol"],
  "ctaText": "Short CTA sentence (max 100 chars) pointing to the Academy, e.g. 'Join the Urban Monk Academy → theurbanmonk.com/academy'"
}

IMPORTANT: The X post MUST be 260 characters or fewer. Count carefully. The instagramReel caption MUST be under 300 characters.`;

      const response = await invokeLLM({
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "social_copy",
            strict: true,
            schema: {
              type: "object",
              properties: {
                linkedin: { type: "string" },
                x: { type: "string" },
                meta: { type: "string" },
                instagram: { type: "string" },
                instagramReel: { type: "string" },
                hashtags: { type: "array", items: { type: "string" } },
                ctaText: { type: "string" },
              },
              required: ["linkedin", "x", "meta", "instagram", "instagramReel", "hashtags", "ctaText"],
              additionalProperties: false,
            },
          },
        },
      });

      const rawContent = response?.choices?.[0]?.message?.content;
      const raw = typeof rawContent === "string" ? rawContent : "{}";
      let parsed: { linkedin: string; x: string; meta: string; instagram: string; instagramReel: string; hashtags: string[]; ctaText: string };
      try {
        parsed = JSON.parse(raw);
      } catch {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to parse social copy from AI" });
      }

      // Enforce X character limit
      if (parsed.x.length > 280) {
        parsed.x = parsed.x.substring(0, 277) + "...";
      }

      await db
        .update(bookSnippets)
        .set({
          linkedinCopy: parsed.linkedin,
          xCopy: parsed.x,
          metaCopy: parsed.meta,
          instagramCopy: parsed.instagram,
          instagramReelCopy: parsed.instagramReel,
          hashtags: JSON.stringify(parsed.hashtags),
          ctaText: parsed.ctaText,
        })
        .where(eq(bookSnippets.id, input.snippetId));

      return {
        linkedin: parsed.linkedin,
        x: parsed.x,
        meta: parsed.meta,
        instagram: parsed.instagram,
        instagramReel: parsed.instagramReel,
        hashtags: parsed.hashtags,
        ctaText: parsed.ctaText,
      };
    }),

  // ─── Get Buffer channels ─────────────────────────────────────────────────────
  getBufferChannels: protectedProcedure.query(async () => {
    try {
      const profiles = await getBufferProfiles();
      return profiles;
    } catch (err) {
      console.error("[bookLibrary] getBufferChannels error:", err);
      return [];
    }
  }),

  // ─── Push snippet to Buffer ──────────────────────────────────────────────────
  pushSnippetToBuffer: protectedProcedure
    .input(z.object({
      snippetId: z.number(),
      platform: z.enum(["linkedin", "x", "meta", "instagram_feed", "instagram_reel", "instagram_story"]),
      channelIds: z.array(z.string()).min(1),
      copyOverride: z.string().optional(), // user-edited copy
      scheduledAt: z.number().optional(),  // UTC ms timestamp
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      const [snippet] = await db
        .select()
        .from(bookSnippets)
        .where(and(eq(bookSnippets.id, input.snippetId), eq(bookSnippets.userId, ctx.user.id)));
      if (!snippet) throw new TRPCError({ code: "NOT_FOUND", message: "Snippet not found" });

      // Determine which copy to use
      let copy = input.copyOverride;
      if (!copy) {
        if (input.platform === "linkedin") copy = snippet.linkedinCopy ?? undefined;
        else if (input.platform === "x") copy = snippet.xCopy ?? undefined;
        else if (input.platform === "instagram_feed") copy = snippet.instagramCopy ?? undefined;
        else if (input.platform === "instagram_reel") copy = snippet.instagramReelCopy ?? undefined;
        else if (input.platform === "instagram_story") copy = snippet.instagramCopy ?? undefined;
        else copy = snippet.metaCopy ?? undefined;
      }
      if (!copy) {
        throw new TRPCError({ code: "BAD_REQUEST", message: `No copy available for ${input.platform}. Generate social copy first.` });
      }

      // Determine which image to use
      let imageUrl: string | undefined;
      if (input.platform === "linkedin") {
        imageUrl = snippet.titleCardLinkedinUrl ?? snippet.titleCardUrl ?? undefined;
      } else if (input.platform === "x") {
        imageUrl = snippet.titleCardXUrl ?? snippet.titleCardUrl ?? undefined;
      } else if (input.platform === "instagram_feed") {
        imageUrl = snippet.titleCardInstagramFeedUrl ?? snippet.titleCardUrl ?? undefined;
      } else if (input.platform === "instagram_reel") {
        imageUrl = snippet.titleCardInstagramReelUrl ?? snippet.titleCardUrl ?? undefined;
      } else if (input.platform === "instagram_story") {
        imageUrl = snippet.titleCardInstagramStoryUrl ?? snippet.titleCardUrl ?? undefined;
      } else {
        imageUrl = snippet.titleCardMetaUrl ?? snippet.titleCardUrl ?? undefined;
      }

      // Map platform to Buffer metaPostType for Instagram
      const metaPostType = input.platform === "instagram_reel" ? "reel"
        : input.platform === "instagram_story" ? "story"
        : "post";

      // Map platform to Buffer platform string
      const bufferPlatform = input.platform.startsWith("instagram") ? "instagram"
        : input.platform === "x" ? "x"
        : input.platform;

      const result = await pushToBuffer({
        text: copy,
        profileIds: input.channelIds,
        imageUrl,
        platform: bufferPlatform,
        metaPostType,
        scheduledAt: input.scheduledAt,
        ctaUrl: snippet.ctaText ? "https://theurbanmonk.com/academy" : undefined,
        channelServiceMap: Object.fromEntries(input.channelIds.map((id) => [id, input.platform.startsWith("instagram") ? "instagram" : input.platform])),
      });

            // Record the push result — set per-platform published timestamp to prevent re-publishing
      if (result.success) {
        const platformPublishedField: Partial<typeof bookSnippets.$inferInsert> = {
          bufferSentAt: new Date(),
          bufferLastResult: JSON.stringify({ platform: input.platform, ...result }),
        };
        if (input.platform === "linkedin") platformPublishedField.publishedLinkedinAt = new Date();
        else if (input.platform === "x") platformPublishedField.publishedXAt = new Date();
        else if (input.platform === "meta") platformPublishedField.publishedMetaAt = new Date();
        else if (input.platform === "instagram_feed") platformPublishedField.publishedInstagramFeedAt = new Date();
        else if (input.platform === "instagram_reel") platformPublishedField.publishedInstagramReelAt = new Date();
        else if (input.platform === "instagram_story") platformPublishedField.publishedInstagramStoryAt = new Date();
        await db
          .update(bookSnippets)
          .set(platformPublishedField)
          .where(eq(bookSnippets.id, input.snippetId));
      } else {
        await db
          .update(bookSnippets)
          .set({ bufferLastResult: JSON.stringify({ platform: input.platform, ...result }) })
          .where(eq(bookSnippets.id, input.snippetId));
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: result.error ?? "Buffer push failed" });
      }
      return { success: true, bufferId: result.bufferId };
    }),

  // ─── Generate all 6 platform title cards for a snippet in one call ──────────
  generateAllPlatformCards: protectedProcedure
    .input(z.object({
      snippetId: z.number(),
      correctedText: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      const [snippet] = await db
        .select()
        .from(bookSnippets)
        .where(and(eq(bookSnippets.id, input.snippetId), eq(bookSnippets.userId, ctx.user.id)));
      if (!snippet) throw new TRPCError({ code: "NOT_FOUND", message: "Snippet not found" });
      const [book] = await db
        .select({ title: uploadedBooks.title })
        .from(uploadedBooks)
        .where(eq(uploadedBooks.id, snippet.bookId));
      const bookTitle = book?.title ?? "The Urban Monk";
      const quoteText = input.correctedText ?? snippet.passageText;
      // Optionally save corrected text
      if (input.correctedText && input.correctedText !== snippet.passageText) {
        await db
          .update(bookSnippets)
          .set({ passageText: input.correctedText })
          .where(eq(bookSnippets.id, input.snippetId));
      }
      await db
        .update(bookSnippets)
        .set({ titleCardStatus: "generating" })
        .where(eq(bookSnippets.id, input.snippetId));
      const basePrompt = (dimNote: string) =>
        `Create a professional social media quote card for The Urban Monk brand.
Quote: "${quoteText}"
Author: Dr. Pedram Shojai
Book: ${bookTitle}
Format: ${dimNote}
Style: Dark earthy background (deep forest green or rich charcoal), elegant serif typography for the quote in white/cream, small "- Dr. Pedram Shojai" attribution in gold/amber below the quote, "The Urban Monk" branding subtly at the bottom in gold small caps, minimalist and sophisticated. No busy backgrounds, no stock photos of people. The quote text must be rendered EXACTLY as provided — no repeated words, no typos.`;
      const platforms = [
        { key: "linkedin", dim: "Landscape 1.91:1 format (1200×627px) — LinkedIn", field: "titleCardLinkedinUrl" },
        { key: "x", dim: "Landscape 16:9 format (1600×900px) — X/Twitter", field: "titleCardXUrl" },
        { key: "meta", dim: "Square 1:1 format (1080×1080px) — Facebook/Meta", field: "titleCardMetaUrl" },
        { key: "instagram_feed", dim: "Square 1:1 format (1080×1080px) — Instagram feed", field: "titleCardInstagramFeedUrl" },
        { key: "instagram_reel", dim: "Vertical 9:16 format (1080×1920px) — Instagram Reel cover", field: "titleCardInstagramReelUrl" },
        { key: "instagram_story", dim: "Vertical 9:16 format (1080×1920px) — Instagram Story", field: "titleCardInstagramStoryUrl" },
      ];
      const results: Record<string, string | null> = {};
      // Generate all 6 platform cards in parallel
      await Promise.all(
        platforms.map(async (p) => {
          try {
            const { url } = await generateImage({ prompt: basePrompt(p.dim) });
            results[p.field] = url ?? null;
          } catch {
            results[p.field] = null;
          }
        })
      );
      // Also set the default titleCardUrl to the square/meta version
      const defaultUrl = results["titleCardMetaUrl"] ?? results["titleCardInstagramFeedUrl"] ?? null;
      await db
        .update(bookSnippets)
        .set({
          ...results,
          titleCardUrl: defaultUrl,
          titleCardStatus: "ready",
        } as Partial<typeof bookSnippets.$inferInsert>)
        .where(eq(bookSnippets.id, input.snippetId));
      const generated = Object.values(results).filter(Boolean).length;
      return { success: true, generated, results };
    }),
});
