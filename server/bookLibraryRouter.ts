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

// ─── Snippet Extraction ───────────────────────────────────────────────────────

const SNIPPET_EXTRACTION_PROMPT = `You are a social media content strategist for Dr. Pedram Shojai (The Urban Monk).
Extract 20-30 quote-worthy passages from this book excerpt that would make powerful social media posts.

For each passage, identify:
- The exact quote (verbatim from the text, 1-4 sentences max, under 280 characters preferred)
- The theme (one of: energy, mindfulness, gut-health, sleep, consciousness, longevity, stress, nutrition, movement, spirituality, productivity, relationships)
- Best platform (instagram, linkedin, twitter, facebook, or all)
- Approximate page/section context

Return a JSON array of objects with fields: passageText, theme, platform, chapter`;

async function extractSnippets(
  text: string,
  bookTitle: string
): Promise<Array<{ passageText: string; theme: string; platform: string; chapter: string }>> {
  const chunkSize = 8000;
  const chunks: string[] = [];
  for (let i = 0; i < Math.min(text.length, 40000); i += chunkSize) {
    chunks.push(text.substring(i, i + chunkSize));
  }

  const allSnippets: Array<{ passageText: string; theme: string; platform: string; chapter: string }> = [];

  for (const chunk of chunks.slice(0, 4)) {
    try {
      const result = await invokeLLM({
        messages: [
          { role: "system", content: SNIPPET_EXTRACTION_PROMPT },
          {
            role: "user",
            content: `Book: "${bookTitle}"\n\nExcerpt:\n\n${chunk}`,
          },
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "snippets",
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
                },
                required: ["passageText", "theme", "platform", "chapter"],
              },
            },
          },
        },
      });

      const content = result.choices?.[0]?.message?.content ?? "[]";
      const contentStr = typeof content === "string" ? content : JSON.stringify(content);
      const snippets = parseLLMJson(contentStr, "snippets");
      if (Array.isArray(snippets)) {
        allSnippets.push(...(snippets as Array<{ passageText: string; theme: string; platform: string; chapter: string }>));
      }
    } catch (err) {
      console.error("[bookLibrary] snippet extraction chunk error:", err);
    }
  }

  const seen = new Set<string>();
  return allSnippets.filter((s) => {
    const key = s.passageText.substring(0, 60);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
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
});
