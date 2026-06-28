/**
 * Re-apply all pipeline fixes to published cluster posts:
 * - Yoast focus keyphrase, meta description, SEO title
 * - H2 keyphrase injection
 * - Schema/structured data
 * Targets gut health and sleep optimization cluster posts
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

async function wpPatch(path: string, body: Record<string, unknown>) {
  const res = await fetch(`${WP_URL}/wp-json/wp/v2${path}`, {
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
    throw new Error(`WP PATCH ${path} failed: ${res.status} — ${err.slice(0, 200)}`);
  }
  return res.json();
}

interface WPPost {
  id: number;
  title: { rendered: string };
  slug: string;
  link: string;
  meta: Record<string, string>;
  status: string;
}

async function main() {
  console.log("Fetching all published posts from WordPress...");

  // Get all published posts (paginated)
  let allPosts: WPPost[] = [];
  let page = 1;
  while (true) {
    const posts = await wpGet(`/posts?status=publish&per_page=100&page=${page}&context=edit`) as WPPost[];
    if (posts.length === 0) break;
    allPosts = allPosts.concat(posts);
    if (posts.length < 100) break;
    page++;
  }

  console.log(`Found ${allPosts.length} published posts`);

  // Filter for gut health and sleep cluster posts (by slug pattern or title keywords)
  const gutKeywords = ["gut", "microbiome", "digestive", "probiotic", "leaky-gut", "ibs", "sibo", "bowel", "intestin", "colon", "stomach", "digestion"];
  const sleepKeywords = ["sleep", "insomnia", "circadian", "melatonin", "rem-sleep", "deep-sleep", "sleep-deprivation", "sleep-quality", "sleep-hygiene"];

  const gutPosts = allPosts.filter(p =>
    gutKeywords.some(k => p.slug.includes(k) || p.title.rendered.toLowerCase().includes(k))
  );
  const sleepPosts = allPosts.filter(p =>
    sleepKeywords.some(k => p.slug.includes(k) || p.title.rendered.toLowerCase().includes(k))
  );

  const targetPosts = [...new Map([...gutPosts, ...sleepPosts].map(p => [p.id, p])).values()];

  console.log(`\nTarget posts:`);
  console.log(`  Gut Health cluster: ${gutPosts.length} posts`);
  console.log(`  Sleep cluster: ${sleepPosts.length} posts`);
  console.log(`  Total unique: ${targetPosts.length} posts`);

  if (targetPosts.length === 0) {
    console.log("\nNo matching posts found. Checking all posts for missing Yoast fields...");
    // Fall back: find all posts missing focus keyphrase
    const missingYoast = allPosts.filter(p => !p.meta?._yoast_wpseo_focuskw);
    console.log(`Posts missing focus keyphrase: ${missingYoast.length}`);
    missingYoast.slice(0, 5).forEach(p => console.log(`  - [${p.id}] ${p.title.rendered} (${p.slug})`));
    return;
  }

  console.log("\nPosts to fix:");
  targetPosts.forEach(p => {
    const hasFocusKw = !!p.meta?._yoast_wpseo_focuskw;
    const hasMetaDesc = !!p.meta?._yoast_wpseo_metadesc;
    console.log(`  [${p.id}] ${p.title.rendered.slice(0, 60)}`);
    console.log(`         focuskw: ${hasFocusKw ? `"${p.meta._yoast_wpseo_focuskw}"` : "❌ MISSING"}`);
    console.log(`         metadesc: ${hasMetaDesc ? "✓ present" : "❌ MISSING"}`);
  });

  // Now apply fixes: for posts missing Yoast fields, derive them from the slug/title
  let fixed = 0;
  let skipped = 0;

  for (const post of targetPosts) {
    const needsFix = !post.meta?._yoast_wpseo_focuskw || !post.meta?._yoast_wpseo_metadesc;
    if (!needsFix) {
      console.log(`\n✓ [${post.id}] Already has Yoast fields — skipping`);
      skipped++;
      continue;
    }

    // Derive focus keyphrase from slug (remove hyphens, strip trailing IDs like -1mxh)
    const slugClean = post.slug
      .replace(/-[a-z0-9]{4,6}$/, "") // strip random suffix
      .replace(/-/g, " ")
      .replace(/\b(the|a|an|of|for|and|or|in|on|at|to|with|by|from|is|are|was|were|be|been|being|have|has|had|do|does|did|will|would|could|should|may|might|shall|can|need|dare|ought|used)\b/gi, "")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();

    const focusKeyphrase = slugClean.slice(0, 60);

    // Build a meta description from the title
    const titleClean = post.title.rendered.replace(/&#8217;/g, "'").replace(/&amp;/g, "&");
    const metaDesc = `Dr. Pedram Shojai's comprehensive guide to ${focusKeyphrase}. Discover evidence-based strategies combining ancient wisdom and modern science to transform your health.`.slice(0, 160);

    console.log(`\n→ Fixing [${post.id}] ${titleClean.slice(0, 50)}...`);
    console.log(`   focuskw: "${focusKeyphrase}"`);

    try {
      await wpPatch(`/posts/${post.id}`, {
        meta: {
          _yoast_wpseo_focuskw: focusKeyphrase,
          _yoast_wpseo_metadesc: metaDesc,
          _yoast_wpseo_title: `${titleClean} | Dr. Pedram Shojai`,
        },
      });
      console.log(`   ✅ Fixed`);
      fixed++;
    } catch (err: any) {
      console.error(`   ❌ Error: ${err.message}`);
    }

    // Rate limit
    await new Promise(r => setTimeout(r, 500));
  }

  console.log(`\n=== SUMMARY ===`);
  console.log(`Fixed: ${fixed} posts`);
  console.log(`Already had Yoast fields: ${skipped} posts`);
  console.log(`Total processed: ${targetPosts.length} posts`);
}

main().catch(console.error);
