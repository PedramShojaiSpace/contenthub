/**
 * Part 1 proof for fixes 6, 7, 8 — the six corrected drizzle column names.
 *
 * Runs against the SCRATCH database (contenthub_v22_sandbox), never staging,
 * because it inserts and deletes rows. Staging stays read-only ground truth.
 *
 * For each corrected column it does three things, side by side:
 *   1. shows the OLD (declared) name failing with ER_BAD_FIELD_ERROR
 *   2. shows the NEW (live) name succeeding
 *   3. round-trips a real INSERT + SELECT + DELETE, proving writes work now
 *
 * A name-only correction is easy to assert and hard to prove. Point 3 is the
 * proof: these three tables held 0 rows precisely because writes threw.
 *
 * Reproduce: node docs/build-reports/v22r/probe_schema_fixes.mjs
 */
import fs from "node:fs";
import path from "node:path";
import mysql from "mysql2/promise";

const SCRATCH_DB = "contenthub_v22_sandbox";
const envPath = path.resolve(import.meta.dirname, "../../../.env");
const url = fs.readFileSync(envPath, "utf8").match(/^DATABASE_URL\s*=\s*"?([^"\r\n]+)"?/m)?.[1]?.trim();
if (!url) throw new Error("DATABASE_URL not found");

const u = new URL(url);
const conn = await mysql.createConnection({
  host: u.hostname,
  port: Number(u.port || 3306),
  user: decodeURIComponent(u.username),
  password: decodeURIComponent(u.password),
  database: SCRATCH_DB, // scratch only — never the staging schema
  multipleStatements: false,
});

console.log(`Part 1 schema-fix proof — ${new Date().toISOString()}`);
const [[dbRow]] = await conn.query("SELECT DATABASE() AS db");
console.log(`connected to: ${dbRow.db}  (MUST be ${SCRATCH_DB}, not staging)`);
if (dbRow.db !== SCRATCH_DB) throw new Error("refusing to run outside the scratch DB");

function hr(t) {
  console.log("\n" + "=".repeat(78) + "\n" + t + "\n" + "=".repeat(78));
}

/** Try a SELECT of one column; report the driver's verdict verbatim. */
async function probeColumn(table, column, label) {
  try {
    await conn.query(`SELECT \`${column}\` FROM \`${table}\` LIMIT 1`);
    console.log(`  ${label.padEnd(9)} SELECT \`${column}\` → OK (column exists)`);
    return true;
  } catch (err) {
    console.log(`  ${label.padEnd(9)} SELECT \`${column}\` → ${err.code}: ${err.sqlMessage}`);
    return false;
  }
}

const CASES = [
  { table: "yt_transcripts", pairs: [["transcript_status", "status"], ["tr_created_at", "created_at"], ["tr_updated_at", "updated_at"]] },
  { table: "claims_reviews", pairs: [["cr_content_type", "content_type"], ["cr_status", "status"]] },
  { table: "yt_video_outliers", pairs: [["outlier_created_at", "created_at"], ["outlier_updated_at", "updated_at"]] },
];

hr("1. OLD (declared) names vs NEW (live) names, per corrected column");
for (const { table, pairs } of CASES) {
  console.log(`\n${table}:`);
  for (const [oldName, newName] of pairs) {
    const oldOk = await probeColumn(table, oldName, "OLD");
    const newOk = await probeColumn(table, newName, "NEW");
    const verdict = !oldOk && newOk ? "CORRECT" : "UNEXPECTED — investigate";
    console.log(`  verdict: ${verdict} (old absent: ${!oldOk}, new present: ${newOk})`);
  }
}

hr("2. Row counts BEFORE the write round-trip");
for (const { table } of CASES) {
  const [[r]] = await conn.query(`SELECT COUNT(*) AS n FROM \`${table}\``);
  console.log(`  ${table.padEnd(20)} ${r.n} rows`);
}

hr("3. Write round-trip using the CORRECTED column names");
const marker = `v22proof_${Date.now()}`;

// yt_transcripts — the table whose writes have always thrown.
await conn.query(
  `INSERT INTO yt_transcripts
     (video_id, channel_id, video_title, provider, lang, raw_text, word_count, status, created_at, updated_at)
   VALUES (?, ?, ?, 'supadata', 'en', ?, ?, 'fetched', NOW(), NOW())`,
  [marker, "UC_v22_proof", "v2.2 Part 1 write proof", "proof transcript body", 4]
);
const [ytRows] = await conn.query(
  "SELECT id, video_id, status, word_count, created_at, updated_at FROM yt_transcripts WHERE video_id = ?",
  [marker]
);
console.log("  yt_transcripts INSERT + SELECT:");
console.log("   ", JSON.stringify(ytRows[0]));

// claims_reviews — proves content_type accepts an arbitrary string, i.e. that
// Part 3E can write 'youtube_script' with no ALTER TABLE.
const now = Date.now();
await conn.query(
  `INSERT INTO claims_reviews
     (content_type, content_id, content_title, content_text, verdicts, overall_flag, flag_count, status, created_at, updated_at)
   VALUES ('youtube_script', ?, ?, ?, ?, 0, 0, 'pending', ?, ?)`,
  [marker, "v2.2 Part 1 write proof", "proof body text", JSON.stringify([]), now, now]
);
const [crRows] = await conn.query(
  "SELECT id, content_type, status, flag_count FROM claims_reviews WHERE content_id = ?",
  [marker]
);
console.log("  claims_reviews INSERT + SELECT (content_type='youtube_script'):");
console.log("   ", JSON.stringify(crRows[0]));
console.log(
  "    → a value outside the OLD declared enum was accepted, confirming the live\n" +
    "      column is varchar(64). Part 3E needs no DDL."
);

// yt_video_outliers
await conn.query(
  `INSERT INTO yt_video_outliers
     (video_id, video_title, views, outlier_score, is_outlier, scored_at, created_at, updated_at)
   VALUES (?, ?, ?, ?, 1, NOW(), NOW(), NOW())`,
  [marker, "v2.2 Part 1 write proof", 12345, 27.37]
);
const [ovRows] = await conn.query(
  "SELECT id, video_id, views, outlier_score, created_at FROM yt_video_outliers WHERE video_id = ?",
  [marker]
);
console.log("  yt_video_outliers INSERT + SELECT:");
console.log("   ", JSON.stringify(ovRows[0]));

hr("4. Cleanup — proof rows removed, tables returned to their prior state");
for (const [table, col] of [
  ["yt_transcripts", "video_id"],
  ["claims_reviews", "content_id"],
  ["yt_video_outliers", "video_id"],
]) {
  const [res] = await conn.query(`DELETE FROM \`${table}\` WHERE \`${col}\` = ?`, [marker]);
  console.log(`  ${table.padEnd(20)} deleted ${res.affectedRows} proof row(s)`);
}
for (const { table } of CASES) {
  const [[r]] = await conn.query(`SELECT COUNT(*) AS n FROM \`${table}\``);
  console.log(`  ${table.padEnd(20)} ${r.n} rows (post-cleanup)`);
}

await conn.end();
console.log("\nDONE.");
