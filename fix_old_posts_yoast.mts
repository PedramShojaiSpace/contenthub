/**
 * Fix Yoast fields on older gut health + sleep posts (IDs < 9700)
 * that are missing focus keyphrase and meta description.
 * Uses the slug to derive a sensible focus keyphrase.
 */
import "dotenv/config";

const WP_URL = process.env.WORDPRESS_URL;
const WP_USER = process.env.WORDPRESS_USERNAME;
const WP_PASS = process.env.WORDPRESS_APP_PASSWORD;

if (!WP_URL || !WP_USER || !WP_PASS) {
  console.error("Missing WordPress credentials");
  process.exit(1);
}

const auth = Buffer.from(`${WP_USER}:${WP_PASS}`).toString("base64");

async function wpGet(path: string) {
  const res = await fetch(`${WP_URL}/wp-json/wp/v2${path}`, {
    headers: { Authorization: `Basic ${auth}` },
  });
  if (!res.ok) throw new Error(`WP GET ${path} failed: ${res.status}`);
  return res.json();
}

async function wpPatch(postId: number, body: Record<string, unknown>) {
  const res = await fetch(`${WP_URL}/wp-json/wp/v2/posts/${postId}`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/json",
      "X-HTTP-Method-Override": "PUT",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`WP PATCH /posts/${postId} failed: ${res.status} — ${err.slice(0, 200)}`);
  }
  return res.json();
}

// Derive focus keyphrase from slug
function slugToKeyphrase(slug: string): string {
  const stopWords = /\b(the|a|an|of|for|and|or|in|on|at|to|with|by|from|is|are|was|were|be|been|being|have|has|had|do|does|did|will|would|could|should|may|might|shall|can|need|dare|ought|used|your|you|how|why|what|when|where|who|which|that|this|these|those|its|it|we|our|their|they|he|she|his|her|my|i|me|us|them|him)\b/gi;
  return slug
    .replace(/-[a-z0-9]{4,6}$/, "")   // strip random suffix
    .replace(/-/g, " ")
    .replace(stopWords, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase()
    .slice(0, 60);
}

async function main() {
  // The older posts we identified as missing Yoast fields
  const oldPostIds = [
    7743, 7371, 7365, 7344, 7316, 7215, 7088, 7002, 6915, 6682,
    5464, 5434, 5420, 5416, 4806, 4804, 4713, 3536, 3490, 3465,
    3241, 4084, 3164
  ];

  // Also add gut health posts that were missing
  // (from the earlier output scan)
  const gutOldIds = [9650]; // already started fixing this one

  const allIds = [...new Set([...oldPostIds, ...gutOldIds])];
  console.log(`Fixing ${allIds.length} older posts missing Yoast fields...`);

  let fixed = 0;
  let errors = 0;

  for (const postId of allIds) {
    try {
      // Fetch the post to get slug and title
      const post = await wpGet(`/posts/${postId}?context=edit`) as any;

      // Skip if already has focuskw
      if (post.meta?._yoast_wpseo_focuskw) {
        console.log(`✓ [${postId}] Already has focuskw — skipping`);
        continue;
      }

      const slug = post.slug ?? "";
      const titleRaw = (post.title?.rendered ?? "").replace(/&#[0-9]+;/g, "'").replace(/&amp;/g, "&").replace(/<[^>]+>/g, "");
      const focusKeyphrase = slugToKeyphrase(slug) || titleRaw.toLowerCase().slice(0, 60);
      const metaDesc = `Dr. Pedram Shojai explores ${focusKeyphrase} — combining ancient wisdom and modern science to help you reclaim your health and vitality.`.slice(0, 160);
      const seoTitle = `${titleRaw.slice(0, 55)} | Dr. Pedram Shojai`;

      console.log(`→ [${postId}] ${titleRaw.slice(0, 55)}`);
      console.log(`   focuskw: "${focusKeyphrase}"`);

      await wpPatch(postId, {
        meta: {
          _yoast_wpseo_focuskw: focusKeyphrase,
          _yoast_wpseo_metadesc: metaDesc,
          _yoast_wpseo_title: seoTitle,
        },
      });

      console.log(`   ✅ Fixed`);
      fixed++;

      // Rate limit: 2 requests/sec
      await new Promise(r => setTimeout(r, 500));
    } catch (err: any) {
      console.error(`   ❌ [${postId}] Error: ${err.message}`);
      errors++;
    }
  }

  console.log(`\n=== SUMMARY ===`);
  console.log(`Fixed: ${fixed} posts`);
  console.log(`Errors: ${errors} posts`);
  console.log(`Total: ${allIds.length} posts`);
}

main().catch(console.error);
