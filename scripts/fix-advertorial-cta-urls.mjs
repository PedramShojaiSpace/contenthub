/**
 * fix-advertorial-cta-urls.mjs
 * One-time script to update all existing advertorial_pages rows
 * so their cta_url matches the correct Shopify cart permalink.
 */
import mysql from "mysql2/promise";
import dotenv from "dotenv";
dotenv.config();

// Canonical topic → Shopify cart permalink mapping
const TOPIC_CTA_MAP = {
  lights_on:   "https://shop.theurbanmonk.com/cart/47631630631066:1",
  orobiome:    "https://shop.theurbanmonk.com/cart/46719608946842:1",
  kbmo:        "https://shop.theurbanmonk.com/cart/48029578756250:1",
  gut_health:  "https://shop.theurbanmonk.com/cart/44120868470938:1",
  sleep:       "https://shop.theurbanmonk.com/cart/44120868536474:1",
  energy:      "https://shop.theurbanmonk.com/cart/44120868569242:1",
  inflammation:"https://shop.theurbanmonk.com/cart/44120868602010:1",
  stress:      "https://shop.theurbanmonk.com/cart/44120868634778:1",
  longevity:   "https://shop.theurbanmonk.com/cart/44120868569242:1",
};

// Patterns to detect bad/stale CTA URLs
const BAD_URL_PATTERNS = [
  /ch\.theurbanmonk\.com/,
  /theurbanmonk\.com\/orobiome/,
  /theurbanmonk\.com\/kbmo/,
  /theurbanmonk\.com\/lights-on/,
  /theacademy\.theurbanmonk\.com/,
];

function isBadUrl(url) {
  if (!url) return true;
  return BAD_URL_PATTERNS.some(p => p.test(url));
}

function detectTopic(row) {
  const text = `${row.topic || ""} ${row.headline || ""} ${row.slug || ""}`.toLowerCase();
  if (text.includes("lights") || text.includes("light_on") || text.includes("lights_on")) return "lights_on";
  if (text.includes("orobiome") || text.includes("oral") || text.includes("mouth")) return "orobiome";
  if (text.includes("kbmo") || text.includes("fit22") || text.includes("food sensitivity")) return "kbmo";
  if (text.includes("gut") || text.includes("microbiome") || text.includes("digestive")) return "gut_health";
  if (text.includes("sleep") || text.includes("tired") || text.includes("fatigue")) return "sleep";
  if (text.includes("energy") || text.includes("mito") || text.includes("vitality")) return "energy";
  if (text.includes("inflam")) return "inflammation";
  if (text.includes("stress") || text.includes("cortisol") || text.includes("zen")) return "stress";
  if (text.includes("longevity") || text.includes("aging") || text.includes("anti-age")) return "longevity";
  return null;
}

async function main() {
  const db = await mysql.createConnection(process.env.DATABASE_URL);
  console.log("Connected to DB");

  const [rows] = await db.execute("SELECT id, topic, headline, slug, cta_url FROM advertorial_pages");
  console.log(`Found ${rows.length} advertorial pages`);

  let fixed = 0;
  let skipped = 0;

  for (const row of rows) {
    if (!isBadUrl(row.cta_url)) {
      console.log(`  SKIP id=${row.id} — URL already correct: ${row.cta_url}`);
      skipped++;
      continue;
    }

    const topic = detectTopic(row);
    const correctUrl = topic ? TOPIC_CTA_MAP[topic] : null;

    if (!correctUrl) {
      console.log(`  WARN id=${row.id} — Could not detect topic for: "${row.title}" (slug: ${row.slug})`);
      continue;
    }

    await db.execute(
      "UPDATE advertorial_pages SET cta_url = ? WHERE id = ?",
      [correctUrl, row.id]
    );
    console.log(`  FIXED id=${row.id} topic=${topic} → ${correctUrl}`);
    fixed++;
  }

  console.log(`\nDone. Fixed: ${fixed}, Skipped (already correct): ${skipped}`);
  await db.end();
}

main().catch(err => {
  console.error("Error:", err.message);
  process.exit(1);
});
