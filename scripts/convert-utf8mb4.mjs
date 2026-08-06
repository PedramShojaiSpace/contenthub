/**
 * Converts the Script Factory data-path tables to utf8mb4 so 4-byte characters
 * (emoji) survive a round trip.
 *
 * Why this is needed at all: the database is created with DEFAULT CHARACTER SET
 * utf8mb3 to match the original sandbox, so every text column is born utf8mb3.
 * utf8mb3 stores at most 3 bytes per character and CANNOT represent astral-plane
 * codepoints. The operator's sales page contains three of them (📦 🔬 👨), so an
 * unconverted insert either errors with ER_TRUNCATED_WRONG_VALUE_FOR_FIELD or
 * silently mangles them — and seed-sandbox.mjs's Buffer.compare round-trip check
 * would then fail, correctly, on storage that lost data.
 *
 * Scope: only the tables the Script Factory reads and writes. Converting all 139
 * tables is unnecessary and slow, and touching unrelated modules' tables during a
 * sandbox rebuild is exactly the kind of scope creep that causes drift.
 *
 * CONVERT TO is used rather than per-column MODIFY: it converts every character
 * column in the table in one DDL, including ones added later, so this script does
 * not need updating each time a column is added.
 */
import mysql from "mysql2/promise";

const TABLES = [
  "script_factory_outputs",
  "analog_data_entries",
  "corpus_entries",
  "personas",
  // Research inputs the generate path reads. Transcripts, video titles and
  // comments routinely carry emoji, and a title that fails to store would look
  // like a research bug rather than a charset bug.
  // Names verified against information_schema — an earlier draft of this list
  // guessed "yt_videos" and "script_factory_jobs", neither of which exists.
  "yt_transcripts",
  "yt_video_outliers",
  "yt_comments",
  "research_jobs",
  "research_reports",
  "research_queries",
];

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("[utf8mb4] DATABASE_URL is not set");
  process.exit(1);
}

const conn = await mysql.createConnection(url);

for (const table of TABLES) {
  const [exists] = await conn.query(
    "SELECT COUNT(*) AS n FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = ?",
    [table]
  );
  if (exists[0].n === 0) {
    console.log(`[utf8mb4] SKIP ${table} — table not present`);
    continue;
  }

  const [before] = await conn.query(
    `SELECT COUNT(*) AS n FROM information_schema.columns
      WHERE table_schema = DATABASE() AND table_name = ?
        AND character_set_name IS NOT NULL AND character_set_name <> 'utf8mb4'`,
    [table]
  );

  if (before[0].n === 0) {
    console.log(`[utf8mb4] ${table} already utf8mb4`);
    continue;
  }

  await conn.query(
    `ALTER TABLE \`${table}\` CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
  );

  const [after] = await conn.query(
    `SELECT COUNT(*) AS n FROM information_schema.columns
      WHERE table_schema = DATABASE() AND table_name = ?
        AND character_set_name IS NOT NULL AND character_set_name <> 'utf8mb4'`,
    [table]
  );
  console.log(`[utf8mb4] ${table}: ${before[0].n} non-utf8mb4 columns -> ${after[0].n}`);
}

// Proof the conversion actually works, rather than trusting the DDL succeeded.
// A 4-byte insert into a utf8mb3 column fails or mangles; this asserts a real
// round trip through the column the sales page lands in.
await conn.query(`
  CREATE TEMPORARY TABLE __emoji_probe (v TEXT) CHARACTER SET utf8mb4
`);
const probe = "📦🔬👨";
await conn.execute("INSERT INTO __emoji_probe (v) VALUES (?)", [probe]);
const [[row]] = await conn.query("SELECT v FROM __emoji_probe");
const ok = Buffer.compare(Buffer.from(probe, "utf8"), Buffer.from(row.v, "utf8")) === 0;
console.log(`[utf8mb4] 4-byte round trip: ${ok ? "OK" : "FAILED"} (${row.v})`);

await conn.end();
if (!ok) process.exitCode = 1;
