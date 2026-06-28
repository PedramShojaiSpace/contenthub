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

const PEXELS_API_BASE = "https://api.pexels.com";

export interface PexelsVideoFile {
  id: number;
  quality: string; // "hd" | "sd" | "hls"
  file_type: string; // "video/mp4"
  width: number;
  height: number;
  fps: number;
  link: string; // direct download URL
}

export interface PexelsVideo {
  id: number;
  width: number;
  height: number;
  duration: number; // seconds
  url: string; // pexels.com page URL
  image: string; // thumbnail
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
  url: string;       // direct MP4 download URL (HD preferred, SD fallback)
  duration: number;  // seconds
  width: number;
  height: number;
  pexelsId: number;
  query: string;     // the search query that found this clip
}

function getPexelsApiKey(): string | null {
  return process.env.PEXELS_API_KEY ?? null;
}

/**
 * Search Pexels for stock video clips matching a query.
 * Returns up to `perPage` results (max 80 per request).
 * If no API key is configured, returns empty array (graceful degradation).
 */
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
    size: "medium", // medium = 1280x720 or larger
  });

  const url = `${PEXELS_API_BASE}/videos/search?${params}`;

  let res: Response;
  try {
    res = await fetch(url, {
      headers: {
        Authorization: apiKey,
      },
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
    .filter(v => v.duration >= 8) // only clips at least 8 seconds long
    .map(v => {
      // Prefer HD (1280x720+), fall back to SD
      const hdFile = v.video_files.find(
        f => f.quality === "hd" && f.file_type === "video/mp4"
      );
      const sdFile = v.video_files.find(
        f => f.quality === "sd" && f.file_type === "video/mp4"
      );
      const bestFile = hdFile ?? sdFile ?? v.video_files[0];

      if (!bestFile?.link) return null;

      return {
        url: bestFile.link,
        duration: v.duration,
        width: bestFile.width ?? v.width,
        height: bestFile.height ?? v.height,
        pexelsId: v.id,
        query,
      } as StockClip;
    })
    .filter((c): c is StockClip => c !== null);
}

/**
 * Run multiple Pexels searches in parallel and return deduplicated results.
 * Used to gather a diverse pool of stock clips for a video topic.
 *
 * @param queries - Array of search queries (e.g. ["gut health", "microbiome", "healthy food"])
 * @param clipsPerQuery - How many clips to fetch per query (default 5)
 * @returns Deduplicated array of StockClip objects, sorted by duration descending
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

  for (const result of results) {
    if (result.status === "fulfilled") {
      for (const clip of result.value) {
        if (!seenIds.has(clip.pexelsId)) {
          seenIds.add(clip.pexelsId);
          allClips.push(clip);
        }
      }
    }
  }

  // Sort by duration descending — longer clips give Underlord more to work with
  return allClips.sort((a, b) => b.duration - a.duration);
}

/**
 * Generate Pexels search queries from a script's topic and scene directions.
 * Returns 4-6 diverse query strings that cover the video's visual themes.
 */
export function buildPexelsQueries(
  scriptTitle: string,
  sceneDirections: string[]
): string[] {
  // Extract key visual concepts from scene directions
  const conceptsFromScenes = sceneDirections
    .slice(0, 8) // use first 8 scene directions
    .map(dir => {
      // Extract the visual description after the timestamp
      const match = dir.match(/:\s*(.+?)(?:;|$)/);
      return match ? match[1].trim() : dir;
    })
    .filter(c => c.length > 5 && c.length < 60);

  // Build a diverse set of queries
  const queries: string[] = [];

  // 1. Topic-based query from title
  const titleQuery = scriptTitle
    .replace(/[^a-zA-Z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .slice(0, 4)
    .join(" ");
  if (titleQuery) queries.push(titleQuery);

  // 2. First 3 scene-based queries
  queries.push(...conceptsFromScenes.slice(0, 3));

  // 3. Generic wellness/health fallbacks if we don't have enough
  const fallbacks = [
    "healthy lifestyle nature",
    "meditation wellness",
    "human body anatomy",
    "healthy food nutrition",
    "science laboratory research",
    "nature forest calm",
  ];

  while (queries.length < 5 && fallbacks.length > 0) {
    queries.push(fallbacks.shift()!);
  }

  // Deduplicate and limit to 6 queries
  return Array.from(new Set(queries)).slice(0, 6);
}
