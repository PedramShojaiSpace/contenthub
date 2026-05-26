/**
 * Fix the 3 remaining posts with truncated meta descriptions.
 * Uses LLM to rewrite each one cleanly to 140-150 chars.
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
  return data.meta?._yoast_wpseo_metadesc;
}

async function rewriteMetaDesc(title, keyphrase, currentDesc) {
  const prompt = `You are an SEO copywriter. Rewrite this meta description so it:
1. Is EXACTLY 140-150 characters (count every character including spaces and punctuation)
2. Starts with or naturally includes the focus keyphrase
3. Ends with a complete sentence — period, exclamation mark, or question mark at the end
4. Is compelling, specific, and action-oriented

Article title: "${title}"
Focus keyphrase: "${keyphrase}"
Current (truncated) meta description: "${currentDesc}"

Reply with ONLY the rewritten meta description. No quotes, no labels, no explanation.`;

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
  return (data.choices?.[0]?.message?.content?.trim() || '').replace(/^["']|["']$/g, '').trim();
}

const TARGETS = [9787, 9791, 9805];

async function main() {
  const conn = await mysql.createConnection(process.env.DATABASE_URL);

  const [posts] = await conn.execute(
    `SELECT id, title, wpPostId, focusKeyword, yoastMetaDescription
     FROM content_items
     WHERE wpPostId IN (${TARGETS.join(',')})
     AND platform = 'blog'`
  );

  for (const post of posts) {
    const keyphrase = post.focusKeyword || post.title;
    console.log(`\n[WP#${post.wpPostId}] ${post.title}`);
    console.log(`  Keyphrase: ${keyphrase}`);
    console.log(`  Current (${post.yoastMetaDescription?.length}): ${post.yoastMetaDescription}`);

    const newDesc = await rewriteMetaDesc(post.title, keyphrase, post.yoastMetaDescription);
    console.log(`  New     (${newDesc.length}): ${newDesc}`);

    if (newDesc.length < 120 || newDesc.length > 160) {
      console.log(`  ⚠️  Bad length — skipping`);
      continue;
    }

    await updateWpYoast(post.wpPostId, newDesc);
    await conn.execute('UPDATE content_items SET yoastMetaDescription = ? WHERE id = ?', [newDesc, post.id]);
    console.log(`  ✅ Updated in WP and DB`);
    await new Promise(r => setTimeout(r, 500));
  }

  await conn.end();
  console.log('\n✅ All done');
}

main().catch(console.error);
