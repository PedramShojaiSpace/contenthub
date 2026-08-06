/**
 * PART 3D MIGRATION — script_factory_outputs.pattern_composition (LONGTEXT, nullable).
 *
 * Additive only. Runs against `contenthub_v22_sandbox` and REFUSES to run
 * anywhere else: the connection is asserted before any DDL is issued, because a
 * migration pointed at staging would be unrecoverable.
 *
 * LONGTEXT rather than `json` deliberately. Finding #10 established that every
 * existing "json" column in this database is physically LONGTEXT
 * (probe_json_column_drift.mjs: MISMATCHED 15/15), and drizzle reads them
 * through the custom `longtextJson()` type. Creating this one as a real `json`
 * column would make it the single inconsistent column in the schema and would
 * break the shared read path.
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

const COL = "pattern_composition";
const [before] = await conn.query(
  `SHOW COLUMNS FROM script_factory_outputs LIKE '${COL}'`
);
console.log(`\nBEFORE — ${COL} present: ${before.length > 0}`);

if (before.length === 0) {
  await conn.query(
    `ALTER TABLE script_factory_outputs ADD COLUMN ${COL} LONGTEXT NULL`
  );
  console.log(`ALTER TABLE executed: added ${COL} LONGTEXT NULL`);
} else {
  console.log("already present — no DDL issued");
}

const [after] = await conn.query(
  `SHOW COLUMNS FROM script_factory_outputs LIKE '${COL}'`
);
console.log(`\nAFTER — ${COL}:`);
console.log(JSON.stringify(after, null, 2));

// Prove no existing row was touched: the column must be NULL everywhere.
const [[counts]] = await conn.query(
  `SELECT COUNT(*) AS total, SUM(${COL} IS NOT NULL) AS populated FROM script_factory_outputs`
);
console.log(`\nrows=${counts.total}; populated=${counts.populated} (expected 0 immediately after migration)`);

await conn.end();

