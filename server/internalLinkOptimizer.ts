/**
 * internalLinkOptimizer.ts
 *
 * Automatically injects contextual internal links into newly published blog posts
 * and back-links the pillar page to the new supporting post.
 *
 * Strategy:
 * 1. Find the keyword campaign that owns the new post's focusKeyword
 * 2. Identify the pillar post for that campaign (keywordType = "pillar")
 * 3. Find 2–3 other published supporting posts in the same campaign
 * 4. Inject contextual anchor-text links into the new post's HTML body
 * 5. Update the pillar page in WordPress to add the new post to its Related Reading section
 */

import { getDb } from "./db";
import {
  contentItems,
  keywordCampaigns,
  keywordTargets,
} from "../drizzle/schema";
import { and, eq, inArray, isNotNull, ne } from "drizzle-orm";
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

interface PublishedItem {
  id: number;
  title: string | null;
  wpPostId: number | null;
  publishUrl: string | null;
  focusKeyword: string | null;
}

interface CampaignTarget {
  targetId: number;
  keyword: string;
  keywordType: string;
  contentItemId: number | null;
  publishedUrl: string | null;
}

// ---------------------------------------------------------------------------
// Main entry point — call this after a blog post is published to WordPress
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

    // Look for a keyword target matching this focusKeyword
    const matchingTargets = await db
      .select({
        targetId: keywordTargets.id,
        campaignId: keywordTargets.campaignId,
        keywordType: keywordTargets.keywordType,
      })
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
      // Fallback: try to match via pillarKeyword on campaigns
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
      result.errors.push(`No keyword campaign found for focus keyword: "${newPostFocusKeyword}"`);
      return result;
    }

    // -----------------------------------------------------------------------
    // Step 2: Get all published posts in this campaign (excluding the new post)
    // -----------------------------------------------------------------------
    const rawCampaignTargets = await db
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
          isNotNull(keywordTargets.contentItemId)
        )
      );

    const campaignTargets: CampaignTarget[] = rawCampaignTargets.map((t) => ({
      targetId: t.targetId,
      keyword: t.keyword,
      keywordType: t.keywordType,
      contentItemId: t.contentItemId,
      publishedUrl: t.publishedUrl,
    }));

    // Also fetch content_items for these targets to get wpPostId and title
    const contentItemIds: number[] = campaignTargets
      .map((t: CampaignTarget) => t.contentItemId)
      .filter((id: number | null): id is number => id !== null);

    let publishedItems: PublishedItem[] = [];

    if (contentItemIds.length > 0) {
      const rawItems = await db
        .select({
          id: contentItems.id,
          title: contentItems.title,
          wpPostId: contentItems.wpPostId,
          publishUrl: contentItems.publishUrl,
          focusKeyword: contentItems.focusKeyword,
        })
        .from(contentItems)
        .where(
          and(
            inArray(contentItems.id, contentItemIds),
            isNotNull(contentItems.wpPostId),
            isNotNull(contentItems.publishUrl),
            ne(contentItems.wpPostId, newPostWpId)
          )
        );

      publishedItems = rawItems.map((p) => ({
        id: p.id,
        title: p.title,
        wpPostId: p.wpPostId,
        publishUrl: p.publishUrl,
        focusKeyword: p.focusKeyword,
      }));
    }

    // -----------------------------------------------------------------------
    // Step 3: Identify the pillar post
    // -----------------------------------------------------------------------
    const pillarTarget = campaignTargets.find((t: CampaignTarget) => t.keywordType === "pillar");
    let pillarItem: PublishedItem | undefined = pillarTarget?.contentItemId
      ? publishedItems.find((p: PublishedItem) => p.id === pillarTarget.contentItemId)
      : undefined;

    // Fallback: the post with the shortest focusKeyword is likely the pillar
    if (!pillarItem && publishedItems.length > 0) {
      pillarItem = publishedItems.reduce((shortest: PublishedItem, current: PublishedItem) => {
        const sLen = (shortest.focusKeyword ?? "").length;
        const cLen = (current.focusKeyword ?? "").length;
        return cLen < sLen ? current : shortest;
      });
    }

    // -----------------------------------------------------------------------
    // Step 4: Pick 2–3 supporting posts to link to (not the pillar, not self)
    // -----------------------------------------------------------------------
    const supportingPosts = publishedItems
      .filter((p: PublishedItem) => p.id !== pillarItem?.id && p.wpPostId !== newPostWpId)
      .slice(0, 3);

    // Build the full link candidates list: pillar first, then supporting
    const linkCandidates: PublishedItem[] = [
      ...(pillarItem ? [pillarItem] : []),
      ...supportingPosts,
    ].slice(0, 3); // max 3 internal links per post

    // -----------------------------------------------------------------------
    // Step 5: Inject contextual links into the new post's HTML body
    // -----------------------------------------------------------------------
    let updatedHtml = newPostHtmlBody;

    for (const candidate of linkCandidates) {
      if (!candidate.publishUrl || !candidate.focusKeyword) continue;

      const anchorText = candidate.focusKeyword;
      const targetUrl = candidate.publishUrl;

      // Try to find the anchor text in the body (case-insensitive) and wrap it
      const injected = injectLink(updatedHtml, anchorText, targetUrl);

      if (injected.success) {
        updatedHtml = injected.html;
        result.linksInjected++;
        result.linkedPosts.push({
          title: candidate.title ?? anchorText,
          url: targetUrl,
          anchorText,
        });
      }
    }

    // Push updated HTML back to WordPress if any links were injected
    if (result.linksInjected > 0) {
      try {
        await updateWpPostContent(newPostWpId, updatedHtml);
      } catch (e) {
        result.errors.push(`Failed to update new post HTML in WordPress: ${String(e)}`);
      }
    }

    // -----------------------------------------------------------------------
    // Step 6: Update the pillar page to add new post to Related Reading section
    // -----------------------------------------------------------------------
    if (pillarItem?.wpPostId && pillarItem.wpPostId !== newPostWpId) {
      try {
        const pillarData = await fetchSingleWpPost(pillarItem.wpPostId);
        const pillarHtml = pillarData.content;

        if (pillarHtml) {
          const updatedPillarHtml = addRelatedReadingEntry(
            pillarHtml,
            newPostTitle,
            newPostUrl
          );

          if (updatedPillarHtml !== pillarHtml) {
            await updateWpPostContent(pillarItem.wpPostId, updatedPillarHtml);
            result.pillarUpdated = true;
            result.pillarWpPostId = pillarItem.wpPostId;
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

// ---------------------------------------------------------------------------
// Helper: inject a single contextual link into HTML body
// ---------------------------------------------------------------------------

function injectLink(
  html: string,
  anchorText: string,
  targetUrl: string
): { success: boolean; html: string } {
  // Avoid injecting if the URL is already present in the HTML
  if (html.includes(targetUrl)) {
    return { success: false, html };
  }

  // Escape special regex chars in anchor text
  const escaped = anchorText.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  // Match the anchor text only when it's not already inside an HTML tag
  const regex = new RegExp(`(?<!<[^>]*)(${escaped})(?![^<]*>)`, "i");

  const match = html.match(regex);
  if (!match) {
    return { success: false, html };
  }

  // Replace only the FIRST occurrence (not inside an existing anchor tag)
  const newHtml = html.replace(
    regex,
    `<a href="${targetUrl}" title="${anchorText}">${match[1]}</a>`
  );

  return { success: newHtml !== html, html: newHtml };
}

// ---------------------------------------------------------------------------
// Helper: add a new entry to the Related Reading section of a pillar page
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
        // Avoid duplicates
        if (existing.includes(newPostUrl)) return _;
        return `${open}${existing}${newEntry}${close}`;
      }
    );
  }

  // If no Related Reading section exists, append one before </article> or at the end
  const relatedSection = `
<!-- related-reading -->
<div class="related-reading" style="margin-top:2rem;padding:1.5rem;background:#f9f5f0;border-left:4px solid #c8a96e;border-radius:4px;">
  <h3 style="margin:0 0 0.75rem;font-size:1.1rem;color:#2d2d2d;">Related Reading</h3>
  <ul style="margin:0;padding-left:1.25rem;">
    ${newEntry}
  </ul>
</div>`;

  // Insert before </article> if present, otherwise append
  if (pillarHtml.includes("</article>")) {
    return pillarHtml.replace("</article>", `${relatedSection}\n</article>`);
  }

  return pillarHtml + relatedSection;
}
