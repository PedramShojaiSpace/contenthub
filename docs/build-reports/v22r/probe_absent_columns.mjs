/**
 * Part 0.3 / Part 1 verification helper — READ-ONLY.
 * Proves a column is absent by issuing a SELECT and capturing the driver's
 * verbatim error (ER_BAD_FIELD_ERROR). The mysql CLI in this sandbox swallows
 * stderr, so we probe through the same driver the app uses.
 *
 * Usage: node probe_absent_columns.mjs <database>
 */
import mysql from "mysql2/promise";
import { readFileSync } from "node:fs";

const db = process.argv[2] || "contenthub_staging";
const password = readFileSync("/tmp/chpw.txt", "utf8").trim();

const PROBES = [
  ["analog_data_entries", "offer_profile"],
  ["script_factory_outputs", "pattern_composition"],
  ["research_jobs", "structure_summary"],
];

const conn = await mysql.createConnection({
  host: "127.0.0.1",
  port: 3306,
  user: "chstaging",
  password,
  database: db,
});

console.log(`=== column absence probes  [db=${db}] ===\n`);
for (const [table, column] of PROBES) {
  const sql = `SELECT \`${column}\` FROM \`${table}\` LIMIT 1`;
  console.log(`$ ${sql}`);
  try {
    const [rows] = await conn.query(sql);
    console.log(`  PRESENT — returned ${rows.length} row(s): ${JSON.stringify(rows)}`);
  } catch (e) {
    console.log(`  ABSENT — ${e.code}: ${e.sqlMessage}`);
  }
  console.log();
}

await conn.end();
