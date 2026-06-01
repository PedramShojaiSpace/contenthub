/**
 * retroactive-internal-links.mjs
 *
 * Retroactively applies the Internal Link Optimizer to all existing published
 * blog posts across every keyword campaign cluster.
 *
 * Smart phrase matching strategy:
 *   1. Try exact focusKeyword phrase
 *   2. Try common natural-language variants (e.g. "cortisol and stress" → "cortisol levels", "chronic stress")
 *   3. Try the most distinctive word(s) from the keyword
 *
 * Run with: node scripts/retroactive-internal-links.mjs
 */

import mysql from 'mysql2/promise';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '../.env') });

const WP_BASE_URL = (process.env.WORDPRESS_URL ?? '').replace(/\/$/, '');
const WP_AUTH = Buffer.from(
  `${process.env.WORDPRESS_USERNAME}:${process.env.WORDPRESS_APP_PASSWORD}`
).toString('base64');

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// ─── WordPress helpers ────────────────────────────────────────────────────────

async function wpFetch(url, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30_000);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function resolveWpPostId(publishedUrl) {
  if (!publishedUrl) return null;
  const pMatch = publishedUrl.match(/[?&]p=(\d+)/);
  if (pMatch) return parseInt(pMatch[1]);
  const urlObj = new URL(publishedUrl);
  const slug = urlObj.pathname.replace(/^\/|\/$/g, '').split('/').pop();
  if (!slug) return null;
  const res = await wpFetch(
    `${WP_BASE_URL}/wp-json/wp/v2/posts?slug=${encodeURIComponent(slug)}&per_page=1`,
    { headers: { Authorization: `Basic ${WP_AUTH}` } }
  );
  if (!res.ok) return null;
  const posts = await res.json();
  if (!Array.isArray(posts) || posts.length === 0) return null;
  return posts[0].id;
}

async function fetchWpPost(wpPostId) {
  const res = await wpFetch(
    `${WP_BASE_URL}/wp-json/wp/v2/posts/${wpPostId}?context=edit`,
    { headers: { Authorization: `Basic ${WP_AUTH}` } }
  );
  if (!res.ok) throw new Error(`WP fetch ${wpPostId} failed: ${res.status}`);
  const data = await res.json();
  return {
    content: data.content?.raw ?? data.content?.rendered ?? '',
    title: data.title?.rendered ?? '',
  };
}

async function updateWpPost(wpPostId, htmlContent) {
  const res = await wpFetch(
    `${WP_BASE_URL}/wp-json/wp/v2/posts/${wpPostId}`,
    {
      method: 'POST',
      headers: { Authorization: `Basic ${WP_AUTH}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: htmlContent }),
    }
  );
  if (!res.ok) throw new Error(`WP update ${wpPostId} failed: ${res.status}`);
  return true;
}

// ─── Smart phrase matching ────────────────────────────────────────────────────

// Stop words to strip when building fallback phrases
const STOP_WORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'but', 'for', 'of', 'in', 'on', 'at',
  'to', 'with', 'by', 'from', 'is', 'are', 'was', 'were', 'be', 'been',
  'your', 'my', 'our', 'their', 'its', 'how', 'what', 'why', 'when',
  'that', 'this', 'these', 'those', 'not', 'no', 'so', 'as', 'if',
]);

/**
 * Build a prioritised list of anchor-text candidates for a given focusKeyword.
 * Returns phrases from most specific to least specific.
 */
function buildAnchorCandidates(focusKeyword) {
  const kw = focusKeyword.toLowerCase().trim();
  const words = kw.split(/\s+/);
  const candidates = [kw]; // exact phrase first

  // Try bigrams and trigrams from the keyword (skip stop words)
  const contentWords = words.filter(w => !STOP_WORDS.has(w));
  if (contentWords.length >= 2) {
    // Longest content-word phrase
    candidates.push(contentWords.join(' '));
    // First two content words
    if (contentWords.length > 2) candidates.push(contentWords.slice(0, 2).join(' '));
    // Last two content words
    if (contentWords.length > 2) candidates.push(contentWords.slice(-2).join(' '));
  }

  // Single most distinctive word (longest content word)
  const longest = contentWords.sort((a, b) => b.length - a.length)[0];
  if (longest && longest.length > 5) candidates.push(longest);

  // Deduplicate while preserving order
  return [...new Set(candidates)];
}

function injectLink(html, anchorText, targetUrl) {
  if (html.includes(targetUrl)) return { success: false, html, reason: 'url-exists' };
  const escaped = anchorText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`(?<!<[^>]*)(${escaped})(?![^<]*>)`, 'i');
  const match = html.match(regex);
  if (!match) return { success: false, html, reason: 'phrase-not-found' };
  const newHtml = html.replace(
    regex,
    `<a href="${targetUrl}" title="${anchorText}">${match[1]}</a>`
  );
  return { success: newHtml !== html, html: newHtml, reason: 'ok' };
}

/**
 * Try to inject a link using progressively simpler anchor text candidates.
 */
function smartInjectLink(html, focusKeyword, targetUrl) {
  const candidates = buildAnchorCandidates(focusKeyword);
  for (const candidate of candidates) {
    const result = injectLink(html, candidate, targetUrl);
    if (result.success) {
      return { success: true, html: result.html, usedAnchor: candidate };
    }
    if (result.reason === 'url-exists') {
      return { success: false, html, usedAnchor: null, reason: 'url-exists' };
    }
  }
  return { success: false, html, usedAnchor: null, reason: 'phrase-not-found' };
}

function upsertRelatedReadingSection(pillarHtml, posts) {
  const stripped = pillarHtml.replace(
    /\n?<!-- related-reading -->[\s\S]*?<\/div>/i,
    ''
  ).trim();

  const items = posts
    .map(p => `    <li><a href="${p.url}">${p.title}</a></li>`)
    .join('\n');

  const section = `
<!-- related-reading -->
<div class="related-reading" style="margin-top:2rem;padding:1.5rem;background:#f9f5f0;border-left:4px solid #c8a96e;border-radius:4px;">
  <h3 style="margin:0 0 0.75rem;font-size:1.1rem;color:#2d2d2d;">Related Reading</h3>
  <ul style="margin:0;padding-left:1.25rem;">
${items}
  </ul>
</div>`;

  if (stripped.includes('</article>')) {
    return stripped.replace('</article>', `${section}\n</article>`);
  }
  return stripped + section;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  if (!WP_BASE_URL) throw new Error('WORDPRESS_URL not set');

  const conn = await mysql.createConnection(process.env.DATABASE_URL);

  const [campaigns] = await conn.execute(
    'SELECT id, kc_name, kc_pillar_keyword FROM keyword_campaigns WHERE kc_status = "active" ORDER BY id'
  );
  console.log(`\n📋 Found ${campaigns.length} active keyword campaigns\n`);

  const globalResults = {
    postsProcessed: 0,
    linksInjected: 0,
    pillarPagesUpdated: 0,
    skippedUrlExists: 0,
    skippedPhraseNotFound: 0,
    errors: [],
  };

  for (const campaign of campaigns) {
    console.log(`\n${'═'.repeat(60)}`);
    console.log(`📂 Campaign: ${campaign.kc_name}`);
    console.log(`   Pillar keyword: "${campaign.kc_pillar_keyword}"`);
    console.log('═'.repeat(60));

    const [targets] = await conn.execute(
      `SELECT id, kt_keyword, kt_keyword_type, kt_content_item_id, kt_published_url
       FROM keyword_targets
       WHERE kt_campaign_id = ? AND kt_content_status = 'published' AND kt_published_url IS NOT NULL
       ORDER BY kt_keyword_type DESC, id ASC`,
      [campaign.id]
    );

    if (targets.length === 0) {
      console.log('  ⚠️  No published targets — skipping');
      continue;
    }

    // ── Resolve WP post IDs ───────────────────────────────────────────────────
    console.log(`  🔍 Resolving WP post IDs for ${targets.length} targets...`);
    const campaignPosts = [];

    for (const target of targets) {
      await sleep(250);
      let wpPostId = null;
      let title = target.kt_keyword;

      if (target.kt_content_item_id) {
        const [ciRows] = await conn.execute(
          'SELECT wpPostId, title FROM content_items WHERE id = ? AND wpPostId IS NOT NULL LIMIT 1',
          [target.kt_content_item_id]
        );
        if (ciRows.length > 0) { wpPostId = ciRows[0].wpPostId; title = ciRows[0].title ?? title; }
      }

      if (!wpPostId) {
        const normUrl = target.kt_published_url.replace(/\/$/, '');
        const [ciRows] = await conn.execute(
          'SELECT wpPostId, title FROM content_items WHERE (publishUrl = ? OR publishUrl = ?) AND wpPostId IS NOT NULL LIMIT 1',
          [normUrl + '/', normUrl]
        );
        if (ciRows.length > 0) { wpPostId = ciRows[0].wpPostId; title = ciRows[0].title ?? title; }
      }

      if (!wpPostId) {
        try {
          wpPostId = await resolveWpPostId(target.kt_published_url);
          if (wpPostId) {
            const wpData = await fetchWpPost(wpPostId);
            title = wpData.title || title;
          }
        } catch (e) {
          console.log(`    ⚠️  WP lookup failed for "${target.kt_keyword}": ${e.message}`);
        }
      }

      if (!wpPostId) {
        console.log(`    ❌ No WP ID: "${target.kt_keyword}"`);
        globalResults.errors.push(`No WP ID: "${target.kt_keyword}"`);
        continue;
      }

      console.log(`    ✓ WP#${wpPostId} [${target.kt_keyword_type}] "${target.kt_keyword}"`);
      campaignPosts.push({
        keyword: target.kt_keyword,
        keywordType: target.kt_keyword_type,
        wpPostId,
        url: target.kt_published_url,
        title,
        focusKeyword: target.kt_keyword,
      });
    }

    if (campaignPosts.length === 0) {
      console.log('  ⚠️  No posts resolved — skipping');
      continue;
    }

    let pillarPost = campaignPosts.find(p => p.keywordType === 'pillar');
    if (!pillarPost) {
      pillarPost = campaignPosts.reduce((a, b) =>
        (a.focusKeyword ?? '').length <= (b.focusKeyword ?? '').length ? a : b
      );
      console.log(`\n  ℹ️  No explicit pillar — using: WP#${pillarPost.wpPostId} "${pillarPost.focusKeyword}"`);
    } else {
      console.log(`\n  📌 Pillar: WP#${pillarPost.wpPostId} "${pillarPost.focusKeyword}"`);
    }

    const clusterPosts = campaignPosts.filter(p => p.wpPostId !== pillarPost.wpPostId);
    console.log(`  📝 ${clusterPosts.length} cluster/conversion posts\n`);

    // ── Process each cluster post ─────────────────────────────────────────────
    for (const post of clusterPosts) {
      console.log(`  🔗 WP#${post.wpPostId} "${post.focusKeyword}"`);
      await sleep(400);

      let html;
      try {
        const wpData = await fetchWpPost(post.wpPostId);
        html = wpData.content;
        if (!post.title || post.title === post.keyword) post.title = wpData.title || post.title;
      } catch (e) {
        console.log(`    ❌ Fetch failed: ${e.message}`);
        globalResults.errors.push(`Fetch WP#${post.wpPostId}: ${e.message}`);
        continue;
      }

      const others = clusterPosts.filter(p => p.wpPostId !== post.wpPostId).slice(0, 2);
      const candidates = [pillarPost, ...others];

      let updatedHtml = html;
      let linksAdded = 0;

      for (const candidate of candidates) {
        if (!candidate.url || !candidate.focusKeyword) continue;
        const result = smartInjectLink(updatedHtml, candidate.focusKeyword, candidate.url);
        if (result.success) {
          updatedHtml = result.html;
          linksAdded++;
          console.log(`    ✅ Injected "${result.usedAnchor}" → ${candidate.url}`);
        } else if (result.reason === 'url-exists') {
          console.log(`    ⏭️  URL already present: ${candidate.url}`);
          globalResults.skippedUrlExists++;
        } else {
          console.log(`    ⚠️  Phrase not found for "${candidate.focusKeyword}" (tried all variants)`);
          globalResults.skippedPhraseNotFound++;
        }
      }

      if (linksAdded > 0) {
        try {
          await sleep(300);
          await updateWpPost(post.wpPostId, updatedHtml);
          console.log(`    💾 Saved ${linksAdded} link(s) to WP#${post.wpPostId}`);
          globalResults.linksInjected += linksAdded;
        } catch (e) {
          console.log(`    ❌ Save failed: ${e.message}`);
          globalResults.errors.push(`Save WP#${post.wpPostId}: ${e.message}`);
        }
      } else {
        console.log(`    ℹ️  No new links injected`);
      }

      globalResults.postsProcessed++;
    }

    // ── Rebuild pillar Related Reading section ────────────────────────────────
    console.log(`\n  📌 Rebuilding Related Reading on pillar WP#${pillarPost.wpPostId}...`);
    await sleep(400);

    try {
      const wpData = await fetchWpPost(pillarPost.wpPostId);
      const readingList = clusterPosts
        .filter(p => p.url && p.title)
        .map(p => ({ url: p.url, title: p.title }));

      if (readingList.length > 0) {
        const updatedPillarHtml = upsertRelatedReadingSection(wpData.content, readingList);
        await sleep(300);
        await updateWpPost(pillarPost.wpPostId, updatedPillarHtml);
        console.log(`    ✅ Related Reading rebuilt with ${readingList.length} entries:`);
        readingList.forEach(r => console.log(`       • ${r.title}`));
        globalResults.pillarPagesUpdated++;
      }
    } catch (e) {
      console.log(`    ❌ Pillar update failed: ${e.message}`);
      globalResults.errors.push(`Pillar WP#${pillarPost.wpPostId}: ${e.message}`);
    }
  }

  await conn.end();

  console.log(`\n${'═'.repeat(60)}`);
  console.log('✅ RETROACTIVE INTERNAL LINK BACKFILL COMPLETE');
  console.log('═'.repeat(60));
  console.log(`  Posts processed:         ${globalResults.postsProcessed}`);
  console.log(`  Links injected:          ${globalResults.linksInjected}`);
  console.log(`  Pillar pages updated:    ${globalResults.pillarPagesUpdated}`);
  console.log(`  Skipped (URL exists):    ${globalResults.skippedUrlExists}`);
  console.log(`  Skipped (phrase absent): ${globalResults.skippedPhraseNotFound}`);
  if (globalResults.errors.length > 0) {
    console.log(`\n  ⚠️  Errors (${globalResults.errors.length}):`);
    for (const e of globalResults.errors) console.log(`    • ${e}`);
  }
  console.log('');
}

main().catch(err => {
  console.error('\n💥 Fatal error:', err);
  process.exit(1);
});
