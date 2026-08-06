/**
 * FINDING #10 blast radius.
 *
 * ROOT CAUSE (proven by probe_inarray_app.ts): `research_jobs.transcript_video_ids`
 * is declared `json("transcript_video_ids").$type<string[]>()` in drizzle but is
 * physically LONGTEXT in MySQL. For a real JSON column mysql2 parses the value
 * into a JS array; for LONGTEXT it returns the raw string. The app then does
 * `(job.transcriptVideoIds ?? []) as string[]`, a compile-time cast that does
 * nothing at runtime, so downstream code receives a STRING where it expects an
 * array.
 *
 * That is the same failure class as Part 1 fixes 6-8 (drizzle declaration not
 * matching the live column). Before patching call sites one at a time, measure
 * how many json()-declared columns are actually LONGTEXT — every one of them is
 * a latent instance of this bug.
 */
import mysql from "mysql2/promise";
import fs from "node:fs";

const envText = fs.readFileSync(new URL("../../../.env", import.meta.url), "utf8");
const env = {};
for (const line of envText.split("\n")) {
  const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)$/.exec(line);
  if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
}
const u = new URL(env.DATABASE_URL);
const conn = await mysql.createConnection({
  host: u.hostname,
  port: Number(u.port || 3306),
  user: decodeURIComponent(u.username),
  password: decodeURIComponent(u.password),
  database: "contenthub_v22_sandbox",
});

// Every json() declaration in drizzle/schema.ts, as (table, column) pairs.
const schemaText = fs.readFileSync(new URL("../../../drizzle/schema.ts", import.meta.url), "utf8");
const tableBlocks = [...schemaText.matchAll(/mysqlTable\(\s*"([a-z0-9_]+)"[\s\S]*?\n\}\)/g)];
const declared = [];
for (const block of tableBlocks) {
  const table = block[1];
  for (const c of block[0].matchAll(/json\("([a-z0-9_]+)"\)/g)) {
    declared.push({ table, column: c[1] });
  }
}

console.log(`json()-declared columns found in drizzle/schema.ts: ${declared.length}\n`);

const rows = [];
for (const d of declared) {
  const [r] = await conn.query(
    `SELECT DATA_TYPE FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    ["contenthub_v22_sandbox", d.table, d.column]
  );
  const actual = r[0]?.DATA_TYPE ?? "(column missing)";
  rows.push({ ...d, actual, mismatch: actual !== "json" });
}

const pad = (s, n) => String(s).padEnd(n);
console.log(
  `${pad("TABLE", 22)}${pad("COLUMN", 26)}${pad("DECLARED", 10)}${pad("ACTUAL", 12)}MISMATCH`
);
console.log("-".repeat(82));
for (const r of rows) {
  console.log(
    `${pad(r.table, 22)}${pad(r.column, 26)}${pad("json", 10)}${pad(r.actual, 12)}${r.mismatch ? "YES" : "no"}`
  );
}

const bad = rows.filter((r) => r.mismatch);
console.log(`\nMISMATCHED: ${bad.length}/${rows.length}`);
console.log(
  bad.length === rows.length
    ? "=> EVERY json() declaration is actually TEXT/LONGTEXT. The driver returns\n" +
        "   strings for all of them, so every `as T[]` cast on these columns is a\n" +
        "   latent runtime bug, not just transcript_video_ids."
    : "=> Mixed. Only the mismatched rows return strings."
);

// Demonstrate the runtime consequence on real data, not just metadata.
console.log("\nRUNTIME CHECK — what the driver actually returns for job #3:");
const [j] = await conn.query(
  "SELECT transcript_video_ids, pattern_ids, outlier_videos FROM research_jobs WHERE id = 3"
);
for (const [k, v] of Object.entries(j[0] ?? {})) {
  console.log(`  ${pad(k, 24)} typeof=${pad(typeof v, 8)} isArray=${Array.isArray(v)}`);
}

await conn.end();
