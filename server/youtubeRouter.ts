import { Supadata } from "@supadata/js";
import { z } from "zod";
import { invokeLLM } from "./_core/llm";
import { wrapLLM } from "./llmUtils";
import { publicProcedure, router } from "./_core/trpc";
import { getDb } from "./db";

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

export const youtubeRouter = router({
  // Step 1: Search for competitor videos by idea/topic
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
        features: ["subtitles"], // prefer videos with existing captions
      });

      const videos = (results.results ?? [])
        .filter((r: any) => r.type === "video")
        .slice(0, input.limit)
        .map((v: any) => ({
          id: v.id as string,
          title: v.title as string,
          description: ((v.description as string) ?? "").slice(0, 300),
          thumbnail: v.thumbnail as string,
          duration: v.duration as number, // seconds
          viewCount: v.viewCount as number,
          uploadDate: v.uploadDate as string,
          channelName: (v.channel?.name ?? "Unknown") as string,
          channelId: (v.channel?.id ?? "") as string,
          url: `https://www.youtube.com/watch?v=${v.id}`,
        }));

      return { videos };
    }),

  // Step 2: Fetch transcripts for selected video IDs
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
            mode: "native", // only use existing captions — no AI generation cost
          });

          // Handle async job (202 response for long videos)
          if ("jobId" in result) {
            // Poll for up to 30 seconds
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

  // Step 3: LLM analysis — differentiation brief
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

  // Summarize a single video transcript into a 5-bullet outline
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

  // Save differentiation brief as a Script Library entry
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

  // ── Competitor Channel Watchlist ───────────────────────────────────────────────────────────────────────────

  // Track a competitor channel
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

  // List all tracked competitor channels
  listTrackedChannels: publicProcedure.query(async () => {
    const db = await getDb();
    if (!db) return { channels: [] };
    const { competitorChannels } = await import("../drizzle/schema");
    const channels = await db.select().from(competitorChannels).orderBy(competitorChannels.trackedAt);
    return { channels };
  }),

  // Untrack a competitor channel
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

  // Get latest uploads from a tracked channel
  getChannelNewUploads: publicProcedure
    .input(
      z.object({
        channelId: z.string(),
        limit: z.number().min(1).max(20).default(5),
      })
    )
    .mutation(async ({ input }) => {
      const supadata = getSupadata();
      // Search for recent videos from this channel
      const results = await supadata.youtube.search({
        query: `channel:${input.channelId}`,
        type: "video",
        limit: input.limit,
        sortBy: "date",
        uploadDate: "month",
      });
      // Update lastCheckedAt
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

  // Run weekly digest for all tracked channels (manual trigger)
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

  // Validate API key is working
  validateApiKey: publicProcedure.query(async () => {
    try {
      const supadata = getSupadata();
      // Lightweight test: search for one video
      await supadata.youtube.search({ query: "health wellness", type: "video", limit: 1 });
      return { valid: true };
    } catch (err: any) {
      return { valid: false, error: err?.message ?? "Unknown error" };
    }
  }),
});
