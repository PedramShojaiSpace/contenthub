/**
 * PART 3C MIGRATION — research_jobs.structure_summary (json, nullable).
 *
 * Additive only. Runs against `contenthub_v22_sandbox` and REFUSES to run
 * anywhere else: the connection is asserted before any DDL is issued, because a
 * migration pointed at staging would be unrecoverable.
 */
import mysql from "mysql2/promise";
import { readFileSync } from "node:fs";

const env = Object.fromEntries(
  readFileSync("/home/ubuntu/contenthub/.env", "utf8")
    .split("\n")
    .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")];
    })
);

const TARGET = "contenthub_v22_sandbox";
const conn = await mysql.createConnection({
  host: "127.0.0.1",
  port: 3306,
  user: "chstaging",
  password: env.DATABASE_URL?.match(/mysql:\/\/chstaging:([^@]+)@/)?.[1],
  database: TARGET,
});

const [[{ db }]] = await conn.query("SELECT DATABASE() AS db");
console.log(`connected to: ${db}`);
if (db !== TARGET) {
  console.error(`REFUSING: expected ${TARGET}`);
  process.exit(1);
}

const [before] = await conn.query(`SHOW COLUMNS FROM research_jobs LIKE 'structure_summary'`);
console.log(`\nBEFORE — structure_summary present: ${before.length > 0}`);

if (before.length === 0) {
  const ddl = "ALTER TABLE research_jobs ADD COLUMN structure_summary JSON NULL";
  console.log(`\nDDL: ${ddl}`);
  await conn.query(ddl);
} else {
  console.log("\nalready present — no DDL issued (idempotent)");
}

const [after] = await conn.query(`SHOW COLUMNS FROM research_jobs LIKE 'structure_summary'`);
console.log(`\nAFTER — structure_summary present: ${after.length > 0}`);
console.log(JSON.stringify(after[0] ?? null, null, 2));

// Prove staging did NOT receive the column.
const [stg] = await conn.query(
  `SELECT COUNT(*) AS n FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA='contenthub_staging' AND TABLE_NAME='research_jobs'
     AND COLUMN_NAME='structure_summary'`
);
console.log(`\nISOLATION — staging.research_jobs.structure_summary exists: ${stg[0].n > 0} (must be false)`);

await conn.end();
console.log("\nDONE");
