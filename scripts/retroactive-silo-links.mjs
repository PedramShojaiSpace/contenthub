/**
 * retroactive-silo-links.mjs
 *
 * Retroactively applies the new silo-based vertical chain link optimizer
 * to all existing published WordPress posts.
 *
 * Strategy:
 * 1. Fetch all published posts from WordPress (up to 500)
 * 2. Group them by WordPress subcategory (silo)
 * 3. For each silo, identify the pillar post (shortest focus keyword)
 * 4. For each non-pillar post in the silo:
 *    a. Inject contextual links to the pillar + up to 2 sibling posts
 *    b. Update the pillar's Related Reading section
 * 5. Report results
 *
 * Safe to run multiple times — skips links that already exist.
 */

import "dotenv/config";
import { createConnection } from "mysql2/promise";

const WP_BASE_URL = (process.env.WORDPRESS_URL ?? "").replace(/\/$/, "");
const WP_AUTH = Buffer.from(
  `${process.env.WORDPRESS_USERNAME}:${process.env.WORDPRESS_APP_PASSWORD}`
).toString("base64");

// ---------------------------------------------------------------------------
// WordPress helpers
// ---------------------------------------------------------------------------

async function wpFetch(url, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30_000);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    return res;
  } finally {
    clearTimeout(timer);
  }
}

async function getAllPublishedPosts() {
  const posts = [];
  let page = 1;
  while (true) {
    const res = await wpFetch(
      `${WP_BASE_URL}/wp-json/wp/v2/posts?status=publish&per_page=100&page=${page}&_fields=id,title,link,categories,meta`,
      { headers: { Authorization: `Basic ${WP_AUTH}` } }
    );
    if (!res.ok) break;
    const batch = await res.json();
    if (!Array.isArray(batch) || batch.length === 0) break;
    posts.push(...batch);
    if (batch.length < 100) break;
    page++;
  }
  return posts;
}

async function getPostContent(wpPostId) {
  const res = await wpFetch(
    `${WP_BASE_URL}/wp-json/wp/v2/posts/${wpPostId}?context=edit&_fields=id,content`,
    { headers: { Authorization: `Basic ${WP_AUTH}` } }
  );
  if (!res.ok) return null;
  const data = await res.json();
  return data.content?.rendered ?? data.content?.raw ?? null;
}

async function updatePostContent(wpPostId, content) {
  const res = await wpFetch(
    `${WP_BASE_URL}/wp-json/wp/v2/posts/${wpPostId}`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${WP_AUTH}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ content }),
    }
  );
  return res.ok;
}

// ---------------------------------------------------------------------------
// Link injection helpers
// ---------------------------------------------------------------------------

const STOP_WORDS = new Set([
  "a", "an", "the", "and", "or", "but", "for", "of", "in", "on", "at",
  "to", "with", "by", "from", "is", "are", "was", "were", "be", "been",
  "your", "my", "our", "their", "its", "how", "what", "why", "when",
  "that", "this", "these", "those", "not", "no", "so", "as", "if",
]);

function buildAnchorCandidates(focusKeyword) {
  const kw = focusKeyword.toLowerCase().trim();
  const words = kw.split(/\s+/);
  const candidates = [kw];
  const contentWords = words.filter((w) => !STOP_WORDS.has(w));
  if (contentWords.length >= 2) {
    candidates.push(contentWords.join(" "));
    if (contentWords.length > 2) candidates.push(contentWords.slice(0, 2).join(" "));
    if (contentWords.length > 2) candidates.push(contentWords.slice(-2).join(" "));
  }
  const longest = [...contentWords].sort((a, b) => b.length - a.length)[0];
  if (longest && longest.length > 5) candidates.push(longest);
  return [...new Set(candidates)];
}

function injectLink(html, anchorText, targetUrl) {
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

function smartInjectLink(html, focusKeyword, targetUrl) {
  const candidates = buildAnchorCandidates(focusKeyword);
  for (const candidate of candidates) {
    const result = injectLink(html, candidate, targetUrl);
    if (result.success) return result;
    if (html.includes(targetUrl)) return { success: false, html };
  }
  return { success: false, html };
}

function addRelatedReadingEntry(pillarHtml, newPostTitle, newPostUrl) {
  const newEntry = `<li><a href="${newPostUrl}">${newPostTitle}</a></li>`;
  const relatedReadingRegex = /(<!-- related-reading -->[\s\S]*?<ul[^>]*>)([\s\S]*?)(<\/ul>)/i;
  if (relatedReadingRegex.test(pillarHtml)) {
    return pillarHtml.replace(
      relatedReadingRegex,
      (_, open, existing, close) => {
        if (existing.includes(newPostUrl)) return _;
        return `${open}${existing}    ${newEntry}\n  ${close}`;
      }
    );
  }
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
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log("=== Retroactive Silo-Based Link Backfill ===\n");

  // 1. Fetch all published posts
  console.log("Fetching all published posts from WordPress...");
  const allPosts = await getAllPublishedPosts();
  console.log(`  Found ${allPosts.length} published posts\n`);

  // 2. Group by subcategory (silo)
  // Parent "Health and Wellness" = 19, "Uncategorized" = 1 — skip these as silo IDs
  const SKIP_CATS = new Set([1, 19, 941]);
  const siloMap = new Map(); // subcategoryId → [post, ...]

  for (const post of allPosts) {
    const cats = post.categories ?? [];
    const subcat = cats.find((id) => !SKIP_CATS.has(id));
    if (!subcat) continue; // no subcategory — skip
    if (!siloMap.has(subcat)) siloMap.set(subcat, []);
    siloMap.get(subcat).push({
      id: post.id,
      title: post.title?.rendered ?? "",
      url: post.link ?? "",
      focusKeyword: ((post.meta?._yoast_wpseo_focuskw ?? "").toLowerCase().trim()) || ((post.title?.rendered ?? "").toLowerCase()),
    });
  }

  console.log(`Found ${siloMap.size} silos (subcategories) with posts:\n`);
  for (const [catId, posts] of siloMap) {
    console.log(`  Subcategory ${catId}: ${posts.length} posts`);
  }
  console.log();

  // 3. Process each silo
  let totalLinksInjected = 0;
  let totalPillarUpdates = 0;
  let totalPostsProcessed = 0;
  let totalErrors = 0;

  for (const [catId, posts] of siloMap) {
    if (posts.length < 2) {
      console.log(`  [Subcategory ${catId}] Only 1 post — skipping\n`);
      continue;
    }

    // Identify pillar: shortest focusKeyword
    const pillar = posts.reduce((a, b) =>
      (a.focusKeyword ?? "").length <= (b.focusKeyword ?? "").length ? a : b
    );

    console.log(`\n[Subcategory ${catId}] ${posts.length} posts — Pillar: "${pillar.title}" (WP#${pillar.id})`);

    // Process each non-pillar post
    for (const post of posts) {
      if (post.id === pillar.id) continue;

      totalPostsProcessed++;
      const siblings = posts.filter((p) => p.id !== post.id && p.id !== pillar.id).slice(0, 2);
      const linkCandidates = [pillar, ...siblings];

      // Fetch post content
      const html = await getPostContent(post.id);
      if (!html) {
        console.log(`  [WP#${post.id}] Could not fetch content — skipping`);
        totalErrors++;
        continue;
      }

      let updatedHtml = html;
      let linksInjected = 0;

      for (const candidate of linkCandidates) {
        const result = smartInjectLink(updatedHtml, candidate.focusKeyword, candidate.url);
        if (result.success) {
          updatedHtml = result.html;
          linksInjected++;
        }
      }

      if (linksInjected > 0) {
        const ok = await updatePostContent(post.id, updatedHtml);
        if (ok) {
          console.log(`  [WP#${post.id}] "${post.title}" → injected ${linksInjected} link(s)`);
          totalLinksInjected += linksInjected;
        } else {
          console.log(`  [WP#${post.id}] "${post.title}" → FAILED to update`);
          totalErrors++;
        }
      } else {
        console.log(`  [WP#${post.id}] "${post.title}" → no matching phrases found`);
      }

      // Update pillar Related Reading
      const pillarHtml = await getPostContent(pillar.id);
      if (pillarHtml) {
        const updatedPillarHtml = addRelatedReadingEntry(pillarHtml, post.title, post.url);
        if (updatedPillarHtml !== pillarHtml) {
          const ok = await updatePostContent(pillar.id, updatedPillarHtml);
          if (ok) {
            console.log(`  [WP#${pillar.id}] Pillar Related Reading updated with "${post.title}"`);
            totalPillarUpdates++;
          }
        }
      }

      // Small delay to avoid overwhelming WP REST API
      await new Promise((r) => setTimeout(r, 300));
    }
  }

  console.log("\n=== BACKFILL COMPLETE ===");
  console.log(`Posts processed:    ${totalPostsProcessed}`);
  console.log(`Links injected:     ${totalLinksInjected}`);
  console.log(`Pillar RR updates:  ${totalPillarUpdates}`);
  console.log(`Errors:             ${totalErrors}`);
}

main().catch(console.error);
