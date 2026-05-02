/**
 * newsfeed.ts — Article discovery for the LinkedIn Newsfeed (Doovo replacement).
 *
 * Two free, zero-cost sources:
 *   1. Bing News RSS  — real-time headlines from any keyword query, no API key.
 *                       The real article URL is embedded in the redirect link's
 *                       `url=` query parameter and extracted client-side — no
 *                       HTTP redirect following required.
 *   2. PubMed E-Utilities — peer-reviewed medical literature, free with NCBI email
 *
 * Topic clusters covered:
 *   integrative_medicine | longevity | gut_health | sleep_science |
 *   mental_health | cardiometabolic
 */

import { parseStringPromise } from "xml2js";

export interface RawArticle {
  title: string;
  url: string;
  source: string;
  description: string;
  imageUrl?: string;
  topic: string;
  fetchedAt: Date;
}

// ─── Topic Cluster Definitions ────────────────────────────────────────────────

export const TOPIC_CLUSTERS: Record<string, { label: string; bingQuery: string; pubmedQuery: string }> = {
  integrative_medicine: {
    label: "Integrative & Functional Medicine",
    bingQuery: "integrative medicine functional medicine research 2025 2026",
    pubmedQuery: "integrative medicine[MeSH] OR functional medicine[tiab]",
  },
  longevity: {
    label: "Longevity & Healthspan",
    bingQuery: "longevity science healthspan aging research 2025 2026",
    pubmedQuery: "longevity[MeSH] OR healthspan[tiab] OR lifespan extension[tiab]",
  },
  gut_health: {
    label: "Gut Health & Microbiome",
    bingQuery: "gut microbiome health research 2025 2026",
    pubmedQuery: "gut microbiome[MeSH] OR intestinal microbiota[tiab] OR leaky gut[tiab]",
  },
  sleep_science: {
    label: "Sleep Science & Circadian Rhythm",
    bingQuery: "sleep science circadian rhythm health research 2025 2026",
    pubmedQuery: "sleep[MeSH] OR circadian rhythm[MeSH] OR sleep quality[tiab]",
  },
  mental_health: {
    label: "Mental Health & Wellness",
    bingQuery: "mental health wellness mindfulness stress research 2025 2026",
    pubmedQuery: "mental health[MeSH] OR mindfulness[MeSH] OR stress reduction[tiab]",
  },
  cardiometabolic: {
    label: "Cardiometabolic Health",
    bingQuery: "cardiometabolic health metabolic syndrome cardiovascular research 2025 2026",
    pubmedQuery: "cardiometabolic[tiab] OR metabolic syndrome[MeSH] OR cardiovascular health[tiab]",
  },
};

// ─── Bing News RSS Fetcher ────────────────────────────────────────────────────

/**
 * Extracts the real article URL from a Bing News RSS redirect link.
 *
 * Bing News RSS links look like:
 *   http://www.bing.com/news/apiclick.aspx?...&url=https%3a%2f%2fwww.healthline.com%2f...&...
 *
 * The real article URL is URL-encoded in the `url=` query parameter.
 * We extract it directly — no HTTP request needed.
 */
function extractBingRealUrl(bingLink: string): string {
  try {
    const parsed = new URL(bingLink);
    const realUrl = parsed.searchParams.get("url");
    if (realUrl && realUrl.startsWith("http")) {
      return realUrl;
    }
  } catch {
    // fall through
  }
  // If extraction fails, return the original link as fallback
  return bingLink;
}

/**
 * Fetches articles from Bing News RSS for a given topic cluster.
 * No API key required — uses the public RSS endpoint.
 * Returns real article URLs (extracted from Bing's redirect link).
 */
export async function fetchBingNewsRSS(topic: string, maxItems = 8): Promise<RawArticle[]> {
  const cluster = TOPIC_CLUSTERS[topic];
  if (!cluster) return [];

  const query = encodeURIComponent(cluster.bingQuery);
  const url = `https://www.bing.com/news/search?q=${query}&format=rss`;

  let xml: string;
  try {
    const resp = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; UrbanMonkContentHub/1.0)",
        "Accept": "application/rss+xml, application/xml, text/xml",
      },
      signal: AbortSignal.timeout(15_000),
    });
    if (!resp.ok) throw new Error(`Bing News RSS returned ${resp.status}`);
    xml = await resp.text();
  } catch (err) {
    console.error(`[newsfeed] Bing News RSS fetch failed for topic "${topic}":`, err);
    return [];
  }

  let parsed: any;
  try {
    parsed = await parseStringPromise(xml, { explicitArray: false, ignoreAttrs: false });
  } catch (err) {
    console.error(`[newsfeed] XML parse failed for topic "${topic}":`, err);
    return [];
  }

  const items: any[] = parsed?.rss?.channel?.item ?? [];
  const itemArray = Array.isArray(items) ? items : [items];

  return itemArray.slice(0, maxItems).map((item: any) => {
    const title: string = (item.title ?? "").trim();

    // Extract real article URL from Bing's redirect link
    const bingLink: string = item.link ?? "";
    const realUrl = extractBingRealUrl(bingLink);

    // Source comes from the News:Source element (or fall back to domain)
    const sourceEl = item["News:Source"] ?? item["news:source"] ?? "";
    const source = typeof sourceEl === "string" ? sourceEl : (sourceEl?._ ?? "Bing News");

    // Extract thumbnail image URL from News:Image element if present
    const imageEl = item["News:Image"] ?? item["news:image"] ?? "";
    const rawImageUrl = typeof imageEl === "string" ? imageEl : "";
    // Bing image URLs use {0}/{1} placeholders — replace with fixed dimensions
    const imageUrl = rawImageUrl
      ? rawImageUrl.replace("{0}", "600").replace("{1}", "337")
      : undefined;

    // Strip HTML tags from description
    const rawDesc: string = item.description ?? "";
    const description = rawDesc.replace(/<[^>]+>/g, "").trim();

    return {
      title,
      url: realUrl,
      source,
      description: description.slice(0, 500),
      imageUrl: imageUrl || undefined,
      topic,
      fetchedAt: new Date(),
    };
  }).filter((a) => a.url && a.title && !a.url.includes("bing.com/news/apiclick"));
  // The last filter removes any items where URL extraction failed (fell back to Bing redirect)
}

// ─── PubMed E-Utilities Fetcher ───────────────────────────────────────────────

const PUBMED_BASE = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils";
const PUBMED_EMAIL = "content@theurbanmonk.com"; // Required by NCBI usage policy

/**
 * Fetches recent peer-reviewed articles from PubMed for a given topic cluster.
 * Free — no API key required, just an email in the request.
 */
export async function fetchPubMedArticles(topic: string, maxItems = 5): Promise<RawArticle[]> {
  const cluster = TOPIC_CLUSTERS[topic];
  if (!cluster) return [];

  // Step 1: Search for PMIDs
  const searchQuery = encodeURIComponent(cluster.pubmedQuery);
  const searchUrl =
    `${PUBMED_BASE}/esearch.fcgi?db=pubmed&term=${searchQuery}` +
    `&retmax=${maxItems}&sort=date&retmode=json&email=${PUBMED_EMAIL}&tool=UrbanMonkContentHub`;

  let pmids: string[] = [];
  try {
    const resp = await fetch(searchUrl, { signal: AbortSignal.timeout(15_000) });
    if (!resp.ok) throw new Error(`PubMed search returned ${resp.status}`);
    const data = await resp.json();
    pmids = data?.esearchresult?.idlist ?? [];
  } catch (err) {
    console.error(`[newsfeed] PubMed search failed for topic "${topic}":`, err);
    return [];
  }

  if (pmids.length === 0) return [];

  // Step 2: Fetch summaries for the PMIDs
  const summaryUrl =
    `${PUBMED_BASE}/esummary.fcgi?db=pubmed&id=${pmids.join(",")}&retmode=json&email=${PUBMED_EMAIL}&tool=UrbanMonkContentHub`;

  let summaries: any;
  try {
    const resp = await fetch(summaryUrl, { signal: AbortSignal.timeout(15_000) });
    if (!resp.ok) throw new Error(`PubMed summary returned ${resp.status}`);
    summaries = await resp.json();
  } catch (err) {
    console.error(`[newsfeed] PubMed summary fetch failed for topic "${topic}":`, err);
    return [];
  }

  const result: RawArticle[] = [];
  for (const pmid of pmids) {
    const doc = summaries?.result?.[pmid];
    if (!doc) continue;

    const title: string = doc.title ?? "";
    const authors: string[] = (doc.authors ?? []).slice(0, 3).map((a: any) => a.name ?? "");
    const journal: string = doc.fulljournalname ?? doc.source ?? "PubMed";
    const pubDate: string = doc.pubdate ?? "";
    const description = authors.length > 0
      ? `${authors.join(", ")} — ${journal} (${pubDate})`
      : `${journal} (${pubDate})`;

    result.push({
      title: title.replace(/\.$/, ""),
      url: `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`,
      source: "PubMed",
      description: description.slice(0, 500),
      topic,
      fetchedAt: new Date(),
    });
  }

  return result;
}

// ─── Combined Fetcher ─────────────────────────────────────────────────────────

/**
 * Fetches articles from both Bing News and PubMed for all topic clusters.
 * Returns a deduplicated list sorted by topic.
 */
export async function fetchAllTopics(): Promise<RawArticle[]> {
  const topics = Object.keys(TOPIC_CLUSTERS);
  const results: RawArticle[] = [];

  // Fetch all topics in parallel
  await Promise.allSettled(
    topics.map(async (topic) => {
      const [newsArticles, pubmedArticles] = await Promise.allSettled([
        fetchBingNewsRSS(topic, 6),
        fetchPubMedArticles(topic, 4),
      ]);
      if (newsArticles.status === "fulfilled") results.push(...newsArticles.value);
      if (pubmedArticles.status === "fulfilled") results.push(...pubmedArticles.value);
    })
  );

  // Deduplicate by URL
  const seen = new Set<string>();
  return results.filter((a) => {
    if (!a.url || seen.has(a.url)) return false;
    seen.add(a.url);
    return true;
  });
}
