/**
 * Applies drizzle migration SQL files directly, in journal order, and records
 * each one in __drizzle_migrations so drizzle-kit stays in sync.
 *
 * Why this exists: `drizzle-kit migrate` exits 0 on this project without
 * creating any tables (verified: 126 journal entries, 0 tables created, no
 * __drizzle_migrations table written). Rather than debug drizzle-kit's silent
 * failure during a time-boxed sandbox rebuild, this applies the same SQL the
 * same way the project's own scripts/mark-migrations-applied.mjs assumes was
 * applied "manually via direct SQL execution" — that comment tells us direct
 * application is already the established fallback in this repo.
 *
 * Statement splitting: drizzle-GENERATED files write `--> statement-breakpoint`
 * between statements, and splitting on that marker is exact. But this repo also
 * contains HAND-WRITTEN migrations with no breakpoint markers at all (verified:
 * 0113 and 0115 have zero markers, and 0115 holds two CREATE TABLEs), so a
 * marker-only split hands MySQL two concatenated statements and it dies on a
 * parse error at the second CREATE.
 *
 * So: use the marker when present, otherwise fall back to a semicolon split
 * that respects quoting. A naive `split(";")` is wrong because backtick-quoted
 * identifiers and string literals can contain semicolons; splitSql below tracks
 * quote state and only breaks on semicolons at depth zero outside quotes.
 *
 * Idempotent: skips any migration whose hash is already in
 * __drizzle_migrations, and tolerates "already exists" errors so a partially
 * applied database converges rather than aborting.
 */
import mysql from "mysql2/promise";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("[migrate] DATABASE_URL is not set");
  process.exit(1);
}

/**
 * Split SQL into statements on top-level semicolons, ignoring semicolons that
 * appear inside single quotes, double quotes, or backticks, and skipping
 * `--` line comments.
 */
function splitSql(sql) {
  const out = [];
  let buf = "";
  let quote = null; // "'", '"', or "`"
  let i = 0;
  while (i < sql.length) {
    const ch = sql[i];
    const next = sql[i + 1];

    if (quote) {
      buf += ch;
      if (ch === "\\" && quote !== "`") {
        // escaped char inside a string literal
        if (next !== undefined) {
          buf += next;
          i += 2;
          continue;
        }
      } else if (ch === quote) {
        quote = null;
      }
      i++;
      continue;
    }

    // line comment: copy through end of line
    if (ch === "-" && next === "-") {
      const nl = sql.indexOf("\n", i);
      const end = nl === -1 ? sql.length : nl + 1;
      buf += sql.slice(i, end);
      i = end;
      continue;
    }

    if (ch === "'" || ch === '"' || ch === "`") {
      quote = ch;
      buf += ch;
      i++;
      continue;
    }

    if (ch === ";") {
      out.push(buf);
      buf = "";
      i++;
      continue;
    }

    buf += ch;
    i++;
  }
  if (buf.trim()) out.push(buf);
  return out;
}

const journal = JSON.parse(readFileSync("drizzle/meta/_journal.json", "utf8"));
const entries = journal.entries ?? [];
console.log(`[migrate] journal has ${entries.length} entries`);

const conn = await mysql.createConnection({ uri: url, multipleStatements: false });

await conn.query(`
  CREATE TABLE IF NOT EXISTS __drizzle_migrations (
    id SERIAL PRIMARY KEY,
    hash text NOT NULL,
    created_at bigint
  )
`);

const [appliedRows] = await conn.query("SELECT hash FROM __drizzle_migrations");
const applied = new Set(appliedRows.map((r) => r.hash));
console.log(`[migrate] ${applied.size} already recorded as applied`);

// Errors that mean "this object is already in the desired state". Tolerated so
// a re-run converges instead of aborting halfway.
const BENIGN = new Set([
  "ER_TABLE_EXISTS_ERROR",
  "ER_DUP_FIELDNAME",
  "ER_DUP_KEYNAME",
  "ER_DUP_ENTRY",
  "ER_CANT_DROP_FIELD_OR_KEY",
  "ER_FK_DUP_NAME",
  "ER_MULTIPLE_PRI_KEY",
]);

/**
 * Migrations that are provably wrong in committed history and are already
 * no-ops against a correctly built schema. Each entry needs a reason, because
 * a blanket "ignore errors" would turn this runner into a way of not noticing
 * broken migrations.
 *
 * 0114_add_uploaded_unlisted_status: targets `video_jobs`.`vj_status`, a column
 *   that has never existed. 0113_broad_speed creates the column as
 *   `video_job_status`, and drizzle/schema.ts:2112 declares the enum with that
 *   same name (`mysqlEnum("video_job_status", ...)`). So this ALTER could only
 *   ever have failed. It is skipped rather than "fixed": rewriting it to target
 *   video_job_status would change the enum's allowed values on every existing
 *   deployment, which is a schema change to the video pipeline — outside the
 *   scope of a sandbox rebuild, and the video pipeline is not part of v2.3.
 *   Logged for the operator instead.
 */
const KNOWN_BROKEN = new Map([
  [
    "0114_add_uploaded_unlisted_status",
    "targets video_jobs.vj_status which never existed; 0113 creates video_job_status",
  ],
]);

let appliedCount = 0;
let skippedCount = 0;
let benignCount = 0;
const brokenSkipped = [];

for (const entry of entries) {
  const file = `drizzle/${entry.tag}.sql`;

  if (KNOWN_BROKEN.has(entry.tag)) {
    brokenSkipped.push(`${entry.tag} — ${KNOWN_BROKEN.get(entry.tag)}`);
    continue;
  }

  let sql;
  try {
    sql = readFileSync(file, "utf8");
  } catch {
    console.log(`[migrate] SKIP ${entry.tag} — file absent`);
    continue;
  }

  const hash = createHash("sha256").update(sql).digest("hex");
  if (applied.has(hash)) {
    skippedCount++;
    continue;
  }

  // Drizzle-generated files carry breakpoint markers; hand-written ones do not.
  const statements = sql.includes("--> statement-breakpoint")
    ? sql.split("--> statement-breakpoint")
    : splitSql(sql);

  let stmtOk = 0;
  for (const raw of statements) {
    // Strip comment-only lines so an all-comment fragment is not sent as SQL.
    const body = raw
      .split("\n")
      .filter((l) => !l.trim().startsWith("--"))
      .join("\n")
      .trim()
      .replace(/;\s*$/, "");
    if (!body) continue;

    try {
      await conn.query(body);
      stmtOk++;
    } catch (err) {
      if (BENIGN.has(err.code)) {
        benignCount++;
        continue;
      }
      console.error(`[migrate] FAILED in ${entry.tag}: ${err.code} ${err.message}`);
      console.error(`[migrate] statement was:\n${body.slice(0, 400)}`);
      await conn.end();
      process.exit(1);
    }
  }

  await conn.execute("INSERT INTO __drizzle_migrations (hash, created_at) VALUES (?, ?)", [
    hash,
    entry.when ?? Date.now(),
  ]);
  appliedCount++;
  if (appliedCount % 20 === 0) console.log(`[migrate] ...${appliedCount} applied`);
}

const [[{ n }]] = await conn.query(
  "SELECT COUNT(*) AS n FROM information_schema.tables WHERE table_schema = DATABASE()"
);
console.log(
  `[migrate] done — applied ${appliedCount}, already-applied ${skippedCount}, benign-tolerated ${benignCount}, tables now ${n}`
);

if (brokenSkipped.length > 0) {
  console.log("[migrate] KNOWN-BROKEN migrations skipped (pre-existing, not caused by this rebuild):");
  for (const b of brokenSkipped) console.log(`[migrate]   - ${b}`);
}

await conn.end();
