/**
 * internalLinkOptimizer.ts
 *
 * Automatically injects contextual internal links into newly published blog posts
 * and back-links the pillar page to the new supporting post.
 *
 * Strategy:
 * 1. Find the keyword campaign that owns the new post's focusKeyword
 * 2. Identify the pillar post for that campaign (keywordType = "pillar")
 * 3. Find all other published posts in the same campaign
 *    — resolves WP post IDs via: contentItemId → URL match → WP REST API slug lookup
 * 4. Inject contextual anchor-text links into the new post's HTML body
 *    — uses smart phrase matching: exact keyword → content-word phrases → single distinctive word
 * 5. Update the pillar page in WordPress to add the new post to its Related Reading section
 */

import { getDb } from "./db";
import { keywordCampaigns, keywordTargets, contentItems } from "../drizzle/schema";
import { and, eq, isNotNull, ne } from "drizzle-orm";
import { updateWpPostContent, fetchSingleWpPost } from "./wordpress";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface InternalLinkResult {
  linksInjected: number;
  pillarUpdated: boolean;
  pillarWpPostId?: number;
  linkedPosts: Array<{ title: string; url: string; anchorText: string }>;
  errors: string[];
}

interface ResolvedPost {
  wpPostId: number;
  title: string;
  url: string;
  focusKeyword: string;
  keywordType: string;
}

// ---------------------------------------------------------------------------
// WordPress REST API helpers
// ---------------------------------------------------------------------------

const WP_BASE_URL = (process.env.WORDPRESS_URL ?? "").replace(/\/$/, "");
const WP_AUTH = Buffer.from(
  `${process.env.WORDPRESS_USERNAME}:${process.env.WORDPRESS_APP_PASSWORD}`
).toString("base64");

async function wpFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 25_000);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Resolve a WP post ID from a published URL.
 * Tries ?p=XXXX first, then slug-based REST API lookup.
 */
async function resolveWpPostIdFromUrl(publishedUrl: string): Promise<{ wpPostId: number; title: string } | null> {
  if (!publishedUrl) return null;

  // Handle ?p=XXXX style URLs
  const pMatch = publishedUrl.match(/[?&]p=(\d+)/);
  if (pMatch) {
    const wpPostId = parseInt(pMatch[1]);
    try {
      const res = await wpFetch(
        `${WP_BASE_URL}/wp-json/wp/v2/posts/${wpPostId}?context=edit`,
        { headers: { Authorization: `Basic ${WP_AUTH}` } }
      );
      if (res.ok) {
        const data = await res.json() as { title?: { rendered?: string } };
        return { wpPostId, title: data.title?.rendered ?? "" };
      }
    } catch { /* fall through */ }
    return { wpPostId, title: "" };
  }

  // Extract slug from URL
  try {
    const urlObj = new URL(publishedUrl);
    const slug = urlObj.pathname.replace(/^\/|\/$/g, "").split("/").pop();
    if (!slug) return null;

    const res = await wpFetch(
      `${WP_BASE_URL}/wp-json/wp/v2/posts?slug=${encodeURIComponent(slug)}&per_page=1&context=edit`,
      { headers: { Authorization: `Basic ${WP_AUTH}` } }
    );
    if (!res.ok) return null;
    const posts = await res.json() as Array<{ id: number; title?: { rendered?: string } }>;
    if (!Array.isArray(posts) || posts.length === 0) return null;
    return { wpPostId: posts[0].id, title: posts[0].title?.rendered ?? "" };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Smart phrase matching helpers
// ---------------------------------------------------------------------------

const STOP_WORDS = new Set([
  "a", "an", "the", "and", "or", "but", "for", "of", "in", "on", "at",
  "to", "with", "by", "from", "is", "are", "was", "were", "be", "been",
  "your", "my", "our", "their", "its", "how", "what", "why", "when",
  "that", "this", "these", "those", "not", "no", "so", "as", "if",
]);

function buildAnchorCandidates(focusKeyword: string): string[] {
  const kw = focusKeyword.toLowerCase().trim();
  const words = kw.split(/\s+/);
  const candidates: string[] = [kw];

  const contentWords = words.filter((w) => !STOP_WORDS.has(w));
  if (contentWords.length >= 2) {
    candidates.push(contentWords.join(" "));
    if (contentWords.length > 2) candidates.push(contentWords.slice(0, 2).join(" "));
    if (contentWords.length > 2) candidates.push(contentWords.slice(-2).join(" "));
  }

  const longest = [...contentWords].sort((a, b) => b.length - a.length)[0];
  if (longest && longest.length > 5) candidates.push(longest);

  return Array.from(new Set(candidates));
}

function injectLink(
  html: string,
  anchorText: string,
  targetUrl: string
): { success: boolean; html: string; usedAnchor?: string } {
  if (html.includes(targetUrl)) return { success: false, html };

  const escaped = anchorText.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(`(?<!<[^>]*)(${escaped})(?![^<]*>)`, "i");
  const match = html.match(regex);
  if (!match) return { success: false, html };

  const newHtml = html.replace(
    regex,
    `<a href="${targetUrl}" title="${anchorText}">${match[1]}</a>`
  );
  return { success: newHtml !== html, html: newHtml, usedAnchor: anchorText };
}

function smartInjectLink(
  html: string,
  focusKeyword: string,
  targetUrl: string
): { success: boolean; html: string; usedAnchor?: string } {
  const candidates = buildAnchorCandidates(focusKeyword);
  for (const candidate of candidates) {
    const result = injectLink(html, candidate, targetUrl);
    if (result.success) return result;
    if (html.includes(targetUrl)) return { success: false, html }; // URL already present
  }
  return { success: false, html };
}

// ---------------------------------------------------------------------------
// Related Reading section helpers
// ---------------------------------------------------------------------------

function addRelatedReadingEntry(
  pillarHtml: string,
  newPostTitle: string,
  newPostUrl: string
): string {
  const newEntry = `<li><a href="${newPostUrl}">${newPostTitle}</a></li>`;

  // If a Related Reading section already exists, append to its <ul>
  const relatedReadingRegex = /(<!-- related-reading -->[\s\S]*?<ul[^>]*>)([\s\S]*?)(<\/ul>)/i;
  if (relatedReadingRegex.test(pillarHtml)) {
    return pillarHtml.replace(
      relatedReadingRegex,
      (_: string, open: string, existing: string, close: string) => {
        if (existing.includes(newPostUrl)) return _;
        return `${open}${existing}    ${newEntry}\n  ${close}`;
      }
    );
  }

  // No Related Reading section yet — create one
  const relatedSection = `
<!-- related-reading -->
<div class="related-reading" style="margin-top:2rem;padding:1.5rem;background:#f9f5f0;border-left:4px solid #c8a96e;border-radius:4px;">
  <h3 style="margin:0 0 0.75rem;font-size:1.1rem;color:#2d2d2d;">Related Reading</h3>
  <ul style="margin:0;padding-left:1.25rem;">
    ${newEntry}
  </ul>
</div>`;

  if (pillarHtml.includes("</article>")) {
    return pillarHtml.replace("</article>", `${relatedSection}\n</article>`);
  }
  return pillarHtml + relatedSection;
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

export async function runInternalLinkOptimizer(params: {
  newPostWpId: number;
  newPostHtmlBody: string;
  newPostFocusKeyword: string;
  newPostTitle: string;
  newPostUrl: string;
  userId: number;
}): Promise<InternalLinkResult> {
  const {
    newPostWpId,
    newPostHtmlBody,
    newPostFocusKeyword,
    newPostTitle,
    newPostUrl,
    userId,
  } = params;

  const result: InternalLinkResult = {
    linksInjected: 0,
    pillarUpdated: false,
    linkedPosts: [],
    errors: [],
  };

  const db = await getDb();
  if (!db) {
    result.errors.push("Database not available");
    return result;
  }

  try {
    // -----------------------------------------------------------------------
    // Step 1: Find the keyword campaign that owns this post's focusKeyword
    // -----------------------------------------------------------------------
    const kw = newPostFocusKeyword.toLowerCase().trim();

    const matchingTargets = await db
      .select({ campaignId: keywordTargets.campaignId })
      .from(keywordTargets)
      .where(
        and(
          eq(keywordTargets.userId, userId),
          eq(keywordTargets.keyword, kw)
        )
      )
      .limit(1);

    let campaignId: number | null = null;

    if (matchingTargets.length > 0) {
      campaignId = matchingTargets[0].campaignId;
    } else {
      // Fallback: match via pillarKeyword
      const campaigns = await db
        .select({ id: keywordCampaigns.id, pillarKeyword: keywordCampaigns.pillarKeyword })
        .from(keywordCampaigns)
        .where(eq(keywordCampaigns.userId, userId));

      for (const c of campaigns) {
        if (
          kw.includes(c.pillarKeyword.toLowerCase()) ||
          c.pillarKeyword.toLowerCase().includes(kw)
        ) {
          campaignId = c.id;
          break;
        }
      }
    }

    if (!campaignId) {
      result.errors.push(`No keyword campaign found for: "${newPostFocusKeyword}"`);
      return result;
    }

    // -----------------------------------------------------------------------
    // Step 2: Get all published targets in this campaign (excluding new post)
    // -----------------------------------------------------------------------
    const rawTargets = await db
      .select({
        targetId: keywordTargets.id,
        keyword: keywordTargets.keyword,
        keywordType: keywordTargets.keywordType,
        contentItemId: keywordTargets.contentItemId,
        publishedUrl: keywordTargets.publishedUrl,
      })
      .from(keywordTargets)
      .where(
        and(
          eq(keywordTargets.campaignId, campaignId),
          eq(keywordTargets.userId, userId),
          eq(keywordTargets.contentStatus, "published"),
          isNotNull(keywordTargets.publishedUrl),
          ne(keywordTargets.keyword, kw) // exclude the new post itself
        )
      );

    // -----------------------------------------------------------------------
    // Step 3: Resolve WP post IDs for each sibling target
    //   Priority: contentItemId → URL match in content_items → WP REST API slug
    // -----------------------------------------------------------------------
    const resolvedPosts: ResolvedPost[] = [];

    for (const target of rawTargets) {
      if (!target.publishedUrl) continue;

      let wpPostId: number | null = null;
      let title: string = target.keyword;

      // Try contentItemId first
      if (target.contentItemId) {
        const ciRows = await db
          .select({ wpPostId: contentItems.wpPostId, title: contentItems.title })
          .from(contentItems)
          .where(
            and(
              eq(contentItems.id, target.contentItemId),
              isNotNull(contentItems.wpPostId)
            )
          )
          .limit(1);
        if (ciRows.length > 0 && ciRows[0].wpPostId) {
          wpPostId = ciRows[0].wpPostId;
          title = ciRows[0].title ?? title;
        }
      }

      // Try URL match in content_items
      if (!wpPostId) {
        const normUrl = target.publishedUrl.replace(/\/$/, "");
        const ciRows = await db
          .select({ wpPostId: contentItems.wpPostId, title: contentItems.title })
          .from(contentItems)
          .where(isNotNull(contentItems.wpPostId))
          .limit(50); // fetch a batch and filter in JS to avoid complex SQL

        const match = ciRows.find(
          (r) =>
            r.wpPostId &&
            (
              (contentItems as unknown as { publishUrl?: string }).publishUrl === normUrl ||
              (contentItems as unknown as { publishUrl?: string }).publishUrl === normUrl + "/"
            )
        );
        if (match?.wpPostId) {
          wpPostId = match.wpPostId;
          title = match.title ?? title;
        }
      }

      // Fallback: WP REST API slug lookup
      if (!wpPostId) {
        try {
          const resolved = await resolveWpPostIdFromUrl(target.publishedUrl);
          if (resolved) {
            wpPostId = resolved.wpPostId;
            if (resolved.title) title = resolved.title;
          }
        } catch (e) {
          result.errors.push(`WP lookup failed for "${target.keyword}": ${String(e)}`);
        }
      }

      if (!wpPostId || wpPostId === newPostWpId) continue;

      resolvedPosts.push({
        wpPostId,
        title,
        url: target.publishedUrl,
        focusKeyword: target.keyword,
        keywordType: target.keywordType,
      });
    }

    if (resolvedPosts.length === 0) {
      result.errors.push("No sibling posts resolved — nothing to link to");
      return result;
    }

    // -----------------------------------------------------------------------
    // Step 4: Identify pillar post
    // -----------------------------------------------------------------------
    let pillarPost = resolvedPosts.find((p) => p.keywordType === "pillar");
    if (!pillarPost) {
      pillarPost = resolvedPosts.reduce((a, b) =>
        (a.focusKeyword ?? "").length <= (b.focusKeyword ?? "").length ? a : b
      );
    }

    // -----------------------------------------------------------------------
    // Step 5: Inject contextual links into the new post
    // -----------------------------------------------------------------------
    const others = resolvedPosts.filter((p) => p.wpPostId !== pillarPost!.wpPostId).slice(0, 2);
    const linkCandidates: ResolvedPost[] = [pillarPost, ...others];

    let updatedHtml = newPostHtmlBody;

    for (const candidate of linkCandidates) {
      const injected = smartInjectLink(updatedHtml, candidate.focusKeyword, candidate.url);
      if (injected.success && injected.html !== updatedHtml) {
        updatedHtml = injected.html;
        result.linksInjected++;
        result.linkedPosts.push({
          title: candidate.title,
          url: candidate.url,
          anchorText: injected.usedAnchor ?? candidate.focusKeyword,
        });
      }
    }

    if (result.linksInjected > 0) {
      try {
        await updateWpPostContent(newPostWpId, updatedHtml);
      } catch (e) {
        result.errors.push(`Failed to update new post in WordPress: ${String(e)}`);
      }
    }

    // -----------------------------------------------------------------------
    // Step 6: Update the pillar page Related Reading section
    // -----------------------------------------------------------------------
    if (pillarPost.wpPostId !== newPostWpId) {
      try {
        const pillarData = await fetchSingleWpPost(pillarPost.wpPostId);
        const pillarHtml = pillarData.content;

        if (pillarHtml) {
          const updatedPillarHtml = addRelatedReadingEntry(pillarHtml, newPostTitle, newPostUrl);
          if (updatedPillarHtml !== pillarHtml) {
            await updateWpPostContent(pillarPost.wpPostId, updatedPillarHtml);
            result.pillarUpdated = true;
            result.pillarWpPostId = pillarPost.wpPostId;
          }
        }
      } catch (e) {
        result.errors.push(`Failed to update pillar page: ${String(e)}`);
      }
    }
  } catch (e) {
    result.errors.push(`Internal link optimizer error: ${String(e)}`);
  }

  return result;
}
