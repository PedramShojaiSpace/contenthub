/**
 * vidIQ MCP Client
 * Wraps the vidIQ MCP server (https://mcp.vidiq.com/mcp) for server-side use.
 * Auth: Bearer token from VIDIQ_API_KEY env var.
 *
 * Available tools (30 total, key ones used here):
 *  - vidiq_keyword_research  : volume, competition, overall score, related keywords
 *  - vidiq_outliers          : viral/breakout videos for a keyword or channel
 *  - vidiq_trending_videos   : currently trending videos by format/niche
 *  - vidiq_channel_stats     : subscriber count, views, growth for a channel
 *  - vidiq_video_stats       : historical stats for a specific video
 *  - vidiq_get_videos_by_ids : metadata + current stats for video IDs
 *  - vidiq_breakout_channels : fast-growing channels in a niche
 *  - vidiq_balance           : remaining MCP credits
 */

import { ENV } from "./_core/env";

const VIDIQ_MCP_URL = "https://mcp.vidiq.com/mcp";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface VidIQKeywordResult {
  keyword: string;
  volume: number;          // 0–100 relative score
  competition: number;     // 0–100
  overall: number;         // 0–100 opportunity score
  estimatedMonthlySearch: number;
  topMarkets: { country: string; pct: number }[];
}

export interface VidIQKeywordResearch {
  keyword: string;
  volume: number;
  competition: number;
  overall: number;
  estimatedMonthlySearch: number;
  related: VidIQKeywordResult[];
}

export interface VidIQOutlierVideo {
  videoId: string;
  title: string;
  channelTitle: string;
  viewCount: number;
  outlierScore: number;
  publishedAt: string;
  thumbnail?: string;
}

export interface VidIQTrendingVideo {
  videoId: string;
  title: string;
  channelTitle: string;
  viewCount: number;
  vph: number; // views per hour
  publishedAt: string;
  thumbnail?: string;
}

// ─── Core MCP caller ──────────────────────────────────────────────────────────

let _sessionId = 0;

async function callVidIQTool<T = unknown>(
  toolName: string,
  args: Record<string, unknown>
): Promise<T> {
  const apiKey = ENV.vidiqApiKey;
  if (!apiKey) throw new Error("VIDIQ_API_KEY is not configured");

  const id = ++_sessionId;

  const resp = await fetch(VIDIQ_MCP_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id,
      method: "tools/call",
      params: { name: toolName, arguments: args },
    }),
  });

  if (!resp.ok) {
    throw new Error(`vidIQ MCP HTTP ${resp.status}`);
  }

  const text = await resp.text();
  // vidIQ returns SSE format: "event: message\ndata: {...}"
  const dataLine = text.split("\n").find((l) => l.startsWith("data:"));
  if (!dataLine) throw new Error(`vidIQ MCP unexpected response: ${text.slice(0, 200)}`);

  const parsed = JSON.parse(dataLine.slice(5));
  if (parsed.error) throw new Error(`vidIQ MCP error: ${parsed.error.message}`);

  // Tool result is in parsed.result.content[0].text (JSON string)
  const content = parsed.result?.content;
  if (!content || !content[0]?.text) {
    throw new Error("vidIQ MCP: empty result");
  }

  return JSON.parse(content[0].text) as T;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Research a YouTube keyword: volume, competition, overall score, and related keywords.
 * Cost: 5 credits per call.
 */
export async function vidiqKeywordResearch(
  keyword: string,
  includeRelated = true
): Promise<VidIQKeywordResearch> {
  // The VidIQ MCP API returns { seedKeyword: {...}, relatedKeywords: [...] }
  // NOT a flat object — we must read from seedKeyword.
  const raw = await callVidIQTool<{
    // New structure (actual API)
    seedKeyword?: {
      keyword: string;
      volume: number;
      competition: number;
      overall: number;
      estimatedMonthlySearch: number;
      topMarkets?: { country: string; pct: number }[];
    };
    relatedKeywords?: VidIQKeywordResult[];
    // Legacy flat structure (kept for safety)
    keyword?: string;
    volume?: number;
    competition?: number;
    overall?: number;
    estimatedMonthlySearch?: number;
    related?: VidIQKeywordResult[];
  }>("vidiq_keyword_research", { keyword, includeRelated });

  // Normalise: prefer seedKeyword object, fall back to flat fields
  const seed = raw.seedKeyword ?? {
    keyword: raw.keyword ?? keyword,
    volume: raw.volume ?? 0,
    competition: raw.competition ?? 0,
    overall: raw.overall ?? 0,
    estimatedMonthlySearch: raw.estimatedMonthlySearch ?? 0,
  };

  const relatedRaw: VidIQKeywordResult[] = (
    raw.relatedKeywords ?? raw.related ?? []
  ) as VidIQKeywordResult[];

  const related = relatedRaw
    .filter((r) => r.overall != null && r.overall > 0)
    .sort((a, b) => b.overall - a.overall)
    .slice(0, 10);

  // If the seed keyword has 0 volume/overall (common for niche terms),
  // surface the best related keyword's numbers as the "effective" score
  // so the UI shows something useful instead of all zeros.
  const bestRelated = related[0];
  const effectiveVolume =
    seed.volume > 0 ? seed.volume : (bestRelated?.volume ?? 0);
  const effectiveOverall =
    seed.overall > 0 ? seed.overall : (bestRelated?.overall ?? 0);
  const effectiveSearch =
    seed.estimatedMonthlySearch > 0
      ? seed.estimatedMonthlySearch
      : (bestRelated?.estimatedMonthlySearch ?? 0);

  return {
    keyword: seed.keyword,
    volume: effectiveVolume,
    competition: seed.competition,
    overall: effectiveOverall,
    estimatedMonthlySearch: effectiveSearch,
    related,
  };
}

/**
 * Find viral/breakout videos for a keyword.
 * Cost: 5 credits per call.
 */
export async function vidiqOutliers(
  keyword: string,
  limit = 5
): Promise<VidIQOutlierVideo[]> {
  const raw = await callVidIQTool<{ videos?: VidIQOutlierVideo[] }>(
    "vidiq_outliers",
    { keyword, limit, contentType: "video" }
  );
  return raw.videos ?? [];
}

/**
 * Find currently trending videos for a keyword/niche.
 * Cost: 5 credits per call.
 */
export async function vidiqTrendingVideos(
  titleQuery: string,
  limit = 5
): Promise<VidIQTrendingVideo[]> {
  const raw = await callVidIQTool<{ videos?: VidIQTrendingVideo[] }>(
    "vidiq_trending_videos",
    { videoFormat: "video", titleQuery, limit }
  );
  return raw.videos ?? [];
}

/**
 * Get stats for a specific YouTube channel.
 * Cost: 5 credits per call.
 */
export async function vidiqChannelStats(channelId: string) {
  return callVidIQTool<{
    channelId: string;
    title: string;
    subscriberCount: number;
    viewCount: number;
    videoCount: number;
    subscriberGrowth?: number;
  }>("vidiq_channel_stats", { channelId });
}

/**
 * Get historical stats for a YouTube video.
 * Cost: 5 credits per call.
 */
export async function vidiqVideoStats(videoId: string) {
  return callVidIQTool<{
    videoId: string;
    stats: { date: string; views: number; likes: number; comments: number; vph: number }[];
  }>("vidiq_video_stats", { videoId, granularity: "day" });
}

/**
 * Get remaining MCP credits balance.
 * Cost: 0 credits.
 */
export async function vidiqBalance(): Promise<{ credits: number }> {
  return callVidIQTool<{ credits: number }>("vidiq_balance", {});
}
