/**
 * Enrich Sleep & Recovery keyword_targets with DataForSEO search volume, difficulty, and CPC.
 * Targets only the "Sleep & Recovery Authority" campaign (pillar = "sleep optimization").
 * Run: node scripts/enrich-sleep-volumes.mjs
 */
import "dotenv/config";
import mysql from "mysql2/promise";

const DB_URL = process.env.DATABASE_URL;
const DFS_LOGIN = process.env.DATAFORSEO_LOGIN;
const DFS_PASSWORD = process.env.DATAFORSEO_PASSWORD;

if (!DB_URL) throw new Error("DATABASE_URL not set");
if (!DFS_LOGIN || !DFS_PASSWORD) throw new Error("DATAFORSEO_LOGIN / DATAFORSEO_PASSWORD not set");

function parseDbUrl(url) {
  const u = new URL(url);
  return {
    host: u.hostname,
    port: parseInt(u.port || "3306"),
    user: u.username,
    password: u.password,
    database: u.pathname.replace(/^\//, ""),
    ssl: { rejectUnauthorized: false },
  };
}

const AUTH = Buffer.from(`${DFS_LOGIN}:${DFS_PASSWORD}`).toString("base64");

async function getKeywordVolumes(keywords) {
  const body = [{
    keywords: keywords,
    location_code: 2840, // United States
    language_code: "en",
  }];

  const res = await fetch("https://api.dataforseo.com/v3/keywords_data/google_ads/search_volume/live", {
    method: "POST",
    headers: {
      Authorization: `Basic ${AUTH}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`DataForSEO error ${res.status}: ${text}`);
  }

  const data = await res.json();
  const results = {};

  for (const task of data.tasks || []) {
    for (const item of task?.result || []) {
      results[item.keyword] = {
        searchVolume: item.search_volume || 0,
        cpc: item.cpc ? String(item.cpc.toFixed(2)) : null,
      };
    }
  }
  return results;
}

async function main() {
  const conn = await mysql.createConnection(parseDbUrl(DB_URL));

  try {
    // Find the sleep campaign
    const [camps] = await conn.execute(
      "SELECT id FROM keyword_campaigns WHERE kc_pillar_keyword = ? LIMIT 1",
      ["sleep optimization"]
    );
    if (!camps.length) {
      console.error("Sleep & Recovery campaign not found. Run seed-sleep-recovery.mjs first.");
      return;
    }
    const campaignId = camps[0].id;
    console.log(`✓ Found Sleep & Recovery campaign (id=${campaignId})`);

    // Get all keywords in this campaign without volume data
    const [rows] = await conn.execute(
      "SELECT id, kt_keyword FROM keyword_targets WHERE kt_campaign_id = ? AND kt_search_volume IS NULL ORDER BY kt_priority ASC",
      [campaignId]
    );

    if (!rows.length) {
      console.log("All keywords already have volume data.");
      return;
    }

    console.log(`Enriching ${rows.length} keywords with DataForSEO volumes...`);

    // Batch in groups of 10
    const BATCH = 10;
    for (let i = 0; i < rows.length; i += BATCH) {
      const batch = rows.slice(i, i + BATCH);
      const keywords = batch.map((r) => r.kt_keyword);

      console.log(`  Batch ${Math.floor(i / BATCH) + 1}: ${keywords.join(", ")}`);

      const volumes = await getKeywordVolumes(keywords);

      for (const row of batch) {
        const vol = volumes[row.kt_keyword];
        if (vol) {
          await conn.execute(
            "UPDATE keyword_targets SET kt_search_volume = ?, kt_cpc = ? WHERE id = ?",
            [vol.searchVolume, vol.cpc, row.id]
          );
          console.log(`    ✓ "${row.kt_keyword}" — ${vol.searchVolume.toLocaleString()}/mo, CPC $${vol.cpc || "n/a"}`);
        } else {
          console.log(`    ⚠ "${row.kt_keyword}" — no data returned`);
        }
      }

      // Small delay between batches
      if (i + BATCH < rows.length) await new Promise((r) => setTimeout(r, 500));
    }

    console.log("\n✓ Volume enrichment complete for Sleep & Recovery campaign.");
  } finally {
    await conn.end();
  }
}

main().catch((err) => {
  console.error("Enrichment failed:", err.message);
  process.exit(1);
});
