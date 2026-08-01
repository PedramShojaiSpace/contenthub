/**
 * FINDING #10 diagnosis — why does drizzle `inArray` fail on this database?
 *
 * Symptom (from the live server log):
 *   query : ... where `video_id` in ?
 *   params: ['["lHEg6dNHTBk","-orMGt5tzuY"]', 'fetched']
 *   MariaDB: syntax error near '["lHEg6dNHTBk","-orMGt5tzuY"]'
 *
 * Drizzle emitted ONE placeholder and bound a JSON string, instead of `in (?, ?)`.
 * Before fixing 28 call sites, establish WHICH layer is wrong:
 *
 *   A. `drizzle(connectionString)` — the one-arg form used in server/db.ts. This
 *      builds its own pool, and the mysql2 default `prepare`/placeholder handling
 *      may differ from an explicitly-created pool.
 *   B. An explicit `mysql.createPool` + `drizzle(pool)`.
 *
 * If B works and A does not, the fix is ONE line in server/db.ts rather than 28
 * rewritten queries — and every other `inArray` in the app is fixed with it.
 * That distinction is why this probe exists instead of a blind patch.
 */
import fs from "node:fs";
import mysql from "mysql2/promise";
import { drizzle } from "drizzle-orm/mysql2";
import { sql } from "drizzle-orm";

const envText = fs.readFileSync(new URL("../../../.env", import.meta.url), "utf8");
const env = {};
for (const line of envText.split("\n")) {
  const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)$/.exec(line);
  if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
}
const base = new URL(env.DATABASE_URL);
base.pathname = "/contenthub_v22_sandbox";
const connStr = base.toString();

const IDS = ["lHEg6dNHTBk", "-orMGt5tzuY"];
const line = (s = "") => console.log(s);

line("=".repeat(72));
line("A. drizzle(connectionString) — exactly what server/db.ts does today");
line("=".repeat(72));
try {
  const dbA = drizzle(connStr);
  const r = await dbA.execute(
    sql`select video_id from yt_transcripts where video_id in ${IDS}`
  );
  line(`OK — rows: ${JSON.stringify(r[0] ?? r)}`);
} catch (err) {
  line(`FAILED: ${err.message.split("\n")[0]}`);
  if (err.cause) line(`cause : ${String(err.cause.message).split("\n")[0]}`);
}

line();
line("=".repeat(72));
line("B. explicit mysql.createPool + drizzle(pool)");
line("=".repeat(72));
try {
  const pool = mysql.createPool(connStr);
  const dbB = drizzle(pool);
  const r = await dbB.execute(
    sql`select video_id from yt_transcripts where video_id in ${IDS}`
  );
  line(`OK — rows: ${JSON.stringify(r[0] ?? r)}`);
  await pool.end();
} catch (err) {
  line(`FAILED: ${err.message.split("\n")[0]}`);
  if (err.cause) line(`cause : ${String(err.cause.message).split("\n")[0]}`);
}

line();
line("=".repeat(72));
line("C. raw mysql2 with expanded placeholders (the SQL that SHOULD be emitted)");
line("=".repeat(72));
try {
  const conn = await mysql.createConnection(connStr);
  const [rows] = await conn.query(
    `SELECT video_id FROM yt_transcripts WHERE video_id IN (${IDS.map(() => "?").join(",")})`,
    IDS
  );
  line(`OK — rows: ${JSON.stringify(rows)}`);
  await conn.end();
} catch (err) {
  line(`FAILED: ${err.message.split("\n")[0]}`);
}

/*
 * A, B and C all pass with a raw `sql` template. So the connection layer is
 * fine and the bug is NOT config-dependent — which rules out the one-line
 * server/db.ts fix I hoped for.
 *
 * The failing call used the QUERY BUILDER with `inArray()`, i.e.
 *   db.select({...}).from(ytTranscripts).where(and(inArray(col, ids), eq(...)))
 * and drizzle's own log showed `in ?` with a JSON-stringified param. The
 * difference between that and the passing cases is the builder + prepared
 * statement + query cache path (`queryWithCache` in the stack trace).
 *
 * D reproduces the EXACT failing shape so the real trigger is identified rather
 * than guessed at.
 */
line();
line("=".repeat(72));
line("D. QUERY BUILDER with inArray() — the exact failing shape");
line("=".repeat(72));
const { mysqlTable, varchar, mediumtext, mysqlEnum, int } = await import("drizzle-orm/mysql-core");
const { and, eq, inArray } = await import("drizzle-orm");
const t = mysqlTable("yt_transcripts", {
  id: int("id"),
  videoId: varchar("video_id", { length: 64 }),
  videoTitle: varchar("video_title", { length: 512 }),
  rawText: mediumtext("raw_text"),
  status: mysqlEnum("status", ["pending", "fetched", "no_transcript", "error"]),
});

for (const [label, mk] of [
  ["drizzle(connStr)", () => drizzle(connStr)],
  ["drizzle(createPool(connStr))", () => drizzle(mysql.createPool(connStr))],
]) {
  try {
    const db = mk();
    const q = db
      .select({ videoId: t.videoId, videoTitle: t.videoTitle })
      .from(t)
      .where(and(inArray(t.videoId, IDS), eq(t.status, "fetched")));
    line(`${label} SQL: ${q.toSQL().sql}`);
    line(`${label} params: ${JSON.stringify(q.toSQL().params)}`);
    const rows = await q;
    line(`${label} -> OK, ${rows.length} rows`);
  } catch (err) {
    line(`${label} -> FAILED: ${err.message.split("\n")[0]}`);
    if (err.cause) line(`   cause: ${String(err.cause.message).split("\n")[0]}`);
  }
  line();
}

process.exit(0);
