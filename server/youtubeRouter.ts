import { Supadata } from "@supadata/js";
import { z } from "zod";
import { invokeLLM } from "./_core/llm";
import { wrapLLM } from "./llmUtils";
import { publicProcedure, router } from "./_core/trpc";
import { getDb } from "./db";
import { getYouTubeClient } from "./youtubeOAuth";

// Pedram's voice guide injected into the differentiation analysis
const PEDRAM_VOICE_GUIDE = `
Pedram Shojai (The Urban Monk) voice & positioning guide:
- Tone: Warm, authoritative, grounded — the wise elder who has walked the path
- Credentials: Doctor of Oriental Medicine (OMD), Qigong master, former Taoist monk, NY Times bestselling author
- Core worldview: Ancient wisdom meets modern science; the body is a garden, not a machine
- Key differentiators vs. typical wellness content:
  1. Integrates Eastern philosophy (Taoism, Qigong, TCM) with Western functional medicine
  2. Emphasizes "life energy" (Qi) and time as the ultimate currency
  3. Practical, actionable — not just theory; always gives the reader/viewer a next step
  4. Speaks to high-performing professionals who feel depleted, not just "sick people"
  5. Avoids fear-mongering; leads with empowerment and possibility
  6. Always connects individual health to the bigger picture (family, community, planet)
- Signature phrases: "Urban Monk", "life energy", "Qi", "the garden", "time as currency", "reclaim your life"
- Offers: Lights On Course (), supplements, retreats — webinar funnel: lightson.theurbanmonk.com
- Content pillars: sleep, gut health, oral health, detox, stress/energy, longevity, Qigong
`;

function getSupadata() {
  const apiKey = process.env.SUPADATA_API_KEY;
  if (!apiKey) throw new Error("SUPADATA_API_KEY is not configured");
  return new Supadata({ apiKey });
}

// ─── YouTube Data API v3 helpers ──────────────────────────────────────────────

/**
 * Get an authenticated YouTube client from the stored refresh token.
 * Falls back to env var YOUTUBE_REFRESH_TOKEN if DB lookup is unavailable.
 */
async function getYTClient() {
  // Try DB first
  try {
    const db = await getDb();
    if (db) {
      const { userCredentials } = await import("../drizzle/schema");
      const { eq } = await import("drizzle-orm");
      const creds = await db
        .select()
        .from(userCredentials)
        .where(eq(userCredentials.userId, 1))
        .limit(1);
      const refreshToken = creds[0]?.youtubeRefreshToken ?? process.env.YOUTUBE_REFRESH_TOKEN;
      if (refreshToken) return getYouTubeClient(refreshToken);
    }
  } catch {
    // fall through
  }
  const envToken = process.env.YOUTUBE_REFRESH_TOKEN;
  if (envToken) return getYouTubeClient(envToken);
  throw new Error("YouTube is not authorized. Please connect your YouTube account in Settings.");
}

/**
 * Resolve a channel handle (@handle) or channel ID (UC...) to a channel ID.
 * Returns the canonical channelId and basic stats.
 */
async function resolveChannel(handleOrId: string) {
  const yt = await getYTClient();
  const isId = handleOrId.startsWith("UC");

  const params: any = {
    part: ["snippet", "statistics", "contentDetails"],
    maxResults: 1,
  };
  if (isId) {
    params.id = [handleOrId];
  } else {
    // Strip leading @
    params.forHandle = handleOrId.replace(/^@/, "");
  }

  const res = await yt.channels.list(params);
  const channel = res.data.items?.[0];
  if (!channel) throw new Error(`Channel not found: ${handleOrId}`);

  return {
    channelId: channel.id ?? "",
    title: channel.snippet?.title ?? "",
    description: (channel.snippet?.description ?? "").slice(0, 500),
    thumbnail: channel.snippet?.thumbnails?.default?.url ?? "",
    country: channel.snippet?.country ?? "",
    publishedAt: channel.snippet?.publishedAt ?? "",
    subscriberCount: parseInt(channel.statistics?.subscriberCount ?? "0", 10),
    viewCount: parseInt(channel.statistics?.viewCount ?? "0", 10),
    videoCount: parseInt(channel.statistics?.videoCount ?? "0", 10),
    uploadsPlaylistId: channel.contentDetails?.relatedPlaylists?.uploads ?? "",
  };
}

/**
 * Fetch up to `maxResults` video IDs from a channel's uploads playlist.
 */
async function getChannelVideoIds(uploadsPlaylistId: string, maxResults: number = 50): Promise<string[]> {
  const yt = await getYTClient();
  const ids: string[] = [];
  let pageToken: string | undefined;

  while (ids.length < maxResults) {
    const res = await yt.playlistItems.list({
      part: ["contentDetails"],
      playlistId: uploadsPlaylistId,
      maxResults: Math.min(50, maxResults - ids.length),
      pageToken,
    });
    for (const item of res.data.items ?? []) {
      const vid = item.contentDetails?.videoId;
      if (vid) ids.push(vid);
    }
    pageToken = res.data.nextPageToken ?? undefined;
    if (!pageToken) break;
  }

  return ids;
}

/**
 * Fetch full video details (snippet + statistics + contentDetails) for up to 50 IDs.
 */
async function getVideoDetails(videoIds: string[]) {
  if (videoIds.length === 0) return [];
  const yt = await getYTClient();
  const results: any[] = [];

  for (let i = 0; i < videoIds.length; i += 50) {
    const chunk = videoIds.slice(i, i + 50);
    const res = await yt.videos.list({
      part: ["snippet", "statistics", "contentDetails"],
      id: chunk,
    });
    results.push(...(res.data.items ?? []));
  }

  return results;
}

/**
 * Parse ISO 8601 duration (PT4M13S) to seconds.
 */
function parseDuration(iso: string): number {
  const match = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 0;
  return (parseInt(match[1] ?? "0") * 3600) +
    (parseInt(match[2] ?? "0") * 60) +
    parseInt(match[3] ?? "0");
}

/**
 * Compute outlier score: video views / channel average views per video.
 * Score > 1.0 = outperformed average. Score > 2.0 = strong outlier.
 */
function computeOutlierScore(videoViews: number, channelTotalViews: number, channelVideoCount: number): number {
  if (channelVideoCount === 0 || channelTotalViews === 0) return 0;
  const avg = channelTotalViews / channelVideoCount;
  return avg > 0 ? Math.round((videoViews / avg) * 100) / 100 : 0;
}

/**
 * Compute view velocity: views per day since upload.
 */
function computeViewVelocity(viewCount: number, uploadDate: string): number {
  const uploadMs = new Date(uploadDate).getTime();
  const nowMs = Date.now();
  const daysSinceUpload = Math.max(1, (nowMs - uploadMs) / (1000 * 60 * 60 * 24));
  return Math.round(viewCount / daysSinceUpload);
}

/**
 * Format a processed video record for API responses.
 */
function formatVideo(item: any, channelTotalViews: number, channelVideoCount: number) {
  const viewCount = parseInt(item.statistics?.viewCount ?? "0", 10);
  const likeCount = parseInt(item.statistics?.likeCount ?? "0", 10);
  const commentCount = parseInt(item.statistics?.commentCount ?? "0", 10);
  const duration = parseDuration(item.contentDetails?.duration ?? "PT0S");
  const uploadDate = item.snippet?.publishedAt ?? "";
  const isShort = duration > 0 && duration <= 60;

  return {
    id: item.id ?? "",
    title: item.snippet?.title ?? "",
    description: (item.snippet?.description ?? "").slice(0, 200),
    thumbnail: item.snippet?.thumbnails?.medium?.url ?? item.snippet?.thumbnails?.default?.url ?? "",
    channelId: item.snippet?.channelId ?? "",
    channelName: item.snippet?.channelTitle ?? "",
    uploadDate,
    duration,
    isShort,
    viewCount,
    likeCount,
    commentCount,
    url: `https://www.youtube.com/watch?v=${item.id}`,
    outlierScore: computeOutlierScore(viewCount, channelTotalViews, channelVideoCount),
    viewVelocity: computeViewVelocity(viewCount, uploadDate),
  };
}

// ─── Router ───────────────────────────────────────────────────────────────────

export const youtubeRouter = router({
  // ── Existing: Competitor Video Search (Supadata) ──────────────────────────

  searchSimilar: publicProcedure
    .input(
      z.object({
        query: z.string().min(3).max(300),
        limit: z.number().min(1).max(10).default(5),
        sortBy: z.enum(["relevance", "views", "date", "rating"]).default("views"),
        uploadDate: z.enum(["all", "week", "month", "year"]).default("year"),
      })
    )
    .mutation(async ({ input }) => {
      const supadata = getSupadata();

      const results = await supadata.youtube.search({
        query: input.query,
        type: "video",
        limit: input.limit,
        sortBy: input.sortBy,
        uploadDate: input.uploadDate === "all" ? undefined : input.uploadDate,
        features: ["subtitles"],
      });

      const videos = (results.results ?? [])
        .filter((r: any) => r.type === "video")
        .slice(0, input.limit)
        .map((v: any) => ({
          id: v.id as string,
          title: v.title as string,
          description: ((v.description as string) ?? "").slice(0, 300),
          thumbnail: v.thumbnail as string,
          duration: v.duration as number,
          viewCount: v.viewCount as number,
          uploadDate: v.uploadDate as string,
          channelName: (v.channel?.name ?? "Unknown") as string,
          channelId: (v.channel?.id ?? "") as string,
          url: `https://www.youtube.com/watch?v=${v.id}`,
        }));

      return { videos };
    }),

  // ── Existing: Transcript Fetch ────────────────────────────────────────────

  fetchTranscripts: publicProcedure
    .input(
      z.object({
        videoIds: z.array(z.string()).min(1).max(3),
      })
    )
    .mutation(async ({ input }) => {
      const supadata = getSupadata();

      const transcripts: Array<{
        videoId: string;
        text: string;
        lang: string;
        error?: string;
      }> = [];

      for (const videoId of input.videoIds) {
        try {
          const url = `https://www.youtube.com/watch?v=${videoId}`;
          const result = await supadata.transcript({
            url,
            text: true,
            lang: "en",
            mode: "native",
          });

          if ("jobId" in result) {
            let jobResult: any = null;
            for (let i = 0; i < 30; i++) {
              await new Promise((r) => setTimeout(r, 1000));
              jobResult = await supadata.transcript.getJobStatus(result.jobId);
              if (jobResult.status === "completed" || jobResult.status === "failed") break;
            }
            if (jobResult?.status === "completed") {
              transcripts.push({
                videoId,
                text: (jobResult.content as string) ?? "",
                lang: (jobResult.lang as string) ?? "en",
              });
            } else {
              transcripts.push({ videoId, text: "", lang: "en", error: "Transcript unavailable or timed out" });
            }
          } else {
            transcripts.push({
              videoId,
              text: (result.content as string) ?? "",
              lang: (result.lang as string) ?? "en",
            });
          }
        } catch (err: any) {
          transcripts.push({
            videoId,
            text: "",
            lang: "en",
            error: err?.message ?? "Failed to fetch transcript",
          });
        }
      }

      return { transcripts };
    }),

  // ── Existing: LLM Differentiation Analysis ───────────────────────────────

  analyzeCompetitors: publicProcedure
    .input(
      z.object({
        idea: z.string().min(3).max(500),
        videos: z.array(
          z.object({
            videoId: z.string(),
            title: z.string(),
            channelName: z.string(),
            viewCount: z.number(),
            transcript: z.string(),
          })
        ).min(1).max(3),
      })
    )
    .mutation(async ({ input }) => {
      const videoSummaries = input.videos
        .map((v, i) => {
          const transcriptSnippet = v.transcript
            ? v.transcript.slice(0, 2000) + (v.transcript.length > 2000 ? "..." : "")
            : "(no transcript available)";
          return `
--- COMPETITOR ${i + 1} ---
Title: ${v.title}
Channel: ${v.channelName}
Views: ${v.viewCount.toLocaleString()}
Transcript excerpt:
${transcriptSnippet}
`;
        })
        .join("\n");

      const prompt = `You are a senior content strategist for The Urban Monk (Dr. Pedram Shojai). 
Your job is to analyze competitor YouTube videos on a topic and produce a differentiation brief that tells Pedram exactly how to make a BETTER, more distinctive video.

TOPIC / IDEA: ${input.idea}

${PEDRAM_VOICE_GUIDE}

COMPETITOR VIDEOS:
${videoSummaries}

Produce a structured differentiation brief with these exact sections:

## 1. What Competitors Are Doing (Pattern Analysis)
- Hook styles they use (fear, curiosity, authority, etc.)
- Key claims and talking points
- Content structure (how they open, build, close)
- CTA approaches
- Tone and positioning

## 2. Gaps & Weaknesses in Competitor Content
- What they miss, oversimplify, or get wrong
- What the audience is NOT getting from these videos
- Emotional needs left unmet

## 3. Pedram's Differentiation Angle
- The specific angle Pedram should take that NO competitor is covering
- How to open with a hook that is distinctly "Urban Monk"
- Key points to include that leverage his unique credentials (OMD, Qigong, Taoist background)
- How to structure the content differently
- The CTA that fits the Urban Monk funnel (Academy, supplements, retreat)

## 4. Suggested Script Outline (5-7 bullet points)
A brief outline Pedram can use as a starting point for his script.

## 5. One-Line Differentiation Statement
A single sentence summarizing how Pedram's video will be different and better.

Be specific, actionable, and grounded in Pedram's actual voice and positioning. Do not be generic.`;

      const response = await wrapLLM(() => invokeLLM({
        messages: [
          {
            role: "system",
            content: "You are a world-class content strategist specializing in health and wellness YouTube content. You produce sharp, specific, actionable differentiation briefs.",
          },
          { role: "user", content: prompt },
        ],
      }));

      const brief = response.choices?.[0]?.message?.content ?? "";

      return { brief };
    }),

  // ── Existing: Video Summarizer ────────────────────────────────────────────

  summarizeVideo: publicProcedure
    .input(
      z.object({
        videoId: z.string(),
        title: z.string(),
        channelName: z.string(),
        transcript: z.string().max(8000),
      })
    )
    .mutation(async ({ input }) => {
      const transcriptSnippet = input.transcript
        ? input.transcript.slice(0, 4000) + (input.transcript.length > 4000 ? "..." : "")
        : "(no transcript available)";

      const prompt = `You are a content analyst. Summarize the following YouTube video into a concise 5-bullet outline that captures the key points, structure, and main claims. Be specific — not generic summaries.

Video: "${input.title}" by ${input.channelName}

Transcript:
${transcriptSnippet}

Produce exactly 5 bullet points. Each bullet should be 1-2 sentences, specific, and capture a distinct key point from the video. Format as:
• [Point 1]
• [Point 2]
• [Point 3]
• [Point 4]
• [Point 5]`;

      const response = await wrapLLM(() => invokeLLM({
        messages: [
          { role: "system", content: "You are a precise content analyst who produces concise, specific video summaries." },
          { role: "user", content: prompt },
        ],
      }));

      const outline = response.choices?.[0]?.message?.content ?? "";
      return { outline: typeof outline === "string" ? outline : String(outline) };
    }),

  // ── Existing: Script Library ──────────────────────────────────────────────

  saveToScript: publicProcedure
    .input(
      z.object({
        title: z.string().min(1).max(255),
        brief: z.string().min(1),
        topic: z.string().optional(),
        competitorAngle: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const { scripts } = await import("../drizzle/schema");
      const [result] = await db
        .insert(scripts)
        .values({
          title: input.title,
          scriptType: "video",
          platform: "youtube",
          productionStatus: "idea",
          scriptBody: input.brief,
          notes: input.topic ? `Generated from YouTube CI analysis. Topic: ${input.topic}` : "Generated from YouTube Competitive Intelligence analysis.",
          competitorAngle: input.competitorAngle ?? null,
        });
      return { id: (result as any).insertId, title: input.title };
    }),

  // ── Existing: Channel Watchlist ───────────────────────────────────────────

  trackChannel: publicProcedure
    .input(
      z.object({
        channelId: z.string().min(1),
        channelName: z.string().min(1),
        channelUrl: z.string().optional(),
        thumbnail: z.string().optional(),
        subscriberCount: z.number().optional(),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const { competitorChannels } = await import("../drizzle/schema");
      await db.insert(competitorChannels).values({
        channelId: input.channelId,
        channelName: input.channelName,
        channelUrl: input.channelUrl ?? null,
        thumbnail: input.thumbnail ?? null,
        subscriberCount: input.subscriberCount ?? null,
        notes: input.notes ?? null,
      }).onDuplicateKeyUpdate({
        set: {
          channelName: input.channelName,
          thumbnail: input.thumbnail ?? null,
          subscriberCount: input.subscriberCount ?? null,
        },
      });
      return { success: true };
    }),

  listTrackedChannels: publicProcedure.query(async () => {
    const db = await getDb();
    if (!db) return { channels: [] };
    const { competitorChannels } = await import("../drizzle/schema");
    const channels = await db.select().from(competitorChannels).orderBy(competitorChannels.trackedAt);
    return { channels };
  }),

  untrackChannel: publicProcedure
    .input(z.object({ channelId: z.string() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const { competitorChannels } = await import("../drizzle/schema");
      const { eq } = await import("drizzle-orm");
      await db.delete(competitorChannels).where(eq(competitorChannels.channelId, input.channelId));
      return { success: true };
    }),

  getChannelNewUploads: publicProcedure
    .input(
      z.object({
        channelId: z.string(),
        limit: z.number().min(1).max(20).default(5),
      })
    )
    .mutation(async ({ input }) => {
      const supadata = getSupadata();
      const results = await supadata.youtube.search({
        query: `channel:${input.channelId}`,
        type: "video",
        limit: input.limit,
        sortBy: "date",
        uploadDate: "month",
      });
      const db = await getDb();
      if (db) {
        const { competitorChannels } = await import("../drizzle/schema");
        const { eq } = await import("drizzle-orm");
        await db.update(competitorChannels)
          .set({ lastCheckedAt: Date.now() })
          .where(eq(competitorChannels.channelId, input.channelId));
      }
      return { videos: results.results ?? [] };
    }),

  runChannelDigest: publicProcedure.mutation(async () => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");
    const { competitorChannels } = await import("../drizzle/schema");
    const { notifyOwner } = await import("./_core/notification");
    const supadata = getSupadata();
    const channels = await db.select().from(competitorChannels);
    if (channels.length === 0) return { sent: false, message: "No channels tracked" };

    const sections: string[] = [];
    for (const ch of channels) {
      try {
        const results = await supadata.youtube.search({
          query: `channel:${ch.channelId}`,
          type: "video",
          limit: 3,
          sortBy: "date",
          uploadDate: "week",
        });
        const videos = results.results ?? [];
        if (videos.length > 0) {
          const lines = videos.map((v: any) => `  - ${v.title} (${v.viewCount?.toLocaleString() ?? "?"} views) https://youtube.com/watch?v=${v.id}`);
          sections.push(`**${ch.channelName}** — ${videos.length} new this week:\n${lines.join("\n")}`);
        } else {
          sections.push(`**${ch.channelName}** — No new uploads this week.`);
        }
      } catch {
        sections.push(`**${ch.channelName}** — Error fetching uploads.`);
      }
    }

    const content = `# Competitor Channel Weekly Digest\n\n${sections.join("\n\n")}`;
    await notifyOwner({ title: "Competitor Channel Digest", content });
    return { sent: true, channelCount: channels.length };
  }),

  validateApiKey: publicProcedure.query(async () => {
    try {
      const supadata = getSupadata();
      await supadata.youtube.search({ query: "health wellness", type: "video", limit: 1 });
      return { valid: true };
    } catch (err: any) {
      return { valid: false, error: err?.message ?? "Unknown error" };
    }
  }),

  // ── NEW: Channel Deep Analyzer ────────────────────────────────────────────
  /**
   * Given a channel handle (@handle) or channel ID, returns:
   * - Channel stats (subs, total views, video count, upload frequency)
   * - Top 10 videos by view count with outlier scores
   * - Longs vs Shorts breakdown
   * - Upload frequency (videos per week over last 90 days)
   */
  analyzeChannel: publicProcedure
    .input(
      z.object({
        channelHandle: z.string().min(1).max(100),
        videoLimit: z.number().min(10).max(50).default(50),
      })
    )
    .mutation(async ({ input }) => {
      // 1. Resolve channel
      const channel = await resolveChannel(input.channelHandle);

      // 2. Fetch recent video IDs from uploads playlist
      const videoIds = await getChannelVideoIds(channel.uploadsPlaylistId, input.videoLimit);

      // 3. Get full video details
      const rawVideos = await getVideoDetails(videoIds);

      // 4. Format all videos with outlier scores
      const allVideos = rawVideos.map((v) =>
        formatVideo(v, channel.viewCount, channel.videoCount)
      );

      // 5. Top 10 by view count
      const top10ByViews = [...allVideos]
        .sort((a, b) => b.viewCount - a.viewCount)
        .slice(0, 10);

      // 6. Longs vs Shorts breakdown
      const longs = allVideos.filter((v) => !v.isShort);
      const shorts = allVideos.filter((v) => v.isShort);
      const longsVsShorts = {
        totalVideos: allVideos.length,
        longsCount: longs.length,
        shortsCount: shorts.length,
        longsViews: longs.reduce((s, v) => s + v.viewCount, 0),
        shortsViews: shorts.reduce((s, v) => s + v.viewCount, 0),
        longsAvgViews: longs.length > 0 ? Math.round(longs.reduce((s, v) => s + v.viewCount, 0) / longs.length) : 0,
        shortsAvgViews: shorts.length > 0 ? Math.round(shorts.reduce((s, v) => s + v.viewCount, 0) / shorts.length) : 0,
      };

      // 7. Upload frequency (videos per week over the fetched window)
      const sortedByDate = [...allVideos].sort(
        (a, b) => new Date(a.uploadDate).getTime() - new Date(b.uploadDate).getTime()
      );
      let uploadsPerWeek = 0;
      let uploadFrequencyLabel = "Unknown";
      if (sortedByDate.length >= 2) {
        const oldest = new Date(sortedByDate[0].uploadDate).getTime();
        const newest = new Date(sortedByDate[sortedByDate.length - 1].uploadDate).getTime();
        const weeks = Math.max(1, (newest - oldest) / (7 * 24 * 60 * 60 * 1000));
        uploadsPerWeek = Math.round((sortedByDate.length / weeks) * 10) / 10;
        if (uploadsPerWeek >= 7) uploadFrequencyLabel = "Daily";
        else if (uploadsPerWeek >= 3) uploadFrequencyLabel = "3-5x/week";
        else if (uploadsPerWeek >= 1.5) uploadFrequencyLabel = "2-3x/week";
        else if (uploadsPerWeek >= 0.8) uploadFrequencyLabel = "Weekly";
        else if (uploadsPerWeek >= 0.4) uploadFrequencyLabel = "Bi-weekly";
        else uploadFrequencyLabel = "Monthly or less";
      }

      // 8. Average views per video
      const avgViewsPerVideo = allVideos.length > 0
        ? Math.round(allVideos.reduce((s, v) => s + v.viewCount, 0) / allVideos.length)
        : 0;

      return {
        channel: {
          ...channel,
          avgViewsPerVideo,
          uploadsPerWeek,
          uploadFrequencyLabel,
        },
        top10ByViews,
        longsVsShorts,
        allVideosCount: allVideos.length,
      };
    }),

  // ── NEW: Outlier Finder ───────────────────────────────────────────────────
  /**
   * Search a topic and return the 10 videos with the highest outlier scores.
   * Outlier score = video views / that channel's average views per video.
   * Score > 2.0 = strong viral outlier. Score > 1.0 = above average.
   */
  getOutlierVideos: publicProcedure
    .input(
      z.object({
        query: z.string().min(3).max(300),
        uploadDate: z.enum(["all", "week", "month", "year"]).default("year"),
        limit: z.number().min(10).max(50).default(25),
      })
    )
    .mutation(async ({ input }) => {
      const yt = await getYTClient();

      // Step 1: Search for videos
      const searchRes = await yt.search.list({
        part: ["snippet"],
        q: input.query,
        type: ["video"],
        maxResults: input.limit,
        order: "viewCount",
        ...(input.uploadDate !== "all" && {
          publishedAfter: {
            week: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
            month: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
            year: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString(),
          }[input.uploadDate],
        }),
      });

      const videoIds = (searchRes.data.items ?? [])
        .map((item: any) => item.id?.videoId)
        .filter(Boolean) as string[];

      if (videoIds.length === 0) return { videos: [] };

      // Step 2: Get full video details
      const rawVideos = await getVideoDetails(videoIds);

      // Step 3: For each video, get channel average views
      const channelIds = [...new Set(rawVideos.map((v: any) => v.snippet?.channelId).filter(Boolean))] as string[];

      // Batch fetch channel stats
      const channelStats = new Map<string, { totalViews: number; videoCount: number }>();
      for (let i = 0; i < channelIds.length; i += 50) {
        const chunk = channelIds.slice(i, i + 50);
        const chRes = await yt.channels.list({
          part: ["statistics"],
          id: chunk,
        });
        for (const ch of chRes.data.items ?? []) {
          if (ch.id) {
            channelStats.set(ch.id, {
              totalViews: parseInt(ch.statistics?.viewCount ?? "0", 10),
              videoCount: parseInt(ch.statistics?.videoCount ?? "0", 10),
            });
          }
        }
      }

      // Step 4: Format with outlier scores
      const videos = rawVideos.map((v: any) => {
        const chId = v.snippet?.channelId ?? "";
        const chStats = channelStats.get(chId) ?? { totalViews: 0, videoCount: 0 };
        return formatVideo(v, chStats.totalViews, chStats.videoCount);
      });

      // Step 5: Sort by outlier score, return top 10
      const top10 = videos
        .sort((a, b) => b.outlierScore - a.outlierScore)
        .slice(0, 10);

      return { videos: top10 };
    }),

  // ── NEW: Topic Trends (View Velocity) ─────────────────────────────────────
  /**
   * Search a topic and return 10 videos ranked by view velocity (views/day since upload).
   * This surfaces fast-rising content, not just all-time high performers.
   */
  getTopicTrends: publicProcedure
    .input(
      z.object({
        query: z.string().min(3).max(300),
        uploadDate: z.enum(["week", "month", "year"]).default("month"),
        limit: z.number().min(10).max(50).default(25),
      })
    )
    .mutation(async ({ input }) => {
      const yt = await getYTClient();

      const publishedAfter = {
        week: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
        month: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
        year: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString(),
      }[input.uploadDate];

      const searchRes = await yt.search.list({
        part: ["snippet"],
        q: input.query,
        type: ["video"],
        maxResults: input.limit,
        order: "viewCount",
        publishedAfter,
      });

      const videoIds = (searchRes.data.items ?? [])
        .map((item: any) => item.id?.videoId)
        .filter(Boolean) as string[];

      if (videoIds.length === 0) return { videos: [] };

      const rawVideos = await getVideoDetails(videoIds);

      // Get channel stats for outlier scores
      const channelIds = [...new Set(rawVideos.map((v: any) => v.snippet?.channelId).filter(Boolean))] as string[];
      const channelStats = new Map<string, { totalViews: number; videoCount: number }>();
      for (let i = 0; i < channelIds.length; i += 50) {
        const chunk = channelIds.slice(i, i + 50);
        const chRes = await yt.channels.list({ part: ["statistics"], id: chunk });
        for (const ch of chRes.data.items ?? []) {
          if (ch.id) {
            channelStats.set(ch.id, {
              totalViews: parseInt(ch.statistics?.viewCount ?? "0", 10),
              videoCount: parseInt(ch.statistics?.videoCount ?? "0", 10),
            });
          }
        }
      }

      const videos = rawVideos.map((v: any) => {
        const chId = v.snippet?.channelId ?? "";
        const chStats = channelStats.get(chId) ?? { totalViews: 0, videoCount: 0 };
        return formatVideo(v, chStats.totalViews, chStats.videoCount);
      });

      // Sort by view velocity (views/day)
      const top10 = videos
        .sort((a, b) => b.viewVelocity - a.viewVelocity)
        .slice(0, 10);

      return { videos: top10 };
    }),

  // ── NEW: Title Pattern Analyzer ───────────────────────────────────────────
  /**
   * Search a topic, collect the top 10 video titles, and use LLM to extract
   * the winning title patterns, hooks, and emotional triggers.
   * Returns both the raw titles and the LLM analysis.
   */
  getTitlePatterns: publicProcedure
    .input(
      z.object({
        query: z.string().min(3).max(300),
        uploadDate: z.enum(["all", "week", "month", "year"]).default("year"),
      })
    )
    .mutation(async ({ input }) => {
      const yt = await getYTClient();

      const searchRes = await yt.search.list({
        part: ["snippet"],
        q: input.query,
        type: ["video"],
        maxResults: 25,
        order: "viewCount",
        ...(input.uploadDate !== "all" && {
          publishedAfter: {
            week: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
            month: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
            year: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString(),
          }[input.uploadDate],
        }),
      });

      const videoIds = (searchRes.data.items ?? [])
        .map((item: any) => item.id?.videoId)
        .filter(Boolean) as string[];

      if (videoIds.length === 0) return { titles: [], analysis: "" };

      const rawVideos = await getVideoDetails(videoIds.slice(0, 10));

      const titlesWithStats = rawVideos.map((v: any) => ({
        id: v.id ?? "",
        title: v.snippet?.title ?? "",
        viewCount: parseInt(v.statistics?.viewCount ?? "0", 10),
        channelName: v.snippet?.channelTitle ?? "",
        url: `https://www.youtube.com/watch?v=${v.id}`,
        thumbnail: v.snippet?.thumbnails?.medium?.url ?? "",
        uploadDate: v.snippet?.publishedAt ?? "",
        duration: parseDuration(v.contentDetails?.duration ?? "PT0S"),
        isShort: parseDuration(v.contentDetails?.duration ?? "PT0S") <= 60,
      }));

      // LLM title pattern analysis
      const titleList = titlesWithStats
        .map((v, i) => `${i + 1}. "${v.title}" — ${(v.viewCount / 1000).toFixed(0)}K views`)
        .join("\n");

      const prompt = `You are a YouTube content strategist for The Urban Monk (Dr. Pedram Shojai). Analyze these 10 top-performing YouTube video titles on the topic of "${input.query}":

${titleList}

${PEDRAM_VOICE_GUIDE}

Produce a structured Title Pattern Analysis with these sections:

## 1. Dominant Title Formulas
List the 3-5 most common structural patterns (e.g., "Number + Benefit", "How to + Outcome", "The [X] That [Y]"). Give 2 examples of each from the list above.

## 2. Power Words & Emotional Triggers
What specific words and phrases appear most? What emotional triggers are being used (fear, curiosity, authority, transformation, urgency)?

## 3. What Makes the Top 3 Titles Win
Analyze the #1, #2, and #3 titles specifically. Why do they outperform? What psychological mechanism is at work?

## 4. Gaps — What No One Is Saying
What title angles are completely absent from this list that Pedram could own? Think about his unique positioning (Eastern medicine, Qigong, Taoist perspective, high-performer audience).

## 5. 5 Suggested Title Templates for Pedram
Write 5 ready-to-use title templates that apply the winning patterns but are distinctly "Urban Monk" in voice and positioning. Format: Title | Why It Works

Be specific, data-driven, and actionable. Reference the actual titles above.`;

      const response = await wrapLLM(() => invokeLLM({
        messages: [
          { role: "system", content: "You are a YouTube title strategist who produces sharp, specific, actionable pattern analyses." },
          { role: "user", content: prompt },
        ],
      }));

      const analysis = response.choices?.[0]?.message?.content ?? "";

      return {
        titles: titlesWithStats,
        analysis: typeof analysis === "string" ? analysis : String(analysis),
      };
    }),

  // ── NEW: Similar Channels Finder ──────────────────────────────────────────
  /**
   * Search a topic and return 10 distinct competitor channels with their stats.
   * Deduplicates by channelId so each channel appears only once.
   */
  searchChannels: publicProcedure
    .input(
      z.object({
        query: z.string().min(3).max(300),
        limit: z.number().min(5).max(20).default(10),
      })
    )
    .mutation(async ({ input }) => {
      const yt = await getYTClient();

      // Search for channels directly
      const searchRes = await yt.search.list({
        part: ["snippet"],
        q: input.query,
        type: ["channel"],
        maxResults: 20,
        order: "relevance",
      });

      const channelIds = (searchRes.data.items ?? [])
        .map((item: any) => item.id?.channelId)
        .filter(Boolean) as string[];

      if (channelIds.length === 0) return { channels: [] };

      // Get full channel stats
      const chRes = await yt.channels.list({
        part: ["snippet", "statistics"],
        id: channelIds.slice(0, 20),
      });

      const channels = (chRes.data.items ?? [])
        .map((ch: any) => ({
          channelId: ch.id ?? "",
          title: ch.snippet?.title ?? "",
          description: (ch.snippet?.description ?? "").slice(0, 200),
          thumbnail: ch.snippet?.thumbnails?.default?.url ?? "",
          country: ch.snippet?.country ?? "",
          subscriberCount: parseInt(ch.statistics?.subscriberCount ?? "0", 10),
          viewCount: parseInt(ch.statistics?.viewCount ?? "0", 10),
          videoCount: parseInt(ch.statistics?.videoCount ?? "0", 10),
          url: `https://www.youtube.com/channel/${ch.id}`,
          handle: ch.snippet?.customUrl ?? "",
        }))
        .sort((a: any, b: any) => b.subscriberCount - a.subscriberCount)
        .slice(0, input.limit);

      return { channels };
    }),
});
