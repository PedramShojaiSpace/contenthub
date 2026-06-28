/**
 * Intent Ideas Router
 *
 * Bridges Reddit + YouTube intent signals → AI-generated content ideas → Content Pipeline.
 *
 * Flow:
 *  1. Aggregate top Reddit posts (last 14 days, not dismissed, scored by engagement)
 *  2. Aggregate YouTube lead prospect comments (last 14 days, by keyword category)
 *  3. Send the aggregated pain points to Claude, which generates 8-10 specific content ideas
 *     written in Pedram Shojai's voice, each with a title, hook, content type, and source signal
 *  4. User reviews ideas in the Intelligence Dashboard
 *  5. One-click "Add to Pipeline" creates a content_item with status="idea"
 */

import { z } from "zod";
import { protectedProcedure, router } from "./_core/trpc";
import { getDb, createContentItem } from "./db";
import { redditPosts, leadProspects } from "../drizzle/schema";
import { desc, gte, eq, and } from "drizzle-orm";
import { invokeLLM } from "./_core/llm";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface GeneratedIdea {
  title: string;           // Compelling headline/title for the content piece
  hook: string;            // Opening line or hook sentence
  contentType: "blog" | "video" | "social" | "email"; // Recommended format
  category: string;        // Topic category (e.g. "gut_health", "stress", "sleep")
  sourceSignals: string[]; // The Reddit/YouTube pain points that inspired this idea
  platform: string;        // Recommended primary platform
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Pull the top Reddit posts from the last 14 days, not dismissed, sorted by score */
async function getRecentRedditSignals(db: NonNullable<Awaited<ReturnType<typeof getDb>>>) {
  const cutoff = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
  return db
    .select({
      title: redditPosts.title,
      selftext: redditPosts.selftext,
      subreddit: redditPosts.subreddit,
      category: redditPosts.category,
      score: redditPosts.score,
      numComments: redditPosts.numComments,
      aiSummary: redditPosts.aiSummary,
      aiRecommendation: redditPosts.aiRecommendation,
    })
    .from(redditPosts)
    .where(
      and(
        eq(redditPosts.isDismissed, false),
        gte(redditPosts.fetchedAt, cutoff)
      )
    )
    .orderBy(desc(redditPosts.score))
    .limit(30);
}

/** Pull YouTube and Reddit lead prospect comments from the last 14 days */
async function getRecentLeadSignals(db: NonNullable<Awaited<ReturnType<typeof getDb>>>) {
  const cutoff = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
  return db
    .select({
      body: leadProspects.body,
      title: leadProspects.title,
      source: leadProspects.source,
      subredditOrChannel: leadProspects.subredditOrChannel,
      keywordsMatched: leadProspects.keywordsMatched,
      category: leadProspects.category,
    })
    .from(leadProspects)
    .where(gte(leadProspects.createdAt, cutoff))
    .orderBy(desc(leadProspects.createdAt))
    .limit(40);
}

/** Build a compact signal summary for the Claude prompt */
function buildSignalSummary(
  redditSignals: Awaited<ReturnType<typeof getRecentRedditSignals>>,
  leadSignals: Awaited<ReturnType<typeof getRecentLeadSignals>>
): string {
  const lines: string[] = [];

  // Reddit posts
  if (redditSignals.length > 0) {
    lines.push("=== TOP REDDIT DISCUSSIONS (last 14 days) ===");
    for (const post of redditSignals.slice(0, 20)) {
      const summary = post.aiSummary
        ? `Summary: ${post.aiSummary}`
        : post.selftext
        ? `Content: ${post.selftext.slice(0, 200)}`
        : "";
      lines.push(
        `[r/${post.subreddit} | ${post.category} | ${post.score} upvotes, ${post.numComments} comments]\n` +
        `Title: ${post.title}\n` +
        (summary ? `${summary}\n` : "") +
        (post.aiRecommendation ? `Angle: ${post.aiRecommendation}\n` : "")
      );
    }
  }

  // YouTube + Reddit lead comments
  if (leadSignals.length > 0) {
    lines.push("\n=== INTENT SIGNALS FROM YOUTUBE COMMENTS & REDDIT LEADS ===");
    for (const lead of leadSignals.slice(0, 20)) {
      const keywords = lead.keywordsMatched
        ? (() => { try { return JSON.parse(lead.keywordsMatched).join(", "); } catch { return lead.keywordsMatched; } })()
        : "";
      lines.push(
        `[${lead.source} | ${lead.subredditOrChannel ?? "unknown"} | keywords: ${keywords}]\n` +
        `"${lead.body.slice(0, 250)}"\n`
      );
    }
  }

  return lines.join("\n");
}

// ─── Router ───────────────────────────────────────────────────────────────────

export const intentIdeasRouter = router({
  /**
   * Generate 8-10 content ideas from the last 14 days of Reddit + YouTube intent signals.
   * Returns a list of GeneratedIdea objects ready to display in the Intelligence Dashboard.
   */
  generateIntentIdeas: protectedProcedure
    .input(
      z.object({
        forceRefresh: z.boolean().optional().default(false),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // Gather signals
      const [redditSignals, leadSignals] = await Promise.all([
        getRecentRedditSignals(db),
        getRecentLeadSignals(db),
      ]);

      const totalSignals = redditSignals.length + leadSignals.length;

      if (totalSignals === 0) {
        return {
          ideas: [] as GeneratedIdea[],
          signalCount: 0,
          message:
            "No intent signals found in the last 14 days. Run the Reddit or YouTube scans first.",
        };
      }

      const signalSummary = buildSignalSummary(redditSignals, leadSignals);

      const systemPrompt = `You are Dr. Pedram Shojai's content strategist. You deeply understand his brand, voice, and audience.

PEDRAM'S BRAND IDENTITY:
- Dr. Pedram Shojai, OMD — Daoist monk, doctor of Oriental medicine, filmmaker, and author
- Bridges ancient wisdom (Daoism, Qigong, TCM) with modern science (neuroscience, functional medicine, biohacking)
- Core message: You can't pour from an empty cup. Energy, vitality, and presence are the foundation of everything.
- Audience: Stressed, high-achieving adults (35-60) who feel depleted, disconnected, or stuck despite doing "everything right"
- Common pain points: brain fog, insomnia (especially waking 2-4am), gut issues, cortisol dysregulation, burnout, feeling spiritually empty
- Tone: Warm authority. Wise but accessible. Never preachy. Science-backed but soulful.
- Products: Urban Monk Academy ($297/year), supplements (Jing, Shen, Qi blends), books, podcast

CONTENT GOALS:
- Every piece should move the audience toward one of: (1) trusting Pedram as their guide, (2) visiting theurbanmonk.com, (3) joining the Academy
- Content should feel like a gift, not a pitch
- The best hooks speak directly to a specific pain the audience is feeling RIGHT NOW

YOUR TASK:
Given the real pain points and discussions happening in Pedram's target communities right now (from Reddit and YouTube), generate exactly 8-10 specific, compelling content ideas.

For each idea, provide:
- title: A specific, compelling headline (not generic — make it feel like it was written for someone in pain right now)
- hook: The opening sentence that would stop someone mid-scroll
- contentType: "blog" | "video" | "social" | "email"
- category: The health/wellness category (e.g. "gut_health", "stress", "sleep", "energy", "longevity", "mindfulness", "detox", "supplements")
- sourceSignals: 1-3 brief phrases describing the actual pain points from the signals that inspired this idea
- platform: Primary recommended platform ("blog", "youtube", "instagram", "linkedin", "email")

IMPORTANT:
- Ideas must be SPECIFIC, not generic. "5 Ways to Sleep Better" is bad. "Why You Wake Up at 3am (It's Your Liver, Not Your Mind)" is good.
- Each idea should feel like it was written by someone who read those exact Reddit posts and YouTube comments
- Vary the content types and platforms across the 8-10 ideas
- At least 2 ideas should be blog posts (for SEO), at least 2 should be video scripts, at least 2 should be social posts
- Include at least one idea that directly bridges to the Academy or supplements (but subtly — through value, not pitch)

Return ONLY a valid JSON array of idea objects. No markdown, no explanation, no wrapper object.`;

      const userPrompt = `Here are the real pain points your audience is expressing right now:\n\n${signalSummary}\n\nGenerate 8-10 specific content ideas based on these signals.`;

      const response = await invokeLLM({
        messages: [
          { role: "system" as const, content: systemPrompt },
          { role: "user" as const, content: userPrompt },
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "content_ideas",
            strict: true,
            schema: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  title: { type: "string" },
                  hook: { type: "string" },
                  contentType: {
                    type: "string",
                    enum: ["blog", "video", "social", "email"],
                  },
                  category: { type: "string" },
                  sourceSignals: {
                    type: "array",
                    items: { type: "string" },
                  },
                  platform: { type: "string" },
                },
                required: [
                  "title",
                  "hook",
                  "contentType",
                  "category",
                  "sourceSignals",
                  "platform",
                ],
                additionalProperties: false,
              },
            },
          },
        },
      });

      const rawContent = response.choices?.[0]?.message?.content;
      const raw = typeof rawContent === "string" ? rawContent : "[]";
      let ideas: GeneratedIdea[] = [];
      try {
        ideas = JSON.parse(raw);
      } catch {
        ideas = [];
      }

      return {
        ideas,
        signalCount: totalSignals,
        redditPostCount: redditSignals.length,
        leadSignalCount: leadSignals.length,
        message: `Generated ${ideas.length} ideas from ${totalSignals} intent signals (${redditSignals.length} Reddit posts, ${leadSignals.length} lead comments).`,
      };
    }),

  /**
   * Push a generated idea into the Content Pipeline as a content_item with status="idea".
   * Returns the new content item ID so the UI can link directly to it.
   */
  pushIdeaToPipeline: protectedProcedure
    .input(
      z.object({
        title: z.string().min(1),
        hook: z.string(),
        contentType: z.enum(["blog", "video", "social", "email"]),
        category: z.string(),
        platform: z.string(),
        sourceSignals: z.array(z.string()),
      })
    )
    .mutation(async ({ input, ctx }: { input: { title: string; hook: string; contentType: "blog" | "video" | "social" | "email"; category: string; platform: string; sourceSignals: string[] }; ctx: { user: { id: number } } }) => {
      // Map contentType → platform enum value
      const platformMap: Record<string, string> = {
        blog: "blog",
        video: "youtube",
        social: "instagram",
        email: "linkedin",
      };
      const platform = platformMap[input.contentType] ?? "linkedin";

      // Build a rich rawIdea that includes the hook and source signals
      const rawIdea =
        `${input.title}\n\nHook: ${input.hook}\n\nSource signals:\n` +
        input.sourceSignals.map((s) => `• ${s}`).join("\n");

      const item = await createContentItem({
        title: input.title,
        rawIdea,
        platform: platform as any,
        status: "idea",
        notes: `Generated from intent signals | Category: ${input.category} | Recommended platform: ${input.platform}`,
      });

      return {
        success: true,
        contentItemId: item.id,
        title: item.title,
      };
    }),
});
