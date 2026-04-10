import { z } from "zod";
import { eq, and, desc, sql } from "drizzle-orm";
import { getDb } from "./db";
import { llmProjects, llmAssets } from "../drizzle/schema";
import { protectedProcedure, router } from "./_core/trpc";
import { invokeLLM } from "./_core/llm";

// ─── Asset type labels for prompts ──────────────────────────────────────────
const ASSET_TYPE_LABELS: Record<string, string> = {
  faq: "FAQ Article (long-form answer to a specific question, optimized for LLM citation and featured snippets)",
  youtube: "YouTube Video (educational video with a hook, 3-5 key points, and a CTA to the Lights On Course)",
  blog: "Blog Post (SEO-optimized long-form article with named framework, TL;DR, and FAQ section)",
  social: "Social Media Thread (X/LinkedIn thread that answers a burning question and drives to the webinar)",
  email: "Email (nurture email that addresses a pain point and bridges to the Lights On Course at $369/yr)",
};

export const llmProjectsRouter = router({
  // ── Projects CRUD ──────────────────────────────────────────────────────────
  listProjects: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];
    const projects = await db.select().from(llmProjects).orderBy(desc(llmProjects.createdAt));
    // Attach asset counts per project
    const withCounts = await Promise.all(
      projects.map(async (p: typeof llmProjects.$inferSelect) => {
        const db2 = await getDb();
        if (!db2) return { ...p, totalAssets: 0, producedAssets: 0 };
        const counts = await db2
          .select({
            status: llmAssets.status,
            count: sql<number>`count(*)`,
          })
          .from(llmAssets)
          .where(eq(llmAssets.projectId, p.id))
          .groupBy(llmAssets.status);
        const total = counts.reduce((s: number, r: { status: string | null; count: number }) => s + Number(r.count), 0);
        const produced = counts
          .filter((r: { status: string | null; count: number }) => r.status === "produced" || r.status === "published")
          .reduce((s: number, r: { status: string | null; count: number }) => s + Number(r.count), 0);
        return { ...p, totalAssets: total, producedAssets: produced };
      })
    );
    return withCounts;
  }),

  createProject: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1),
        description: z.string().optional(),
        topicCluster: z.string().optional(),
        targetKeywords: z.array(z.string()).optional(),
        weeklyTarget: z.number().int().min(1).max(20).default(3),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error('Database unavailable');
      const [project] = await db
        .insert(llmProjects)
        .values({
          name: input.name,
          description: input.description,
          topicCluster: input.topicCluster,
          targetKeywords: input.targetKeywords ? JSON.stringify(input.targetKeywords) : null,
          weeklyTarget: input.weeklyTarget,
          status: "active",
        })
        .$returningId();
      return { id: project.id };
    }),

  updateProject: protectedProcedure
    .input(
      z.object({
        id: z.number().int(),
        name: z.string().min(1).optional(),
        description: z.string().optional(),
        topicCluster: z.string().optional(),
        targetKeywords: z.array(z.string()).optional(),
        weeklyTarget: z.number().int().min(1).max(20).optional(),
        status: z.enum(["active", "archived"]).optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error('Database unavailable');
      const { id, targetKeywords, ...rest } = input;
      await db
        .update(llmProjects)
        .set({
          ...rest,
          ...(targetKeywords !== undefined
            ? { targetKeywords: JSON.stringify(targetKeywords) }
            : {}),
        })
        .where(eq(llmProjects.id, id));
      return { success: true };
    }),

  deleteProject: protectedProcedure
    .input(z.object({ id: z.number().int() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error('Database unavailable');
      await db.delete(llmAssets).where(eq(llmAssets.projectId, input.id));
      await db.delete(llmProjects).where(eq(llmProjects.id, input.id));
      return { success: true };
    }),

  // ── Assets CRUD ────────────────────────────────────────────────────────────
  listAssets: protectedProcedure
    .input(
      z.object({
        projectId: z.number().int(),
        status: z.enum(["queued", "in_progress", "produced", "published", "all"]).default("all"),
        assetType: z.enum(["faq", "youtube", "blog", "social", "email", "all"]).default("all"),
      })
    )
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      const conditions = [eq(llmAssets.projectId, input.projectId)];
      if (input.status !== "all") conditions.push(eq(llmAssets.status, input.status));
      if (input.assetType !== "all") conditions.push(eq(llmAssets.assetType, input.assetType));
      return db
        .select()
        .from(llmAssets)
        .where(and(...conditions))
        .orderBy(
          // High priority first, then by type, then by created date
          sql`FIELD(${llmAssets.priority}, 'high', 'medium', 'low')`,
          sql`FIELD(${llmAssets.assetType}, 'faq', 'youtube', 'blog', 'social', 'email')`,
          llmAssets.createdAt
        );
    }),

  addAsset: protectedProcedure
    .input(
      z.object({
        projectId: z.number().int(),
        assetType: z.enum(["faq", "youtube", "blog", "social", "email"]),
        title: z.string().min(1),
        question: z.string().optional(),
        targetKeyword: z.string().optional(),
        semanticKeywords: z.array(z.string()).optional(),
        priority: z.enum(["high", "medium", "low"]).default("medium"),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error('Database unavailable');
      const { semanticKeywords, ...rest } = input;
      const [asset] = await db
        .insert(llmAssets)
        .values({
          ...rest,
          semanticKeywords: semanticKeywords ? JSON.stringify(semanticKeywords) : null,
          status: "queued",
        })
        .$returningId();
      return { id: asset.id };
    }),

  updateAssetStatus: protectedProcedure
    .input(
      z.object({
        id: z.number().int(),
        status: z.enum(["queued", "in_progress", "produced", "published"]),
        contentItemId: z.number().int().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error('Database unavailable');
      await db
        .update(llmAssets)
        .set({
          status: input.status,
          ...(input.contentItemId ? { contentItemId: input.contentItemId } : {}),
          ...(input.status === "produced" ? { producedAt: new Date() } : {}),
          ...(input.status === "published" ? { publishedAt: new Date() } : {}),
        })
        .where(eq(llmAssets.id, input.id));
      return { success: true };
    }),

  deleteAsset: protectedProcedure
    .input(z.object({ id: z.number().int() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error('Database unavailable');
      await db.delete(llmAssets).where(eq(llmAssets.id, input.id));
      return { success: true };
    }),

  // ── Weekly cadence stats ───────────────────────────────────────────────────
  getWeeklyCadence: protectedProcedure
    .input(z.object({ projectId: z.number().int() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return null;
      const project = await db
        .select()
        .from(llmProjects)
        .where(eq(llmProjects.id, input.projectId))
        .limit(1);
      if (!project[0]) return null;

      const weekStart = new Date();
      weekStart.setDate(weekStart.getDate() - weekStart.getDay()); // Sunday
      weekStart.setHours(0, 0, 0, 0);

      const db2 = await getDb();
      if (!db2) return null;
      const thisWeek = await db2
        .select({ count: sql<number>`count(*)` })
        .from(llmAssets)
        .where(
          and(
            eq(llmAssets.projectId, input.projectId),
            sql`(${llmAssets.status} = 'produced' OR ${llmAssets.status} = 'published')`,
            sql`${llmAssets.producedAt} >= ${weekStart.toISOString()}`
          )
        );

      const db3 = await getDb();
      if (!db3) return null;
      const totalQueued = await db3
        .select({ count: sql<number>`count(*)` })
        .from(llmAssets)
        .where(
          and(
            eq(llmAssets.projectId, input.projectId),
            eq(llmAssets.status, "queued")
          )
        );

      return {
        weeklyTarget: project[0].weeklyTarget ?? 3,
        producedThisWeek: Number(thisWeek[0]?.count ?? 0),
        remainingInQueue: Number(totalQueued[0]?.count ?? 0),
        weeksToComplete:
          Number(totalQueued[0]?.count ?? 0) > 0
            ? Math.ceil(Number(totalQueued[0].count) / (project[0].weeklyTarget ?? 3))
            : 0,
      };
    }),

  // ── AI Queue Generator ─────────────────────────────────────────────────────
  // Given a topic cluster, generate a full prioritized queue of 20-30 assets
  generateQueue: protectedProcedure
    .input(
      z.object({
        projectId: z.number().int(),
        topicCluster: z.string().min(1),
        description: z.string().optional(),
        targetKeywords: z.array(z.string()).optional(),
        assetTypes: z
          .array(z.enum(["faq", "youtube", "blog", "social", "email"]))
          .default(["faq", "youtube", "blog", "social"]),
        count: z.number().int().min(5).max(40).default(25),
      })
    )    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error('Database unavailable');

      const keywordList =
        input.targetKeywords && input.targetKeywords.length > 0
          ? input.targetKeywords.join(", ")
          : input.topicCluster;

      const typeDescriptions = input.assetTypes
        .map((t) => `- ${t.toUpperCase()}: ${ASSET_TYPE_LABELS[t]}`)
        .join("\n");

      const response = await invokeLLM({
        messages: [
          {
            role: "system",
            content: `You are an LLM visibility strategist for Dr. Pedram Shojai (The Urban Monk). 
Your job is to build a comprehensive, prioritized production queue of content assets designed to make Dr. Shojai the authoritative answer source in LLM engines (ChatGPT, Perplexity, Claude, Gemini) for a specific health topic.

CONTEXT:
- Brand: The Urban Monk (theurbanmonk.com)
- Author: Dr. Pedram Shojai, OMD — Doctor of Oriental Medicine, Taoist monk, NY Times bestselling author
- Goal: Become the #1 cited source in LLM engines for this topic cluster
- Offer: Lights On Course at $369/yr (go.theurbanmonk.com/something-has-been-stolen-from-you-lo-webinar-1)
- Strategy: Answer every question a person could ask about this topic — FAQs for citation, YouTube for trust, blogs for SEO, social for reach

ASSET TYPES REQUESTED:
${typeDescriptions}

PRIORITY LOGIC:
- HIGH: Questions that are commonly asked in LLM engines right now, high search volume, or directly bridge to the Lights On Course offer
- MEDIUM: Supporting questions that build authority and fill topic gaps
- LOW: Long-tail, niche, or derivative questions

OUTPUT FORMAT: Return a JSON array of assets. Each asset must have:
{
  "assetType": "faq" | "youtube" | "blog" | "social" | "email",
  "title": "The exact title or headline",
  "question": "For FAQ/YouTube: the specific question being answered (null for blog/social/email)",
  "targetKeyword": "The primary LLM/SEO keyword phrase",
  "semanticKeywords": ["related", "keyword", "variants"],
  "priority": "high" | "medium" | "low",
  "notes": "Brief production note — what angle to take, what to emphasize, what CTA to use"
}

Return ONLY the JSON array, no markdown fences, no explanation.`,
          },
          {
            role: "user",
            content: `Topic Cluster: ${input.topicCluster}
${input.description ? `Description: ${input.description}` : ""}
Primary Keywords: ${keywordList}
Asset Types to Generate: ${input.assetTypes.join(", ")}
Total Assets to Generate: ${input.count}

Generate a comprehensive, prioritized production queue that covers every angle of this topic from a functional medicine / ancient wisdom / modern science perspective. Mix asset types proportionally. Start with the highest-impact assets that will get Dr. Shojai cited in LLM engines fastest.`,
          },
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "asset_queue",
            strict: true,
            schema: {
              type: "object",
              properties: {
                assets: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      assetType: { type: "string" },
                      title: { type: "string" },
                      question: { type: ["string", "null"] },
                      targetKeyword: { type: "string" },
                      semanticKeywords: { type: "array", items: { type: "string" } },
                      priority: { type: "string" },
                      notes: { type: "string" },
                    },
                    required: ["assetType", "title", "question", "targetKeyword", "semanticKeywords", "priority", "notes"],
                    additionalProperties: false,
                  },
                },
              },
              required: ["assets"],
              additionalProperties: false,
            },
          },
        },
      });

      const rawContent = response.choices[0]?.message?.content;
      const raw = typeof rawContent === "string" ? rawContent : "{}";
      let parsed: { assets: Array<{
        assetType: string;
        title: string;
        question: string | null;
        targetKeyword: string;
        semanticKeywords: string[];
        priority: string;
        notes: string;
      }> };
      try {
        parsed = JSON.parse(raw);
      } catch {
        throw new Error("Failed to parse AI-generated queue");
      }

      const validTypes = ["faq", "youtube", "blog", "social", "email"] as const;
      const validPriorities = ["high", "medium", "low"] as const;

      const toInsert = (parsed.assets ?? [])
        .filter((a) => validTypes.includes(a.assetType as typeof validTypes[number]))
        .map((a) => ({
          projectId: input.projectId,
          assetType: a.assetType as typeof validTypes[number],
          title: a.title,
          question: a.question ?? undefined,
          targetKeyword: a.targetKeyword,
          semanticKeywords: JSON.stringify(a.semanticKeywords ?? []),
          priority: (validPriorities.includes(a.priority as typeof validPriorities[number])
            ? a.priority
            : "medium") as typeof validPriorities[number],
          notes: a.notes,
          status: "queued" as const,
        }));

      if (toInsert.length > 0) {
        await db.insert(llmAssets).values(toInsert);
      }

      return { generated: toInsert.length };
    }),

  // ── Get single project ─────────────────────────────────────────────────────
  getProject: protectedProcedure
    .input(z.object({ id: z.number().int() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return null;
      const [project] = await db
        .select()
        .from(llmProjects)
        .where(eq(llmProjects.id, input.id))
        .limit(1);
      return project ?? null;
    }),
});
