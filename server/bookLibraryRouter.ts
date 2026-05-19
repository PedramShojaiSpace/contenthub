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
import { invokeClaudeJson } from "./claudeLLM";
import { parseLLMJson } from "./llmUtils";

// Map any platform string the LLM might return to a valid snippetPlatformEnum value
const VALID_SNIPPET_PLATFORMS = new Set(["instagram", "linkedin", "twitter", "facebook", "all"]);
function sanitizePlatform(raw: string | null | undefined): "instagram" | "linkedin" | "twitter" | "facebook" | "all" {
  if (!raw) return "all";
  const lower = raw.toLowerCase().trim();
  if (lower === "x" || lower === "twitter" || lower === "x/twitter") return "twitter";
  if (lower === "meta" || lower === "facebook") return "facebook";
  if (lower.startsWith("instagram")) return "instagram";
  if (VALID_SNIPPET_PLATFORMS.has(lower)) return lower as "instagram" | "linkedin" | "twitter" | "facebook" | "all";
  return "all";
}
import { pushToBuffer, getBufferProfiles } from "./buffer";
import { compositeCard, compositeAllPlatformCards } from "./titleCardCompositor";

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
  // Sample beginning, middle, and end of the book for a representative voice profile
  const sample = [
    text.substring(0, 2000),
    text.substring(third, third + 2000),
    text.substring(text.length - 2000),
  ].join("\n\n---\n\n");

  // Use Claude Haiku for voice profile extraction — better literary analysis than Gemini Flash,
  // and fast/cheap enough to run on every book upload without meaningful cost impact.
  const rawJson = await invokeClaudeJson({
    systemPrompt: VOICE_PROFILE_PROMPT + "\n\nReturn ONLY valid JSON matching the schema above. No commentary, no markdown fences.",
    messages: [{ role: "user", content: `Book excerpt:\n\n${sample}` }],
    maxTokens: 2048,
  });

  return parseLLMJson(rawJson, "voice profile") as object;
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

// Safely extract an array from LLM output — NEVER throws, returns [] on any failure
function safeParseArray<T>(raw: string | null | undefined, label: string): T[] {
  const str = String(raw ?? "").trim();
  if (!str || str.startsWith("<!DOCTYPE") || str.startsWith("<html") || str.toLowerCase().includes("service unavailable")) {
    console.warn(`[bookLibrary] ${label}: received empty or HTML response from LLM`);
    return [];
  }
  // Strip markdown code fences
  const cleaned = str.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    // Try to extract a JSON array substring
    const match = cleaned.match(/\[[\s\S]*\]/);
    if (match) {
      try { parsed = JSON.parse(match[0]); } catch { return []; }
    } else {
      console.warn(`[bookLibrary] ${label}: failed to parse JSON, skipping`);
      return [];
    }
  }
  if (Array.isArray(parsed)) return parsed as T[];
  // Unwrap if the model returned an object wrapping the array
  if (parsed && typeof parsed === "object") {
    for (const v of Object.values(parsed as Record<string, unknown>)) {
      if (Array.isArray(v)) return v as T[];
    }
  }
  return [];
}

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
      try {
        const result = await invokeLLM({
          messages: [
            { role: "system", content: STAGE1_EXTRACTION_PROMPT },
            { role: "user", content: `Book: "${bookTitle}" (section ${idx + 1} of ${chunks.length})\n\n${chunk}` },
          ],
        });
        const content = result.choices?.[0]?.message?.content ?? "[]";
        const contentStr = typeof content === "string" ? content : JSON.stringify(content);
        return safeParseArray<RawCandidate>(contentStr, `stage1 chunk ${idx + 1}`);
      } catch (err) {
        console.error(`[bookLibrary] Stage 1 chunk ${idx + 1} error:`, err);
        return [];
      }
    })
  );

  // Collect all raw candidates, deduplicate by first 80 chars
  const allCandidates: RawCandidate[] = [];
  const seen = new Set<string>();
  for (const result of stage1Results) {
    if (result.status === "fulfilled") {
      for (const c of result.value) {
        if (!c?.passageText) continue;
        const key = c.passageText.substring(0, 80).toLowerCase().trim();
        if (!seen.has(key) && c.passageText.length > 30) {
          seen.add(key);
          allCandidates.push(c);
        }
      }
    }
  }

  console.log(`[bookLibrary] Stage 1: ${allCandidates.length} raw candidates extracted from "${bookTitle}"`);

  if (allCandidates.length === 0) {
    console.warn(`[bookLibrary] Stage 1 returned 0 candidates for "${bookTitle}" — check book text quality`);
    return [];
  }

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
      });

      const content = result.choices?.[0]?.message?.content ?? "[]";
      const contentStr = typeof content === "string" ? content : JSON.stringify(content);
      const scored = safeParseArray<ScoredSnippet>(contentStr, `stage2 batch ${Math.floor(i / batchSize) + 1}`);
      // Only keep quotes that scored 7 or higher
      const approved = scored.filter((s) => s?.passageText && (s.qualityScore ?? 0) >= 7);
      approvedSnippets.push(...approved);
    } catch (err) {
      console.error(`[bookLibrary] Stage 2 batch ${Math.floor(i / batchSize) + 1} error:`, err);
      // Don't throw — continue processing other batches
    }
  }

  console.log(`[bookLibrary] Stage 2: ${approvedSnippets.length} snippets approved (score ≥7) from "${bookTitle}"`);
  return approvedSnippets;
}

// ─── Title Card Generation ────────────────────────────────────────────────────

async function generateTitleCardImage(snippet: BookSnippet, bookTitle: string): Promise<string | null> {
  // Use the hybrid compositor: AI background + real CSS text (no AI text rendering = no typos)
  return compositeCard({
    quoteText: snippet.passageText,
    bookTitle,
    snippetId: snippet.id,
    platform: "meta", // default square format
  });
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
              platform: sanitizePlatform(s.platform),
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
              platform: sanitizePlatform(s.platform),
              chapter: s.chapter,
              qualityScore: s.qualityScore ?? null,
              shareabilityType: s.shareabilityType ?? null,
              titleCardStatus: "pending" as const,
              savedToKanban: false,
            }))
          );
          snippetCount = snippets.length;
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error("[bookLibrary] re-extraction failed:", msg, err);
        await db.update(uploadedBooks).set({ status: "failed" }).where(eq(uploadedBooks.id, input.bookId));
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: `Re-extraction failed: ${msg}` });
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
      mood: z.enum(["forest_dark", "stone_gray", "ink_black", "warm_amber"]).optional(),
      fontSize: z.enum(["large", "medium", "small"]).optional(),
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

      await db
        .update(bookSnippets)
        .set({ titleCardStatus: "generating" })
        .where(eq(bookSnippets.id, input.snippetId));
      try {
        // Save mood/fontSize preferences if provided
        if (input.mood || input.fontSize) {
          await db
            .update(bookSnippets)
            .set({
              ...(input.mood ? { cardMood: input.mood } : {}),
              ...(input.fontSize ? { cardFontSize: input.fontSize } : {}),
            })
            .where(eq(bookSnippets.id, input.snippetId));
        }
        // Use hybrid compositor: AI background + real CSS text (zero typos)
        const url = await compositeCard({
          quoteText,
          bookTitle,
          snippetId: input.snippetId,
          platform: input.platform,
          mood: (input.mood ?? snippet.cardMood ?? "forest_dark") as "forest_dark" | "stone_gray" | "ink_black" | "warm_amber",
          fontSize: (input.fontSize ?? snippet.cardFontSize ?? "medium") as "large" | "medium" | "small",
        });
        if (!url) throw new Error("Compositor returned no URL");
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
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: `Card generation failed: ${err}` });
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
      mood: z.enum(["forest_dark", "stone_gray", "ink_black", "warm_amber"]).optional(),
      fontSize: z.enum(["large", "medium", "small"]).optional(),
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
      // Save mood/fontSize preferences if provided
      const moodToUse = (input.mood ?? snippet.cardMood ?? "forest_dark") as "forest_dark" | "stone_gray" | "ink_black" | "warm_amber";
      const fontSizeToUse = (input.fontSize ?? snippet.cardFontSize ?? "medium") as "large" | "medium" | "small";
      await db
        .update(bookSnippets)
        .set({
          titleCardStatus: "generating",
          cardMood: moodToUse,
          cardFontSize: fontSizeToUse,
        })
        .where(eq(bookSnippets.id, input.snippetId));
      // Use the hybrid compositor: generates ONE AI background, then composites
      // real CSS text on top for all 6 platform sizes — zero AI text rendering = zero typos
      const compositeResults = await compositeAllPlatformCards({
        quoteText,
        bookTitle,
        snippetId: input.snippetId,
        mood: moodToUse,
        fontSize: fontSizeToUse,
      });

      // Map compositor platform keys to DB field names
      const fieldMap: Record<string, string> = {
        linkedin:        "titleCardLinkedinUrl",
        x:               "titleCardXUrl",
        meta:            "titleCardMetaUrl",
        instagram_feed:  "titleCardInstagramFeedUrl",
        instagram_reel:  "titleCardInstagramReelUrl",
        instagram_story: "titleCardInstagramStoryUrl",
      };
      const results: Record<string, string | null> = {};
      for (const [platform, url] of Object.entries(compositeResults)) {
        const field = fieldMap[platform];
        if (field) results[field] = url;
      }

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

  // ─── Get AI background for client-side card compositor ───────────────────────
  // Step 1: server generates the background image only (no text in prompt).
  // The browser composites real CSS text on top using TitleCardRenderer.
  getCardBackground: protectedProcedure
    .input(z.object({
      snippetId: z.number(),
      mood: z.enum(["forest_dark", "stone_gray", "ink_black", "warm_amber"]).default("forest_dark"),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      const [snippet] = await db
        .select({ id: bookSnippets.id, bookId: bookSnippets.bookId })
        .from(bookSnippets)
        .where(and(eq(bookSnippets.id, input.snippetId), eq(bookSnippets.userId, ctx.user.id)));
      if (!snippet) throw new TRPCError({ code: "NOT_FOUND", message: "Snippet not found" });

      // Fetch the real book title so the client compositor can display it correctly
      const [book] = await db
        .select({ title: uploadedBooks.title })
        .from(uploadedBooks)
        .where(eq(uploadedBooks.id, snippet.bookId));
      const bookTitle = book?.title ?? "The Urban Monk";

      const MOOD_BG_PROMPTS: Record<string, string> = {
        forest_dark: "Abstract square background texture for a premium wellness brand. Dark forest green and deep charcoal tones, subtle organic texture like aged leather or moss, soft vignette edges, no text, no people, no objects, no symbols. Minimalist and sophisticated.",
        stone_gray:  "Abstract square background texture for a premium mindfulness brand. Cool stone gray and slate tones, subtle concrete or granite texture, soft vignette edges, no text, no people, no objects, no symbols. Minimalist and sophisticated.",
        ink_black:   "Abstract square background texture for a luxury brand. Deep black and near-black tones, subtle paper or linen texture, very dark, soft vignette edges, no text, no people, no objects, no symbols. Minimalist and elegant.",
        warm_amber:  "Abstract square background texture for a warm wellness brand. Rich amber, burnt sienna, and deep ochre tones, subtle aged parchment or warm wood texture, soft vignette edges, no text, no people, no objects, no symbols. Warm and sophisticated.",
      };

      const { generateImage } = await import("./_core/imageGeneration");
      const prompt = MOOD_BG_PROMPTS[input.mood] ?? MOOD_BG_PROMPTS["forest_dark"];
      try {
        const { url } = await generateImage({ prompt });
        return { backgroundUrl: url ?? null, bookTitle };
      } catch (err) {
        console.error("[getCardBackground] generateImage failed:", err);
        return { backgroundUrl: null, bookTitle };
      }
    }),

  // ─── Save card URLs after client-side rendering ──────────────────────────────
  // Step 2: browser uploads rendered PNGs to S3 via /api/upload-card,
  // then calls this to persist the URLs in the DB.
  saveCardUrls: protectedProcedure
    .input(z.object({
      snippetId: z.number(),
      urls: z.object({
        linkedin:        z.string().nullable().optional(),
        x:               z.string().nullable().optional(),
        meta:            z.string().nullable().optional(),
        instagram_feed:  z.string().nullable().optional(),
        instagram_reel:  z.string().nullable().optional(),
        instagram_story: z.string().nullable().optional(),
      }),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      const [snippet] = await db
        .select({ id: bookSnippets.id })
        .from(bookSnippets)
        .where(and(eq(bookSnippets.id, input.snippetId), eq(bookSnippets.userId, ctx.user.id)));
      if (!snippet) throw new TRPCError({ code: "NOT_FOUND", message: "Snippet not found" });

      const { urls } = input;
      const setObj: Record<string, string | null> = {};
      if (urls.linkedin        != null) setObj["titleCardLinkedinUrl"]       = urls.linkedin;
      if (urls.x               != null) setObj["titleCardXUrl"]              = urls.x;
      if (urls.meta            != null) setObj["titleCardMetaUrl"]           = urls.meta;
      if (urls.instagram_feed  != null) setObj["titleCardInstagramFeedUrl"]  = urls.instagram_feed;
      if (urls.instagram_reel  != null) setObj["titleCardInstagramReelUrl"]  = urls.instagram_reel;
      if (urls.instagram_story != null) setObj["titleCardInstagramStoryUrl"] = urls.instagram_story;

      const defaultUrl = urls.linkedin ?? urls.x ?? urls.meta ?? urls.instagram_feed ?? null;
      if (defaultUrl) setObj["titleCardUrl"] = defaultUrl;
      setObj["titleCardStatus"] = "ready";

      if (Object.keys(setObj).length > 0) {
        await db
          .update(bookSnippets)
          .set(setObj as Partial<typeof bookSnippets.$inferInsert>)
          .where(eq(bookSnippets.id, input.snippetId));
      }

      const generated = Object.values(urls).filter(Boolean).length;
      return { success: true, generated };
    }),

  // ─── Update snippet card style preferences (mood + font size) ───────────────
  updateSnippetStyle: protectedProcedure
    .input(z.object({
      snippetId: z.number(),
      mood: z.enum(["forest_dark", "stone_gray", "ink_black", "warm_amber"]).optional(),
      fontSize: z.enum(["large", "medium", "small"]).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      const [snippet] = await db
        .select({ id: bookSnippets.id })
        .from(bookSnippets)
        .where(and(eq(bookSnippets.id, input.snippetId), eq(bookSnippets.userId, ctx.user.id)));
      if (!snippet) throw new TRPCError({ code: "NOT_FOUND", message: "Snippet not found" });
      await db
        .update(bookSnippets)
        .set({
          ...(input.mood     ? { cardMood:     input.mood     } : {}),
          ...(input.fontSize ? { cardFontSize: input.fontSize } : {}),
        })
        .where(eq(bookSnippets.id, input.snippetId));
      return { success: true };
    }),

  // ─── Soft-reject (hide) or un-reject a snippet ──────────────────────────────────
  // Sets softRejected=true to hide from the grid without deleting.
  // Calling again with softRejected=false restores it.
  softRejectSnippet: protectedProcedure
    .input(z.object({
      snippetId: z.number(),
      softRejected: z.boolean(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      const [snippet] = await db
        .select({ id: bookSnippets.id })
        .from(bookSnippets)
        .where(and(eq(bookSnippets.id, input.snippetId), eq(bookSnippets.userId, ctx.user.id)));
      if (!snippet) throw new TRPCError({ code: "NOT_FOUND", message: "Snippet not found" });
      await db
        .update(bookSnippets)
        .set({ softRejected: input.softRejected })
        .where(eq(bookSnippets.id, input.snippetId));
      return { success: true };
    }),
});
