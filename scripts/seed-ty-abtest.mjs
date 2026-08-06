/**
 * seed-ty-abtest.mjs
 * Seeds the Interconnected TY Page A/B test into the database.
 * Run once: node scripts/seed-ty-abtest.mjs
 */

import { createConnection } from "mysql2/promise";
import dotenv from "dotenv";
dotenv.config();

const conn = await createConnection(process.env.DATABASE_URL);

try {
  // Check if test already exists
  const [existing] = await conn.execute(
    "SELECT id FROM ab_tests WHERE name = 'Interconnected TY Page — Video A vs B' LIMIT 1"
  );

  if (existing.length > 0) {
    console.log("✅ Test already exists with ID:", existing[0].id);
    const [variants] = await conn.execute(
      "SELECT * FROM ab_variants WHERE test_id = ?",
      [existing[0].id]
    );
    console.log("Variants:", variants);
    await conn.end();
    process.exit(0);
  }

  // Create the test
  const [testResult] = await conn.execute(
    `INSERT INTO ab_tests (name, description, page_url, status, min_exposures, significance_threshold, started_at, created_at, updated_at)
     VALUES (?, ?, '/interconnected/thank-you', 'running', 200, 0.95, UNIX_TIMESTAMP()*1000, UNIX_TIMESTAMP()*1000, UNIX_TIMESTAMP()*1000)`,
    [
      "Interconnected TY Page — Video A vs B",
      "Split test: Version A (original Wistia hobj7srg3q) vs Version B (new script 10cdtpm3il). Conversion goal: $67 OTO purchase click."
    ]
  );
  const testId = testResult.insertId;
  console.log("✅ Created test ID:", testId);

  // Create variant A (control)
  await conn.execute(
    `INSERT INTO ab_variants (test_id, name, description, is_control, weight, created_at, updated_at)
     VALUES (?, 'Version A — Original Video', 'Original TY page video (hobj7srg3q)', 1, 50, UNIX_TIMESTAMP()*1000, UNIX_TIMESTAMP()*1000)`,
    [testId]
  );

  // Create variant B (treatment)
  await conn.execute(
    `INSERT INTO ab_variants (test_id, name, description, is_control, weight, created_at, updated_at)
     VALUES (?, 'Version B — New Script Video', 'New teleprompter script video (10cdtpm3il)', 0, 50, UNIX_TIMESTAMP()*1000, UNIX_TIMESTAMP()*1000)`,
    [testId]
  );

  const [variants] = await conn.execute(
    "SELECT * FROM ab_variants WHERE test_id = ?",
    [testId]
  );

  console.log("✅ Created variants:");
  variants.forEach(v => console.log(`  - ${v.name} (ID: ${v.id}, control: ${v.is_control})`));
  console.log("\n⚠️  Update TY_AB_TEST_ID in InterconnectedThankYouSplitter.tsx to:", testId);

} catch (err) {
  console.error("❌ Error:", err.message);
} finally {
  await conn.end();
}
