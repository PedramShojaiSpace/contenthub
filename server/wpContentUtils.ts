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
 *  2. Convert remaining Markdown to HTML via marked
 *  3. Append the bold hashtag paragraph at the bottom
 *
 * The returned string is safe to pass directly to createWpPost({ content: ... }).
 */
export function markdownToWpHtml(markdown: string): string {
  if (!markdown || !markdown.trim()) return "";

  // Step 1: Pull out hashtags before markdown parsing (# would be parsed as H1/H2)
  const { cleanBody, hashtagHtml } = extractAndConvertHashtags(markdown);

  // Step 2: Convert Markdown → HTML
  // marked.parse() is synchronous when no async extensions are registered
  const html = marked.parse(cleanBody, markedOptions) as string;

  // Step 3: Append hashtag block
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
      // Search for existing tag
      const searchRes = await fetch(
        `${baseUrl}/wp-json/wp/v2/tags?search=${encodeURIComponent(keyword)}&per_page=5`,
        { headers: { Authorization: authHeader } }
      );
      if (searchRes.ok) {
        const existing = (await searchRes.json()) as Array<{ id: number; name: string; slug: string }>;
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

      // Create new tag
      const createRes = await fetch(`${baseUrl}/wp-json/wp/v2/tags`, {
        method: "POST",
        headers: {
          Authorization: authHeader,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name: keyword, slug }),
      });
      if (createRes.ok) {
        const newTag = (await createRes.json()) as { id: number };
        tagIds.push(newTag.id);
      }
    } catch {
      // Non-fatal — skip this tag if resolution fails
    }
  }

  return tagIds;
}
