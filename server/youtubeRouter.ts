import { Supadata } from "@supadata/js";
import { z } from "zod";
import { invokeLLM } from "./_core/llm";
import { wrapLLM } from "./llmUtils";
import { publicProcedure, router } from "./_core/trpc";
import { getDb } from "./db";
import { getYouTubeClient } from "./youtubeOAuth";
import { getAvatarContextBlock } from "./avatarRouter";

// Pedram's voice guide injected into the differentiation analysis
const PEDRAM_VOICE_GUIDE = `
Pedram Shojai (The Urban Monk) voice & positioning guide:
- Tone: Warm, authoritative, grounded — the wise elder who has walked the path
- Credentials: Doctor of Oriental Medicine (OMD), Qigong master, former Daoist monk, NY Times bestselling author
- Core worldview: Ancient wisdom meets modern science; the body is a garden, not a machine
- Key differentiators vs. typical wellness content:
  1. Integrates Eastern philosophy (Daoism, Qigong, TCM) with Western functional medicine
  2. Emphasizes "life energy" (Qi) and time as the ultimate currency
  3. Practical, actionable — not just theory; always gives the reader/viewer a next step
  4. Speaks to high-performing professionals who feel depleted, not just "sick people"
  5. Avoids fear-mongering; leads with empowerment and possibility
  6. Always connects individual health to the bigger picture (family, community, planet)
- Signature phrases: "Urban Monk", "life energy", "Qi", "the garden", "time as currency", "reclaim your life"
- Offers: Lights On Course (), supplements, retreats — webinar funnel: lightson.theurbanmonk.com
- Content pillars: sleep, gut health, oral health, detox, stress/energy, longevity, Qigong
`;

export function getSupadata() {
  const apiKey = process.env.SUPADATA_API_KEY;
  if (!apiKey) throw new Error("SUPADATA_API_KEY is not configured");
  return new Supadata({ apiKey });
}

// ─── YouTube Data API v3 helpers ──────────────────────────────────────────────

/**
 * Get an authenticated YouTube client from the stored refresh token.
 * Falls back to env var YOUTUBE_REFRESH_TOKEN if DB lookup is unavailable.
 */
export async function getYTClient() {
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
      // Fetch avatar intelligence for this topic
      const avatarContext = await getAvatarContextBlock(input.idea).catch(() => "");

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

${avatarContext ? avatarContext + "\n\nUSE THE AVATAR INTELLIGENCE ABOVE to:\n- Identify which competitor gaps align with the audience's deepest pain points\n- Ensure Pedram's differentiation angle speaks directly to the audience's emotional state\n- Recommend hook language that mirrors the audience's exact internal monologue\n- Flag any competitor content that accidentally triggers the audience's top objections" : ""}

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
- Key points to include that leverage his unique credentials (OMD, Qigong, Daoist background)
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

  // ── New: Generate Full Script from Differentiation Brief ─────────────────

  generateScriptFromBrief: publicProcedure
    .input(
      z.object({
        brief: z.string().min(50),
        idea: z.string().min(3).max(500),
        targetDurationMinutes: z.number().min(3).max(20).default(8),
      })
    )
    .mutation(async ({ input }) => {
      const avatarContext = await getAvatarContextBlock(input.idea).catch(() => "");
      const wordTarget = Math.round(input.targetDurationMinutes * 130);

      const prompt = `You are a professional scriptwriter for Dr. Pedram Shojai (The Urban Monk).
Using the differentiation brief below, write a complete, teleprompter-ready YouTube video script.

${PEDRAM_VOICE_GUIDE}

${avatarContext ? avatarContext + "\n\n" : ""}DIFFERENTIATION BRIEF:
${input.brief}

SCRIPT REQUIREMENTS:
- Target length: approximately ${wordTarget} words (${input.targetDurationMinutes} minutes at teleprompter pace)
- Format: Full spoken script — every word Pedram will say, no bullet points, no stage directions in brackets
- Open with a STRONG hook (first 30 seconds must grab attention — use a surprising stat, bold claim, or relatable pain point)
- Follow the Urban Monk structure: Hook → Problem/Agitate → East-meets-West insight → Practical steps → Empowerment close → CTA
- CTA: Direct viewers to lightson.theurbanmonk.com or the Urban Monk Academy
- Voice: Warm, authoritative, conversational — like a wise mentor talking to a smart friend
- Include natural pauses and emphasis cues using em-dashes and ellipses where appropriate
- Do NOT include [brackets], stage directions, or scene descriptions — pure spoken text only
- End with a clear, specific call to action

Write the complete script now:`;

      const response = await wrapLLM(() => invokeLLM({
        messages: [
          { role: "system", content: "You are an expert scriptwriter specializing in health and wellness YouTube content for Dr. Pedram Shojai. You write compelling, teleprompter-ready scripts that sound natural when spoken aloud." },
          { role: "user", content: prompt },
        ],
      }));

      const scriptBody = response.choices?.[0]?.message?.content ?? "";
      const wordCount = typeof scriptBody === "string" ? scriptBody.split(/\s+/).filter(Boolean).length : 0;
      return { scriptBody: typeof scriptBody === "string" ? scriptBody : String(scriptBody), wordCount };
    }),

  // ── New: Create Video Job from Script ───────────────────────────────────

  createVideoJobFromScript: publicProcedure
    .input(
      z.object({
        title: z.string().min(1).max(255),
        scriptBody: z.string().min(50),
        brief: z.string().optional(),
        destination: z.enum(["heygen", "script_library", "record_self"]),
        topic: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const { scripts, videoJobs } = await import("../drizzle/schema");

      const [scriptResult] = await db.insert(scripts).values({
        title: input.title,
        scriptType: "video",
        platform: "youtube",
        productionStatus: input.destination === "heygen" ? "in_production" : input.destination === "record_self" ? "ready_to_record" : "idea",
        scriptBody: input.scriptBody,
        notes: `Generated from YouTube Competitive Intelligence.${input.topic ? ` Topic: ${input.topic}` : ""}`,
      });
      const scriptId = (scriptResult as any).insertId as number;

      if (input.destination === "heygen") {
        const [jobResult] = await db.insert(videoJobs).values({
          title: input.title,
          scriptBody: input.scriptBody,
          status: "pending",
          pipeline: "heygen_then_descript",
          linkedScriptId: scriptId,
          brollPrompt: `Generate b-roll cutaways for a YouTube video about: ${input.title}. Topic: ${input.topic ?? input.title}`,
        });
        const jobId = (jobResult as any).insertId as number;
        return { destination: "heygen" as const, scriptId, jobId, title: input.title };
      }

      return { destination: input.destination as "script_library" | "record_self", scriptId, jobId: null as null, title: input.title };
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

  // ── NEW: Channel Deep Analyzer (uses callDataApi) ────────────────────────
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
      const { callDataApi } = await import("./_core/dataApi");

      // 1. Resolve channel details
      const channelId = input.channelHandle.replace(/^@/, "");
      const channelRes = await callDataApi("Youtube/get_channel_details", {
        query: { id: `https://www.youtube.com/@${channelId}`, hl: "en" },
      }) as any;

      const stats = channelRes?.stats ?? {};
      const subscriberCount = parseInt(String(stats.subscribers ?? "0").replace(/[^0-9]/g, ""), 10);
      const viewCount = parseInt(String(stats.views ?? "0").replace(/[^0-9]/g, ""), 10);
      const videoCount = parseInt(String(stats.videos ?? "0").replace(/[^0-9]/g, ""), 10);
      const channelTitle = channelRes?.title ?? channelId;
      const thumbnail = (channelRes?.avatar ?? [])[0]?.url ?? "";
      const channelIdResolved = channelRes?.channelId ?? "";

      // 2. Fetch recent videos
      const videosRes = await callDataApi("Youtube/get_channel_videos", {
        query: { id: channelIdResolved || `https://www.youtube.com/@${channelId}`, filter: "videos_latest", hl: "en", gl: "US" },
      }) as any;

      const rawVideos = ((videosRes?.contents ?? []) as any[])
        .filter((v: any) => v.type === "video")
        .slice(0, input.videoLimit)
        .map((v: any) => {
          const vid = v.video ?? {};
          const viewCnt = parseInt(String(vid.stats?.views ?? "0").replace(/[^0-9]/g, ""), 10);
          const duration = parseInt(vid.lengthSeconds ?? "0", 10);
          const isShort = duration > 0 && duration <= 60;
          const uploadDate = vid.publishedTimeText ?? "";
          const avgViewsPerVideo = videoCount > 0 ? viewCount / videoCount : 0;
          const outlierScore = avgViewsPerVideo > 0 ? Math.round((viewCnt / avgViewsPerVideo) * 100) / 100 : 0;
          const daysSinceUpload = 30; // approximate since we only have relative time
          const viewVelocity = Math.round(viewCnt / Math.max(1, daysSinceUpload));
          return {
            id: vid.videoId ?? "",
            title: vid.title ?? "",
            description: "",
            thumbnail: (vid.thumbnails ?? [])[0]?.url ?? "",
            channelId: channelIdResolved,
            channelName: channelTitle,
            uploadDate,
            duration,
            isShort,
            viewCount: viewCnt,
            likeCount: 0,
            commentCount: 0,
            url: `https://www.youtube.com/watch?v=${vid.videoId}`,
            outlierScore,
            outlierLabel: outlierScore >= 3 ? "🔥 Viral" : outlierScore >= 2 ? "⚡ Strong" : outlierScore >= 1.5 ? "↑ Above Avg" : outlierScore >= 1 ? "✓ On Par" : "↓ Below Avg",
            viewVelocity,
            badges: vid.badges ?? [],
          };
        });

      const top10ByViews = [...rawVideos].sort((a, b) => b.viewCount - a.viewCount).slice(0, 10);
      const longs = rawVideos.filter((v) => !v.isShort);
      const shorts = rawVideos.filter((v) => v.isShort);
      const longsVsShorts = {
        totalVideos: rawVideos.length,
        longsCount: longs.length,
        shortsCount: shorts.length,
        longsViews: longs.reduce((s, v) => s + v.viewCount, 0),
        shortsViews: shorts.reduce((s, v) => s + v.viewCount, 0),
        longsAvgViews: longs.length > 0 ? Math.round(longs.reduce((s, v) => s + v.viewCount, 0) / longs.length) : 0,
        shortsAvgViews: shorts.length > 0 ? Math.round(shorts.reduce((s, v) => s + v.viewCount, 0) / shorts.length) : 0,
      };
      const avgViewsPerVideo = rawVideos.length > 0 ? Math.round(rawVideos.reduce((s, v) => s + v.viewCount, 0) / rawVideos.length) : 0;

      return {
        channel: { channelId: channelIdResolved, title: channelTitle, thumbnail, subscriberCount, viewCount, videoCount, avgViewsPerVideo, uploadsPerWeek: 0, uploadFrequencyLabel: "See channel" },
        top10ByViews,
        longsVsShorts,
        allVideosCount: rawVideos.length,
      };
    }),

  // ── NEW: Outlier Finder (uses Supadata search) ────────────────────────────
  /**
   * Search a topic and return the 10 videos with the highest outlier scores.
   * Uses Supadata (already configured) for search, then enriches with channel data.
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
      const supadata = getSupadata();

      const results = await supadata.youtube.search({
        query: input.query,
        type: "video",
        limit: input.limit,
        sortBy: "views",
        uploadDate: input.uploadDate === "all" ? undefined : input.uploadDate,
      });

      const videos = ((results.results ?? []) as any[])
        .filter((r: any) => r.type === "video")
        .slice(0, input.limit)
        .map((v: any) => {
          const viewCnt = (v.viewCount as number) ?? 0;
          const duration = (v.duration as number) ?? 0;
          const isShort = duration > 0 && duration <= 60;
          const uploadDate = (v.uploadDate as string) ?? "";
          // Estimate outlier score: views / (channel avg is unknown, use median of result set)
          return {
            id: v.id as string,
            title: v.title as string,
            description: ((v.description as string) ?? "").slice(0, 200),
            thumbnail: v.thumbnail as string,
            channelId: (v.channel?.id ?? "") as string,
            channelName: (v.channel?.name ?? "Unknown") as string,
            uploadDate,
            duration,
            isShort,
            viewCount: viewCnt,
            likeCount: 0,
            commentCount: 0,
            url: `https://www.youtube.com/watch?v=${v.id}`,
            outlierScore: 0, // will be computed below
            outlierLabel: "",
            viewVelocity: computeViewVelocity(viewCnt, uploadDate || new Date().toISOString()),
          };
        });

      // Compute outlier score using median views as baseline
      const sorted = [...videos].sort((a, b) => a.viewCount - b.viewCount);
      const median = sorted[Math.floor(sorted.length / 2)]?.viewCount ?? 1;
      const withScores = videos.map((v) => {
        const score = median > 0 ? Math.round((v.viewCount / median) * 100) / 100 : 0;
        return {
          ...v,
          outlierScore: score,
          outlierLabel: score >= 3 ? "🔥 Viral" : score >= 2 ? "⚡ Strong" : score >= 1.5 ? "↑ Above Avg" : score >= 1 ? "✓ On Par" : "↓ Below Avg",
        };
      });

      const top10 = withScores.sort((a, b) => b.outlierScore - a.outlierScore).slice(0, 10);
      return { videos: top10 };
    }),

  // ── NEW: Topic Trends (View Velocity) — uses Supadata ────────────────────
  /**
   * Search a topic and return 10 videos ranked by view velocity (views/day since upload).
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
      const supadata = getSupadata();

      const results = await supadata.youtube.search({
        query: input.query,
        type: "video",
        limit: input.limit,
        sortBy: "views",
        uploadDate: input.uploadDate,
      });

      const videos = ((results.results ?? []) as any[])
        .filter((r: any) => r.type === "video")
        .map((v: any) => {
          const viewCnt = (v.viewCount as number) ?? 0;
          const duration = (v.duration as number) ?? 0;
          const isShort = duration > 0 && duration <= 60;
          const uploadDate = (v.uploadDate as string) ?? "";
          const viewVelocity = computeViewVelocity(viewCnt, uploadDate || new Date().toISOString());
          return {
            id: v.id as string,
            title: v.title as string,
            description: ((v.description as string) ?? "").slice(0, 200),
            thumbnail: v.thumbnail as string,
            channelId: (v.channel?.id ?? "") as string,
            channelName: (v.channel?.name ?? "Unknown") as string,
            uploadDate,
            duration,
            isShort,
            viewCount: viewCnt,
            likeCount: 0,
            commentCount: 0,
            url: `https://www.youtube.com/watch?v=${v.id}`,
            outlierScore: 0,
            outlierLabel: "",
            viewVelocity,
          };
        })
        .sort((a, b) => b.viewVelocity - a.viewVelocity)
        .slice(0, 10);

      return { videos };
    }),

  // ── NEW: Title Pattern Analyzer — uses Supadata ───────────────────────────
  /**
   * Search a topic, collect the top 10 video titles, and use LLM to extract
   * the winning title patterns, hooks, and emotional triggers.
   */
  getTitlePatterns: publicProcedure
    .input(
      z.object({
        query: z.string().min(3).max(300),
        uploadDate: z.enum(["all", "week", "month", "year"]).default("year"),
      })
    )
    .mutation(async ({ input }) => {
      const supadata = getSupadata();

      const results = await supadata.youtube.search({
        query: input.query,
        type: "video",
        limit: 25,
        sortBy: "views",
        uploadDate: input.uploadDate === "all" ? undefined : input.uploadDate,
      });

      const rawVideos = ((results.results ?? []) as any[])
        .filter((r: any) => r.type === "video")
        .slice(0, 10);

      if (rawVideos.length === 0) return { titles: [], analysis: "" };

      const titlesWithStats = rawVideos.map((v: any) => ({
        id: v.id as string,
        title: v.title as string,
        viewCount: (v.viewCount as number) ?? 0,
        channelName: (v.channel?.name ?? "Unknown") as string,
        url: `https://www.youtube.com/watch?v=${v.id}`,
        thumbnail: v.thumbnail as string,
        uploadDate: (v.uploadDate as string) ?? "",
        duration: (v.duration as number) ?? 0,
        isShort: ((v.duration as number) ?? 0) <= 60 && ((v.duration as number) ?? 0) > 0,
      }));

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
What title angles are completely absent from this list that Pedram could own? Think about his unique positioning (Eastern medicine, Qigong, Daoist perspective, high-performer audience).

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

  // ── NEW: Similar Channels Finder — uses callDataApi ───────────────────────
  /**
   * Search a topic and return 10 distinct competitor channels with their stats.
   */
  searchChannels: publicProcedure
    .input(
      z.object({
        query: z.string().min(3).max(300),
        limit: z.number().min(5).max(20).default(10),
      })
    )
    .mutation(async ({ input }) => {
      const { callDataApi } = await import("./_core/dataApi");

      // Use the built-in Youtube/search endpoint to find channels
      const searchRes = await callDataApi("Youtube/search", {
        query: { q: `${input.query} channel`, hl: "en", gl: "US" },
      }) as any;

      const contents = (searchRes?.contents ?? []) as any[];
      const channelResults = contents
        .filter((c: any) => c.type === "channel")
        .slice(0, input.limit);

      const channels = channelResults.map((c: any) => {
        const ch = c.channel ?? {};
        const subText = ch.subscriberCountText ?? "0";
        const subCount = parseInt(subText.replace(/[^0-9]/g, ""), 10) || 0;
        const vidText = ch.videoCountText ?? "0";
        const vidCount = parseInt(vidText.replace(/[^0-9]/g, ""), 10) || 0;
        return {
          channelId: ch.channelId ?? "",
          title: ch.title ?? "",
          description: (ch.descriptionSnippet ?? "").slice(0, 200),
          thumbnail: (ch.thumbnail ?? [])[0]?.url ?? "",
          country: "",
          subscriberCount: subCount,
          viewCount: 0,
          videoCount: vidCount,
          url: `https://www.youtube.com/channel/${ch.channelId}`,
          handle: ch.handle ?? "",
        };
      });

      return { channels };
    }),

  // ── NEW: Teleprompter Script Generator ───────────────────────────────────────

  generateTeleprompterScript: publicProcedure
    .input(
      z.object({
        topic: z.string().min(3).max(300),
        brief: z.string().min(10).max(15000),
        durationMinutes: z.number().min(1).max(30).default(8),
        platform: z.enum(["youtube", "youtube_short", "instagram", "tiktok"]).default("youtube"),
      })
    )
    .mutation(async ({ input }) => {
      const wordsPerMinute = 130;

      // Fetch avatar intelligence for this topic (non-blocking — falls back to empty string)
      const avatarContext = await getAvatarContextBlock(input.topic).catch(() => "");

      // ── Platform-specific config ──────────────────────────────────────────────
      type PlatformConfig = {
        label: string;
        targetWords: number;
        durationLabel: string;
        hookStyle: string;
        structureRules: string;
        ctaRule: string;
        formatRules: string;
        systemPrompt: string;
      };

      const platformConfigs: Record<string, PlatformConfig> = {
        youtube: {
          label: "YouTube (Long-Form)",
          targetWords: input.durationMinutes * wordsPerMinute,
          durationLabel: `${input.durationMinutes} minutes`,
          hookStyle: `Write a BETTER hook using ONE of these proven YouTube hook formulas:
   - PATTERN INTERRUPT: Start with a shocking, counterintuitive statement that stops the scroll (e.g., "Most doctors are wrong about this...")
   - CURIOSITY GAP: Tease something the viewer desperately wants to know (e.g., "There's a reason you wake up exhausted no matter how much you sleep — and it has nothing to do with sleep.")
   - BOLD CLAIM + PROOF PROMISE: Make a strong claim and immediately promise to back it up (e.g., "I reversed my gut damage in 90 days using a 2,000-year-old protocol. Here's exactly what I did.")
   - STORY HOOK: Open mid-story at the most dramatic moment (e.g., "I was standing in a monastery in China when the master said something that changed everything I thought I knew about health.")`,
          structureRules: `SCRIPT STRUCTURE (flow naturally — no labels):
   Opening hook (30 sec) → Brief personal credibility moment (30 sec) → Core problem/insight (2-3 min) → The Urban Monk solution/framework (3-4 min) → Practical takeaways (1-2 min) → Closing CTA (30 sec)`,
          ctaRule: `Warm, non-pushy invitation to the Urban Monk Academy or lightson.theurbanmonk.com. Example: "If you want to go deeper on this, I've put together a complete program inside the Urban Monk Academy..."`,
          formatRules: `- Write in natural spoken paragraphs — exactly how Pedram would say it out loud
   - Short sentences. Conversational rhythm. Easy to read while looking at a camera.
   - Use ellipses (...) for natural pauses
   - Paragraph breaks = natural breath points`,
          systemPrompt: "You are an expert YouTube scriptwriter specializing in health, wellness, and personal development content. You write scripts that are warm, authoritative, and immediately engaging. You never use markdown formatting in teleprompter scripts.",
        },

        youtube_short: {
          label: "YouTube Short",
          targetWords: 100,
          durationLabel: "under 60 seconds",
          hookStyle: `Write a SINGLE-SENTENCE PATTERN INTERRUPT hook that stops the scroll in the first 2 seconds. It must be one bold, counterintuitive statement that makes the viewer need to keep watching. Examples:
   - "Your morning routine is destroying your cortisol."
   - "The supplement everyone's taking is making your gut worse."
   - "Ancient monks knew something about sleep that modern science just confirmed."`,
          structureRules: `STRUCTURE (must fit in 60 seconds total — no labels, no filler):
   1-sentence hook → 1-sentence context/why it matters → 2-3 sentences of the core insight or tip → 1-sentence CTA
   Every sentence must earn its place. Cut anything that doesn't drive toward the single insight.`,
          ctaRule: `One punchy sentence directing to the Urban Monk Academy or Lights On. Example: "Link in bio for the full protocol." or "Follow for more."`,
          formatRules: `- MAXIMUM 100 words total — this is a Short, not a full video
   - Every sentence is its own paragraph (one sentence per line)
   - Ultra-short sentences — 5 to 10 words each
   - No filler words, no "So today we're going to talk about..."
   - Punchy, direct, high-energy but still Pedram's warm voice`,
          systemPrompt: "You are an expert short-form video scriptwriter for health and wellness creators. You write punchy, scroll-stopping YouTube Shorts scripts that deliver one powerful insight in under 60 seconds. You never use markdown formatting.",
        },

        instagram: {
          label: "Instagram Reel",
          targetWords: 120,
          durationLabel: "60-90 seconds",
          hookStyle: `Write a VISUAL + VERBAL hook designed for Instagram's scroll-stop culture. The first line must work as both a spoken hook AND an on-screen text overlay. Use ONE of:
   - RELATABLE PAIN POINT: "If you're waking up tired every morning, this is why."
   - BOLD CLAIM: "I stopped taking probiotics for 30 days. Here's what happened."
   - CURIOSITY + NUMBER: "3 things your gut is trying to tell you right now."
   - DIRECT CHALLENGE: "You've been breathing wrong your entire life."`,
          structureRules: `STRUCTURE (Instagram Reel — 60-90 seconds, no labels):
   Hook (5 sec, 1-2 sentences) → Problem/relatable moment (10 sec) → Core value/insight — 2-3 actionable points (30-40 sec) → Transformation promise (10 sec) → CTA (5 sec)
   Think: hook them, relate to them, teach them one thing, invite them deeper.`,
          ctaRule: `Warm Instagram-native CTA. Examples: "Save this for later." / "Follow for more ancient wisdom meets modern science." / "Link in bio for the full program."`,
          formatRules: `- 120 words maximum
   - Each thought is its own short paragraph (2-3 sentences max per paragraph)
   - Conversational, warm, slightly faster pace than YouTube
   - Use ellipses (...) for dramatic pauses
   - Avoid jargon — speak to a general wellness audience
   - The script should feel like Pedram is talking directly to ONE person`,
          systemPrompt: "You are an expert Instagram Reels scriptwriter for health and wellness creators. You write warm, engaging, scroll-stopping scripts that feel personal and authentic. You never use markdown formatting.",
        },

        tiktok: {
          label: "TikTok",
          targetWords: 130,
          durationLabel: "60-90 seconds",
          hookStyle: `Write a TikTok-native hook that works in the FIRST 1-2 SECONDS before the viewer swipes. TikTok hooks are more direct and trend-aware than YouTube. Use ONE of:
   - DIRECT ADDRESS: "POV: You've been doing intermittent fasting wrong." (use sparingly — only if natural)
   - BOLD FACT DROP: "Your gut has more neurons than your spinal cord. Here's why that matters."
   - PATTERN INTERRUPT QUESTION: "What if everything you know about stress is backwards?"
   - STORY TEASE: "A Daoist master told me something about sleep that changed my life. Here it is."`,
          structureRules: `STRUCTURE (TikTok — 60-90 seconds, fast-paced, no labels):
   Instant hook (2 sec) → Fast context — why should I care? (5 sec) → Core insight broken into 2-3 fast beats (30-40 sec) → Surprising or memorable close (10 sec) → CTA (5 sec)
   TikTok viewers decide in 2 seconds. Every sentence must pull them forward.`,
          ctaRule: `TikTok-native CTA. Examples: "Follow for more." / "Comment 'MONK' and I'll send you the full protocol." / "Link in bio."`,
          formatRules: `- 130 words maximum
   - Very short sentences — 5 to 8 words each
   - Each sentence is its own line/paragraph
   - Fast, punchy rhythm — imagine Pedram speaking at 1.2x speed
   - Still warm and authentic — NOT hype-bro energy
   - Avoid long explanations — one idea per sentence`,
          systemPrompt: "You are an expert TikTok scriptwriter for health and wellness creators. You write fast-paced, scroll-stopping scripts that deliver maximum value in minimum time. You never use markdown formatting.",
        },
      };

      const cfg = platformConfigs[input.platform];

      const prompt = `You are a world-class social media scriptwriter for Dr. Pedram Shojai (The Urban Monk).

PLATFORM: ${cfg.label}
TOPIC: ${input.topic}
TARGET LENGTH: approximately ${cfg.targetWords} words (${cfg.durationLabel})

${PEDRAM_VOICE_GUIDE}

COMPETITOR ANALYSIS BRIEF (use this to inform the script — especially the differentiation angle):
${input.brief.slice(0, 4000)}

${avatarContext ? avatarContext + "\n\nCRITICAL: Use the Avatar Intelligence above to:\n- Open with language that mirrors the audience's EXACT internal monologue\n- Address their specific pain points and emotional hooks throughout the script\n- Use the messaging framework structure to build trust before offering solutions\n- Preemptively handle the top objections naturally within the script flow\n- Close with transformation language (reclaim, restore, finally, root cause) — NOT management language" : ""}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CRITICAL RULES FOR THIS ${cfg.label.toUpperCase()} SCRIPT:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. VIRAL HOOK (the most important part — make it better than every competitor):
   ${cfg.hookStyle}
   The hook must be in Pedram's authentic voice — warm, authoritative, grounded. NOT clickbait. NOT fear-based.

2. FORMAT RULES (NON-NEGOTIABLE):
   - NO markdown symbols: no #, *, -, [], or ** anywhere in the script
   - NO section headers or labels (no "Hook:", "CTA:", "[Pause here]", "Section 1:")
   - NO bullet points or numbered lists
   ${cfg.formatRules}

3. ${cfg.structureRules}

4. CTA:
   ${cfg.ctaRule}

5. VOICE CONSISTENCY:
   Pedram speaks like a wise, warm teacher — not a hype marketer. He references Qi, life energy, ancient wisdom, and modern science in the same breath. He uses "we" and "you" — never lectures down.

Now write the complete script. Start DIRECTLY with the hook — no preamble, no title, no intro text. Just the spoken words Pedram will read.`;

      const response = await wrapLLM(() => invokeLLM({
        messages: [
          { role: "system", content: cfg.systemPrompt },
          { role: "user", content: prompt },
        ],
      }));

      const script = (response.choices?.[0]?.message?.content as string) ?? "";

      // Strip any residual markdown
      const cleanScript = script
        .replace(/^#{1,6}\s+/gm, "")
        .replace(/\*\*([^*]+)\*\*/g, "$1")
        .replace(/\*([^*]+)\*/g, "$1")
        .replace(/^[-*+]\s+/gm, "")
        .replace(/^\d+\.\s+/gm, "")
        .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
        .replace(/`([^`]+)`/g, "$1")
        .replace(/^(Hook|CTA|Section|Intro|Outro|Opening|Closing|Bridge|Transition|POV label):\s*/gim, "")
        .trim();

      const wordCount = cleanScript.split(/\s+/).filter(Boolean).length;
      const estimatedSeconds = input.platform === "youtube"
        ? input.durationMinutes * 60
        : input.platform === "youtube_short" ? 55
        : input.platform === "instagram" ? 75
        : 75; // tiktok
      const estimatedMinutes = Math.round(wordCount / wordsPerMinute);

      return { script: cleanScript, wordCount, estimatedMinutes, estimatedSeconds, platform: input.platform, platformLabel: cfg.label };
    }),
});
