import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { eq, desc, and } from "drizzle-orm";
import { getDb } from "./db";
import {
  ebooks,
  ebookChapters,
  uploadedBooks,
  ctaBlocks,
  landingPages,
  webinarSessions,
} from "../drizzle/schema";
import { protectedProcedure, router } from "./_core/trpc";
import { invokeLLM } from "./_core/llm";
import { generateImage } from "./_core/imageGeneration";
import { parseLLMJson } from "./llmUtils";

// ─── Voice Profile Helper ─────────────────────────────────────────────────────

async function getMasterVoiceProfile(userId: number): Promise<object | null> {
  const db = await getDb();
  if (!db) return null;

  const books = await db
    .select({ voiceProfileJson: uploadedBooks.voiceProfileJson })
    .from(uploadedBooks)
    .where(and(eq(uploadedBooks.userId, userId), eq(uploadedBooks.status, "ready")));

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
}

function buildVoiceSystemPrompt(voiceProfile: object | null): string {
  if (!voiceProfile) {
    return `You are writing as Dr. Pedram Shojai (The Urban Monk), a doctor of Oriental Medicine, filmmaker, and wellness teacher. 
Write in a direct, warm, authoritative yet accessible tone. Use a blend of scientific grounding and spiritual wisdom. 
Keep sentences varied — mix short punchy sentences with longer explanatory ones. Use "we" and "you" to create connection.
Draw on themes of energy, consciousness, mindfulness, longevity, and practical wellness.`;
  }

  const p = voiceProfile as Record<string, unknown>;
  return `You are writing as Dr. Pedram Shojai (The Urban Monk), a doctor of Oriental Medicine, filmmaker, and wellness teacher.

VOICE PROFILE (extracted from his published books):
- Tone: ${Array.isArray(p.tone) ? (p.tone as string[]).join(", ") : String(p.tone ?? "")}
- Sentence style: ${String(p.sentenceStyle ?? "")}
- Paragraph rhythm: ${String(p.paragraphRhythm ?? "")}
- Metaphor style: ${String(p.metaphorStyle ?? "")}
- Call to action style: ${String(p.callToActionStyle ?? "")}

DISTINCTIVE VOCABULARY (use these naturally throughout):
${Array.isArray(p.vocabulary) ? (p.vocabulary as string[]).slice(0, 30).join(", ") : ""}

RECURRING THEMES:
${Array.isArray(p.themes) ? (p.themes as string[]).join(", ") : ""}

AUTHORITY MARKERS (weave in naturally):
${Array.isArray(p.authorityMarkers) ? (p.authorityMarkers as string[]).slice(0, 6).join(" | ") : ""}

OPENING PATTERNS (use these styles for chapter openings):
${Array.isArray(p.openingPatterns) ? (p.openingPatterns as string[]).slice(0, 4).join("\n") : ""}

Write EXACTLY in this voice. Do not break character. Do not add disclaimers or meta-commentary.`;
}

// ─── Chapter Generation ───────────────────────────────────────────────────────

async function generateChapterOutline(
  topic: string,
  targetAudience: string,
  chapterCount: number,
  voiceSystemPrompt: string
): Promise<Array<{ number: number; title: string; summary: string }>> {
  const result = await invokeLLM({
    messages: [
      { role: "system", content: voiceSystemPrompt },
      {
        role: "user",
        content: `Create a detailed chapter outline for an e-book on: "${topic}"

Target audience: ${targetAudience}
Number of chapters: ${chapterCount}
Author: Dr. Pedram Shojai (The Urban Monk)

Return a JSON array with ${chapterCount} chapters, each with:
- number (1-${chapterCount})
- title (compelling, specific chapter title)
- summary (2-3 sentences describing what this chapter covers and its key takeaway)

The e-book should have a clear narrative arc: problem → understanding → transformation → action.
Make it practical, transformative, and grounded in both science and wisdom.`,
      },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "chapter_outline",
        strict: false,
        schema: {
          type: "array",
          items: {
            type: "object",
            properties: {
              number: { type: "integer" },
              title: { type: "string" },
              summary: { type: "string" },
            },
            required: ["number", "title", "summary"],
          },
        },
      },
    },
  });

  const content = result.choices?.[0]?.message?.content ?? "[]";
  const contentStr = typeof content === "string" ? content : JSON.stringify(content);
  const outline = parseLLMJson(contentStr, "chapter outline");
  if (!Array.isArray(outline)) {
    throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to generate chapter outline" });
  }
  return outline as Array<{ number: number; title: string; summary: string }>;
}

async function generateChapterContent(
  chapterNumber: number,
  chapterTitle: string,
  chapterSummary: string,
  topic: string,
  targetAudience: string,
  voiceSystemPrompt: string,
  ctaText?: string | null
): Promise<string> {
  const ctaInstruction = ctaText
    ? `\n\nEnd this chapter with a natural, compelling call-to-action that flows organically from the content: "${ctaText}"`
    : "";

  const result = await invokeLLM({
    messages: [
      { role: "system", content: voiceSystemPrompt },
      {
        role: "user",
        content: `Write Chapter ${chapterNumber}: "${chapterTitle}"

E-book topic: ${topic}
Target audience: ${targetAudience}
Chapter summary: ${chapterSummary}

Requirements:
- Write 600-900 words of substantive, valuable content
- Open with a hook that draws the reader in immediately
- Include at least one concrete story, example, or case study
- Provide 2-3 actionable insights or practices
- Use subheadings to break up the content (use ## for subheadings)
- End with a transition to the next chapter's theme (or a powerful closing if this is the last chapter)
- Write in Markdown format${ctaInstruction}

Write the full chapter content now:`,
      },
    ],
    maxTokens: 2000,
  });

  const content = result.choices?.[0]?.message?.content ?? "";
  return typeof content === "string" ? content : JSON.stringify(content);
}

// ─── Router ───────────────────────────────────────────────────────────────────

export const ebookRouter = router({
  listEbooks: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return [];
    return db
      .select()
      .from(ebooks)
      .where(eq(ebooks.userId, ctx.user.id))
      .orderBy(desc(ebooks.createdAt));
  }),

  getEbook: protectedProcedure
    .input(z.object({ ebookId: z.number() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      const [ebook] = await db
        .select()
        .from(ebooks)
        .where(and(eq(ebooks.id, input.ebookId), eq(ebooks.userId, ctx.user.id)));
      if (!ebook) throw new TRPCError({ code: "NOT_FOUND", message: "E-book not found" });

      const chapters = await db
        .select()
        .from(ebookChapters)
        .where(eq(ebookChapters.ebookId, input.ebookId))
        .orderBy(ebookChapters.chapterNumber);

      return { ebook, chapters };
    }),

  generateEbook: protectedProcedure
    .input(
      z.object({
        title: z.string().min(1),
        topic: z.string().min(1),
        targetAudience: z.string().default("health-conscious adults seeking transformation"),
        chapterCount: z.number().min(3).max(12).default(7),
        ctaBlockId: z.number().optional(),
        landingPageId: z.number().optional(),
        webinarSessionId: z.number().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      const [ebookRecord] = await db
        .insert(ebooks)
        .values({
          userId: ctx.user.id,
          title: input.title,
          topic: input.topic,
          targetPersona: input.targetAudience,
          chapterCount: input.chapterCount,
          ctaBlockId: input.ctaBlockId,
          landingPageId: input.landingPageId,
          webinarSessionId: input.webinarSessionId,
          status: "drafting",
        })
        .$returningId();

      const ebookId = ebookRecord.id;

      try {
        const voiceProfile = await getMasterVoiceProfile(ctx.user.id);
        const voiceSystemPrompt = buildVoiceSystemPrompt(voiceProfile);

        let ctaText: string | null = null;
        if (input.ctaBlockId) {
          const [cta] = await db
            .select({ ctaText: ctaBlocks.ctaText, url: ctaBlocks.url })
            .from(ctaBlocks)
            .where(eq(ctaBlocks.id, input.ctaBlockId));
          if (cta) ctaText = `${cta.ctaText}${cta.url ? " → " + cta.url : ""}`;
        } else if (input.landingPageId) {
          const [lp] = await db
            .select({ title: landingPages.title })
            .from(landingPages)
            .where(eq(landingPages.id, input.landingPageId));
          if (lp) ctaText = `Learn more and take the next step at The Urban Monk Academy`;
        } else if (input.webinarSessionId) {
          const [webinar] = await db
            .select({ topic: webinarSessions.topic })
            .from(webinarSessions)
            .where(eq(webinarSessions.id, input.webinarSessionId));
          if (webinar) ctaText = `Join our free training: ${webinar.topic}`;
        }

        const outline = await generateChapterOutline(
          input.topic,
          input.targetAudience,
          input.chapterCount,
          voiceSystemPrompt
        );

        await db
          .update(ebooks)
          .set({ outlineJson: JSON.stringify(outline) })
          .where(eq(ebooks.id, ebookId));

        let totalWordCount = 0;
        for (const chapter of outline) {
          const isLastChapter = chapter.number === outline.length;
          const content = await generateChapterContent(
            chapter.number,
            chapter.title,
            chapter.summary,
            input.topic,
            input.targetAudience,
            voiceSystemPrompt,
            isLastChapter ? ctaText : null
          );

          const wordCount = content.split(/\s+/).length;
          totalWordCount += wordCount;

          await db.insert(ebookChapters).values({
            ebookId,
            chapterNumber: chapter.number,
            title: chapter.title,
            summary: chapter.summary,
            content,
            wordCount,
            status: "complete",
          });
        }

        const allChapters = await db
          .select()
          .from(ebookChapters)
          .where(eq(ebookChapters.ebookId, ebookId))
          .orderBy(ebookChapters.chapterNumber);

        const fullContent = allChapters
          .map((c) => `# Chapter ${c.chapterNumber}: ${c.title}\n\n${c.content ?? ""}`)
          .join("\n\n---\n\n");

        await db
          .update(ebooks)
          .set({ status: "complete", fullContent, wordCountTarget: totalWordCount })
          .where(eq(ebooks.id, ebookId));

        return { ebookId, wordCount: totalWordCount, chapterCount: outline.length };
      } catch (err) {
        await db
          .update(ebooks)
          .set({ status: "failed", errorMessage: err instanceof Error ? err.message : String(err) })
          .where(eq(ebooks.id, ebookId));
        throw err;
      }
    }),

  updateChapter: protectedProcedure
    .input(
      z.object({
        chapterId: z.number(),
        content: z.string(),
        title: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      const [chapter] = await db
        .select({ ebookId: ebookChapters.ebookId })
        .from(ebookChapters)
        .where(eq(ebookChapters.id, input.chapterId));
      if (!chapter) throw new TRPCError({ code: "NOT_FOUND", message: "Chapter not found" });

      const [ebook] = await db
        .select({ userId: ebooks.userId })
        .from(ebooks)
        .where(eq(ebooks.id, chapter.ebookId));
      if (ebook?.userId !== ctx.user.id) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Access denied" });
      }

      const wordCount = input.content.split(/\s+/).length;
      await db
        .update(ebookChapters)
        .set({
          content: input.content,
          wordCount,
          ...(input.title ? { title: input.title } : {}),
        })
        .where(eq(ebookChapters.id, input.chapterId));

      return { success: true };
    }),

  regenerateChapter: protectedProcedure
    .input(
      z.object({
        chapterId: z.number(),
        instructions: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      const [chapter] = await db
        .select()
        .from(ebookChapters)
        .where(eq(ebookChapters.id, input.chapterId));
      if (!chapter) throw new TRPCError({ code: "NOT_FOUND", message: "Chapter not found" });

      const [ebook] = await db
        .select()
        .from(ebooks)
        .where(eq(ebooks.id, chapter.ebookId));
      if (ebook?.userId !== ctx.user.id) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Access denied" });
      }

      const voiceProfile = await getMasterVoiceProfile(ctx.user.id);
      const voiceSystemPrompt = buildVoiceSystemPrompt(voiceProfile);

      const result = await invokeLLM({
        messages: [
          { role: "system", content: voiceSystemPrompt },
          {
            role: "user",
            content: `Rewrite Chapter ${chapter.chapterNumber}: "${chapter.title}"

E-book topic: ${ebook.topic}
Target audience: ${ebook.targetPersona ?? "health-conscious adults"}
${input.instructions ? `Special instructions: ${input.instructions}` : ""}

Write 600-900 words in Markdown format. Include subheadings, a hook opening, concrete examples, and actionable insights.`,
          },
        ],
        maxTokens: 2000,
      });

      const rawContent = result.choices?.[0]?.message?.content ?? chapter.content ?? "";
      const content = typeof rawContent === "string" ? rawContent : JSON.stringify(rawContent);
      const wordCount = content.split(/\s+/).length;

      await db
        .update(ebookChapters)
        .set({ content, wordCount })
        .where(eq(ebookChapters.id, input.chapterId));

      return { content, wordCount };
    }),

  generateCoverImage: protectedProcedure
    .input(z.object({ ebookId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      const [ebook] = await db
        .select()
        .from(ebooks)
        .where(and(eq(ebooks.id, input.ebookId), eq(ebooks.userId, ctx.user.id)));
      if (!ebook) throw new TRPCError({ code: "NOT_FOUND", message: "E-book not found" });

      const prompt = `Professional e-book cover for "${ebook.title}" by Dr. Pedram Shojai (The Urban Monk).
Style: Dark, earthy, sophisticated. Deep forest green or charcoal background with golden/amber accents.
Abstract imagery suggesting ${ebook.topic} — no human faces or AI-generated people.
Elegant serif typography space at top for title. Minimalist, premium wellness brand aesthetic.
Vertical format (2:3 ratio). Clean, modern, high-end.`;

      const { url } = await generateImage({ prompt });

      await db
        .update(ebooks)
        .set({ pdfS3Url: url })
        .where(eq(ebooks.id, input.ebookId));

      return { coverImageUrl: url };
    }),

  exportEbook: protectedProcedure
    .input(z.object({ ebookId: z.number() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      const [ebook] = await db
        .select()
        .from(ebooks)
        .where(and(eq(ebooks.id, input.ebookId), eq(ebooks.userId, ctx.user.id)));
      if (!ebook) throw new TRPCError({ code: "NOT_FOUND", message: "E-book not found" });

      const chapters = await db
        .select()
        .from(ebookChapters)
        .where(eq(ebookChapters.ebookId, input.ebookId))
        .orderBy(ebookChapters.chapterNumber);

      const lines: string[] = [
        `# ${ebook.title}`,
        ``,
        `*By Dr. Pedram Shojai, OMD*`,
        `*The Urban Monk*`,
        ``,
        `---`,
        ``,
        `## Table of Contents`,
        ``,
        ...chapters.map((c) => `${c.chapterNumber}. ${c.title}`),
        ``,
        `---`,
        ``,
      ];

      for (const chapter of chapters) {
        lines.push(`# Chapter ${chapter.chapterNumber}: ${chapter.title}`);
        lines.push(``);
        lines.push(chapter.content ?? "");
        lines.push(``);
        lines.push(`---`);
        lines.push(``);
      }

      if (ebook.ctaBlockId || ebook.landingPageId || ebook.webinarSessionId) {
        lines.push(`## Take the Next Step`);
        lines.push(``);
        lines.push(
          `This e-book is just the beginning. If you're ready to go deeper and transform your life with the guidance of Dr. Pedram Shojai, visit [The Urban Monk Academy](https://theurbanmonk.com) to continue your journey.`
        );
        lines.push(``);
      }

      const markdown = lines.join("\n");
      const wordCount = markdown.split(/\s+/).length;

      return { title: ebook.title, markdown, wordCount, chapterCount: chapters.length };
    }),

  deleteEbook: protectedProcedure
    .input(z.object({ ebookId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      await db.delete(ebookChapters).where(eq(ebookChapters.ebookId, input.ebookId));
      await db
        .delete(ebooks)
        .where(and(eq(ebooks.id, input.ebookId), eq(ebooks.userId, ctx.user.id)));
      return { success: true };
    }),

  getLinkableItems: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return { ctas: [], landingPages: [], webinars: [] };

    const [ctaList, lpList, webinarList] = await Promise.all([
      db.select({ id: ctaBlocks.id, text: ctaBlocks.ctaText, url: ctaBlocks.url }).from(ctaBlocks).limit(50),
      db.select({ id: landingPages.id, title: landingPages.title }).from(landingPages).limit(50),
      db.select({ id: webinarSessions.id, title: webinarSessions.topic }).from(webinarSessions).limit(50),
    ]);

    return { ctas: ctaList, landingPages: lpList, webinars: webinarList };
  }),
});
