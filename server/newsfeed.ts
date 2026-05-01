/**
 * newsfeed.ts — Article discovery for the LinkedIn Newsfeed (Doovo replacement).
 *
 * Two free, zero-cost sources:
 *   1. Google News RSS  — real-time headlines from any keyword query, no API key
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

export const TOPIC_CLUSTERS: Record<string, { label: string; googleQuery: string; pubmedQuery: string }> = {
  integrative_medicine: {
    label: "Integrative & Functional Medicine",
    googleQuery: "integrative medicine functional medicine research 2025 2026",
    pubmedQuery: "integrative medicine[MeSH] OR functional medicine[tiab]",
  },
  longevity: {
    label: "Longevity & Healthspan",
    googleQuery: "longevity science healthspan aging research 2025 2026",
    pubmedQuery: "longevity[MeSH] OR healthspan[tiab] OR lifespan extension[tiab]",
  },
  gut_health: {
    label: "Gut Health & Microbiome",
    googleQuery: "gut microbiome health research 2025 2026",
    pubmedQuery: "gut microbiome[MeSH] OR intestinal microbiota[tiab] OR leaky gut[tiab]",
  },
  sleep_science: {
    label: "Sleep Science & Circadian Rhythm",
    googleQuery: "sleep science circadian rhythm health research 2025 2026",
    pubmedQuery: "sleep[MeSH] OR circadian rhythm[MeSH] OR sleep quality[tiab]",
  },
  mental_health: {
    label: "Mental Health & Wellness",
    googleQuery: "mental health wellness mindfulness stress research 2025 2026",
    pubmedQuery: "mental health[MeSH] OR mindfulness[MeSH] OR stress reduction[tiab]",
  },
  cardiometabolic: {
    label: "Cardiometabolic Health",
    googleQuery: "cardiometabolic health metabolic syndrome cardiovascular research 2025 2026",
    pubmedQuery: "cardiometabolic[tiab] OR metabolic syndrome[MeSH] OR cardiovascular health[tiab]",
  },
};

// ─── Google News RSS Fetcher ──────────────────────────────────────────────────

/**
 * Fetches articles from Google News RSS for a given topic cluster.
 * No API key required — uses the public RSS endpoint.
 */
export async function fetchGoogleNewsRSS(topic: string, maxItems = 8): Promise<RawArticle[]> {
  const cluster = TOPIC_CLUSTERS[topic];
  if (!cluster) return [];

  const query = encodeURIComponent(cluster.googleQuery);
  const url = `https://news.google.com/rss/search?q=${query}&hl=en-US&gl=US&ceid=US:en`;

  let xml: string;
  try {
    const resp = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; UrbanMonkContentHub/1.0)" },
      signal: AbortSignal.timeout(15_000),
    });
    if (!resp.ok) throw new Error(`Google News RSS returned ${resp.status}`);
    xml = await resp.text();
  } catch (err) {
    console.error(`[newsfeed] Google News RSS fetch failed for topic "${topic}":`, err);
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
    // Google News RSS wraps the real source in the title: "Headline - Source Name"
    const rawTitle: string = item.title ?? "";
    const lastDash = rawTitle.lastIndexOf(" - ");
    const title = lastDash > 0 ? rawTitle.substring(0, lastDash).trim() : rawTitle.trim();
    const source = lastDash > 0 ? rawTitle.substring(lastDash + 3).trim() : "Google News";

    // Strip HTML tags from description
    const rawDesc: string = item.description ?? "";
    const description = rawDesc.replace(/<[^>]+>/g, "").trim();

    return {
      title,
      url: item.link ?? item.guid ?? "",
      source,
      description: description.slice(0, 500),
      topic,
      fetchedAt: new Date(),
    };
  }).filter((a) => a.url && a.title);
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
 * Fetches articles from both Google News and PubMed for all topic clusters.
 * Returns a deduplicated list sorted by topic.
 */
export async function fetchAllTopics(): Promise<RawArticle[]> {
  const topics = Object.keys(TOPIC_CLUSTERS);
  const results: RawArticle[] = [];

  // Fetch all topics in parallel
  await Promise.allSettled(
    topics.map(async (topic) => {
      const [newsArticles, pubmedArticles] = await Promise.allSettled([
        fetchGoogleNewsRSS(topic, 6),
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
