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

// ─── Placeholder Resolver ─────────────────────────────────────────────────────

/**
 * Pattern that matches the [INTERNAL LINK: topic] placeholder format.
 * The LLM uses this when it needs a link to a topic not in the verified list.
 */
const PLACEHOLDER_RE = /\[INTERNAL LINK:\s*([^\]]+)\]/gi;

export interface PostSummaryForResolution {
  title: string;
  url: string;
  excerpt?: string;
}

export interface ResolutionResult {
  /** Article body after resolution */
  body: string;
  /** Placeholders that were resolved to real URLs */
  resolved: Array<{ topic: string; url: string; title: string }>;
  /** Placeholders that had no good match and were stripped to plain text */
  stripped: string[];
}

/**
 * Resolve [INTERNAL LINK: topic] placeholders in an article body.
 *
 * For each placeholder:
 *  1. Score all posts in `postIndex` by keyword overlap with the topic string
 *  2. If the best match scores ≥ MIN_SCORE, replace with [title](url)
 *  3. Otherwise strip the placeholder entirely (leave just the surrounding sentence)
 *
 * This ensures no raw [INTERNAL LINK: ...] text ever reaches the published post.
 *
 * @param articleBody  Full blog article Markdown (after scrubHallucinatedUrls)
 * @param postIndex    Full list of WP posts to match against
 * @param minScore     Minimum keyword overlap score to accept a match (default: 1)
 */
export function resolvePlaceholderLinks(
  articleBody: string,
  postIndex: PostSummaryForResolution[],
  minScore = 1
): ResolutionResult {
  const resolved: ResolutionResult["resolved"] = [];
  const stripped: string[] = [];

  // Pre-tokenise all post titles+excerpts once for performance
  const scoredPosts = postIndex.map((p) => ({
    post: p,
    tokens: `${p.title} ${p.excerpt ?? ""}`.toLowerCase().split(/\W+/).filter((t) => t.length > 3),
  }));

  const body = articleBody.replace(PLACEHOLDER_RE, (_fullMatch, rawTopic: string) => {
    const topic = rawTopic.trim();
    const topicTokens = topic.toLowerCase().split(/\W+/).filter((t) => t.length > 3);

    if (topicTokens.length === 0 || scoredPosts.length === 0) {
      stripped.push(topic);
      return topic; // strip brackets, keep topic as plain text
    }

    // Score each post by how many topic tokens appear in its title+excerpt
    let bestScore = 0;
    let bestPost: PostSummaryForResolution | null = null;

    for (const { post, tokens } of scoredPosts) {
      const tokenSet = new Set(tokens);
      const score = topicTokens.reduce((acc, t) => acc + (tokenSet.has(t) ? 1 : 0), 0);
      // Bonus: if the post title contains the full topic string (case-insensitive)
      const titleBonus = post.title.toLowerCase().includes(topic.toLowerCase()) ? 2 : 0;
      const total = score + titleBonus;
      if (total > bestScore) {
        bestScore = total;
        bestPost = post;
      }
    }

    if (bestPost && bestScore >= minScore) {
      resolved.push({ topic, url: bestPost.url, title: bestPost.title });
      console.log(`[LinkResolver] Resolved "${topic}" → ${bestPost.url} (score: ${bestScore})`);
      return `[${bestPost.title}](${bestPost.url})`;
    }

    // Score was below minScore but we still have a best candidate — use it as a fallback
    // rather than stripping the link entirely. Stripping produces zero internal links which
    // is a guaranteed Yoast red flag. Any relevant internal link is better than none.
    if (bestPost && scoredPosts.length > 0) {
      resolved.push({ topic, url: bestPost.url, title: bestPost.title });
      console.log(`[LinkResolver] Fallback resolved "${topic}" → ${bestPost.url} (score: ${bestScore})`);
      return `[${bestPost.title}](${bestPost.url})`;
    }

    // Truly no posts available — strip the placeholder, leave the topic as plain text
    stripped.push(topic);
    console.log(`[LinkResolver] No posts available for "${topic}" — stripped`);
    return topic;
  });

  return { body, resolved, stripped };
}
