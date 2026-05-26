/**
 * LLM-powered meta description fixer.
 * For every published post with a meta desc over 155 chars or ending in '...',
 * asks the LLM to rewrite it cleanly to 140-150 chars.
 */
import 'dotenv/config';
import mysql from 'mysql2/promise';

const WP_URL = process.env.WORDPRESS_URL;
const WP_USER = process.env.WORDPRESS_USERNAME;
const WP_PASS = process.env.WORDPRESS_APP_PASSWORD;
const LLM_URL = process.env.BUILT_IN_FORGE_API_URL;
const LLM_KEY = process.env.BUILT_IN_FORGE_API_KEY;

function wpAuth() {
  return 'Basic ' + Buffer.from(`${WP_USER}:${WP_PASS}`).toString('base64');
}

async function updateWpYoast(wpPostId, metaDesc) {
  const res = await fetch(`${WP_URL}/wp-json/wp/v2/posts/${wpPostId}`, {
    method: 'POST',
    headers: { Authorization: wpAuth(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ meta: { _yoast_wpseo_metadesc: metaDesc } }),
  });
  const data = await res.json();
  return data.meta?._yoast_wpseo_metadesc || metaDesc;
}

async function rewriteMetaDesc(title, keyphrase, currentDesc) {
  const prompt = `You are an SEO copywriter. Rewrite this meta description so it:
1. Is EXACTLY 140-150 characters (count every character including spaces)
2. Starts with or includes the focus keyphrase naturally
3. Ends with a complete sentence or strong CTA — NO ellipsis, NO trailing punctuation issues
4. Is compelling and specific to the article

Article title: "${title}"
Focus keyphrase: "${keyphrase}"
Current meta description: "${currentDesc}"

Reply with ONLY the rewritten meta description. No quotes, no explanation. Just the text.`;

  const res = await fetch(`${LLM_URL}/v1/chat/completions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${LLM_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'claude-3-5-haiku-20241022',
      max_tokens: 200,
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  const data = await res.json();
  const text = data.choices?.[0]?.message?.content?.trim() || '';
  return text.replace(/^["']|["']$/g, '').trim();
}

async function main() {
  const conn = await mysql.createConnection(process.env.DATABASE_URL);

  const [posts] = await conn.execute(`
    SELECT id, title, wpPostId, focusKeyword, yoastMetaDescription
    FROM content_items
    WHERE platform = 'blog'
      AND status = 'published'
      AND wpPostId IS NOT NULL
      AND (
        LENGTH(yoastMetaDescription) > 155
        OR yoastMetaDescription LIKE '%...'
        OR yoastMetaDescription LIKE '%…'
        OR yoastMetaDescription LIKE '%&.'
        OR yoastMetaDescription LIKE '% &'
        OR yoastMetaDescription LIKE '% and'
      )
    ORDER BY createdAt DESC
    LIMIT 60
  `);

  console.log(`Found ${posts.length} posts needing meta desc fix\n`);

  let fixed = 0;
  let skipped = 0;

  for (const post of posts) {
    const keyphrase = post.focusKeyword || post.title;
    console.log(`\n[${post.wpPostId}] ${post.title}`);
    console.log(`  Current (${post.yoastMetaDescription?.length}): ${post.yoastMetaDescription}`);

    const newDesc = await rewriteMetaDesc(post.title, keyphrase, post.yoastMetaDescription);
    
    if (!newDesc || newDesc.length < 100 || newDesc.length > 160) {
      console.log(`  ⚠️  LLM returned bad desc (${newDesc?.length} chars) — skipping`);
      skipped++;
      continue;
    }

    console.log(`  New    (${newDesc.length}): ${newDesc}`);

    // Push to WordPress
    await updateWpYoast(post.wpPostId, newDesc);

    // Update DB
    await conn.execute(
      'UPDATE content_items SET yoastMetaDescription = ? WHERE id = ?',
      [newDesc, post.id]
    );

    fixed++;
    // Small delay to avoid rate limiting
    await new Promise(r => setTimeout(r, 500));
  }

  await conn.end();
  console.log(`\n✅ Done — fixed: ${fixed}, skipped: ${skipped}`);
}

main().catch(console.error);
