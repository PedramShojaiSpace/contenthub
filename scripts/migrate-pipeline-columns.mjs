/**
 * Migration: add vj_production_path and vj_output_channels to video_jobs
 * Run: node scripts/migrate-pipeline-columns.mjs
 */
import mysql from "mysql2/promise";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL not set");
  process.exit(1);
}

const conn = await mysql.createConnection(url);

try {
  // 1. Add production path enum column
  try {
    await conn.execute(
      `ALTER TABLE video_jobs ADD COLUMN vj_production_path ENUM('descript_only','heygen_only','heygen_then_descript') NOT NULL DEFAULT 'heygen_then_descript'`
    );
    console.log("✅ Added vj_production_path");
  } catch (e) {
    if (e.message.includes("Duplicate column")) {
      console.log("ℹ️  vj_production_path already exists — skipping");
    } else {
      throw e;
    }
  }

  // 2. Add output channels as VARCHAR (avoids TEXT default restriction in MySQL)
  try {
    await conn.execute(
      `ALTER TABLE video_jobs ADD COLUMN vj_output_channels VARCHAR(512) NOT NULL DEFAULT '["youtube"]'`
    );
    console.log("✅ Added vj_output_channels");
  } catch (e) {
    if (e.message.includes("Duplicate column")) {
      console.log("ℹ️  vj_output_channels already exists — skipping");
    } else {
      throw e;
    }
  }

  // 3. Backfill existing rows: map videoType → productionPath
  await conn.execute(
    `UPDATE video_jobs SET vj_production_path = 'heygen_then_descript' WHERE vj_video_type = 'avatar' AND vj_production_path = 'heygen_then_descript'`
  );
  await conn.execute(
    `UPDATE video_jobs SET vj_production_path = 'descript_only' WHERE vj_video_type = 'standard' AND vj_production_path = 'heygen_then_descript'`
  );
  console.log("✅ Backfilled existing rows");

  console.log("\n🎉 Migration complete.");
} finally {
  await conn.end();
}
