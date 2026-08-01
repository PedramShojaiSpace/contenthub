/**
 * PART 3B MIGRATION — additive, scratch DB only.
 *
 * ALTER analog_data_entries ADD offer_profile json NULL.
 *
 * Additive and nullable by design: every existing row keeps working with a NULL
 * profile, and a NULL profile means the offer block is omitted rather than
 * guessed. Guarded so re-running is a no-op, and it refuses to run against any
 * database other than the scratch clone.
 */
import mysql from "mysql2/promise";
import { readFileSync } from "node:fs";

const TARGET_DB = "contenthub_v22_sandbox";

const env = Object.fromEntries(
  readFileSync("/home/ubuntu/contenthub/.env", "utf8")
    .split("\n")
    .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")];
    })
);
const password = env.DATABASE_URL?.match(/mysql:\/\/chstaging:([^@]+)@/)?.[1];

const conn = await mysql.createConnection({
  host: "127.0.0.1", port: 3306, user: "chstaging", password, database: TARGET_DB,
});

const [[{ db }]] = await conn.query("SELECT DATABASE() AS db");
if (db !== TARGET_DB) {
  console.error(`REFUSING: connected to "${db}", expected "${TARGET_DB}"`);
  process.exit(1);
}
console.log(`target database: ${db}`);

const [before] = await conn.query(
  `SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'analog_data_entries'
     AND COLUMN_NAME = 'offer_profile'`,
  [TARGET_DB]
);
console.log(`\nBEFORE — offer_profile present: ${before.length > 0}`);

if (before.length === 0) {
  const sql = "ALTER TABLE analog_data_entries ADD COLUMN offer_profile json NULL";
  console.log(`\nRunning: ${sql}`);
  await conn.query(sql);
} else {
  console.log("column already present — no-op");
}

const [after] = await conn.query(
  `SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'analog_data_entries'
     AND COLUMN_NAME = 'offer_profile'`,
  [TARGET_DB]
);
console.log("\nAFTER:");
console.table(after);

// Prove existing rows are untouched and default to NULL.
const [[counts]] = await conn.query(
  `SELECT COUNT(*) AS total, SUM(offer_profile IS NULL) AS null_profiles
   FROM analog_data_entries`
);
console.log(`\nrows: ${counts.total} · NULL profiles: ${counts.null_profiles}`);

// Round-trip a JSON value to prove the column stores and returns structured data.
const [rows] = await conn.query("SELECT id FROM analog_data_entries ORDER BY id LIMIT 1");
if (rows.length) {
  const id = rows[0].id;
  const probe = { offerName: "__probe__", deliverables: ["a", "b"], guarantee: null };
  await conn.query("UPDATE analog_data_entries SET offer_profile = ? WHERE id = ?", [
    JSON.stringify(probe), id,
  ]);
  const [[back]] = await conn.query(
    "SELECT offer_profile FROM analog_data_entries WHERE id = ?", [id]
  );
  const parsed = typeof back.offer_profile === "string"
    ? JSON.parse(back.offer_profile)
    : back.offer_profile;
  console.log(`\nround-trip on id=${id}:`);
  console.log(`  offerName preserved:    ${parsed.offerName === "__probe__"}`);
  console.log(`  deliverables array:     ${Array.isArray(parsed.deliverables)}`);
  console.log(`  explicit null retained: ${parsed.guarantee === null}`);
  await conn.query("UPDATE analog_data_entries SET offer_profile = NULL WHERE id = ?", [id]);
  console.log(`  reverted id=${id} to NULL`);
}

await conn.end();
console.log("\nMIGRATION 3B DONE");
