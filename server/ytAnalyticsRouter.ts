/**
 * YouTube Analytics Router
 *
 * Provides:
 *  - fetchVideoAnalytics: pull metrics from YouTube Analytics API + Data API for Pedram's channel
 *  - listVideoSnapshots: return stored snapshots (most recent per video)
 *  - getChannelSummary: aggregate channel-level stats
 *  - listComments: fetch latest comments from YouTube Data API and store them
 *  - postReply: post a reply to a comment via YouTube Data API
 *  - suggestReply: generate an AI reply suggestion in Pedram's voice
 *  - generateHeadlines: produce 5 CTR-optimised title variants for a given topic
 */

import { z } from "zod";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { getDb } from "./db";
import { ytVideoSnapshots, ytComments, ytHeadlineGenerations } from "../drizzle/schema";
import { desc, eq, and, sql } from "drizzle-orm";
import { getYTClient } from "./youtubeRouter";
import { invokeLLM } from "./_core/llm";
import { wrapLLM } from "./llmUtils";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function todayStr() {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
}

/**
 * Fetch the owner's YouTube channel ID from the Data API.
 * Returns the first channel associated with the authenticated account.
 */
async function getOwnerChannelId(): Promise<string> {
  const yt = await getYTClient();
  const res = await yt.channels.list({ part: ["id"], mine: true });
  const channelId = res.data.items?.[0]?.id;
  if (!channelId) throw new Error("Could not resolve owner YouTube channel ID");
  return channelId;
}

/**
 * Fetch up to 50 recent video IDs + basic metadata from the channel's uploads playlist.
 */
async function getChannelVideos(maxResults = 50) {
  const yt = await getYTClient();
  const channelId = await getOwnerChannelId();

  // Get uploads playlist ID
  const chRes = await yt.channels.list({
    part: ["contentDetails"],
    id: [channelId],
  });
  const uploadsPlaylistId = chRes.data.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;
  if (!uploadsPlaylistId) throw new Error("Could not find uploads playlist");

  // Fetch playlist items
  const plRes = await yt.playlistItems.list({
    part: ["contentDetails"],
    playlistId: uploadsPlaylistId,
    maxResults,
  });
  const videoIds = (plRes.data.items ?? []).map(
    (item) => item.contentDetails?.videoId ?? ""
  ).filter(Boolean);

  if (videoIds.length === 0) return [];

  // Fetch video details in one batch
  const vidRes = await yt.videos.list({
    part: ["snippet", "statistics", "contentDetails"],
    id: videoIds,
  });

  return (vidRes.data.items ?? []).map((v) => ({
    videoId: v.id ?? "",
    title: v.snippet?.title ?? "",
    publishedAt: v.snippet?.publishedAt
      ? new Date(v.snippet.publishedAt).getTime()
      : null,
    thumbnailUrl:
      v.snippet?.thumbnails?.medium?.url ??
      v.snippet?.thumbnails?.default?.url ??
      null,
    views: parseInt(v.statistics?.viewCount ?? "0", 10),
    likes: parseInt(v.statistics?.likeCount ?? "0", 10),
    comments: parseInt(v.statistics?.commentCount ?? "0", 10),
  }));
}

// ─── Router ───────────────────────────────────────────────────────────────────

export const ytAnalyticsRouter = router({

  // ── Fetch & store analytics snapshot for all recent videos ─────────────────
  fetchVideoAnalytics: publicProcedure
    .input(z.object({ maxVideos: z.number().min(1).max(50).default(25) }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");

      const videos = await getChannelVideos(input.maxVideos);
      const today = todayStr();
      const now = Date.now();

      let upserted = 0;
      for (const v of videos) {
        if (!v.videoId) continue;

        // Check if we already have a snapshot for today
        const existing = await db
          .select({ id: ytVideoSnapshots.id })
          .from(ytVideoSnapshots)
          .where(
            and(
              eq(ytVideoSnapshots.videoId, v.videoId),
              eq(ytVideoSnapshots.snapshotDate, today)
            )
          )
          .limit(1);

        if (existing.length > 0) {
          // Update existing snapshot
          await db
            .update(ytVideoSnapshots)
            .set({
              views: v.views,
              likes: v.likes,
              comments: v.comments,
              snapshotAt: now,
            })
            .where(eq(ytVideoSnapshots.id, existing[0].id));
        } else {
          // Insert new snapshot
          await db.insert(ytVideoSnapshots).values({
            videoId: v.videoId,
            title: v.title,
            publishedAt: v.publishedAt ?? undefined,
            thumbnailUrl: v.thumbnailUrl ?? undefined,
            views: v.views,
            likes: v.likes,
            comments: v.comments,
            snapshotDate: today,
            snapshotAt: now,
          });
        }
        upserted++;
      }

      return { upserted, total: videos.length, date: today };
    }),

  // ── List most recent snapshot per video ────────────────────────────────────
  listVideoSnapshots: publicProcedure
    .input(z.object({ limit: z.number().min(1).max(100).default(50) }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return { snapshots: [] };

      // Get the most recent snapshot per video using a subquery approach
      const rows = await db
        .select()
        .from(ytVideoSnapshots)
        .orderBy(desc(ytVideoSnapshots.snapshotAt))
        .limit(input.limit * 3); // fetch extra to deduplicate

      // Deduplicate: keep only the latest snapshot per videoId
      const seen = new Set<string>();
      const snapshots = rows
        .filter((r) => {
          if (seen.has(r.videoId)) return false;
          seen.add(r.videoId);
          return true;
        })
        .slice(0, input.limit);

      return { snapshots };
    }),

  // ── Channel-level summary ──────────────────────────────────────────────────
  getChannelSummary: publicProcedure.query(async () => {
    const db = await getDb();
    if (!db) return null;

    const rows = await db
      .select()
      .from(ytVideoSnapshots)
      .orderBy(desc(ytVideoSnapshots.snapshotAt))
      .limit(500);

    // Deduplicate to latest per video
    const seen = new Set<string>();
    const latest = rows.filter((r) => {
      if (seen.has(r.videoId)) return false;
      seen.add(r.videoId);
      return true;
    });

    if (latest.length === 0) return null;

    const totalViews = latest.reduce((s, v) => s + (v.views ?? 0), 0);
    const totalLikes = latest.reduce((s, v) => s + (v.likes ?? 0), 0);
    const totalComments = latest.reduce((s, v) => s + (v.comments ?? 0), 0);
    const withCtr = latest.filter((v) => v.thumbnailCtr != null);
    const avgCtr =
      withCtr.length > 0
        ? withCtr.reduce((s, v) => s + (v.thumbnailCtr ?? 0), 0) / withCtr.length
        : null;
    const withRetention = latest.filter((v) => v.avgViewPct != null);
    const avgRetention =
      withRetention.length > 0
        ? withRetention.reduce((s, v) => s + (v.avgViewPct ?? 0), 0) / withRetention.length
        : null;

    const topByViews = [...latest]
      .sort((a, b) => (b.views ?? 0) - (a.views ?? 0))
      .slice(0, 5);

    return {
      videoCount: latest.length,
      totalViews,
      totalLikes,
      totalComments,
      avgCtr: avgCtr != null ? Math.round(avgCtr * 100) / 100 : null,
      avgRetention: avgRetention != null ? Math.round(avgRetention * 10) / 10 : null,
      topByViews,
    };
  }),

  // ── Fetch & store comments for a video ────────────────────────────────────
  listComments: publicProcedure
    .input(
      z.object({
        videoId: z.string().optional(),
        status: z.enum(["unread", "read", "replied", "ignored", "all"]).default("all"),
        limit: z.number().min(1).max(100).default(50),
        fetchFresh: z.boolean().default(false),
      })
    )
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return { comments: [] };

      // Optionally fetch fresh comments from YouTube API
      if (input.fetchFresh) {
        try {
          const yt = await getYTClient();
          const params: any = {
            part: ["snippet"],
            maxResults: 100,
            order: "time",
            textFormat: "plainText",
          };
          if (input.videoId) {
            params.videoId = input.videoId;
          } else {
            // Fetch for the whole channel (allThreadsRelatedToChannelId)
            const channelId = await getOwnerChannelId();
            params.allThreadsRelatedToChannelId = channelId;
          }

          const res = await yt.commentThreads.list(params);
          const items = res.data.items ?? [];

          for (const item of items) {
            const top = item.snippet?.topLevelComment?.snippet;
            if (!top || !item.id) continue;

            // Upsert by commentId
            const existing = await db
              .select({ id: ytComments.id })
              .from(ytComments)
              .where(eq(ytComments.commentId, item.id))
              .limit(1);

            if (existing.length === 0) {
              await db.insert(ytComments).values({
                commentId: item.id,
                videoId: top.videoId ?? input.videoId ?? "",
                videoTitle: undefined,
                authorName: top.authorDisplayName ?? "Unknown",
                authorProfileImageUrl: top.authorProfileImageUrl ?? undefined,
                text: top.textDisplay ?? "",
                likeCount: top.likeCount ?? 0,
                publishedAt: top.publishedAt
                  ? new Date(top.publishedAt).getTime()
                  : undefined,
                fetchedAt: Date.now(),
              });
            }
          }
        } catch (err: any) {
          // Non-fatal — return cached comments even if fresh fetch fails
          console.warn("YouTube comment fetch failed:", err?.message);
        }
      }

      // Query stored comments
      const conditions: any[] = [];
      if (input.videoId) conditions.push(eq(ytComments.videoId, input.videoId));
      if (input.status !== "all") conditions.push(eq(ytComments.replyStatus, input.status as any));

      const comments = await db
        .select()
        .from(ytComments)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(ytComments.publishedAt))
        .limit(input.limit);

      return { comments };
    }),

  // ── Post a reply to a comment via YouTube API ─────────────────────────────
  postReply: publicProcedure
    .input(
      z.object({
        commentId: z.string(),
        replyText: z.string().min(1).max(10000),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");

      const yt = await getYTClient();

      // Post reply via YouTube Data API
      await yt.comments.insert({
        part: ["snippet"],
        requestBody: {
          snippet: {
            parentId: input.commentId,
            textOriginal: input.replyText,
          },
        },
      });

      // Update local record
      await db
        .update(ytComments)
        .set({
          replyStatus: "replied",
          replyText: input.replyText,
          repliedAt: Date.now(),
        })
        .where(eq(ytComments.commentId, input.commentId));

      return { success: true };
    }),

  // ── Mark comment as read or ignored ───────────────────────────────────────
  updateCommentStatus: publicProcedure
    .input(
      z.object({
        commentId: z.string(),
        status: z.enum(["read", "ignored", "unread"]),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");

      await db
        .update(ytComments)
        .set({ replyStatus: input.status })
        .where(eq(ytComments.commentId, input.commentId));

      return { success: true };
    }),

  // ── AI reply suggestion in Pedram's voice ─────────────────────────────────
  suggestReply: publicProcedure
    .input(
      z.object({
        commentId: z.string(),
        commentText: z.string().min(1).max(5000),
        videoTitle: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();

      const response = await wrapLLM(
        () =>
          invokeLLM({
            messages: [
              {
                role: "system",
                content: `You are Dr. Pedram Shojai (The Urban Monk). You are responding to a YouTube comment on your channel.

Your voice: Warm, wise, grounded, and encouraging. You speak like a knowledgeable friend who genuinely cares. You are a Doctor of Oriental Medicine, Qigong master, and NY Times bestselling author. You bridge ancient Eastern wisdom with modern functional medicine.

Rules for your reply:
- Keep it under 3 sentences
- Be genuine and personal — not corporate or generic
- If the comment asks a question, give a brief, useful answer and invite them to explore more
- If the comment is positive, acknowledge it warmly and reinforce the key insight
- If the comment is critical, respond with grace and curiosity
- Never use hashtags or emojis
- Sign off naturally (e.g., "Stay well, Pedram" or just end the reply naturally)
- Do NOT start with "Great comment!" or "Thanks for watching!" — be more specific`,
              },
              {
                role: "user",
                content: `Video: "${input.videoTitle ?? "Urban Monk video"}"

Comment: "${input.commentText}"

Write a reply in Pedram's voice:`,
              },
            ],
          }),
        "suggestReply"
      );

      const suggestion = response.choices[0]?.message?.content ?? "";

      // Store the suggestion
      if (db) {
        await db
          .update(ytComments)
          .set({ aiSuggestedReply: suggestion })
          .where(eq(ytComments.commentId, input.commentId));
      }

      return { suggestion };
    }),

  // ── Generate 5 headline variants for a topic ──────────────────────────────
  generateHeadlines: publicProcedure
    .input(
      z.object({
        topic: z.string().min(3).max(300),
        pillar: z.enum(["gut_health_metabolism", "nervous_system_stress", "consciousness_longevity", "oral_health", "general"]).optional(),
        linkedScriptId: z.number().optional(),
        linkedPipelineVideoId: z.number().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();

      const pillarContext: Record<string, string> = {
        gut_health_metabolism: "gut health, microbiome, metabolism, weight, digestion",
        nervous_system_stress: "stress, cortisol, nervous system, anxiety, energy, sleep",
        consciousness_longevity: "longevity, consciousness, Qigong, mindfulness, life energy, Qi",
        oral_health: "oral health, microbiome, teeth, gums, mouth-gut connection",
        general: "health, wellness, functional medicine, ancient wisdom",
      };

      const pillarHint = input.pillar ? pillarContext[input.pillar] : "health and wellness";

      const response = await wrapLLM(
        () =>
          invokeLLM({
            messages: [
              {
                role: "system",
                content: `You are an expert YouTube title strategist specializing in health and wellness content. You write titles that maximize click-through rate (CTR) while being accurate and not clickbait.

You are writing titles for Dr. Pedram Shojai (The Urban Monk) — a Doctor of Oriental Medicine, Qigong master, and NY Times bestselling author. His audience: health-conscious professionals aged 35-60 who want to optimize their health using both ancient wisdom and modern science.

Return ONLY valid JSON — no markdown, no explanation, no code fences.`,
              },
              {
                role: "user",
                content: `Topic: "${input.topic}"
Content pillar: ${pillarHint}

Generate exactly 5 YouTube title variants AND a matching thumbnail concept for each. Each title should use a DIFFERENT proven formula:
1. CURIOSITY GAP — tease something the viewer desperately wants to know
2. BOLD CLAIM + NUMBER — specific, credible, makes a strong promise
3. PATTERN INTERRUPT — counterintuitive statement that stops the scroll
4. STORY/PERSONAL — first-person experience or transformation
5. QUESTION — a question the viewer is already asking themselves

For each title, also generate a thumbnail concept. Thumbnails for Dr. Pedram Shojai (The Urban Monk) should:
- NOT use AI-generated likenesses of the host; instead use anonymous human figures, symbolic imagery, or visual metaphors
- Convey the emotional problem or transformation, not a specific person's face
- Use a dark, earthy, or deep navy palette consistent with the Urban Monk brand
- Be production-ready descriptions a graphic designer can execute in Canva or Photoshop

Return JSON in this exact format:
{
  "headlines": [
    {
      "title": "The actual YouTube title (max 70 chars)",
      "hook": "One sentence explaining why this title will make someone click",
      "rationale": "Which formula this uses and why it works for this topic",
      "estimatedCtrTier": "high" | "medium" | "low",
      "thumbnail": {
        "layout": "Overall composition description",
        "textOverlay": "Exact 3-5 word text to overlay on the thumbnail",
        "background": "Background scene or image (no host face — use symbolic imagery or anonymous figures)",
        "focalElement": "Single most eye-catching visual element that dominates the frame",
        "colorMood": "Color palette and emotional tone",
        "productionNotes": "Specific design tips for a Canva/Photoshop designer"
      }
    }
  ]
}`,
              },
            ],
            response_format: {
              type: "json_schema",
              json_schema: {
                name: "headlines_output",
                strict: true,
                schema: {
                  type: "object",
                  properties: {
                    headlines: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          title: { type: "string" },
                          hook: { type: "string" },
                          rationale: { type: "string" },
                          estimatedCtrTier: { type: "string", enum: ["high", "medium", "low"] },
                          thumbnail: {
                            type: "object",
                            properties: {
                              layout: { type: "string" },
                              textOverlay: { type: "string" },
                              background: { type: "string" },
                              focalElement: { type: "string" },
                              colorMood: { type: "string" },
                              productionNotes: { type: "string" },
                            },
                            required: ["layout", "textOverlay", "background", "focalElement", "colorMood", "productionNotes"],
                            additionalProperties: false,
                          },
                        },
                        required: ["title", "hook", "rationale", "estimatedCtrTier", "thumbnail"],
                        additionalProperties: false,
                      },
                    },
                  },
                  required: ["headlines"],
                  additionalProperties: false,
                },
              },
            },
          }),
        "generateHeadlines"
      );

      const raw = response.choices[0]?.message?.content ?? "{}";
      let parsed: {
        headlines: Array<{
          title: string;
          hook: string;
          rationale: string;
          estimatedCtrTier: "high" | "medium" | "low";
          thumbnail: {
            layout: string;
            textOverlay: string;
            background: string;
            focalElement: string;
            colorMood: string;
            productionNotes: string;
          };
        }>;
      };
      try {
        parsed = JSON.parse(raw);
      } catch {
        throw new Error("Failed to parse headline generation response");
      }

      // Extract thumbnail concepts as a parallel array for DB storage
      const thumbnailConcepts = parsed.headlines.map((h) => h.thumbnail);

      // Store in DB
      if (db) {
        await db.insert(ytHeadlineGenerations).values({
          topic: input.topic,
          pillar: input.pillar ?? "general",
          headlines: parsed.headlines,
          thumbnailConcepts,
          linkedScriptId: input.linkedScriptId,
          linkedPipelineVideoId: input.linkedPipelineVideoId,
          createdAt: Date.now(),
        });
      }

      return { headlines: parsed.headlines, topic: input.topic };
    }),

  // ── List past headline generations ────────────────────────────────────────
  listHeadlineGenerations: publicProcedure
    .input(z.object({ limit: z.number().min(1).max(50).default(20) }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return { generations: [] };

      const generations = await db
        .select()
        .from(ytHeadlineGenerations)
        .orderBy(desc(ytHeadlineGenerations.createdAt))
        .limit(input.limit);

      return { generations };
    }),

  // ── Regenerate thumbnail concept for a single headline ─────────────────────
  regenerateThumbnail: publicProcedure
    .input(
      z.object({
        title: z.string().min(1).max(512),
        topic: z.string().min(1).max(300),
        pillar: z.enum(["gut_health_metabolism", "nervous_system_stress", "consciousness_longevity", "oral_health", "general"]).optional(),
        generationId: z.number().optional(),
        headlineIndex: z.number().min(0).max(4).optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();

      const pillarContext: Record<string, string> = {
        gut_health_metabolism: "gut health, microbiome, metabolism, weight, digestion",
        nervous_system_stress: "stress, cortisol, nervous system, anxiety, energy, sleep",
        consciousness_longevity: "longevity, consciousness, Qigong, mindfulness, life energy, Qi",
        oral_health: "oral health, microbiome, teeth, gums, mouth-gut connection",
        general: "health and wellness",
      };
      const pillarHint = input.pillar ? pillarContext[input.pillar] : "health and wellness";

      const response = await wrapLLM(
        () =>
          invokeLLM({
            messages: [
              {
                role: "system",
                content: `You are an expert YouTube thumbnail art director specializing in health and wellness content for Dr. Pedram Shojai (The Urban Monk).

Thumbnail guidelines:
- Do NOT use AI-generated likenesses of the host; use anonymous human figures, symbolic imagery, or visual metaphors
- Convey the emotional problem or transformation, not a specific person's face
- Use a dark, earthy, or deep navy palette consistent with the Urban Monk brand
- Be production-ready — a graphic designer must be able to execute this in Canva or Photoshop

Return ONLY valid JSON — no markdown, no explanation, no code fences.`,
              },
              {
                role: "user",
                content: `Generate a FRESH, DIFFERENT thumbnail concept for this YouTube title.

Title: "${input.title}"
Topic: "${input.topic}"
Content pillar: ${pillarHint}

Return JSON in this exact format:
{
  "thumbnail": {
    "layout": "Overall composition description",
    "textOverlay": "Exact 3-5 word text to overlay on the thumbnail",
    "background": "Background scene or image (no host face — use symbolic imagery or anonymous figures)",
    "focalElement": "Single most eye-catching visual element that dominates the frame",
    "colorMood": "Color palette and emotional tone",
    "productionNotes": "Specific design tips for a Canva/Photoshop designer"
  }
}`,
              },
            ],
            response_format: {
              type: "json_schema",
              json_schema: {
                name: "thumbnail_output",
                strict: true,
                schema: {
                  type: "object",
                  properties: {
                    thumbnail: {
                      type: "object",
                      properties: {
                        layout: { type: "string" },
                        textOverlay: { type: "string" },
                        background: { type: "string" },
                        focalElement: { type: "string" },
                        colorMood: { type: "string" },
                        productionNotes: { type: "string" },
                      },
                      required: ["layout", "textOverlay", "background", "focalElement", "colorMood", "productionNotes"],
                      additionalProperties: false,
                    },
                  },
                  required: ["thumbnail"],
                  additionalProperties: false,
                },
              },
            },
          }),
        "regenerateThumbnail"
      );

      const raw = response.choices[0]?.message?.content ?? "{}";
      let parsed: {
        thumbnail: {
          layout: string;
          textOverlay: string;
          background: string;
          focalElement: string;
          colorMood: string;
          productionNotes: string;
        };
      };
      try {
        parsed = JSON.parse(raw);
      } catch {
        throw new Error("Failed to parse thumbnail regeneration response");
      }

      // Optionally update the stored thumbnailConcepts array in the DB
      if (db && input.generationId != null && input.headlineIndex != null) {
        const existing = await db
          .select({ thumbnailConcepts: ytHeadlineGenerations.thumbnailConcepts })
          .from(ytHeadlineGenerations)
          .where(eq(ytHeadlineGenerations.id, input.generationId))
          .limit(1);

        if (existing.length > 0) {
          const concepts = (existing[0].thumbnailConcepts as any[]) ?? [];
          concepts[input.headlineIndex] = parsed.thumbnail;
          await db
            .update(ytHeadlineGenerations)
            .set({ thumbnailConcepts: concepts })
            .where(eq(ytHeadlineGenerations.id, input.generationId));
        }
      }

      return { thumbnail: parsed.thumbnail };
    }),

  // ── Select a headline for a generation ────────────────────────────────────
  selectHeadline: publicProcedure
    .input(
      z.object({
        generationId: z.number(),
        selectedTitle: z.string().min(1).max(512),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");

      await db
        .update(ytHeadlineGenerations)
        .set({ selectedTitle: input.selectedTitle })
        .where(eq(ytHeadlineGenerations.id, input.generationId));

      return { success: true };
    }),
});
