/**
 * SANDBOX ONLY — convert pipeline text columns to utf8mb4.
 *
 * Why this exists: the sandbox MySQL server default is utf8mb3, because the
 * schema declares `varchar(1024) UNIQUE` on three url columns and a utf8mb4
 * server rejects those with errno 1071 (key longer than 3072 bytes). See
 * docs/build-reports/v22r/DEFECT-varchar1024-unique-index.md.
 *
 * But utf8mb3 cannot store 4-byte characters AT ALL — MySQL raises errno 3988
 * (ER_IMPOSSIBLE_STRING_CONVERSION) rather than truncating. The operator's real
 * sales page contains emoji, so a utf8mb3 corpus column cannot hold it verbatim.
 *
 * Fix: leave the SERVER default at utf8mb3 so the indexed varchars still build,
 * and convert only TEXT-family columns to utf8mb4. TEXT/MEDIUMTEXT/LONGTEXT are
 * not indexed here, so widening them cannot hit the key-length limit.
 *
 * Scope: every table the content pipeline WRITES to, not just the four the
 * Script Factory reads. A generated script quoting the page carries those emoji
 * downstream into ideas, patterns, research jobs, transcripts and content items;
 * converting only the read side would move the write failure three steps later
 * where it is much harder to diagnose.
 *
 * Indexed varchar columns are deliberately NOT touched.
 */
import mysql from "mysql2/promise";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set");
  process.exit(1);
}

/** Tables the content pipeline writes to, in dependency-ish order. */
const PIPELINE_TABLES = [
  // Script Factory core
  "analog_data_entries",
  "corpus_entries",
  "personas",
  "script_factory_outputs",
  "content_patterns",
  "research_jobs",
  "claims_reviews",
  // Research / discovery inputs
  "yt_transcripts",
  "yt_video_outliers",
  "yt_trending_videos",
  "yt_channels",
  // Idea + downstream content
  "content_ideas",
  "content_items",
  "production_scripts",
  "newsfeed_articles",
  "verified_links",
  "wp_post_index",
];

const conn = await mysql.createConnection(url);
const dbName = (await conn.execute("SELECT DATABASE() AS d"))[0][0].d;

/**
 * mysql2 returns information_schema column labels in UPPERCASE (COLUMN_NAME,
 * DATA_TYPE, ...) even when the query is written in lowercase, because
 * information_schema is implemented over system views whose column names are
 * canonical uppercase. Reading `row.column_name` silently yields undefined,
 * which produced ALTER statements containing the literal text "undefined".
 * Normalising every row here rather than at each use site.
 */
const lower = (row) =>
  Object.fromEntries(Object.entries(row).map(([k, v]) => [k.toLowerCase(), v]));

let converted = 0;
let skippedMissing = 0;
const failures = [];

try {
  for (const table of PIPELINE_TABLES) {
    const [exists] = await conn.execute(
      `SELECT COUNT(*) AS n FROM information_schema.tables
        WHERE table_schema=? AND table_name=?`,
      [dbName, table]
    );
    if (Number(lower(exists[0]).n) === 0) {
      console.log(`[skip] ${table} — table does not exist`);
      skippedMissing++;
      continue;
    }

    // TEXT-family columns only. varchar/char are excluded because those are the
    // ones that can carry an index and hit the 3072-byte key limit.
    const [cols] = await conn.execute(
      `SELECT column_name, data_type, character_set_name, is_nullable, column_type
         FROM information_schema.columns
        WHERE table_schema=? AND table_name=?
          AND data_type IN ('text','mediumtext','longtext','tinytext')
        ORDER BY ordinal_position`,
      [dbName, table]
    );

    if (cols.length === 0) {
      console.log(`[----] ${table} — no TEXT-family columns`);
      continue;
    }

    for (const raw of cols) {
      const c = lower(raw);
      if (c.character_set_name === "utf8mb4") continue;
      const nullClause = c.is_nullable === "YES" ? "NULL" : "NOT NULL";
      const sql =
        `ALTER TABLE \`${table}\` MODIFY \`${c.column_name}\` ` +
        `${c.column_type} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci ${nullClause}`;
      try {
        await conn.query(sql);
        console.log(`[ ok ] ${table}.${c.column_name} ${c.character_set_name} -> utf8mb4`);
        converted++;
      } catch (err) {
        console.error(`[FAIL] ${table}.${c.column_name}: ${err.code} ${err.sqlMessage}`);
        failures.push(`${table}.${c.column_name}: ${err.sqlMessage}`);
      }
    }
  }

  console.log(`\n[summary] converted=${converted} tablesMissing=${skippedMissing} failures=${failures.length}`);

  // Verify: no TEXT-family column in the pipeline tables is left non-utf8mb4.
  const placeholders = PIPELINE_TABLES.map(() => "?").join(",");
  const [remaining] = await conn.execute(
    `SELECT table_name, column_name, character_set_name
       FROM information_schema.columns
      WHERE table_schema=?
        AND table_name IN (${placeholders})
        AND data_type IN ('text','mediumtext','longtext','tinytext')
        AND character_set_name <> 'utf8mb4'`,
    [dbName, ...PIPELINE_TABLES]
  );
  if (remaining.length === 0) {
    console.log("[verify] every pipeline TEXT column is utf8mb4");
  } else {
    console.log(`[verify] STILL NON-utf8mb4: ${remaining.length}`);
    for (const raw of remaining) {
      const r = lower(raw);
      console.log(`         ${r.table_name}.${r.column_name} = ${r.character_set_name}`);
    }
  }

  // Confirm the indexed varchars were left alone — this is the whole point of
  // converting selectively rather than running CONVERT TO CHARACTER SET.
  const [urlCols] = await conn.execute(
    `SELECT table_name, column_name, character_set_name, column_type
       FROM information_schema.columns
      WHERE table_schema=? AND column_name='url'
        AND table_name IN ('verified_links','newsfeed_articles','wp_post_index')`,
    [dbName]
  );
  console.log("[verify] indexed url columns untouched:");
  for (const raw of urlCols) {
    const r = lower(raw);
    console.log(`         ${r.table_name}.url = ${r.column_type} ${r.character_set_name}`);
  }

  if (failures.length > 0) process.exitCode = 1;
} finally {
  await conn.end();
}
