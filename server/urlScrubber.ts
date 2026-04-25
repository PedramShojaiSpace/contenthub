/**
 * URL Scrubber — Post-Generation Safety Net
 *
 * After the AI generates a blog article, this module scans for any
 * theurbanmonk.com URLs that were NOT in the verified link list provided to
 * the prompt. Such URLs are hallucinated and must be replaced with the
 * [INTERNAL LINK: topic] placeholder format.
 *
 * This is a defence-in-depth measure on top of the strict prompt instructions.
 */

// Matches any Markdown link: [anchor text](https://theurbanmonk.com/...)
// Captures: full match, anchor text, url
const INTERNAL_LINK_RE = /\[([^\]]+)\]\((https?:\/\/(?:www\.)?theurbanmonk\.com[^\s)]*)\)/gi;

export interface ScrubResult {
  /** Article body after scrubbing */
  body: string;
  /** List of URLs that were removed (hallucinated) */
  removed: string[];
  /** List of URLs that were kept (verified) */
  kept: string[];
}

/**
 * Scan `articleBody` for any theurbanmonk.com Markdown links.
 * Keep links whose URL is in `verifiedUrls`; replace all others with
 * [INTERNAL LINK: anchor text].
 *
 * @param articleBody  Full blog article Markdown
 * @param verifiedUrls Set of allowed URLs (exact match, case-insensitive)
 */
export function scrubHallucinatedUrls(
  articleBody: string,
  verifiedUrls: string[]
): ScrubResult {
  const normalised = new Set(verifiedUrls.map((u) => u.toLowerCase().replace(/\/$/, "")));
  const removed: string[] = [];
  const kept: string[] = [];

  const body = articleBody.replace(INTERNAL_LINK_RE, (fullMatch, anchor, url) => {
    const normUrl = url.toLowerCase().replace(/\/$/, "");
    if (normalised.has(normUrl)) {
      kept.push(url);
      return fullMatch; // keep as-is
    }
    // Hallucinated URL — replace with placeholder
    removed.push(url);
    console.warn(`[URLScrubber] Removed hallucinated URL: ${url}`);
    return `[INTERNAL LINK: ${anchor}]`;
  });

  return { body, removed, kept };
}
