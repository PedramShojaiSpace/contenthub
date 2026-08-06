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
 *
 * ── v2.2 Part 1: five verified defects fixed here ───────────────────────────
 * All five were reproduced live against mcp.vidiq.com before being changed;
 * raw probe output lives in docs/build-reports/v22r/01-fixes-proof.txt.
 *
 *  1. `result.isError` was never checked. MCP tool failures arrive as HTTP 200
 *     with `isError: true` and the reason in plain English at content[0].text —
 *     no JSON-RPC `error` member. Every guard passed and the reason was fed to
 *     JSON.parse, which threw SyntaxError. This is why every VidIQ failure
 *     surfaced as the same meaningless message regardless of cause.
 *  2. Structured data lives in `result.structuredContent`. For several tools
 *     content[0].text is markdown prose, so JSON.parse threw ON SUCCESS —
 *     the actual root cause of "Supercharge failed", not low credits.
 *  3. vidiq_outliers was sent contentType:"video"; live enum is all|long|short.
 *  4. vidiq_trending_videos was sent videoFormat:"video"; live enum is long|short.
 *  5. vidiqBalance read `.credits`, which does not exist in the live payload.
 *
 * A SIXTH defect (fix 9 in the build report) was found while proving the above:
 * the video interfaces used `title`/`publishedAt`/`outlierScore`, but the wire
 * shape is `videoTitle`/`videoPublishedAt`/`breakoutScore`. See the block above
 * VidIQOutlierVideo. It was invisible to both tsc and the unit tests, and only
 * surfaced because the live proof printed every title as `undefined`.
 */

import { ENV } from "./_core/env";

const VIDIQ_MCP_URL = "https://mcp.vidiq.com/mcp";

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * Live `contentType` enum for vidiq_outliers, read from the tool's own schema
 * via tools/list. Sending anything else fails validation with MCP -32602.
 */
export type VidIQContentType = "all" | "long" | "short";

/**
 * Live `videoFormat` enum for vidiq_trending_videos. Note it does NOT include
 * "all" — it is a strictly narrower enum than vidiq_outliers' contentType.
 */
export type VidIQVideoFormat = "long" | "short";

/**
 * A tool-level failure: HTTP 200, no JSON-RPC error, `result.isError === true`,
 * and the human-readable reason in content[0].text.
 *
 * `rawMessage` carries that text verbatim. It is the only place the real reason
 * exists — discarding it is what made these failures undiagnosable for months.
 */
export class VidIQToolError extends Error {
  readonly kind = "tool_error" as const;
  readonly tool: string;
  readonly rawMessage: string;

  constructor(tool: string, rawMessage: string) {
    super(`vidIQ tool "${tool}" failed: ${rawMessage}`);
    this.name = "VidIQToolError";
    this.tool = tool;
    this.rawMessage = rawMessage;
  }
}

export function isVidIQToolError(err: unknown): err is VidIQToolError {
  return err instanceof VidIQToolError;
}

/**
 * Live shape of vidiq_balance, verified 2026-08-01. There is no `credits` key
 * at any level; the spendable figure is `totalCredits`.
 */
export interface VidIQBalance {
  type: string;
  totalCredits: number;
  renewableCredits: number;
  maxRenewableCredits: number;
  renewableResetsAt: string | null;
  addOnCredits: number;
  maxAddOnCredits: number;
}

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

/**
 * ── v2.2 Part 1 fix 9 — field-name mismatch (NOT in the original defect list) ──
 *
 * Found by the live probe, not by the unit tests: those used hand-written
 * fixtures and so agreed with the wrong assumption. The declared interfaces used
 * `title` / `publishedAt` / `outlierScore`, but the live payload uses
 * `videoTitle` / `videoPublishedAt` / `breakoutScore` — and has no `outlierScore`
 * at any level. Because `callVidIQTool` casts its result to the declared generic,
 * TypeScript could not catch it: every consumer silently read `undefined`, and
 * the proof run printed `"undefined"` for all five video titles.
 *
 * Raw payloads captured 2026-08-01 (reproduce with
 * `node docs/build-reports/v22r/probe_vidiq_fields.mjs`):
 *
 *   vidiq_outliers        videos[0] keys: videoId, videoTitle, videoTags,
 *     videoTopics, videoThumbnail, videoPublishedAt, videoDuration, channelId,
 *     channelTitle, channelThumbnail, channelCountry, subscriberCount,
 *     mainCategory, viewCount, breakoutScore, videoType, engagementRate, vph,
 *     score, trendCategories
 *   vidiq_trending_videos videos[0] keys: videoId, videoTitle,
 *     videoTitleLanguage, videoPublishedAt, videoDuration, channelId,
 *     channelTitle, channelCountry, subscriberCount, viewCount, likeCount,
 *     commentCount, engagementRate, vph, videoTags
 *
 * The two tools also disagree on the TYPE of `videoPublishedAt`: outliers
 * returns unix seconds (1774063697), trending returns ISO 8601
 * ("2026-07-28T14:52:05.000Z"). Both are normalised to ISO here so no downstream
 * caller has to branch on which tool produced a row.
 *
 * `channelId` and `subscriberCount` ARE present in the live payload, contrary to
 * the note at the deep-research call site that stored them as null.
 */
interface RawVidIQVideo {
  videoId?: string;
  videoTitle?: string;
  videoThumbnail?: string;
  videoPublishedAt?: number | string;
  videoDuration?: number;
  channelId?: string;
  channelTitle?: string;
  subscriberCount?: number;
  viewCount?: number;
  likeCount?: number;
  commentCount?: number;
  engagementRate?: number;
  vph?: number;
  /** Outliers only. This — not `outlierScore` — is vidIQ's breakout metric. */
  breakoutScore?: number;
  /** Outliers only. An internal 0..1 relevance score, not a view multiplier. */
  score?: number;
  videoType?: string;
  mainCategory?: string;
  videoTopics?: string[] | null;
}

/** Normalise either tool's `videoPublishedAt` to an ISO string, or null. */
function normalizePublishedAt(value: number | string | undefined): string | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    // Unix seconds (outliers); guard in case a millisecond value ever appears.
    const ms = value > 1e11 ? value : value * 1000;
    const d = new Date(ms);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  }
  if (typeof value === "string" && value.trim() !== "") {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  }
  return null;
}

export interface VidIQOutlierVideo {
  videoId: string;
  title: string;
  channelId: string | null;
  channelTitle: string;
  viewCount: number;
  subscriberCount: number | null;
  /**
   * vidIQ's `breakoutScore`: how far this video over-performed its channel
   * baseline. Kept under the app's existing name to match `yt_video_outliers`.
   * NOT a view multiplier — do not render it as "Nx" without checking scale.
   */
  outlierScore: number;
  engagementRate: number | null;
  vph: number | null;
  durationSec: number | null;
  publishedAt: string | null;
  thumbnail?: string;
}

export interface VidIQTrendingVideo {
  videoId: string;
  title: string;
  channelId: string | null;
  channelTitle: string;
  viewCount: number;
  subscriberCount: number | null;
  vph: number; // views per hour
  engagementRate: number | null;
  durationSec: number | null;
  publishedAt: string | null;
  thumbnail?: string;
}

function mapOutlier(v: RawVidIQVideo): VidIQOutlierVideo {
  return {
    videoId: String(v.videoId ?? ""),
    title: String(v.videoTitle ?? "Untitled"),
    channelId: v.channelId ? String(v.channelId) : null,
    channelTitle: String(v.channelTitle ?? "Unknown channel"),
    viewCount: Number(v.viewCount ?? 0),
    subscriberCount: typeof v.subscriberCount === "number" ? v.subscriberCount : null,
    outlierScore: Number(v.breakoutScore ?? 0),
    engagementRate: typeof v.engagementRate === "number" ? v.engagementRate : null,
    vph: typeof v.vph === "number" ? v.vph : null,
    durationSec: typeof v.videoDuration === "number" ? v.videoDuration : null,
    publishedAt: normalizePublishedAt(v.videoPublishedAt),
    thumbnail: v.videoThumbnail ? String(v.videoThumbnail) : undefined,
  };
}

function mapTrending(v: RawVidIQVideo): VidIQTrendingVideo {
  return {
    videoId: String(v.videoId ?? ""),
    title: String(v.videoTitle ?? "Untitled"),
    channelId: v.channelId ? String(v.channelId) : null,
    channelTitle: String(v.channelTitle ?? "Unknown channel"),
    viewCount: Number(v.viewCount ?? 0),
    subscriberCount: typeof v.subscriberCount === "number" ? v.subscriberCount : null,
    vph: Number(v.vph ?? 0),
    engagementRate: typeof v.engagementRate === "number" ? v.engagementRate : null,
    durationSec: typeof v.videoDuration === "number" ? v.videoDuration : null,
    publishedAt: normalizePublishedAt(v.videoPublishedAt),
    thumbnail: v.videoThumbnail ? String(v.videoThumbnail) : undefined,
  };
}

// ─── Core MCP caller ──────────────────────────────────────────────────────────

let _sessionId = 0;

/**
 * Per-call ceiling for a single vidIQ MCP request (v2.1 Bug C item 1).
 *
 * `fetch` has no default timeout, so a stalled MCP connection previously hung
 * for as long as the caller was willing to wait — observed in production as a
 * "Supercharge with VidIQ" click that spun for 7–8 minutes and never resolved.
 * 20s is generous for this API (typical response is well under 2s) while still
 * failing fast enough that a batch of six ideas cannot outlive a user's patience.
 */
export const VIDIQ_CALL_TIMEOUT_MS = 20_000;

async function callVidIQTool<T = unknown>(
  toolName: string,
  args: Record<string, unknown>,
  timeoutMs: number = VIDIQ_CALL_TIMEOUT_MS
): Promise<T> {
  const apiKey = ENV.vidiqApiKey;
  if (!apiKey) throw new Error("VIDIQ_API_KEY is not configured");

  const id = ++_sessionId;

  // AbortController is what actually severs a stalled socket; clearing the timer
  // in `finally` keeps a fast response from leaving a dangling handle behind.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let resp: Response;
  try {
    resp = await fetch(VIDIQ_MCP_URL, {
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
      signal: controller.signal,
    });
  } catch (err) {
    // Surface the timeout as a named, actionable error rather than a bare
    // "AbortError" that tells the operator nothing.
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error(`vidIQ MCP timeout after ${timeoutMs}ms (tool: ${toolName})`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }

  if (!resp.ok) {
    throw new Error(`vidIQ MCP HTTP ${resp.status}`);
  }

  const text = await resp.text();
  // vidIQ returns SSE format: "event: message\ndata: {...}"
  const dataLine = text.split("\n").find((l) => l.startsWith("data:"));
  if (!dataLine) throw new Error(`vidIQ MCP unexpected response: ${text.slice(0, 200)}`);

  const parsed = JSON.parse(dataLine.slice(5));
  if (parsed.error) throw new Error(`vidIQ MCP error: ${parsed.error.message}`);

  const result = parsed.result;

  // ── Fix 1: tool-level failure detection ────────────────────────────────────
  // A failed tool call is HTTP 200 with no JSON-RPC error member, so this is
  // the ONLY place the failure is observable. Check it before touching content.
  if (result?.isError === true) {
    const rawMessage =
      firstText(result) ?? "vidIQ reported an error with no message body";
    throw new VidIQToolError(toolName, rawMessage);
  }

  // ── Fix 2: prefer structuredContent ───────────────────────────────────────
  // Contract, in order:
  //   1. `structuredContent` when present — the machine-readable payload.
  //   2. else JSON.parse(content[0].text) when it happens to be valid JSON
  //      (vidiq_balance is one such tool).
  //   3. else return `{ _text }` and let the caller decide. Returning the prose
  //      is strictly better than throwing: a caller that only needs a summary
  //      can use it, and one that needs fields fails on a missing field with a
  //      clear message instead of an opaque SyntaxError.
  if (result?.structuredContent !== undefined && result.structuredContent !== null) {
    return result.structuredContent as T;
  }

  const raw = firstText(result);
  if (raw == null) {
    throw new Error(`vidIQ MCP: empty result (tool: ${toolName})`);
  }

  try {
    return JSON.parse(raw) as T;
  } catch {
    return { _text: raw } as unknown as T;
  }
}

/** Extract the first text block from an MCP result's content array, if any. */
function firstText(result: unknown): string | null {
  if (typeof result !== "object" || result === null) return null;
  const content = (result as { content?: unknown }).content;
  if (!Array.isArray(content)) return null;
  for (const block of content) {
    const t = (block as { text?: unknown } | null)?.text;
    if (typeof t === "string" && t.length > 0) return t;
  }
  return null;
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
  limit = 5,
  contentType: VidIQContentType = "long"
): Promise<VidIQOutlierVideo[]> {
  // Fix 3: was contentType:"video", which is not in the live enum
  // ["all","long","short"]. Every call failed validation with MCP -32602, and
  // because isError was unchecked (fix 1) the failure was invisible — this is
  // why Deep Research had never once completed. Default "long": full-length
  // videos are what a 10–20 minute script should learn structure from.
  //
  // Fix 9: map the wire shape explicitly. Returning `raw.videos` directly is
  // what produced `undefined` titles — the payload never had a `title` key.
  const raw = await callVidIQTool<{ videos?: RawVidIQVideo[] }>(
    "vidiq_outliers",
    { keyword, limit, contentType }
  );
  return (raw.videos ?? []).filter((v) => v?.videoId).map(mapOutlier);
}

/**
 * Find currently trending videos for a keyword/niche.
 * Cost: 5 credits per call.
 */
export async function vidiqTrendingVideos(
  titleQuery: string,
  limit = 5,
  videoFormat: VidIQVideoFormat = "long"
): Promise<VidIQTrendingVideo[]> {
  // Fix 4: was videoFormat:"video"; live enum is ["long","short"] only. The
  // fallback path was broken by the same defect class as the primary path, so
  // there was no rescue when outliers failed.
  // Fix 9 applies here too — same `videoTitle` vs `title` mismatch.
  const raw = await callVidIQTool<{ videos?: RawVidIQVideo[] }>(
    "vidiq_trending_videos",
    { videoFormat, titleQuery, limit }
  );
  return (raw.videos ?? []).filter((v) => v?.videoId).map(mapTrending);
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
export async function vidiqBalance(): Promise<VidIQBalance> {
  // Fix 5: the declared return type was `{ credits: number }`, but no `credits`
  // key exists in the live payload. Every pre-flight check read `undefined`, so
  // `undefined < needed` was always false and a doomed batch fired every call
  // instead of stopping at the first. Callers must read `totalCredits`.
  return callVidIQTool<VidIQBalance>("vidiq_balance", {});
}

/**
 * Spendable credit total, or null when the balance call returns an unusable
 * shape. Callers should prefer this over reaching into the payload themselves,
 * so a future field rename breaks in exactly one place.
 */
export function spendableCredits(balance: VidIQBalance | null | undefined): number | null {
  const n = balance?.totalCredits;
  return typeof n === "number" && Number.isFinite(n) ? n : null;
}
