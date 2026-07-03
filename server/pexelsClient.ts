/**
 * Pexels Free-Tier Video API Client
 *
 * Pexels provides a free API for searching and downloading stock footage.
 * API key is required (free to obtain at pexels.com/api) — rate limit: 200 req/hr.
 * If no API key is configured, falls back to graceful no-op (returns empty array).
 *
 * All videos returned are royalty-free and safe for commercial use.
 * Attribution: "Video provided by Pexels" (required by Pexels license).
 */

import { invokeLLM } from "./_core/llm";

const PEXELS_API_BASE = "https://api.pexels.com";

export interface PexelsVideoFile {
  id: number;
  quality: string;
  file_type: string;
  width: number;
  height: number;
  fps: number;
  link: string;
}

export interface PexelsVideo {
  id: number;
  width: number;
  height: number;
  duration: number;
  url: string;
  image: string;
  video_files: PexelsVideoFile[];
  video_pictures: Array<{ id: number; picture: string; nr: number }>;
}

export interface PexelsSearchResult {
  total_results: number;
  page: number;
  per_page: number;
  videos: PexelsVideo[];
}

export interface StockClip {
  url: string;
  duration: number;
  width: number;
  height: number;
  pexelsId: number;
  query: string;
  relevanceScore: number; // 0-110, higher = better topical match
}

function getPexelsApiKey(): string | null {
  return process.env.PEXELS_API_KEY ?? null;
}

export async function searchPexelsVideos(
  query: string,
  perPage: number = 5,
  orientation: "landscape" | "portrait" | "square" = "landscape"
): Promise<StockClip[]> {
  const apiKey = getPexelsApiKey();
  if (!apiKey) {
    console.warn("[Pexels] PEXELS_API_KEY not set — skipping stock footage search");
    return [];
  }

  const params = new URLSearchParams({
    query,
    per_page: String(Math.min(perPage, 80)),
    orientation,
    size: "medium",
  });

  const url = `${PEXELS_API_BASE}/videos/search?${params}`;

  let res: Response;
  try {
    res = await fetch(url, {
      headers: { Authorization: apiKey },
      signal: AbortSignal.timeout(15_000),
    });
  } catch (err: any) {
    console.warn(`[Pexels] Request failed for query "${query}": ${err?.message}`);
    return [];
  }

  if (!res.ok) {
    const body = await res.text();
    console.warn(`[Pexels] API error ${res.status} for query "${query}": ${body.substring(0, 200)}`);
    return [];
  }

  const data = (await res.json()) as PexelsSearchResult;

  return data.videos
    .filter(v => v.duration >= 8)
    .map(v => {
      const hdFile = v.video_files.find(f => f.quality === "hd" && f.file_type === "video/mp4");
      const sdFile = v.video_files.find(f => f.quality === "sd" && f.file_type === "video/mp4");
      const bestFile = hdFile ?? sdFile ?? v.video_files[0];
      if (!bestFile?.link) return null;
      return {
        url: bestFile.link,
        duration: v.duration,
        width: bestFile.width ?? v.width,
        height: bestFile.height ?? v.height,
        pexelsId: v.id,
        query,
        relevanceScore: 50,
      } as StockClip;
    })
    .filter((c): c is StockClip => c !== null);
}

/**
 * Run multiple Pexels searches in parallel and return deduplicated results.
 * Clips are sorted by relevance score (topical match) rather than duration.
 * Earlier queries (more specific) produce higher-scoring clips.
 */
export async function gatherStockFootage(
  queries: string[],
  clipsPerQuery: number = 5
): Promise<StockClip[]> {
  const results = await Promise.allSettled(
    queries.map(q => searchPexelsVideos(q, clipsPerQuery))
  );

  const allClips: StockClip[] = [];
  const seenIds = new Set<number>();

  results.forEach((result, queryIndex) => {
    if (result.status === "fulfilled") {
      for (const clip of result.value) {
        if (!seenIds.has(clip.pexelsId)) {
          seenIds.add(clip.pexelsId);
          // Earlier queries = more specific = higher score
          const queryScore = Math.max(100 - queryIndex * 10, 10);
          const durationBonus = Math.min(Math.floor(clip.duration / 6), 10);
          allClips.push({ ...clip, relevanceScore: queryScore + durationBonus });
        }
      }
    }
  });

  // Sort by relevance score descending — topically relevant clips first
  return allClips.sort((a, b) => b.relevanceScore - a.relevanceScore);
}

/**
 * Use LLM to extract specific, visually-concrete Pexels search queries from the script.
 * Returns 8 queries ordered from most specific (exact topic) to most general (fallback).
 * Falls back gracefully if LLM fails.
 */
export async function buildPexelsQueriesFromScript(params: {
  scriptTitle: string;
  scriptText: string;
  sceneDirections: string[];
  topic: string;
}): Promise<string[]> {
  const { scriptTitle, scriptText, sceneDirections, topic } = params;

  // Use scene directions as primary source if we have enough (already LLM-generated)
  const sceneQueries = sceneDirections
    .slice(0, 10)
    .map(dir => {
      const match = dir.match(/:\s*(.+?)(?:;|$)/);
      return match ? match[1].trim() : dir;
    })
    .filter(c => c.length > 5 && c.length < 60)
    .map(c => c.split(" ").slice(0, 5).join(" "));

  if (sceneQueries.length >= 6) {
    const titleQuery = scriptTitle
      .replace(/[^a-zA-Z0-9 ]/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .split(" ")
      .slice(0, 4)
      .join(" ");
    const allQueries = titleQuery ? [titleQuery, ...sceneQueries] : sceneQueries;
    return Array.from(new Set(allQueries)).slice(0, 8);
  }

  // Not enough scene directions — use LLM to extract visual concepts from the script
  try {
    const scriptExcerpt = scriptText.substring(0, 2000);
    const response = await invokeLLM({
      messages: [
        {
          role: "system",
          content: `You are a stock footage researcher for a health and wellness YouTube channel (The Urban Monk by Dr. Pedram Shojai). Generate specific, visually-concrete Pexels search queries for B-roll footage.

RULES:
- Each query must be 2-5 words, concrete and visual (not abstract)
- Queries must match what is ACTUALLY SPOKEN about in the script
- Order queries from most specific (exact topic) to most general (fallback)
- Avoid generic terms like "wellness", "health", "lifestyle" unless the script is actually about those
- Good examples for a gut health video: "intestinal bacteria microscope", "fermented food kimchi", "digestive system animation", "person eating healthy salad"
- Bad examples: "healthy lifestyle", "wellness nature", "science research" (too generic)`,
        },
        {
          role: "user",
          content: `Generate 8 Pexels stock footage search queries for this video.

TITLE: ${scriptTitle}
TOPIC: ${topic}
SCRIPT EXCERPT:
${scriptExcerpt}

Return JSON: { "queries": ["query1", "query2", ...] } — exactly 8 queries, most specific first.`,
        },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "pexels_queries",
          strict: true,
          schema: {
            type: "object",
            properties: { queries: { type: "array", items: { type: "string" } } },
            required: ["queries"],
            additionalProperties: false,
          },
        },
      },
    });

    const rawContent = response.choices?.[0]?.message?.content;
    const content = typeof rawContent === "string" ? rawContent : null;
    if (content) {
      const parsed = JSON.parse(content) as { queries: string[] };
      if (Array.isArray(parsed.queries) && parsed.queries.length > 0) {
        console.log(`[pexelsClient] LLM generated ${parsed.queries.length} topic-specific queries for "${scriptTitle}"`);
        return parsed.queries.slice(0, 8);
      }
    }
  } catch (err) {
    console.warn(`[pexelsClient] LLM query generation failed (non-fatal): ${err instanceof Error ? err.message : String(err)}`);
  }

  // Final fallback: title + scene directions + topic-derived terms
  const titleQuery = scriptTitle.replace(/[^a-zA-Z0-9 ]/g, " ").replace(/\s+/g, " ").trim().split(" ").slice(0, 4).join(" ");
  const topicQuery = topic.replace(/[^a-zA-Z0-9 ]/g, " ").replace(/\s+/g, " ").trim().split(" ").slice(0, 4).join(" ");
  const queries: string[] = [];
  if (titleQuery) queries.push(titleQuery);
  if (topicQuery && topicQuery !== titleQuery) queries.push(topicQuery);
  queries.push(...sceneQueries.slice(0, 4));
  const topicWords = topic.toLowerCase().split(" ").filter(w => w.length > 3);
  if (topicWords.length > 0) {
    queries.push(`${topicWords[0]} health science`);
    queries.push(`${topicWords[0]} natural remedy`);
  }
  if (queries.length < 5) {
    queries.push("doctor patient consultation");
    queries.push("healthy food preparation");
    queries.push("nature mindfulness meditation");
  }
  return Array.from(new Set(queries)).slice(0, 8);
}

/**
 * Legacy synchronous query builder — kept for backward compatibility.
 * @deprecated Use buildPexelsQueriesFromScript() instead for better results.
 */
export function buildPexelsQueries(
  scriptTitle: string,
  sceneDirections: string[]
): string[] {
  const conceptsFromScenes = sceneDirections
    .slice(0, 8)
    .map(dir => {
      const match = dir.match(/:\s*(.+?)(?:;|$)/);
      return match ? match[1].trim() : dir;
    })
    .filter(c => c.length > 5 && c.length < 60);

  const queries: string[] = [];
  const titleQuery = scriptTitle.replace(/[^a-zA-Z0-9 ]/g, " ").replace(/\s+/g, " ").trim().split(" ").slice(0, 4).join(" ");
  if (titleQuery) queries.push(titleQuery);
  queries.push(...conceptsFromScenes.slice(0, 7));

  if (queries.length < 5) {
    const titleWords = scriptTitle.toLowerCase().split(" ").filter(w => w.length > 3);
    if (titleWords.length > 0) {
      queries.push(`${titleWords[0]} health science`);
      queries.push(`${titleWords[0]} natural remedy`);
      queries.push("doctor patient consultation");
    }
  }
  return Array.from(new Set(queries)).slice(0, 8);
}
