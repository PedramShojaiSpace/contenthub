import { z } from "zod";
import { protectedProcedure, router } from "./_core/trpc";
import { getDb } from "./db";
import { redditSubreddits, redditPosts } from "../drizzle/schema";
import { eq, desc, and, sql } from "drizzle-orm";
import { invokeLLM } from "./_core/llm";
import { callDataApi } from "./_core/dataApi";

// ─── Reddit fetch via Manus Data API (bypasses datacenter IP blocks) ─────────

interface RedditRawPost {
  id: string;
  subreddit: string;
  title: string;
  selftext: string;
  score: number;
  num_comments: number;
  upvote_ratio: number;
  permalink: string;
  author: string;
  created_utc: number;
}

interface DataApiPost {
  data?: {
    id?: string;
    subreddit?: string;
    title?: string;
    selftext?: string;
    score?: number;
    num_comments?: number;
    upvote_ratio?: number;
    permalink?: string;
    author?: string;
    created_utc?: number;
  };
}

interface DataApiResponse {
  posts?: DataApiPost[];
  success?: boolean;
}

async function fetchRedditHot(
  subreddit: string,
  limit = 25
): Promise<RedditRawPost[]> {
  try {
    const result = await callDataApi("Reddit/AccessAPI", {
      query: { subreddit, limit: String(limit) },
    }) as DataApiResponse;

    if (!result?.posts?.length) return [];

    return result.posts
      .map((p) => p.data)
      .filter((d): d is NonNullable<typeof d> => !!d && !!d.id && !!d.title)
      .map((d) => ({
        id: d.id!,
        subreddit: d.subreddit ?? subreddit,
        title: d.title!,
        selftext: d.selftext ?? "",
        score: d.score ?? 0,
        num_comments: d.num_comments ?? 0,
        upvote_ratio: d.upvote_ratio ?? 1,
        permalink: d.permalink ?? "",
        author: d.author ?? "[deleted]",
        created_utc: d.created_utc ?? Math.floor(Date.now() / 1000),
      }));
  } catch (err) {
    console.error(`[Reddit] fetchRedditHot(${subreddit}) failed:`, err);
    return [];
  }
}

// ─── Default subreddits for Urban Monk topics ────────────────────────────────

const DEFAULT_SUBREDDITS = [
  { subreddit: "Meditation", category: "meditation" },
  { subreddit: "Mindfulness", category: "meditation" },
  { subreddit: "Biohackers", category: "biohacking" },
  { subreddit: "longevity", category: "biohacking" },
  { subreddit: "Nootropics", category: "biohacking" },
  { subreddit: "Supplements", category: "supplements" },
  { subreddit: "yoga", category: "movement" },
  { subreddit: "Fitness", category: "movement" },
  { subreddit: "sleep", category: "recovery" },
  { subreddit: "Anxiety", category: "stress" },
  { subreddit: "stress", category: "stress" },
  { subreddit: "LifeProTips", category: "productivity" },
  { subreddit: "Entrepreneur", category: "productivity" },
  { subreddit: "nutrition", category: "nutrition" },
  { subreddit: "herbalism", category: "nutrition" },
  { subreddit: "TCM", category: "tcm" },
  { subreddit: "Qigong", category: "tcm" },
  { subreddit: "Ayurveda", category: "tcm" },
];

// ─── AI analysis ─────────────────────────────────────────────────────────────

interface PostAnalysis {
  engagementScore: number;
  aiSummary: string;
  aiRecommendation: string;
  aiDraftComment: string;
}

async function analyzePostWithAI(post: {
  title: string;
  selftext: string | null;
  subreddit: string;
  score: number;
  numComments: number;
}): Promise<PostAnalysis> {
  const prompt = `You are the editorial AI for Dr. Pedram Shojai (The Urban Monk) — a doctor of Oriental Medicine, bestselling author, and expert in energy medicine, Taoist philosophy, biohacking, meditation, stress resilience, gut health, and longevity.

Analyze this Reddit thread and determine if it's a high-value opportunity for Dr. Shojai to add expert value:

SUBREDDIT: r/${post.subreddit}
TITLE: ${post.title}
BODY: ${(post.selftext ?? "").slice(0, 600)}
SCORE: ${post.score} upvotes | ${post.numComments} comments

Return a JSON object with exactly these fields:
{
  "engagementScore": <integer 1-10, where 10 = perfect opportunity for Dr. Shojai's expertise>,
  "aiSummary": "<one sentence: what this thread is really asking or discussing>",
  "aiRecommendation": "<one sentence: the specific angle Dr. Shojai should take — what unique insight he can offer that others can't>",
  "aiDraftComment": "<a 3-5 sentence draft comment in Dr. Shojai's voice — grounded, wise, specific, no fluff. Blend ancient wisdom with modern science. End with a gentle invitation to explore further, not a hard sell.>"
}

Only return the JSON object, nothing else.`;

  try {
    const res = await invokeLLM({
      messages: [{ role: "user", content: prompt }],
    });
    const content = res.choices?.[0]?.message?.content;
    const text = typeof content === "string" ? content : "";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    const parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : {};
    return {
      engagementScore: Math.min(10, Math.max(1, parseInt(String(parsed.engagementScore)) || 5)),
      aiSummary: String(parsed.aiSummary ?? ""),
      aiRecommendation: String(parsed.aiRecommendation ?? ""),
      aiDraftComment: String(parsed.aiDraftComment ?? ""),
    };
  } catch {
    return { engagementScore: 5, aiSummary: "", aiRecommendation: "", aiDraftComment: "" };
  }
}

// ─── Router ───────────────────────────────────────────────────────────────────

export const redditRouter = router({
  // Seed default subreddits if none exist
  seedDefaults: protectedProcedure.mutation(async () => {
    const db = await getDb();
    if (!db) throw new Error("DB unavailable");
    const existing = await db.select().from(redditSubreddits);
    if (existing.length > 0) return { seeded: 0 };
    await db.insert(redditSubreddits).values(DEFAULT_SUBREDDITS);
    return { seeded: DEFAULT_SUBREDDITS.length };
  }),

  // List all tracked subreddits
  listSubreddits: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new Error("DB unavailable");
    return db
      .select()
      .from(redditSubreddits)
      .orderBy(redditSubreddits.category, redditSubreddits.subreddit);
  }),

  // Add a subreddit
  addSubreddit: protectedProcedure
    .input(z.object({ subreddit: z.string().min(1), category: z.string().min(1) }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      await db
        .insert(redditSubreddits)
        .values({ subreddit: input.subreddit, category: input.category })
        .onDuplicateKeyUpdate({ set: { isActive: true, category: input.category } });
      return { ok: true };
    }),

  // Toggle active/inactive
  toggleSubreddit: protectedProcedure
    .input(z.object({ id: z.number(), isActive: z.boolean() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      await db
        .update(redditSubreddits)
        .set({ isActive: input.isActive })
        .where(eq(redditSubreddits.id, input.id));
      return { ok: true };
    }),

  // Remove a subreddit
  removeSubreddit: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      await db.delete(redditSubreddits).where(eq(redditSubreddits.id, input.id));
      return { ok: true };
    }),

  // Fetch & cache posts from all active subreddits
  refreshFeed: protectedProcedure
    .input(z.object({ category: z.string().optional() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      const conditions = input.category
        ? and(eq(redditSubreddits.isActive, true), eq(redditSubreddits.category, input.category))
        : eq(redditSubreddits.isActive, true);

      const subs = await db.select().from(redditSubreddits).where(conditions);

      let totalFetched = 0;
      let totalNew = 0;

      for (const sub of subs) {
        const posts = await fetchRedditHot(sub.subreddit, 15);
        for (const p of posts) {
          const existing = await db
            .select({ id: redditPosts.id })
            .from(redditPosts)
            .where(eq(redditPosts.redditId, p.id))
            .limit(1);

          if (existing.length === 0) {
            await db.insert(redditPosts).values({
              redditId: p.id,
              subreddit: p.subreddit,
              category: sub.category,
              title: p.title,
              selftext: p.selftext?.slice(0, 2000) ?? null,
              score: p.score,
              numComments: p.num_comments,
              upvoteRatio: p.upvote_ratio,
              permalink: `https://reddit.com${p.permalink}`,
              author: p.author,
              createdUtc: Math.floor(p.created_utc),
            });
            totalNew++;
          } else {
            await db
              .update(redditPosts)
              .set({ score: p.score, numComments: p.num_comments })
              .where(eq(redditPosts.redditId, p.id));
          }
          totalFetched++;
        }
        await db
          .update(redditSubreddits)
          .set({ lastFetchedAt: new Date() })
          .where(eq(redditSubreddits.id, sub.id));
      }

      return { totalFetched, totalNew, subredditsScanned: subs.length };
    }),

  // Get the feed of posts (with optional filters)
  getFeed: protectedProcedure
    .input(
      z.object({
        category: z.string().optional(),
        onlyFlagged: z.boolean().optional(),
        minScore: z.number().optional(),
        limit: z.number().default(50),
      })
    )
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      const conditions = [eq(redditPosts.isDismissed, false)];
      if (input.category) conditions.push(eq(redditPosts.category, input.category));
      if (input.onlyFlagged) conditions.push(eq(redditPosts.isFlagged, true));
      if (input.minScore) conditions.push(sql`${redditPosts.score} >= ${input.minScore}`);

      return db
        .select()
        .from(redditPosts)
        .where(and(...conditions))
        .orderBy(desc(redditPosts.engagementScore), desc(redditPosts.score))
        .limit(input.limit);
    }),

  // AI-analyze a single post
  analyzePost: protectedProcedure
    .input(z.object({ postId: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      const [post] = await db
        .select()
        .from(redditPosts)
        .where(eq(redditPosts.id, input.postId))
        .limit(1);
      if (!post) throw new Error("Post not found");

      const analysis = await analyzePostWithAI({
        title: post.title,
        selftext: post.selftext,
        subreddit: post.subreddit,
        score: post.score,
        numComments: post.numComments,
      });

      await db
        .update(redditPosts)
        .set({ ...analysis, isAnalyzed: true })
        .where(eq(redditPosts.id, input.postId));

      return analysis;
    }),

  // Batch-analyze top unanalyzed posts (up to 10 at a time)
  batchAnalyze: protectedProcedure
    .input(z.object({ limit: z.number().default(10), category: z.string().optional() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      const conditions = [eq(redditPosts.isAnalyzed, false), eq(redditPosts.isDismissed, false)];
      if (input.category) conditions.push(eq(redditPosts.category, input.category));

      const posts = await db
        .select()
        .from(redditPosts)
        .where(and(...conditions))
        .orderBy(desc(redditPosts.score))
        .limit(input.limit);

      let analyzed = 0;
      for (const post of posts) {
        const analysis = await analyzePostWithAI({
          title: post.title,
          selftext: post.selftext,
          subreddit: post.subreddit,
          score: post.score,
          numComments: post.numComments,
        });
        await db
          .update(redditPosts)
          .set({ ...analysis, isAnalyzed: true })
          .where(eq(redditPosts.id, post.id));
        analyzed++;
      }
      return { analyzed };
    }),

  // Flag a post for engagement
  flagPost: protectedProcedure
    .input(z.object({ postId: z.number(), isFlagged: z.boolean() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      await db
        .update(redditPosts)
        .set({ isFlagged: input.isFlagged })
        .where(eq(redditPosts.id, input.postId));
      return { ok: true };
    }),

  // Dismiss a post
  dismissPost: protectedProcedure
    .input(z.object({ postId: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      await db
        .update(redditPosts)
        .set({ isDismissed: true })
        .where(eq(redditPosts.id, input.postId));
      return { ok: true };
    }),

  // Regenerate draft comment for a post
  regenerateDraft: protectedProcedure
    .input(z.object({ postId: z.number(), customInstructions: z.string().optional() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      const [post] = await db
        .select()
        .from(redditPosts)
        .where(eq(redditPosts.id, input.postId))
        .limit(1);
      if (!post) throw new Error("Post not found");

      const extraInstructions = input.customInstructions
        ? `\n\nAdditional instructions: ${input.customInstructions}`
        : "";

      const prompt = `You are writing a Reddit comment for Dr. Pedram Shojai (The Urban Monk) — a doctor of Oriental Medicine, bestselling author, expert in energy medicine, Taoist philosophy, biohacking, meditation, stress resilience, gut health, and longevity.

Thread: r/${post.subreddit}
Title: ${post.title}
Body: ${(post.selftext ?? "").slice(0, 600)}
${post.aiRecommendation ? `Recommended angle: ${post.aiRecommendation}` : ""}${extraInstructions}

Write a 3-6 sentence comment in Dr. Shojai's authentic voice:
- Grounded, warm, and direct — never preachy
- Blend ancient wisdom with modern science naturally
- Offer a specific, actionable insight or perspective
- End with a gentle curiosity-opener (not a hard sell)
- Sound like a knowledgeable friend, not a marketer

Return only the comment text, no quotes or labels.`;

      const res = await invokeLLM({
        messages: [{ role: "user", content: prompt }],
      });
      const content = res.choices?.[0]?.message?.content;
      const draft = typeof content === "string" ? content.trim() : "";

      await db
        .update(redditPosts)
        .set({ aiDraftComment: draft })
        .where(eq(redditPosts.id, input.postId));

      return { draft };
    }),

  // Get stats summary
  getStats: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new Error("DB unavailable");
    const [total] = await db
      .select({ count: sql<number>`count(*)` })
      .from(redditPosts)
      .where(eq(redditPosts.isDismissed, false));
    const [analyzed] = await db
      .select({ count: sql<number>`count(*)` })
      .from(redditPosts)
      .where(and(eq(redditPosts.isAnalyzed, true), eq(redditPosts.isDismissed, false)));
    const [flagged] = await db
      .select({ count: sql<number>`count(*)` })
      .from(redditPosts)
      .where(and(eq(redditPosts.isFlagged, true), eq(redditPosts.isDismissed, false)));
    const [highValue] = await db
      .select({ count: sql<number>`count(*)` })
      .from(redditPosts)
      .where(
        and(
          eq(redditPosts.isAnalyzed, true),
          eq(redditPosts.isDismissed, false),
          sql`${redditPosts.engagementScore} >= 7`
        )
      );
    return {
      total: total?.count ?? 0,
      analyzed: analyzed?.count ?? 0,
      flagged: flagged?.count ?? 0,
      highValue: highValue?.count ?? 0,
    };
  }),
});
