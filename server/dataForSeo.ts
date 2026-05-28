/**
 * DataForSEO API Client
 *
 * Covers the four endpoints used in the SEO competitive intelligence panel:
 *   1. Keyword Overview (Labs) — search volume, CPC, difficulty, intent for a list of keywords
 *   2. Keywords For Site (Labs) — all keywords a domain ranks for
 *   3. Competitors Domain (Labs) — competitor domains + their organic traffic overview
 *   4. Domain Intersection (Labs) — keywords both your domain AND a competitor rank for
 *   5. Ranked Keywords (Labs) — keywords a specific competitor domain ranks for (gap analysis)
 *
 * Auth: HTTP Basic Auth using DATAFORSEO_LOGIN + DATAFORSEO_PASSWORD
 * Base URL: https://api.dataforseo.com/v3
 */

const BASE_URL = "https://api.dataforseo.com/v3";
const LOCATION_CODE = 2840; // United States
const LANGUAGE_CODE = "en";

export function getAuthHeader(): string {
  const login = process.env.DATAFORSEO_LOGIN;
  const password = process.env.DATAFORSEO_PASSWORD;
  if (!login || !password) {
    throw new Error("DATAFORSEO_LOGIN and DATAFORSEO_PASSWORD must be set");
  }
  return "Basic " + Buffer.from(`${login}:${password}`).toString("base64");
}

async function dfsPost<T>(path: string, body: unknown[]): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: "POST",
    headers: {
      Authorization: getAuthHeader(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`DataForSEO API error ${res.status}: ${text}`);
  }

  const json = (await res.json()) as {
    status_code: number;
    status_message: string;
    tasks?: Array<{ status_code: number; status_message: string; result?: T }>;
  };

  if (json.status_code !== 20000) {
    throw new Error(`DataForSEO error: ${json.status_message}`);
  }

  const task = json.tasks?.[0];
  if (!task || task.status_code !== 20000) {
    throw new Error(`DataForSEO task error: ${task?.status_message ?? "unknown"}`);
  }

  return task.result as T;
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface KeywordOverviewItem {
  keyword: string;
  search_volume: number | null;
  cpc: number | null;
  competition: number | null;
  keyword_difficulty: number | null;
  search_intent_info?: {
    main_intent: string;
    foreign_intent?: string[];
  } | null;
  monthly_searches?: Array<{ year: number; month: number; search_volume: number }> | null;
}

export interface RankedKeywordItem {
  keyword_data: {
    keyword: string;
    keyword_info: {
      search_volume: number | null;
      cpc: number | null;
      competition: number | null;
    };
  };
  ranked_serp_element: {
    serp_item: {
      rank_group: number;
      rank_absolute: number;
      url: string;
    };
  };
}

export interface CompetitorDomainItem {
  domain: string;
  avg_position: number | null;
  sum_position: number | null;
  intersections: number;
  full_domain_metrics: {
    organic: {
      count: number;
      etv: number;
      pos_1: number;
      pos_2_3: number;
      pos_4_10: number;
      pos_11_20: number;
    };
  } | null;
}

export interface DomainIntersectionItem {
  keyword_data: {
    keyword: string;
    keyword_info: {
      search_volume: number | null;
      cpc: number | null;
      competition: number | null;
    };
  };
  first_domain_serp_element: {
    serp_item: {
      rank_group: number;
      url: string;
    };
  } | null;
  second_domain_serp_element: {
    serp_item: {
      rank_group: number;
      url: string;
    };
  } | null;
}

export interface DomainRankOverview {
  metrics: {
    organic: {
      count: number;
      etv: number;
      pos_1: number;
      pos_2_3: number;
      pos_4_10: number;
      pos_11_20: number;
      pos_21_30: number;
      pos_31_40: number;
      pos_41_50: number;
    };
  } | null;
}

// ─── 1. Credential Test / User Data ──────────────────────────────────────────

export async function testCredentials(): Promise<{ balance: number; login: string }> {
  const res = await fetch(`${BASE_URL}/appendix/user_data`, {
    headers: { Authorization: getAuthHeader() },
  });
  if (!res.ok) {
    throw new Error(`DataForSEO credential test failed: HTTP ${res.status}`);
  }
  const json = (await res.json()) as {
    status_code: number;
    status_message: string;
    tasks?: Array<{
      result?: Array<{ money_balance: number; login: string }>;
    }>;
  };
  if (json.status_code !== 20000) {
    throw new Error(`DataForSEO credential test error: ${json.status_message}`);
  }
  const result = json.tasks?.[0]?.result?.[0];
  return {
    balance: result?.money_balance ?? 0,
    login: result?.login ?? "",
  };
}

// ─── 2. Keyword Overview (search volume, CPC, difficulty, intent) ─────────────

// Raw shape returned by DataForSEO keyword_overview/live
interface RawKeywordOverviewItem {
  keyword: string;
  keyword_info?: {
    search_volume?: number | null;
    cpc?: number | null;
    competition?: number | null;
  } | null;
  keyword_properties?: {
    keyword_difficulty?: number | null;
  } | null;
  search_intent_info?: {
    main_intent: string;
    foreign_intent?: string[] | null;
  } | null;
  keyword_info_normalized_with_bing?: {
    monthly_searches?: Array<{ year: number; month: number; search_volume: number }> | null;
  } | null;
}

export async function getKeywordOverview(keywords: string[]): Promise<KeywordOverviewItem[]> {
  const result = await dfsPost<Array<{ items: RawKeywordOverviewItem[] }>>(
    "/dataforseo_labs/google/keyword_overview/live",
    [
      {
        keywords,
        location_code: LOCATION_CODE,
        language_code: LANGUAGE_CODE,
      },
    ]
  );
  const rawItems = result?.[0]?.items ?? [];
  // Map nested API response to the flat structure the UI expects
  return rawItems.map((raw) => ({
    keyword: raw.keyword,
    search_volume: raw.keyword_info?.search_volume ?? null,
    cpc: raw.keyword_info?.cpc ?? null,
    competition: raw.keyword_info?.competition ?? null,
    keyword_difficulty: raw.keyword_properties?.keyword_difficulty ?? null,
    search_intent_info: raw.search_intent_info
      ? {
          main_intent: raw.search_intent_info.main_intent,
          foreign_intent: raw.search_intent_info.foreign_intent ?? undefined,
        }
      : null,
    monthly_searches: raw.keyword_info_normalized_with_bing?.monthly_searches ?? null,
  }));
}

// ─── 3. Keywords For Site (what keywords does a domain rank for) ──────────────

export async function getKeywordsForSite(
  domain: string,
  limit = 50,
  offset = 0
): Promise<{ items: RankedKeywordItem[]; total_count: number }> {
  const result = await dfsPost<
    Array<{ items: RankedKeywordItem[]; total_count: number }>
  >("/dataforseo_labs/google/keywords_for_site/live", [
    {
      target: domain,
      location_code: LOCATION_CODE,
      language_code: LANGUAGE_CODE,
      limit,
      offset,
      order_by: ["keyword_data.keyword_info.search_volume,desc"],
      filters: [["keyword_data.keyword_info.search_volume", ">", 0]],
    },
  ]);
  return {
    items: result?.[0]?.items ?? [],
    total_count: result?.[0]?.total_count ?? 0,
  };
}

// ─── 4. Competitors Domain ────────────────────────────────────────────────────

export async function getCompetitorDomains(
  domain: string,
  limit = 20
): Promise<{ items: CompetitorDomainItem[]; total_count: number }> {
  const result = await dfsPost<
    Array<{ items: CompetitorDomainItem[]; total_count: number }>
  >("/dataforseo_labs/google/competitors_domain/live", [
    {
      target: domain,
      location_code: LOCATION_CODE,
      language_code: LANGUAGE_CODE,
      item_types: ["organic"],
      limit,
      order_by: ["intersections,desc"],
    },
  ]);
  return {
    items: result?.[0]?.items ?? [],
    total_count: result?.[0]?.total_count ?? 0,
  };
}

// ─── 5. Domain Intersection (keywords both domains rank for) ──────────────────

export async function getDomainIntersection(
  target1: string,
  target2: string,
  limit = 50
): Promise<{ items: DomainIntersectionItem[]; total_count: number }> {
  const result = await dfsPost<
    Array<{ items: DomainIntersectionItem[]; total_count: number }>
  >("/dataforseo_labs/google/domain_intersection/live", [
    {
      target1,
      target2,
      location_code: LOCATION_CODE,
      language_code: LANGUAGE_CODE,
      item_types: ["organic"],
      limit,
      order_by: ["keyword_data.keyword_info.search_volume,desc"],
      filters: [["keyword_data.keyword_info.search_volume", ">", 0]],
    },
  ]);
  return {
    items: result?.[0]?.items ?? [],
    total_count: result?.[0]?.total_count ?? 0,
  };
}

// ─── 6. Ranked Keywords for a competitor (gap: they rank, we don't) ───────────

export async function getRankedKeywords(
  domain: string,
  limit = 100
): Promise<{ items: RankedKeywordItem[]; total_count: number }> {
  const result = await dfsPost<
    Array<{ items: RankedKeywordItem[]; total_count: number }>
  >("/dataforseo_labs/google/ranked_keywords/live", [
    {
      target: domain,
      location_code: LOCATION_CODE,
      language_code: LANGUAGE_CODE,
      limit,
      order_by: ["keyword_data.keyword_info.search_volume,desc"],
      filters: [
        ["keyword_data.keyword_info.search_volume", ">", 100],
        "and",
        ["ranked_serp_element.serp_item.rank_group", "<=", 20],
      ],
    },
  ]);
  return {
    items: result?.[0]?.items ?? [],
    total_count: result?.[0]?.total_count ?? 0,
  };
}

// ─── 7. Domain Rank Overview ──────────────────────────────────────────────────

export async function getDomainRankOverview(domain: string): Promise<DomainRankOverview> {
  const result = await dfsPost<Array<{ items: DomainRankOverview[] }>>(
    "/dataforseo_labs/google/domain_rank_overview/live",
    [
      {
        target: domain,
        location_code: LOCATION_CODE,
        language_code: LANGUAGE_CODE,
      },
    ]
  );
  return result?.[0]?.items?.[0] ?? { metrics: null };
}

// ─── SERP Top-1 Competitor Lookup ────────────────────────────────────────────

export interface SerpTop1Result {
  keyword: string;
  domain: string | null;
  title: string | null;
  url: string | null;
}

/**
 * For each keyword, fetch the #1 organic SERP result using DataForSEO
 * SERP / Google Organic / Live / Advanced endpoint.
 * Returns one result per keyword (or null fields if unavailable).
 * Batches up to 100 keywords per API call.
 */
export async function getSerpTop1(keywords: string[]): Promise<SerpTop1Result[]> {
  if (keywords.length === 0) return [];

  // DataForSEO SERP live advanced allows up to 100 tasks per call
  const batches: string[][] = [];
  for (let i = 0; i < keywords.length; i += 100) {
    batches.push(keywords.slice(i, i + 100));
  }

  const results: SerpTop1Result[] = [];

  for (const batch of batches) {
    const body = batch.map((kw) => ({
      keyword: kw,
      location_code: LOCATION_CODE,
      language_code: LANGUAGE_CODE,
      depth: 1, // only fetch position 1
    }));

    try {
      const raw = await fetch(`${BASE_URL}/serp/google/organic/live/advanced`, {
        method: "POST",
        headers: {
          Authorization: getAuthHeader(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      if (!raw.ok) {
        // On error, push null results for this batch
        for (const kw of batch) results.push({ keyword: kw, domain: null, title: null, url: null });
        continue;
      }

      const json = (await raw.json()) as {
        status_code: number;
        tasks?: Array<{
          status_code: number;
          data?: { keyword: string };
          result?: Array<{
            items?: Array<{
              type: string;
              rank_group: number;
              domain: string;
              title: string;
              url: string;
            }>;
          }>;
        }>;
      };

      for (const task of json.tasks ?? []) {
        const kw = task.data?.keyword ?? "";
        const items = task.result?.[0]?.items ?? [];
        const top1 = items.find((item) => item.type === "organic" && item.rank_group === 1);
        results.push({
          keyword: kw,
          domain: top1?.domain ?? null,
          title: top1?.title ?? null,
          url: top1?.url ?? null,
        });
      }
    } catch {
      for (const kw of batch) results.push({ keyword: kw, domain: null, title: null, url: null });
    }
  }

  return results;
}

// ─── 8. Keyword Gap (competitor ranks, you don't) ─────────────────────────────

export interface KeywordGapItem {
  keyword: string;
  search_volume: number | null;
  keyword_difficulty: number | null;
  cpc: number | null;
  competitor_rank: number | null;   // competitor's position (1-100)
  my_rank: number | null;           // your position (null = not ranking in top 100)
  competitor_url: string | null;
  monthly_searches?: Array<{ year: number; month: number; search_volume: number }> | null;
}

interface RawGapItem {
  keyword_data?: {
    keyword?: string;
    keyword_info?: {
      search_volume?: number | null;
      cpc?: number | null;
    };
    keyword_properties?: {
      keyword_difficulty?: number | null;
    };
    keyword_info_normalized_with_bing?: {
      monthly_searches?: Array<{ year: number; month: number; search_volume: number }> | null;
    } | null;
  };
  // first_domain = myDomain, second_domain = competitorDomain
  first_domain_serp_element?: {
    serp_item?: { rank_group?: number; url?: string } | null;
  } | null;
  second_domain_serp_element?: {
    serp_item?: { rank_group?: number; url?: string } | null;
  } | null;
}

/**
 * Returns keywords that `competitorDomain` ranks for but `myDomain` does NOT rank for.
 * Uses the DataForSEO /dataforseo_labs/google/domain_intersection/live endpoint with
 * a filter that excludes keywords where myDomain already has a position.
 *
 * Strategy: fetch intersection with both domains, then also fetch competitor-only ranked
 * keywords and subtract the intersection to find true gaps.
 */
export async function getKeywordGap(
  myDomain: string,
  competitorDomain: string,
  limit = 100
): Promise<{ items: KeywordGapItem[]; total_count: number }> {
  // Use domain_intersection to get keywords both rank for (we'll exclude these)
  // Then get competitor's ranked keywords and subtract
  // DataForSEO has a dedicated endpoint: we use ranked_keywords for competitor
  // filtered to exclude keywords where myDomain also appears.
  // The cleanest approach: use domain_intersection with filters to find
  // keywords where competitor ranks but my domain does NOT.

  // We'll use the ranked_keywords endpoint for the competitor and then
  // cross-reference with keywords_for_site for our domain.
  // However the most efficient approach is domain_intersection with
  // exclude_top_domains = [myDomain] — but that's not available.
  // Instead: fetch competitor's ranked keywords (top 20), then filter out
  // any that appear in our domain's keyword list.

  // Fetch competitor's top keywords
  const competitorResult = await dfsPost<
    Array<{ items: RankedKeywordItem[]; total_count: number }>
  >("/dataforseo_labs/google/ranked_keywords/live", [
    {
      target: competitorDomain,
      location_code: LOCATION_CODE,
      language_code: LANGUAGE_CODE,
      limit: Math.min(limit * 2, 200), // fetch extra to account for filtering
      order_by: ["keyword_data.keyword_info.search_volume,desc"],
      filters: [
        ["keyword_data.keyword_info.search_volume", ">", 100],
        "and",
        ["ranked_serp_element.serp_item.rank_group", "<=", 30],
      ],
    },
  ]);

  const competitorItems = competitorResult?.[0]?.items ?? [];
  const competitorTotal = competitorResult?.[0]?.total_count ?? 0;

  if (competitorItems.length === 0) {
    return { items: [], total_count: 0 };
  }

  // Fetch our domain's keywords to build an exclusion set
  const myResult = await dfsPost<
    Array<{ items: RankedKeywordItem[]; total_count: number }>
  >("/dataforseo_labs/google/ranked_keywords/live", [
    {
      target: myDomain,
      location_code: LOCATION_CODE,
      language_code: LANGUAGE_CODE,
      limit: 200,
      order_by: ["keyword_data.keyword_info.search_volume,desc"],
      filters: [["keyword_data.keyword_info.search_volume", ">", 0]],
    },
  ]);

  const myKeywords = new Set(
    (myResult?.[0]?.items ?? []).map((item) => item.keyword_data?.keyword?.toLowerCase() ?? "")
  );

  // Filter: keep only keywords competitor ranks for that we don't rank for
  const gapItems: KeywordGapItem[] = competitorItems
    .filter((item) => {
      const kw = item.keyword_data?.keyword?.toLowerCase() ?? "";
      return kw && !myKeywords.has(kw);
    })
    .slice(0, limit)
    .map((item) => ({
      keyword: item.keyword_data?.keyword ?? "",
      search_volume: item.keyword_data?.keyword_info?.search_volume ?? null,
      keyword_difficulty: null, // not available in ranked_keywords response
      cpc: item.keyword_data?.keyword_info?.cpc ?? null,
      competitor_rank: item.ranked_serp_element?.serp_item?.rank_group ?? null,
      my_rank: null,
      competitor_url: item.ranked_serp_element?.serp_item?.url ?? null,
      monthly_searches: null,
    }));

  return { items: gapItems, total_count: competitorTotal };
}
