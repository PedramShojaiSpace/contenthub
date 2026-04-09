import mysql from "mysql2/promise";
import dotenv from "dotenv";
dotenv.config();

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL not set");
  process.exit(1);
}

const conn = await mysql.createConnection(url);

try {
  // Step 0: Temporarily change to TEXT to allow any value during migration
  await conn.execute(`ALTER TABLE \`landing_pages\` MODIFY COLUMN \`offer\` VARCHAR(64) NOT NULL DEFAULT 'upstream_bundle'`);
  console.log("  Changed offer column to TEXT temporarily");

  // Step 1: Remap old offer values to new ones before changing the enum
  const remaps = [
    ["academy", "upstream_course"],
    ["retreat", "upstream_bundle"],
    ["supplements", "upstream_bundle"],
    ["free_guide", "lights_on_webinar"],
  ];
  for (const [oldVal, newVal] of remaps) {
    const [result] = await conn.execute(
      `UPDATE \`landing_pages\` SET \`offer\` = '${newVal}' WHERE \`offer\` = '${oldVal}'`
    );
    console.log(`  Remapped '${oldVal}' → '${newVal}': ${result.affectedRows} rows`);
  }

  // Step 2: Now change the enum column
  await conn.execute(
    `ALTER TABLE \`landing_pages\` MODIFY COLUMN \`offer\` enum('upstream_bundle','upstream_course','explorer_tier','lights_on_webinar','deep_sleep_webinar','homesick_screening','interconnected_screening','kbmo_testing','gateway_health','custom') NOT NULL DEFAULT 'upstream_bundle'`
  );
  console.log("✓ offer enum column updated successfully");
} catch (err) {
  console.error("Migration error:", err.message);
} finally {
  await conn.end();
}
