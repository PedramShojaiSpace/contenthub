/**
 * backfill-wp-subcategories.mjs
 *
 * Retroactively assigns the correct WordPress subcategory to all published posts
 * that only have the parent "Health and Wellness" (ID 19) and no subcategory.
 *
 * Uses the same CLUSTER_MAP and detectCluster logic as wpContentUtils.ts.
 * Run once: node scripts/backfill-wp-subcategories.mjs
 */

import * as dotenv from "dotenv";
dotenv.config();

const WP_BASE_URL = process.env.WORDPRESS_URL ?? "https://theurbanmonk.com";
const WP_USER = process.env.WORDPRESS_USERNAME ?? "";
const WP_PASS = process.env.WORDPRESS_APP_PASSWORD ?? "";
const AUTH = "Basic " + Buffer.from(`${WP_USER}:${WP_PASS}`).toString("base64");
const WP_CATEGORY_HEALTH_AND_WELLNESS = 19;

// Mirror of CLUSTER_MAP from wpContentUtils.ts
const CLUSTER_MAP = [
  { label: "Gut Health & Digestion", slug: "gut-health-digestion", keywords: ["gut", "digestion", "microbiome", "probiotic", "leaky gut", "ibs", "bloating", "bowel", "intestin", "colon", "stomach", "gi map", "dysbiosis"] },
  { label: "Stress & Mental Wellness", slug: "stress-mental-wellness", keywords: ["stress", "anxiety", "cortisol", "nervous system", "mental", "burnout", "adrenal", "hpa axis", "mood", "depression", "emotional"] },
  { label: "Sleep & Recovery", slug: "sleep-recovery", keywords: ["sleep", "insomnia", "circadian", "melatonin", "rest", "recovery", "fatigue", "tired", "exhaustion"] },
  { label: "Energy & Vitality", slug: "energy-vitality", keywords: ["energy", "mitochondria", "atp", "vitality", "stamina", "chronic fatigue", "adrenal fatigue", "low energy"] },
  { label: "Detox & Cleansing", slug: "detox-cleansing", keywords: ["detox", "cleanse", "toxin", "heavy metal", "liver", "lymph", "fasting", "autophagy", "elimination"] },
  { label: "Mindfulness & Meditation", slug: "mindfulness-meditation", keywords: ["meditation", "mindfulness", "qigong", "breathwork", "breath", "pranayama", "presence", "awareness", "monk", "taoist", "zen"] },
  { label: "Nutrition & Diet", slug: "nutrition-diet", keywords: ["nutrition", "diet", "food", "eating", "meal", "nutrient", "vitamin", "mineral", "supplement", "keto", "paleo", "anti-inflammatory"] },
  { label: "Fitness & Movement", slug: "fitness-movement", keywords: ["exercise", "fitness", "movement", "workout", "yoga", "strength", "cardio", "flexibility", "mobility"] },
  { label: "Longevity & Anti-Aging", slug: "longevity-anti-aging", keywords: ["longevity", "aging", "anti-aging", "lifespan", "healthspan", "telomere", "biohack", "epigenetic", "senescence"] },
];

function detectCluster(focusKeyword) {
  if (!focusKeyword) return null;
  const kw = focusKeyword.toLowerCase();
  for (const cluster of CLUSTER_MAP) {
    if (cluster.keywords.some((sig) => kw.includes(sig))) return cluster;
  }
  return null;
}

async function wpFetch(url, options = {}) {
  const res = await fetch(url, { ...options, headers: { Authorization: AUTH, "Content-Type": "application/json", ...(options.headers ?? {}) } });
  return res;
}

async function ensureSubcategory(label, slug) {
  // Check if it exists
  const searchRes = await wpFetch(`${WP_BASE_URL}/wp-json/wp/v2/categories?slug=${encodeURIComponent(slug)}&per_page=5`);
  if (searchRes.ok) {
    const existing = await searchRes.json();
    if (existing.length > 0) return existing[0].id;
  }
  // Create it
  const createRes = await wpFetch(`${WP_BASE_URL}/wp-json/wp/v2/categories`, {
    method: "POST",
    body: JSON.stringify({ name: label, slug, parent: WP_CATEGORY_HEALTH_AND_WELLNESS }),
  });
  if (createRes.ok) {
    const newCat = await createRes.json();
    console.log(`  ✅ Created subcategory: "${label}" (ID ${newCat.id})`);
    return newCat.id;
  }
  console.warn(`  ⚠️  Failed to create subcategory "${label}": ${createRes.status}`);
  return null;
}

async function getAllPublishedPosts() {
  const posts = [];
  let page = 1;
  while (true) {
    const res = await wpFetch(`${WP_BASE_URL}/wp-json/wp/v2/posts?status=publish&per_page=100&page=${page}&_fields=id,title,slug,categories,yoast_head_json`);
    if (!res.ok) break;
    const batch = await res.json();
    if (!batch.length) break;
    posts.push(...batch);
    if (batch.length < 100) break;
    page++;
  }
  return posts;
}

async function getYoastFocusKeyword(postId) {
  // Try to get the focus keyword from Yoast meta via the post's meta endpoint
  const res = await wpFetch(`${WP_BASE_URL}/wp-json/wp/v2/posts/${postId}?_fields=id,yoast_head_json,meta`);
  if (!res.ok) return null;
  const data = await res.json();
  // Yoast stores focus keyword in post meta as _yoast_wpseo_focuskw
  return data?.meta?._yoast_wpseo_focuskw ?? null;
}

async function main() {
  console.log("🔍 Fetching all published posts from WordPress...");
  const posts = await getAllPublishedPosts();
  console.log(`Found ${posts.length} published posts.\n`);

  // Get all existing subcategories (children of ID 19)
  const catRes = await wpFetch(`${WP_BASE_URL}/wp-json/wp/v2/categories?parent=${WP_CATEGORY_HEALTH_AND_WELLNESS}&per_page=100`);
  const existingSubcats = catRes.ok ? await catRes.json() : [];
  const subcatIds = new Set(existingSubcats.map((c) => c.id));

  // Find posts that only have the parent category (no subcategory)
  const postsNeedingSubcat = posts.filter((p) => {
    const cats = p.categories ?? [];
    const hasParent = cats.includes(WP_CATEGORY_HEALTH_AND_WELLNESS);
    const hasSubcat = cats.some((id) => subcatIds.has(id));
    return hasParent && !hasSubcat;
  });

  console.log(`Posts needing subcategory assignment: ${postsNeedingSubcat.length}\n`);

  let fixed = 0;
  let skipped = 0;
  let errors = 0;

  for (const post of postsNeedingSubcat) {
    const title = post.title?.rendered ?? post.slug;
    console.log(`\n📄 Post ID ${post.id}: "${title}"`);

    // Try to get focus keyword from Yoast
    const focusKw = await getYoastFocusKeyword(post.id);
    const searchText = focusKw || post.slug.replace(/-/g, " ");
    console.log(`  Focus keyword: "${searchText}"`);

    const cluster = detectCluster(searchText);
    if (!cluster) {
      // Try slug words as fallback
      const slugWords = post.slug.replace(/-/g, " ");
      const slugCluster = detectCluster(slugWords);
      if (!slugCluster) {
        console.log(`  ⏭️  No cluster match — skipping`);
        skipped++;
        continue;
      }
      console.log(`  Cluster (from slug): "${slugCluster.label}"`);
      const subcatId = await ensureSubcategory(slugCluster.label, slugCluster.slug);
      if (!subcatId) { errors++; continue; }
      const newCats = [...new Set([...post.categories, subcatId])];
      const updateRes = await wpFetch(`${WP_BASE_URL}/wp-json/wp/v2/posts/${post.id}`, {
        method: "POST",
        body: JSON.stringify({ categories: newCats }),
      });
      if (updateRes.ok) {
        console.log(`  ✅ Assigned "${slugCluster.label}" (ID ${subcatId})`);
        fixed++;
      } else {
        console.warn(`  ❌ Failed to update post: ${updateRes.status}`);
        errors++;
      }
      continue;
    }

    console.log(`  Cluster: "${cluster.label}"`);
    const subcatId = await ensureSubcategory(cluster.label, cluster.slug);
    if (!subcatId) { errors++; continue; }

    const newCats = [...new Set([...post.categories, subcatId])];
    const updateRes = await wpFetch(`${WP_BASE_URL}/wp-json/wp/v2/posts/${post.id}`, {
      method: "POST",
      body: JSON.stringify({ categories: newCats }),
    });
    if (updateRes.ok) {
      console.log(`  ✅ Assigned "${cluster.label}" (ID ${subcatId})`);
      fixed++;
    } else {
      console.warn(`  ❌ Failed to update post: ${updateRes.status}`);
      errors++;
    }

    // Small delay to avoid hammering WP API
    await new Promise((r) => setTimeout(r, 300));
  }

  console.log(`\n${"=".repeat(60)}`);
  console.log(`✅ Fixed: ${fixed} posts`);
  console.log(`⏭️  Skipped (no cluster match): ${skipped} posts`);
  console.log(`❌ Errors: ${errors} posts`);
  console.log(`${"=".repeat(60)}`);
}

main().catch(console.error);
