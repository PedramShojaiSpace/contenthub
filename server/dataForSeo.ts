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

function getAuthHeader(): string {
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

export async function getKeywordOverview(keywords: string[]): Promise<KeywordOverviewItem[]> {
  const result = await dfsPost<Array<{ items: KeywordOverviewItem[] }>>(
    "/dataforseo_labs/google/keyword_overview/live",
    [
      {
        keywords,
        location_code: LOCATION_CODE,
        language_code: LANGUAGE_CODE,
      },
    ]
  );
  return result?.[0]?.items ?? [];
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
