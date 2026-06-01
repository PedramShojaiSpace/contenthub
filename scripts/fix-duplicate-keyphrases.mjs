/**
 * fix-duplicate-keyphrases.mjs
 *
 * 1. Queries all blog posts with duplicate focus keyphrases
 * 2. Uses the LLM to generate a unique long-tail keyphrase for each duplicate
 * 3. Updates the DB and re-publishes the Yoast focus keyphrase to WordPress
 */

import "dotenv/config";
import mysql from "mysql2/promise";
// Using native fetch (Node 22+)

const DB_URL = process.env.DATABASE_URL;
const WP_URL = process.env.WORDPRESS_URL;
const WP_USER = process.env.WORDPRESS_USERNAME;
const WP_PASS = process.env.WORDPRESS_APP_PASSWORD;
const LLM_URL = process.env.BUILT_IN_FORGE_API_URL;
const LLM_KEY = process.env.BUILT_IN_FORGE_API_KEY;

if (!DB_URL) { console.error("DATABASE_URL not set"); process.exit(1); }

// Parse mysql2 connection string
function parseDbUrl(url) {
  const u = new URL(url);
  return {
    host: u.hostname,
    port: parseInt(u.port || "3306"),
    user: u.username,
    password: u.password,
    database: u.pathname.replace("/", ""),
    ssl: { rejectUnauthorized: false },
  };
}

async function invokeLLM(messages) {
  const res = await fetch(`${LLM_URL}/v1/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${LLM_KEY}`,
    },
    body: JSON.stringify({ model: "gpt-4o", messages, temperature: 0.3 }),
  });
  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? "";
}

async function updateWpYoastKeyphrase(wpPostId, newKeyphrase) {
  if (!WP_URL || !WP_USER || !WP_PASS) {
    console.warn("  ⚠ WP credentials not set — skipping WP update");
    return false;
  }
  const auth = Buffer.from(`${WP_USER}:${WP_PASS}`).toString("base64");
  const res = await fetch(`${WP_URL}/wp-json/wp/v2/posts/${wpPostId}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Basic ${auth}`,
    },
    body: JSON.stringify({
      meta: {
        _yoast_wpseo_focuskw: newKeyphrase,
      },
    }),
  });
  if (!res.ok) {
    const txt = await res.text();
    console.warn(`  ⚠ WP update failed for post ${wpPostId}: ${res.status} ${txt.slice(0, 200)}`);
    return false;
  }
  return true;
}

async function main() {
  const conn = await mysql.createConnection(parseDbUrl(DB_URL));

  // Step 1: Find all duplicate focus keyphrases
  const [dupeGroups] = await conn.execute(`
    SELECT LOWER(TRIM(focusKeyword)) AS kw, COUNT(*) AS cnt
    FROM content_items
    WHERE platform = 'blog' AND focusKeyword IS NOT NULL AND focusKeyword != ''
    GROUP BY LOWER(TRIM(focusKeyword))
    HAVING COUNT(*) > 1
    ORDER BY cnt DESC, kw
  `);

  if (!dupeGroups.length) {
    console.log("✅ No duplicate focus keyphrases found — nothing to fix!");
    await conn.end();
    return;
  }

  console.log(`\n🔍 Found ${dupeGroups.length} duplicate keyphrase group(s):\n`);
  for (const g of dupeGroups) {
    console.log(`  "${g.kw}" — ${g.cnt} posts`);
  }

  // Step 2: For each group, get all posts and fix duplicates
  const fixes = []; // { id, wpPostId, title, oldKw, newKw }

  for (const group of dupeGroups) {
    const kw = group.kw;
    const [posts] = await conn.execute(`
      SELECT id, title, focusKeyword, wpPostId, publishUrl, status,
             SUBSTRING(textContent, 1, 500) AS excerpt
      FROM content_items
      WHERE platform = 'blog'
        AND LOWER(TRIM(focusKeyword)) = ?
      ORDER BY id
    `, [kw]);

    console.log(`\n📋 Group: "${kw}" (${posts.length} posts)`);

    // Keep the FIRST (oldest) post with the original keyphrase — it's the pillar
    // All subsequent posts need unique long-tail variants
    const [pillar, ...duplicates] = posts;
    console.log(`  ✅ Keeping pillar: [${pillar.id}] "${pillar.title}" → "${pillar.focusKeyword}"`);

    for (const post of duplicates) {
      console.log(`  🔧 Fixing: [${post.id}] "${post.title}"`);

      // Use LLM to generate a unique long-tail keyphrase based on the post title and excerpt
      const prompt = `You are an SEO expert for Dr. Pedram Shojai (The Urban Monk), a wellness brand.

The pillar keyphrase "${kw}" is already used on another post. You need to assign a UNIQUE, more specific long-tail keyphrase to this post so it does NOT compete with the pillar post.

Post title: "${post.title}"
Post excerpt: "${(post.excerpt || "").slice(0, 400)}"
Pillar keyphrase (already taken): "${kw}"

Rules:
- The new keyphrase must be 3-6 words
- It must be MORE SPECIFIC than "${kw}" (a long-tail variant)
- It must accurately describe THIS specific post's unique angle
- It must NOT be the same as or a minor variation of "${kw}"
- It should have search intent (someone would actually Google this)
- Output ONLY the keyphrase, nothing else — no quotes, no explanation`;

      const newKw = (await invokeLLM([
        { role: "system", content: "You are an SEO expert. Output only the requested keyphrase, nothing else." },
        { role: "user", content: prompt },
      ])).trim().replace(/^["']|["']$/g, "").toLowerCase();

      console.log(`    → New keyphrase: "${newKw}"`);
      fixes.push({ id: post.id, wpPostId: post.wpPostId, title: post.title, oldKw: kw, newKw });
    }
  }

  if (!fixes.length) {
    console.log("\n✅ No fixes needed.");
    await conn.end();
    return;
  }

  // Step 3: Apply fixes — update DB and WordPress
  console.log(`\n🚀 Applying ${fixes.length} fix(es)...\n`);
  let dbOk = 0, wpOk = 0, wpSkipped = 0;

  for (const fix of fixes) {
    // Update DB
    await conn.execute(
      `UPDATE content_items SET focusKeyword = ? WHERE id = ?`,
      [fix.newKw, fix.id]
    );
    dbOk++;
    console.log(`  ✅ DB updated [${fix.id}]: "${fix.oldKw}" → "${fix.newKw}"`);

    // Update WordPress Yoast meta
    if (fix.wpPostId) {
      const ok = await updateWpYoastKeyphrase(fix.wpPostId, fix.newKw);
      if (ok) {
        wpOk++;
        console.log(`  ✅ WP Yoast updated for post ${fix.wpPostId}`);
      } else {
        wpSkipped++;
      }
    } else {
      console.log(`  ⚠ No wpPostId for item ${fix.id} — DB updated only`);
      wpSkipped++;
    }
  }

  console.log(`\n📊 Summary:`);
  console.log(`  DB updates: ${dbOk}/${fixes.length}`);
  console.log(`  WP Yoast updates: ${wpOk}/${fixes.length} (${wpSkipped} skipped/failed)`);
  console.log(`\n✅ Done! Re-run the Yoast SEO check on the updated posts to verify green status.`);

  // Print the full fix table
  console.log(`\n📋 Full fix table:`);
  console.log("ID".padEnd(10) + "WP Post ID".padEnd(12) + "Old Keyphrase".padEnd(35) + "New Keyphrase".padEnd(45) + "Title");
  console.log("-".repeat(130));
  for (const f of fixes) {
    console.log(
      String(f.id).padEnd(10) +
      String(f.wpPostId ?? "—").padEnd(12) +
      f.oldKw.padEnd(35) +
      f.newKw.padEnd(45) +
      f.title.slice(0, 50)
    );
  }

  await conn.end();
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
