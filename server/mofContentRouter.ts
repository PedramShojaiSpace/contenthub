/**
 * mofContentRouter.ts
 * Middle-of-Funnel Content Engine
 *
 * Pulls top-performing organic videos from Pedram's YouTube channel,
 * scores each for MOF suitability against the Interconnected funnel audience,
 * and returns ranked recommendations for $1/day retargeting ads.
 *
 * Also pulls Meta page video performance for cross-platform comparison.
 */
import { z } from "zod";
import { protectedProcedure, router } from "./_core/trpc";
import { getYTClient } from "./youtubeRouter";

// ── MOF keyword scoring ────────────────────────────────────────────────────────
const MOF_KEYWORDS: { kw: string; w: number }[] = [
  // Core funnel topics — highest weight
  { kw: "gut health", w: 5 }, { kw: "microbiome", w: 5 }, { kw: "leaky gut", w: 5 },
  { kw: "interconnected", w: 5 }, { kw: "upstream", w: 4 }, { kw: "detox", w: 4 },
  { kw: "inflammation", w: 4 }, { kw: "parasite", w: 4 }, { kw: "candida", w: 4 },
  { kw: "probiotic", w: 3 }, { kw: "gut", w: 3 }, { kw: "digest", w: 3 },
  // Secondary health topics
  { kw: "sleep", w: 3 }, { kw: "energy", w: 2 }, { kw: "healing", w: 3 },
  { kw: "immune", w: 3 }, { kw: "toxic", w: 3 }, { kw: "cleanse", w: 3 },
  { kw: "liver", w: 3 }, { kw: "hormone", w: 3 }, { kw: "thyroid", w: 3 },
  { kw: "adrenal", w: 3 }, { kw: "autoimmune", w: 3 }, { kw: "chronic", w: 2 },
  { kw: "stress", w: 2 }, { kw: "cortisol", w: 3 }, { kw: "blood sugar", w: 3 },
  { kw: "insulin", w: 3 }, { kw: "weight", w: 2 }, { kw: "fasting", w: 3 },
  // Mind-body / brand
  { kw: "meditation", w: 2 }, { kw: "qigong", w: 2 }, { kw: "taoist", w: 2 },
  { kw: "monk", w: 2 }, { kw: "urban monk", w: 3 }, { kw: "breath", w: 2 },
  { kw: "trauma", w: 2 }, { kw: "anxiety", w: 2 }, { kw: "depression", w: 2 },
  { kw: "brain", w: 2 }, { kw: "food", w: 1 }, { kw: "health", w: 1 },
  { kw: "medicine", w: 1 }, { kw: "bacteria", w: 2 }, { kw: "oral", w: 2 },
  { kw: "mouth", w: 2 }, { kw: "teeth", w: 2 }, { kw: "microbiota", w: 4 },
];

function mofTopicScore(title: string, description = ""): number {
  const text = (title + " " + description).toLowerCase();
  let score = 0;
  for (const { kw, w } of MOF_KEYWORDS) {
    if (text.includes(kw)) score += w;
  }
  return Math.min(score, 10);
}

function parseDurationSeconds(iso: string): number {
  const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!m) return 0;
  return (parseInt(m[1] ?? "0") * 3600) + (parseInt(m[2] ?? "0") * 60) + parseInt(m[3] ?? "0");
}

interface RawVideo {
  id: string;
  title: string;
  description: string;
  publishedAt: string;
  thumbnail: string;
  url: string;
  views: number;
  likes: number;
  comments: number;
  durationSecs: number;
  platform: string;
}

interface ScoredVideo extends RawVideo {
  scores: {
    topic: number;
    engagement: number;
    volume: number;
    recency: number;
    total: number;
  };
  adSetupTip: string;
  audienceNote: string;
}

function scoreVideo(v: RawVideo): ScoredVideo {
  const topicScore = mofTopicScore(v.title, v.description);
  const engRate = (v.likes + v.comments * 3) / Math.max(v.views, 1) * 1000;
  const engagementScore = Math.min(10, engRate);
  const ageMonths = (Date.now() - new Date(v.publishedAt).getTime()) / (1000 * 60 * 60 * 24 * 30);
  const recencyScore = Math.max(0, 10 - ageMonths * 0.3);
  const volumeScore = Math.min(10, Math.log10(Math.max(v.views, 1)) * 2);
  // Duration bonus: 5–20 min is ideal MOF depth
  const durationBonus = (v.durationSecs >= 300 && v.durationSecs <= 1200) ? 1 : 0;
  const total = topicScore * 0.40 + engagementScore * 0.30 + volumeScore * 0.20 + recencyScore * 0.10 + durationBonus;

  // Generate ad setup tip based on scores
  let adSetupTip = "";
  if (topicScore >= 7) {
    adSetupTip = "Strong topic match — use as primary MOF touch point. Target: Interconnected leads custom audience.";
  } else if (topicScore >= 4) {
    adSetupTip = "Good topic relevance — use as secondary touch point. Pair with a gut health hook in the ad copy.";
  } else {
    adSetupTip = "Broad health content — use for cold retargeting only. Add a gut health CTA in the caption.";
  }

  // Audience note
  let audienceNote = "";
  if (engagementScore >= 5) {
    audienceNote = "High engagement — comment section likely has warm leads. Consider pinning a comment with the Interconnected link.";
  } else if (volumeScore >= 6) {
    audienceNote = "High view volume = strong social proof. Good for building trust with cold leads.";
  } else {
    audienceNote = "Niche content — likely to resonate deeply with health-conscious segment of your audience.";
  }

  return {
    ...v,
    scores: {
      topic: parseFloat(topicScore.toFixed(1)),
      engagement: parseFloat(engagementScore.toFixed(1)),
      volume: parseFloat(volumeScore.toFixed(1)),
      recency: parseFloat(recencyScore.toFixed(1)),
      total: parseFloat(total.toFixed(1)),
    },
    adSetupTip,
    audienceNote,
  };
}

// ── Router ─────────────────────────────────────────────────────────────────────
export const mofContentRouter = router({
  /**
   * Pull and score top videos from Pedram's YouTube channel for MOF retargeting.
   */
  getTopMofVideos: protectedProcedure
    .input(z.object({
      limit: z.number().min(5).max(50).default(20),
      minTopicScore: z.number().min(0).max(10).default(0),
    }))
    .query(async ({ input }) => {
      const yt = await getYTClient();

      // Get channel info
      const chRes = await yt.channels.list({
        part: ["id", "contentDetails", "statistics", "snippet"],
        mine: true,
      });
      const channel = chRes.data.items?.[0];
      const uploadsPlaylistId = channel?.contentDetails?.relatedPlaylists?.uploads;
      const subscriberCount = parseInt(channel?.statistics?.subscriberCount ?? "0");

      if (!uploadsPlaylistId) throw new Error("Could not find uploads playlist");

      // Get last 50 videos
      const plRes = await yt.playlistItems.list({
        part: ["contentDetails"],
        playlistId: uploadsPlaylistId,
        maxResults: 50,
      });
      const videoIds = plRes.data.items
        ?.map(i => i.contentDetails?.videoId)
        .filter((id): id is string => !!id) ?? [];

      // Get full stats
      const statsRes = await yt.videos.list({
        part: ["statistics", "snippet", "contentDetails"],
        id: videoIds,
      });

      const rawVideos: RawVideo[] = (statsRes.data.items ?? []).map(v => ({
        id: v.id ?? "",
        title: v.snippet?.title ?? "",
        description: v.snippet?.description?.slice(0, 400) ?? "",
        publishedAt: v.snippet?.publishedAt ?? "",
        thumbnail: v.snippet?.thumbnails?.medium?.url ?? "",
        url: `https://www.youtube.com/watch?v=${v.id}`,
        views: parseInt(v.statistics?.viewCount ?? "0"),
        likes: parseInt(v.statistics?.likeCount ?? "0"),
        comments: parseInt(v.statistics?.commentCount ?? "0"),
        durationSecs: parseDurationSeconds(v.contentDetails?.duration ?? ""),
        platform: "youtube",
      }));

      // Score and rank
      const scored = rawVideos
        .map(scoreVideo)
        .filter(v => v.scores.topic >= input.minTopicScore)
        .sort((a, b) => b.scores.total - a.scores.total)
        .slice(0, input.limit);

      // Also pull Meta page videos for comparison
      let metaVideos: ScoredVideo[] = [];
      try {
        const META_TOKEN = process.env.META_AD_ACCESS_TOKEN;
        const META_PAGE_ID = process.env.META_PAGE_ID;
        const fields = "id,title,description,permalink_url,created_time,views,likes.summary(true),comments.summary(true),shares";
        const res = await fetch(
          `https://graph.facebook.com/v21.0/${META_PAGE_ID}/videos?fields=${fields}&limit=50&access_token=${META_TOKEN}`
        );
        const data = await res.json() as any;
        if (data.data) {
          metaVideos = (data.data as any[]).map(v => scoreVideo({
            id: v.id,
            title: v.title ?? "(untitled)",
            description: v.description?.slice(0, 400) ?? "",
            publishedAt: v.created_time,
            thumbnail: "",
            url: v.permalink_url ?? `https://www.facebook.com/video/${v.id}`,
            views: v.views ?? 0,
            likes: v.likes?.summary?.total_count ?? 0,
            comments: v.comments?.summary?.total_count ?? 0,
            durationSecs: 0,
            platform: "meta_video",
          }))
          .filter(v => v.scores.topic >= input.minTopicScore)
          .sort((a, b) => b.scores.total - a.scores.total)
          .slice(0, 10);
        }
      } catch {
        // Meta videos are optional
      }

      return {
        youtube: scored,
        meta: metaVideos,
        channelStats: {
          subscriberCount,
          totalVideosAnalyzed: rawVideos.length,
        },
        fetchedAt: new Date().toISOString(),
      };
    }),
});
