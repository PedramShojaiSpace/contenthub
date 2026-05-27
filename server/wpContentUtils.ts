/**
 * WordPress Content Utilities
 *
 * Handles all content transformation between LLM Markdown output and
 * WordPress-ready HTML. Centralised here so every publish path (single
 * post, batch publish, webinar landing pages) uses the same pipeline.
 *
 * Pipeline:
 *  1. Strip trailing hashtag block — convert each #tag to <strong>#tag</strong>
 *     and append as a styled paragraph at the bottom of the article.
 *  2. Convert Markdown → clean HTML via `marked`.
 *  3. Ensure WordPress Gutenberg block compatibility (no raw <br> spam, etc.)
 *
 * Category constants:
 *  WP_CATEGORY_HEALTH_AND_WELLNESS — ID 19 ("Health and Wellness", slug: wellness)
 *  WP_CATEGORY_HEALTH_WELLNESS     — ID 941 ("Health & Wellness", slug: health-wellness)
 *
 * These IDs are stable on theurbanmonk.com — verified 2026-04-18.
 */

import { marked } from "marked";
import { safeParseJson } from "./fetchUtils";

/**
 * Fetch wrapper with a hard timeout for WordPress API calls.
 * Prevents indefinite hangs when WP is in maintenance mode or slow.
 */
async function wpFetch(
  url: string,
  options: RequestInit = {},
  timeoutMs = 10_000
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    if (res.status === 503) {
      const body = await res.text();
      if (body.includes("autoupdater") || body.includes("maintenance") || body.includes("Site is offline")) {
        throw new Error("WordPress is currently in maintenance mode. Please try again in a few minutes.");
      }
    }
    return res;
  } catch (err: unknown) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error("WordPress tag API timed out. The site may be in maintenance mode.");
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

// ─── WordPress Category IDs (theurbanmonk.com) ────────────────────────────────
export const WP_CATEGORY_HEALTH_AND_WELLNESS = 19;   // "Health and Wellness" (slug: wellness)
export const WP_CATEGORY_HEALTH_WELLNESS = 941;       // "Health & Wellness" (slug: health-wellness)

/**
 * Default categories to assign to every AI-generated blog post.
 * Covers both the original and the newer duplicate so the post appears
 * in both category archives.
 */
export const DEFAULT_WP_CATEGORIES = [
  WP_CATEGORY_HEALTH_AND_WELLNESS,
  WP_CATEGORY_HEALTH_WELLNESS,
];

// ─── Hashtag → Bold conversion ────────────────────────────────────────────────

/**
 * Detect whether a line is a hashtag-only line (e.g. "#urbanmonk #guthealth #energy").
 * Returns true if the line contains only whitespace and #word tokens.
 */
function isHashtagLine(line: string): boolean {
  return /^(\s*#[A-Za-z0-9_]+\s*)+$/.test(line.trim());
}

/**
 * Convert a string of hashtags into bold HTML tokens.
 * "#urbanmonk #guthealth" → "<strong>#urbanmonk</strong> <strong>#guthealth</strong>"
 */
function hashtagsToHtml(line: string): string {
  return line
    .trim()
    .replace(/#([A-Za-z0-9_]+)/g, "<strong>#$1</strong>");
}

/**
 * Extract and remove any trailing hashtag block from the Markdown body.
 * Returns { cleanBody, hashtagHtml } where hashtagHtml is a ready-to-append
 * HTML paragraph (or empty string if no hashtags were found).
 *
 * Handles two patterns the LLM produces:
 *   (a) A final paragraph that is entirely hashtags: "#urbanmonk #guthealth ..."
 *   (b) Hashtags mixed into the last paragraph after a blank line
 */
export function extractAndConvertHashtags(markdown: string): {
  cleanBody: string;
  hashtagHtml: string;
} {
  const lines = markdown.split("\n");

  // Walk backwards from the end, collecting consecutive hashtag-only lines
  const hashtagLines: string[] = [];
  let cutIndex = lines.length;

  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i];
    if (line.trim() === "") continue; // skip blank lines at the tail
    if (isHashtagLine(line)) {
      hashtagLines.unshift(line);
      cutIndex = i;
    } else {
      break;
    }
  }

  if (hashtagLines.length === 0) {
    return { cleanBody: markdown, hashtagHtml: "" };
  }

  // Remove the hashtag lines (and any trailing blank lines above them)
  let trimmedLines = lines.slice(0, cutIndex);
  while (trimmedLines.length > 0 && trimmedLines[trimmedLines.length - 1].trim() === "") {
    trimmedLines.pop();
  }

  const allHashtags = hashtagLines.join(" ");
  const boldHtml = hashtagsToHtml(allHashtags);
  const hashtagHtml = `<p class="wp-block-paragraph blog-hashtags">${boldHtml}</p>`;

  return {
    cleanBody: trimmedLines.join("\n"),
    hashtagHtml,
  };
}

// ─── Markdown → WordPress HTML ────────────────────────────────────────────────

/**
 * Configure marked for WordPress-compatible output.
 * - GFM enabled (tables, strikethrough, task lists)
 * - Breaks disabled (WordPress handles paragraph spacing)
 * - mangle disabled (don't obfuscate email addresses)
 */
const markedOptions = {
  gfm: true,
  breaks: false,
};

/**
 * Convert LLM-generated Markdown to WordPress-ready HTML.
 *
 * Full pipeline:
 *  1. Extract trailing hashtag block → convert to bold HTML paragraph
 *  2. Split on raw HTML blocks (e.g. injected CTA banners) so they pass through unchanged
 *  3. Convert each Markdown segment to HTML via marked
 *  4. Reassemble segments + HTML passthrough blocks in order
 *  5. Append the bold hashtag paragraph at the bottom
 *
 * The returned string is safe to pass directly to createWpPost({ content: ... }).
 *
 * WHY SPLIT: When a raw HTML block (e.g. <div class="um-cta-banner">) is injected into
 * a Markdown string, `marked` treats the HTML block as a passthrough but stops converting
 * Markdown that follows it (e.g. the FAQ section). Splitting on HTML blocks ensures every
 * Markdown segment is fully converted regardless of what precedes it.
 */
export function markdownToWpHtml(markdown: string): string {
  if (!markdown || !markdown.trim()) return "";

  // Step 1: Pull out trailing hashtags before markdown parsing (# would be parsed as H1/H2)
  const { cleanBody, hashtagHtml } = extractAndConvertHashtags(markdown);

  // Step 2: Split on raw HTML blocks so they pass through unchanged.
  // Pattern: a line that starts with < (HTML tag) and is followed by a closing tag.
  // We match self-contained block-level HTML elements (div, p with inline style, etc.)
  // that were injected into the Markdown string (e.g. the um-cta-banner div).
  // Each segment is either a Markdown chunk or a raw HTML passthrough.
  const HTML_BLOCK_RE = /(<(?:div|section|figure|aside|table|ul|ol|blockquote|pre|script|style)[^>]*>[\s\S]*?<\/(?:div|section|figure|aside|table|ul|ol|blockquote|pre|script|style)>)/gi;

  const parts: Array<{ type: "markdown" | "html"; content: string }> = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  // Reset regex state
  HTML_BLOCK_RE.lastIndex = 0;
  while ((match = HTML_BLOCK_RE.exec(cleanBody)) !== null) {
    // Markdown before this HTML block
    if (match.index > lastIndex) {
      parts.push({ type: "markdown", content: cleanBody.slice(lastIndex, match.index) });
    }
    // The HTML block itself (pass through unchanged)
    parts.push({ type: "html", content: match[0] });
    lastIndex = match.index + match[0].length;
  }
  // Any remaining Markdown after the last HTML block
  if (lastIndex < cleanBody.length) {
    parts.push({ type: "markdown", content: cleanBody.slice(lastIndex) });
  }

  // Step 3: Convert each Markdown segment; leave HTML segments untouched
  const converted = parts.map((part) => {
    if (part.type === "html") return part.content;
    const trimmed = part.content.trim();
    if (!trimmed) return "";
    return marked.parse(trimmed, markedOptions) as string;
  });

  // Step 4: Reassemble
  const html = converted.join("\n");

  // Step 5: Append hashtag block
  const finalHtml = hashtagHtml ? `${html}\n${hashtagHtml}` : html;

  return finalHtml;
}

// ─── SEO Keywords → WordPress Tags ───────────────────────────────────────────

/**
 * Resolve or create WordPress tags from a list of keyword strings.
 * Returns an array of WP tag IDs ready to pass to createWpPost({ tags: [...] }).
 *
 * Strategy:
 *  - Search for each keyword by name (case-insensitive)
 *  - If found, use the existing tag ID
 *  - If not found, create a new tag and use the new ID
 */
export async function resolveOrCreateWpTags(
  keywords: string[],
  authHeader: string,
  baseUrl: string
): Promise<number[]> {
  const tagIds: number[] = [];

  for (const keyword of keywords) {
    if (!keyword || !keyword.trim()) continue;
    const slug = keyword
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .slice(0, 80);

    try {
      // Search for existing tag (8s timeout)
      const searchRes = await wpFetch(
        `${baseUrl}/wp-json/wp/v2/tags?search=${encodeURIComponent(keyword)}&per_page=5`,
        { headers: { Authorization: authHeader } },
        8_000
      );
      if (searchRes.ok) {
        const existing = await safeParseJson<Array<{ id: number; name: string; slug: string }>>(searchRes, "WordPress tag search");
        const match = existing.find(
          (t) =>
            t.name.toLowerCase() === keyword.toLowerCase() ||
            t.slug === slug
        );
        if (match) {
          tagIds.push(match.id);
          continue;
        }
      }

      // Create new tag (8s timeout)
      const createRes = await wpFetch(`${baseUrl}/wp-json/wp/v2/tags`, {
        method: "POST",
        headers: {
          Authorization: authHeader,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name: keyword, slug }),
      }, 8_000);
      if (createRes.ok) {
        const newTag = await safeParseJson<{ id: number }>(createRes, "WordPress tag create");
        tagIds.push(newTag.id);
      }
    } catch {
      // Non-fatal — skip this tag if resolution fails
    }
  }

  return tagIds;
}

// ─── WordPress Category Auto-Assignment ──────────────────────────────────────
//
// Category hierarchy on theurbanmonk.com:
//   Health and Wellness (ID 19, slug: wellness) ← PARENT — always assigned
//     ├─ Gut Health & Digestion      (cluster subcategory — created on first use)
//     ├─ Stress & Mental Wellness    (cluster subcategory — created on first use)
//     ├─ Sleep & Recovery            (cluster subcategory — created on first use)
//     ├─ Energy & Vitality           (cluster subcategory — created on first use)
//     ├─ Detox & Cleansing           (cluster subcategory — created on first use)
//     ├─ Mindfulness & Meditation    (cluster subcategory — created on first use)
//     ├─ Nutrition & Diet            (cluster subcategory — created on first use)
//     ├─ Fitness & Movement          (cluster subcategory — created on first use)
//     └─ Longevity & Anti-Aging      (cluster subcategory — created on first use)
//
// The old duplicate category ID 941 ("Health & Wellness") is intentionally
// excluded — it was causing the "Health and Wellness / Health and Wellness"
// double-category display in WordPress.

/** Cluster definitions: keyword signals → subcategory label */
const CLUSTER_MAP: Array<{ label: string; slug: string; keywords: string[] }> = [
  {
    label: "Gut Health & Digestion",
    slug: "gut-health-digestion",
    keywords: ["gut", "digestion", "microbiome", "probiotic", "leaky gut", "ibs", "bloating", "bowel", "intestin", "colon", "stomach", "gi map", "dysbiosis"],
  },
  {
    label: "Stress & Mental Wellness",
    slug: "stress-mental-wellness",
    keywords: ["stress", "anxiety", "cortisol", "nervous system", "mental", "burnout", "adrenal", "hpa axis", "mood", "depression", "emotional"],
  },
  {
    label: "Sleep & Recovery",
    slug: "sleep-recovery",
    keywords: ["sleep", "insomnia", "circadian", "melatonin", "rest", "recovery", "fatigue", "tired", "exhaustion"],
  },
  {
    label: "Energy & Vitality",
    slug: "energy-vitality",
    keywords: ["energy", "mitochondria", "atp", "fatigue", "vitality", "stamina", "chronic fatigue", "adrenal fatigue", "low energy"],
  },
  {
    label: "Detox & Cleansing",
    slug: "detox-cleansing",
    keywords: ["detox", "cleanse", "toxin", "heavy metal", "liver", "lymph", "fasting", "autophagy", "elimination"],
  },
  {
    label: "Mindfulness & Meditation",
    slug: "mindfulness-meditation",
    keywords: ["meditation", "mindfulness", "qigong", "breathwork", "breath", "pranayama", "presence", "awareness", "monk", "taoist", "zen"],
  },
  {
    label: "Nutrition & Diet",
    slug: "nutrition-diet",
    keywords: ["nutrition", "diet", "food", "eating", "meal", "nutrient", "vitamin", "mineral", "supplement", "keto", "paleo", "anti-inflammatory"],
  },
  {
    label: "Fitness & Movement",
    slug: "fitness-movement",
    keywords: ["exercise", "fitness", "movement", "workout", "yoga", "strength", "cardio", "flexibility", "mobility"],
  },
  {
    label: "Longevity & Anti-Aging",
    slug: "longevity-anti-aging",
    keywords: ["longevity", "aging", "anti-aging", "lifespan", "healthspan", "telomere", "biohack", "epigenetic", "senescence"],
  },
];

/**
 * Detect which cluster subcategory best matches the focus keyword.
 * Returns the cluster label + slug, or null if no match.
 */
export function detectCluster(focusKeyword: string): { label: string; slug: string } | null {
  if (!focusKeyword) return null;
  const kw = focusKeyword.toLowerCase();
  for (const cluster of CLUSTER_MAP) {
    if (cluster.keywords.some((sig) => kw.includes(sig))) {
      return { label: cluster.label, slug: cluster.slug };
    }
  }
  return null;
}

/**
 * Ensure a WordPress category exists as a child of "Health and Wellness" (ID 19).
 * If it already exists, returns its ID. If not, creates it and returns the new ID.
 * Returns null on any error (non-fatal — post will still be published under parent).
 */
async function ensureWpSubcategory(
  label: string,
  slug: string,
  authHeader: string,
  baseUrl: string
): Promise<number | null> {
  try {
    // Search for existing category by slug
    const searchRes = await wpFetch(
      `${baseUrl}/wp-json/wp/v2/categories?slug=${encodeURIComponent(slug)}&per_page=5`,
      { headers: { Authorization: authHeader } },
      8_000
    );
    if (searchRes.ok) {
      const existing = await safeParseJson<Array<{ id: number; slug: string }>>(searchRes, "WP category search");
      if (existing.length > 0) return existing[0].id;
    }

    // Create the subcategory under parent ID 19 (Health and Wellness)
    const createRes = await wpFetch(`${baseUrl}/wp-json/wp/v2/categories`, {
      method: "POST",
      headers: {
        Authorization: authHeader,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name: label, slug, parent: WP_CATEGORY_HEALTH_AND_WELLNESS }),
    }, 8_000);

    if (createRes.ok) {
      const newCat = await safeParseJson<{ id: number }>(createRes, "WP category create");
      return newCat.id;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Resolve the final list of WordPress category IDs for a post.
 *
 * Rules:
 *  1. Always include the parent "Health and Wellness" (ID 19).
 *  2. If wpCategoryOverride is provided, use it as the subcategory.
 *  3. Otherwise, auto-detect the cluster from focusKeyword and ensure/create the subcategory.
 *  4. Never include the duplicate ID 941 ("Health & Wellness").
 */
export async function resolveWpCategories(params: {
  focusKeyword?: string;
  wpCategoryOverride?: number;
  baseUrl: string;
  authHeader: string;
}): Promise<number[]> {
  const ids: number[] = [WP_CATEGORY_HEALTH_AND_WELLNESS];

  // Manual override takes precedence
  if (params.wpCategoryOverride && params.wpCategoryOverride !== WP_CATEGORY_HEALTH_AND_WELLNESS) {
    ids.push(params.wpCategoryOverride);
    return ids;
  }

  // Auto-detect cluster from focus keyword
  if (params.focusKeyword) {
    const cluster = detectCluster(params.focusKeyword);
    if (cluster) {
      const subcatId = await ensureWpSubcategory(
        cluster.label,
        cluster.slug,
        params.authHeader,
        params.baseUrl
      );
      if (subcatId && subcatId !== WP_CATEGORY_HEALTH_AND_WELLNESS) {
        ids.push(subcatId);
      }
    }
  }

  return ids;
}

/**
 * Fetch all WordPress categories (for use in the UI dropdown).
 * Returns id, name, slug, parent for each category.
 */
export async function fetchWpCategories(
  authHeader: string,
  baseUrl: string
): Promise<Array<{ id: number; name: string; slug: string; parent: number }>> {
  try {
    const res = await wpFetch(
      `${baseUrl}/wp-json/wp/v2/categories?per_page=100&orderby=name&order=asc`,
      { headers: { Authorization: authHeader } },
      10_000
    );
    if (!res.ok) return [];
    return safeParseJson<Array<{ id: number; name: string; slug: string; parent: number }>>(res, "WP categories fetch");
  } catch {
    return [];
  }
}
