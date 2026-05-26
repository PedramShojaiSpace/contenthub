/**
 * Fix WP#9805 (Holistic Health Optimization Programs) and audit all posts
 * for truncated meta descriptions and missing keyphrase in H2s.
 */
import 'dotenv/config';
import mysql from 'mysql2/promise';
import { marked } from 'marked';

const WP_URL = process.env.WORDPRESS_URL;
const WP_USER = process.env.WORDPRESS_USERNAME;
const WP_PASS = process.env.WORDPRESS_APP_PASSWORD;

function wpAuth() {
  return 'Basic ' + Buffer.from(`${WP_USER}:${WP_PASS}`).toString('base64');
}

async function getWpPost(wpPostId) {
  const res = await fetch(`${WP_URL}/wp-json/wp/v2/posts/${wpPostId}?context=edit`, {
    headers: { Authorization: wpAuth() },
  });
  return res.json();
}

async function updateWpPost(wpPostId, updates) {
  const res = await fetch(`${WP_URL}/wp-json/wp/v2/posts/${wpPostId}`, {
    method: 'POST',
    headers: {
      Authorization: wpAuth(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(updates),
  });
  return res.json();
}

function countKeyphraseInH2s(html, keyphrase) {
  const kp = keyphrase.toLowerCase();
  const h2Matches = [...html.matchAll(/<h2[^>]*>(.*?)<\/h2>/gi)];
  return h2Matches.filter(m => m[1].toLowerCase().includes(kp)).length;
}

function injectKeyphraseIntoH2(html, keyphrase) {
  const kp = keyphrase.toLowerCase();
  const h2Matches = [...html.matchAll(/<h2[^>]*>(.*?)<\/h2>/gi)];
  if (h2Matches.length < 3) return html; // safety: need at least 3 H2s
  // Pick the 3rd H2 (index 2) — typically the framework/protocol section
  const target = h2Matches[2];
  const originalText = target[1];
  if (originalText.toLowerCase().includes(kp)) return html; // already has it
  // Prepend keyphrase naturally
  const fixed = target[0].replace(
    target[1],
    `${keyphrase.charAt(0).toUpperCase() + keyphrase.slice(1)}: ${originalText}`
  );
  return html.replace(target[0], fixed);
}

function trimMetaDesc(desc) {
  if (!desc) return desc;
  // Remove trailing ellipsis patterns
  let clean = desc.replace(/\.{3,}$/, '').replace(/…$/, '').trim();
  // If still over 155, trim at last word boundary
  if (clean.length > 155) {
    clean = clean.substring(0, 152).replace(/\s+\S*$/, '') + '.';
  }
  return clean;
}

async function main() {
  const conn = await mysql.createConnection(process.env.DATABASE_URL);

  // 1. Get all published blog posts with WP IDs
  const [posts] = await conn.execute(`
    SELECT id, title, wpPostId, focusKeyword, yoastMetaDescription, yoastSeoTitle, textContent
    FROM content_items
    WHERE platform = 'blog' 
      AND status = 'published'
      AND wpPostId IS NOT NULL
    ORDER BY createdAt DESC
    LIMIT 60
  `);

  console.log(`\nAuditing ${posts.length} published blog posts...\n`);

  const needsMetaFix = [];
  const needsH2Fix = [];

  for (const post of posts) {
    const metaDesc = post.yoastMetaDescription || '';
    const hasTruncation = metaDesc.endsWith('...') || metaDesc.endsWith('…');
    const overLength = metaDesc.length > 155;

    if (hasTruncation || overLength) {
      needsMetaFix.push(post);
    }

    // Check H2 keyphrase in WP content
    if (post.focusKeyword) {
      const kp = post.focusKeyword.toLowerCase();
      // Quick check from textContent (markdown)
      const body = post.textContent || '';
      const h2Lines = body.split('\n').filter(l => l.startsWith('## '));
      const hasKpInH2 = h2Lines.some(l => l.toLowerCase().includes(kp));
      if (!hasKpInH2 && h2Lines.length > 0) {
        needsH2Fix.push(post);
      }
    }
  }

  console.log(`Meta desc issues: ${needsMetaFix.length}`);
  console.log(`H2 keyphrase missing: ${needsH2Fix.length}`);

  // 2. Fix meta descriptions
  for (const post of needsMetaFix) {
    const fixed = trimMetaDesc(post.yoastMetaDescription);
    console.log(`\nFixing meta desc for WP#${post.wpPostId}: "${post.title}"`);
    console.log(`  Before (${post.yoastMetaDescription?.length}): ${post.yoastMetaDescription}`);
    console.log(`  After  (${fixed?.length}): ${fixed}`);

    // Update WP Yoast meta
    await updateWpPost(post.wpPostId, {
      meta: {
        _yoast_wpseo_metadesc: fixed,
      },
    });

    // Update DB
    await conn.execute(
      'UPDATE content_items SET yoastMetaDescription = ? WHERE id = ?',
      [fixed, post.id]
    );
  }

  // 3. Fix H2 keyphrases
  for (const post of needsH2Fix) {
    console.log(`\nFixing H2 keyphrase for WP#${post.wpPostId}: "${post.title}" [kp: ${post.focusKeyword}]`);

    // Get current WP HTML
    const wpPost = await getWpPost(post.wpPostId);
    const currentHtml = wpPost.content?.raw || '';

    const kpCount = countKeyphraseInH2s(currentHtml, post.focusKeyword);
    if (kpCount > 0) {
      console.log(`  Already has keyphrase in ${kpCount} H2(s) — skipping`);
      continue;
    }

    const fixedHtml = injectKeyphraseIntoH2(currentHtml, post.focusKeyword);
    if (fixedHtml === currentHtml) {
      console.log(`  Could not inject (not enough H2s or already present) — skipping`);
      continue;
    }

    await updateWpPost(post.wpPostId, { content: fixedHtml });

    // Update DB textContent too (replace the 3rd ## heading)
    const body = post.textContent || '';
    const h2Lines = body.split('\n').filter(l => l.startsWith('## '));
    if (h2Lines.length >= 3) {
      const targetLine = h2Lines[2];
      const kp = post.focusKeyword;
      const fixedLine = `## ${kp.charAt(0).toUpperCase() + kp.slice(1)}: ${targetLine.replace('## ', '')}`;
      const fixedBody = body.replace(targetLine, fixedLine);
      await conn.execute(
        'UPDATE content_items SET textContent = ? WHERE id = ?',
        [fixedBody, post.id]
      );
    }

    console.log(`  Fixed — injected keyphrase into 3rd H2`);
  }

  await conn.end();
  console.log('\n✅ Done');
}

main().catch(console.error);
