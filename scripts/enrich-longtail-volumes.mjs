/**
 * DataForSEO volume enrichment for the 15 Pedram-specific long-tail keywords
 * added by seed-longtail-pedram.mjs.
 *
 * Targets keywords with priority >= 50 (the long-tail batch) that have no volume yet.
 * Run: node scripts/enrich-longtail-volumes.mjs
 */
import "dotenv/config";
import mysql from "mysql2/promise";

const DB_URL = process.env.DATABASE_URL;
const DATAFORSEO_LOGIN = process.env.DATAFORSEO_LOGIN;
const DATAFORSEO_PASSWORD = process.env.DATAFORSEO_PASSWORD;

if (!DB_URL) throw new Error("DATABASE_URL not set");
if (!DATAFORSEO_LOGIN || !DATAFORSEO_PASSWORD) throw new Error("DATAFORSEO_LOGIN / DATAFORSEO_PASSWORD not set");

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

const DATAFORSEO_BASE = "https://api.dataforseo.com/v3";
const authHeader = "Basic " + Buffer.from(`${DATAFORSEO_LOGIN}:${DATAFORSEO_PASSWORD}`).toString("base64");

async function getSearchVolumes(keywords) {
  const tasks = keywords.map((kw) => ({
    language_name: "English",
    location_code: 2840, // United States
    keywords: [kw],
  }));

  const res = await fetch(`${DATAFORSEO_BASE}/keywords_data/google_ads/search_volume/live`, {
    method: "POST",
    headers: {
      Authorization: authHeader,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(tasks),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`DataForSEO API error ${res.status}: ${errText.slice(0, 300)}`);
  }

  const data = await res.json();
  const volumeMap = {};

  for (const task of data.tasks ?? []) {
    for (const result of task.result ?? []) {
      for (const item of result.items ?? []) {
        if (item.keyword && item.search_volume != null) {
          volumeMap[item.keyword.toLowerCase()] = item.search_volume;
        }
      }
    }
  }

  return volumeMap;
}

async function main() {
  const conn = await mysql.createConnection(parseDbUrl(DB_URL));

  try {
    // Fetch all long-tail keywords (priority >= 50) that have no volume yet
    const [rows] = await conn.execute(
      `SELECT id, kt_keyword FROM keyword_targets
       WHERE kt_priority >= 50 AND (kt_search_volume IS NULL OR kt_search_volume = 0)
       ORDER BY id ASC`
    );

    if (!rows.length) {
      console.log("✓ All long-tail keywords already have volume data. Nothing to do.");
      return;
    }

    console.log(`Fetching volumes for ${rows.length} long-tail keywords...`);

    // DataForSEO live endpoint: process in batches of 10
    const BATCH_SIZE = 10;
    let updated = 0;

    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      const batch = rows.slice(i, i + BATCH_SIZE);
      const keywords = batch.map((r) => r.kt_keyword);

      console.log(`  Batch ${Math.floor(i / BATCH_SIZE) + 1}: ${keywords.join(", ")}`);

      try {
        const volumeMap = await getSearchVolumes(keywords);

        for (const row of batch) {
          const vol = volumeMap[row.kt_keyword.toLowerCase()];
          if (vol != null) {
            await conn.execute(
              "UPDATE keyword_targets SET kt_search_volume = ? WHERE id = ?",
              [vol, row.id]
            );
            console.log(`    ✓ "${row.kt_keyword}" → ${vol.toLocaleString()}/mo`);
            updated++;
          } else {
            console.log(`    ⚠ "${row.kt_keyword}" → no volume data returned`);
          }
        }
      } catch (batchErr) {
        console.error(`  ✗ Batch failed: ${batchErr.message}`);
      }

      // Rate limit: 1 request per second
      if (i + BATCH_SIZE < rows.length) {
        await new Promise((r) => setTimeout(r, 1100));
      }
    }

    console.log(`\n✓ Updated ${updated}/${rows.length} long-tail keyword volumes`);
  } finally {
    await conn.end();
  }
}

main().catch((err) => {
  console.error("Enrichment failed:", err.message);
  process.exit(1);
});
