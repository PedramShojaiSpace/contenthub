/**
 * Deep Dive Router — Paid Tier Weekly Content Generator
 *
 * Mines Pedram's uploaded books to produce weekly premium deep dive posts
 * delivered exclusively to paid Substack subscribers.
 *
 * Each deep dive has three sections:
 *   1. The Practice — a specific, actionable technique from the books
 *   2. The Insight — the science/philosophy behind it
 *   3. The Protocol — step-by-step implementation guide
 */

import { z } from "zod";
import { protectedProcedure, router } from "./_core/trpc";
import { getDb } from "./db";
import { uploadedBooks, weeklyDeepDives } from "../drizzle/schema";
import { invokeLLM } from "./_core/llm";
import { publishToSubstack } from "./substackPublisher";
import { eq, desc, sql } from "drizzle-orm";
import { notifyOwner } from "./_core/notification";

// ─── Book theme catalog ────────────────────────────────────────────────────────
// Rotates through these themes week over week
const DEEP_DIVE_THEMES = [
  "Morning Rituals & Energy Architecture",
  "Breath as Medicine",
  "Sleep Optimization & Recovery",
  "Gut-Brain Axis & Microbiome Health",
  "Stress Alchemy — Turning Pressure into Power",
  "Fasting & Metabolic Flexibility",
  "Cold & Heat Therapy Protocols",
  "Emotional Regulation & Nervous System Mastery",
  "Movement as Medicine",
  "Digital Detox & Attention Restoration",
  "Circadian Biology & Light Hygiene",
  "Longevity Practices from Ancient Traditions",
  "The Urban Monk's Approach to Nutrition",
  "Mindfulness in the Modern World",
  "Hormonal Balance & Vitality",
  "Community, Purpose & Meaning",
];

// ─── Helper: pick next theme based on existing deep dives count ────────────────
async function pickNextTheme(): Promise<string> {
  const db = await getDb();
  if (!db) return DEEP_DIVE_THEMES[0];
  const [countRow] = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(weeklyDeepDives);
  const count = Number(countRow?.count ?? 0);
  return DEEP_DIVE_THEMES[count % DEEP_DIVE_THEMES.length];
}

// ─── Helper: sample book content for the theme ────────────────────────────────
async function sampleBookContent(theme: string): Promise<{
  bookIds: number[];
  bookTitles: string[];
  excerpts: string;
}> {
  const db = await getDb();
  if (!db) return { bookIds: [], bookTitles: [], excerpts: "" };
  const books = await db
    .select({
      id: uploadedBooks.id,
      title: uploadedBooks.title,
      extractedText: uploadedBooks.extractedText,
    })
    .from(uploadedBooks)
    .where(eq(uploadedBooks.status, "ready"));

  if (books.length === 0) {
    return { bookIds: [], bookTitles: [], excerpts: "" };
  }

  // Build keyword list from theme for relevance scoring
  const themeKeywords = theme.toLowerCase().split(/\s+|&|-|,/).filter(w => w.length > 3);

  // Score each book by keyword hits in extractedText
  const scored = books.map(book => {
    const text = (book.extractedText ?? "").toLowerCase();
    const score = themeKeywords.reduce((acc, kw) => {
      const matches = (text.match(new RegExp(kw, "g")) ?? []).length;
      return acc + matches;
    }, 0);
    return { ...book, score };
  });

  // Sort by relevance, take top 2
  scored.sort((a, b) => b.score - a.score);
  const topBooks = scored.slice(0, 2);

  // Extract ~2000 chars of relevant content from each book
  const excerpts = topBooks.map(book => {
    const text = book.extractedText ?? "";
    // Find the most relevant passage by searching for theme keywords
    let bestStart = 0;
    let bestScore = 0;
    const windowSize = 2000;
    for (let i = 0; i < text.length - windowSize; i += 500) {
      const window = text.slice(i, i + windowSize).toLowerCase();
      const score = themeKeywords.reduce((acc, kw) => {
        return acc + (window.includes(kw) ? 1 : 0);
      }, 0);
      if (score > bestScore) {
        bestScore = score;
        bestStart = i;
      }
    }
    const excerpt = text.slice(bestStart, bestStart + windowSize);
    return `[From "${book.title}"]\n${excerpt}`;
  }).join("\n\n---\n\n");

  return {
    bookIds: topBooks.map(b => b.id),
    bookTitles: topBooks.map(b => b.title ?? "Unknown"),
    excerpts,
  };
}

// ─── Helper: generate deep dive content via LLM ───────────────────────────────
async function generateDeepDiveContent(
  theme: string,
  bookTitles: string[],
  excerpts: string
): Promise<{
  title: string;
  teaser: string;
  practiceBody: string;
  insightBody: string;
  protocolBody: string;
  fullContent: string;
}> {
  const systemPrompt = `You are Dr. Pedram Shojai, OMD — the Urban Monk. You write weekly premium deep dives for your paid subscribers. Your voice is warm, direct, and grounded in both ancient wisdom and modern science. You write like a trusted teacher who has walked the path himself.

Your deep dives have three sections:
1. **The Practice** — A specific, actionable technique your reader can start TODAY. Vivid, concrete, no fluff.
2. **The Insight** — The science and philosophy behind the practice. Reference your books where relevant. Connect ancient wisdom to modern research.
3. **The Protocol** — A clear step-by-step implementation guide. Numbered steps. Specific timing, duration, frequency.

Write in first person. Use "you" to address the reader directly. Keep each section 250-400 words. No filler. Every sentence earns its place.`;

  const userPrompt = `This week's deep dive theme: **${theme}**

Here are relevant passages from your books to draw from:

${excerpts || "Draw from your general knowledge of Urban Monk principles, Taoist medicine, and modern health optimization."}

Write a complete deep dive with:
- A compelling title (not generic — make it specific and intriguing)
- A 1-2 sentence teaser/subtitle
- The Practice section (markdown, use ## The Practice as heading)
- The Insight section (markdown, use ## The Insight as heading)  
- The Protocol section (markdown, use ## The Protocol as heading)

End with a brief closing paragraph that connects back to the Urban Monk Academy and the reader's journey.

Format your response as JSON with these exact keys:
{
  "title": "...",
  "teaser": "...",
  "practiceBody": "...(markdown)...",
  "insightBody": "...(markdown)...",
  "protocolBody": "...(markdown)...",
  "fullContent": "...(all sections combined as markdown)..."
}`;

  const response = await invokeLLM({
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "deep_dive_content",
        strict: true,
        schema: {
          type: "object",
          properties: {
            title: { type: "string" },
            teaser: { type: "string" },
            practiceBody: { type: "string" },
            insightBody: { type: "string" },
            protocolBody: { type: "string" },
            fullContent: { type: "string" },
          },
          required: ["title", "teaser", "practiceBody", "insightBody", "protocolBody", "fullContent"],
          additionalProperties: false,
        },
      },
    },
  });

  const raw = response.choices?.[0]?.message?.content ?? "{}";
  const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
  return parsed as {
    title: string;
    teaser: string;
    practiceBody: string;
    insightBody: string;
    protocolBody: string;
    fullContent: string;
  };
}

// ─── Helper: convert markdown to simple HTML for Substack ─────────────────────
function markdownToHtml(md: string): string {
  return md
    .replace(/^## (.+)$/gm, "<h2>$1</h2>")
    .replace(/^### (.+)$/gm, "<h3>$1</h3>")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/^\d+\. (.+)$/gm, "<li>$1</li>")
    .replace(/^- (.+)$/gm, "<li>$1</li>")
    .replace(/(<li>.*<\/li>\n?)+/g, (match) => `<ol>${match}</ol>`)
    .replace(/\n\n/g, "</p><p>")
    .replace(/^(?!<[hol])(.+)$/gm, "$1")
    .replace(/^<\/p><p>(<[hol])/gm, "$1")
    .trim();
}

// ─── Router ────────────────────────────────────────────────────────────────────
export const deepDiveRouter = router({
  /** Generate a new deep dive from book corpus */
  generate: protectedProcedure
    .input(
      z.object({
        theme: z.string().optional(), // if omitted, auto-picks next theme
        sourceBookIds: z.array(z.number()).optional(), // if omitted, auto-selects
      })
    )
    .mutation(async ({ input }) => {
      const theme = input.theme ?? (await pickNextTheme());
      const { bookIds, bookTitles, excerpts } = await sampleBookContent(theme);

      const content = await generateDeepDiveContent(theme, bookTitles, excerpts);

      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      await db
        .insert(weeklyDeepDives)
        .values({
          theme,
          bookSources: bookTitles.join(", "),
          sourceBookIds: JSON.stringify(input.sourceBookIds ?? bookIds),
          title: content.title,
          teaser: content.teaser,
          practiceBody: content.practiceBody,
          insightBody: content.insightBody,
          protocolBody: content.protocolBody,
          fullContent: content.fullContent,
          status: "draft",
          paidOnly: true,
        });

      const [newDive] = await db
        .select()
        .from(weeklyDeepDives)
        .orderBy(desc(weeklyDeepDives.id))
        .limit(1);

      return newDive;
    }),

  /** List all deep dives */
  list: protectedProcedure
    .input(z.object({ limit: z.number().default(20), offset: z.number().default(0) }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      const dives = await db
        .select()
        .from(weeklyDeepDives)
        .orderBy(desc(weeklyDeepDives.id))
        .limit(input.limit)
        .offset(input.offset);
      return dives;
    }),

  /** Get a single deep dive */
  get: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      const [dive] = await db
        .select()
        .from(weeklyDeepDives)
        .where(eq(weeklyDeepDives.id, input.id));
      if (!dive) throw new Error("Deep dive not found");
      return dive;
    }),

  /** Update a deep dive (edit before publishing) */
  update: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        title: z.string().optional(),
        teaser: z.string().optional(),
        practiceBody: z.string().optional(),
        insightBody: z.string().optional(),
        protocolBody: z.string().optional(),
        fullContent: z.string().optional(),
        notes: z.string().optional(),
        status: z.enum(["draft", "ready", "published", "archived"]).optional(),
        scheduledAt: z.number().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const { id, ...updates } = input;
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      await db
        .update(weeklyDeepDives)
        .set({ ...updates, updatedAt: new Date() })
        .where(eq(weeklyDeepDives.id, id));
      const [updated] = await db
        .select()
        .from(weeklyDeepDives)
        .where(eq(weeklyDeepDives.id, id));
      return updated;
    }),

  /** Delete a deep dive */
  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      await db.delete(weeklyDeepDives).where(eq(weeklyDeepDives.id, input.id));
      return { success: true };
    }),

  /** Publish a deep dive to Substack as a paid-only post */
  publish: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        sendEmail: z.boolean().default(true),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      const [dive] = await db
        .select()
        .from(weeklyDeepDives)
        .where(eq(weeklyDeepDives.id, input.id));

      if (!dive) throw new Error("Deep dive not found");
      if (dive.status === "published") throw new Error("Already published");

      // Build HTML for Substack
      const bodyHtml = `
<p><em>${dive.teaser ?? ""}</em></p>
<hr/>
${markdownToHtml(dive.practiceBody ?? "")}
<hr/>
${markdownToHtml(dive.insightBody ?? "")}
<hr/>
${markdownToHtml(dive.protocolBody ?? "")}
<hr/>
<p><em>This deep dive is part of your Urban Monk Academy paid membership. Thank you for being on this journey with me. — Pedram</em></p>
      `.trim();

      const result = await publishToSubstack({
        title: dive.title,
        subtitle: dive.teaser ?? undefined,
        bodyHtml,
        sendEmail: input.sendEmail,
        audience: dive.paidOnly ? "founding_member" : "everyone",
      });

      const db2 = await getDb();
      if (!db2) throw new Error("Database unavailable");
      await db2
        .update(weeklyDeepDives)
        .set({
          status: "published",
          publishedAt: Date.now(),
          substackPostId: result.postId,
          substackPostUrl: result.postUrl,
          updatedAt: new Date(),
        })
        .where(eq(weeklyDeepDives.id, input.id));

      await notifyOwner({
        title: "✅ Paid Deep Dive Published",
        content: `"${dive.title}" has been published to Substack paid subscribers.\n${result.postUrl}`,
      });

      return { postId: result.postId, postUrl: result.postUrl };
    }),

  /** Get available themes */
  getThemes: protectedProcedure.query(async () => {
    return DEEP_DIVE_THEMES;
  }),

  /** Get available books for selection */
  getBooks: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];
    return db
      .select({
        id: uploadedBooks.id,
        title: uploadedBooks.title,
        author: uploadedBooks.author,
        wordCount: uploadedBooks.wordCount,
        status: uploadedBooks.status,
      })
      .from(uploadedBooks)
      .where(eq(uploadedBooks.status, "ready"));
  }),
});
