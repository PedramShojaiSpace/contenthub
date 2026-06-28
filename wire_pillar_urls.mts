import { getDb } from "./server/db.js";
import { sql } from "drizzle-orm";

async function main() {
  const db = await getDb();
  if (!db) { console.error("No DB"); process.exit(1); }

  // Find keyword targets for gut health and sleep optimization (using correct column names)
  const rows = await db.execute(sql`
    SELECT id, kt_keyword, kt_keyword_type, kt_published_url 
    FROM keyword_targets 
    WHERE kt_keyword LIKE '%gut health%' OR kt_keyword LIKE '%sleep optim%'
    LIMIT 20
  `);
  
  console.log("Keyword targets found:");
  const targets = (rows as any).rows || rows;
  for (const row of targets as any[]) {
    console.log(`  ID:${row.id} type:${row.kt_keyword_type} keyword:"${row.kt_keyword}" published_url:${row.kt_published_url || 'null'}`);
  }

  if ((targets as any[]).length === 0) {
    console.log("No matching keyword targets found. Checking all pillar-type targets...");
    const allPillars = await db.execute(sql`
      SELECT id, kt_keyword, kt_keyword_type, kt_published_url 
      FROM keyword_targets 
      WHERE kt_keyword_type = 'pillar'
      LIMIT 20
    `);
    const pillarRows = (allPillars as any).rows || allPillars;
    for (const row of pillarRows as any[]) {
      console.log(`  ID:${row.id} type:${row.kt_keyword_type} keyword:"${row.kt_keyword}" published_url:${row.kt_published_url || 'null'}`);
    }
    
    // Also show all keyword targets
    console.log("\nAll keyword targets:");
    const allRows = await db.execute(sql`
      SELECT id, kt_keyword, kt_keyword_type, kt_published_url 
      FROM keyword_targets 
      LIMIT 30
    `);
    const allTargets = (allRows as any).rows || allRows;
    for (const row of allTargets as any[]) {
      console.log(`  ID:${row.id} type:${row.kt_keyword_type} keyword:"${row.kt_keyword}" published_url:${row.kt_published_url || 'null'}`);
    }
    process.exit(0);
  }

  // Update gut health pillar
  const gutUpdate = await db.execute(sql`
    UPDATE keyword_targets 
    SET kt_published_url = 'https://theurbanmonk.com/gut-health-complete-guide/',
        kt_content_status = 'published'
    WHERE kt_keyword LIKE '%gut health%' AND kt_keyword_type = 'pillar'
  `);
  console.log("\nGut health pillar URL update:", JSON.stringify(gutUpdate).slice(0, 150));

  // Update sleep optimization pillar
  const sleepUpdate = await db.execute(sql`
    UPDATE keyword_targets 
    SET kt_published_url = 'https://theurbanmonk.com/sleep-optimization-complete-guide/',
        kt_content_status = 'published'
    WHERE kt_keyword LIKE '%sleep optim%' AND kt_keyword_type = 'pillar'
  `);
  console.log("Sleep optimization pillar URL update:", JSON.stringify(sleepUpdate).slice(0, 150));

  // Verify
  const verify = await db.execute(sql`
    SELECT id, kt_keyword, kt_keyword_type, kt_published_url, kt_content_status
    FROM keyword_targets 
    WHERE kt_published_url IS NOT NULL
    LIMIT 10
  `);
  console.log("\nAll keyword targets with published URLs:");
  const verifyRows = (verify as any).rows || verify;
  for (const row of verifyRows as any[]) {
    console.log(`  ID:${row.id} "${row.kt_keyword}" → ${row.kt_published_url} [${row.kt_content_status}]`);
  }

  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
