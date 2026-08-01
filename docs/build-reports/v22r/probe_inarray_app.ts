/**
 * FINDING #10, second pass — reproduce through the APP'S OWN db + schema.
 *
 * The isolated repro (probe_inarray_bug.mjs sections A-D) all PASSED with
 * correct `in (?, ?)` expansion, which disproved my first hypothesis that
 * `inArray` or the connection config was broken. The server, however, emitted
 * `in ?` with a JSON-stringified array and the stack trace named
 * `MySql2PreparedQuery.queryWithCache`.
 *
 * The remaining differences between the passing repro and the failing server:
 *   1. The app imports the table from drizzle/schema (mysqlTable with a real
 *      `.$type` / enum set) rather than a locally-declared table.
 *   2. The app's db comes from getDb() — a module-level singleton created once
 *      with `drizzle(process.env.DATABASE_URL)`.
 *   3. The values passed are `(job.transcriptVideoIds ?? []) as string[]`, read
 *      back out of a LONGTEXT json column — so they may NOT be a plain
 *      JS array. If drizzle receives a JSON *string* rather than an array,
 *      `inArray` would emit exactly one placeholder and bind that string,
 *      which is precisely the observed SQL.
 *
 * Hypothesis 3 is now the leading candidate and it is a bug in OUR code, not
 * drizzle's. This probe tests it directly by inspecting the runtime type of the
 * value read back from the job row.
 */
import fs from "node:fs";

/*
 * `dotenv/config` alone is not enough here: the app's getDb() reads
 * process.env.DATABASE_URL at first call, and it must point at the SCRATCH
 * database, never staging. Load .env manually, rewrite the database name, and
 * set it BEFORE any app module is imported.
 */
const envText = fs.readFileSync(new URL("../../../.env", import.meta.url), "utf8");
for (const line of envText.split("\n")) {
  const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)$/.exec(line);
  // .env WINS over the inherited shell env here. The sandbox shell already has
  // a credential-less DATABASE_URL exported, which produced a misleading
  // "Access denied for user 'root'@'localhost'" on the first run of this probe.
  if (m) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
}
const dbUrl = new URL(process.env.DATABASE_URL as string);
dbUrl.pathname = "/contenthub_v22_sandbox";
process.env.DATABASE_URL = dbUrl.toString();
console.log(
  `[probe] DATABASE_URL -> ${dbUrl.username}@${dbUrl.hostname}:${dbUrl.port}${dbUrl.pathname} (scratch)`
);

async function main() {
  const { getDb } = await import("../../../server/db");
  const { researchJobs, ytTranscripts } = await import("../../../drizzle/schema");
  const { and, eq, inArray } = await import("drizzle-orm");

  const db = await getDb();
  if (!db) throw new Error("no db");

  const [job] = await db
    .select()
    .from(researchJobs)
    .where(eq(researchJobs.id, 3))
    .limit(1);

  console.log("=".repeat(72));
  console.log("RUNTIME TYPE OF transcriptVideoIds AS READ FROM THE DB");
  console.log("=".repeat(72));
  const raw = job.transcriptVideoIds;
  console.log("typeof            :", typeof raw);
  console.log("Array.isArray     :", Array.isArray(raw));
  console.log("constructor       :", raw?.constructor?.name);
  console.log("JSON.stringify    :", JSON.stringify(raw));
  console.log("value             :", raw);

  const ids = (raw ?? []) as string[];
  console.log();
  console.log("after `(raw ?? []) as string[]` cast:");
  console.log("  Array.isArray   :", Array.isArray(ids));
  console.log("  length          :", (ids as any).length);

  console.log();
  console.log("=".repeat(72));
  console.log("SQL THE APP ACTUALLY BUILDS");
  console.log("=".repeat(72));
  const q = db
    .select({
      videoId: ytTranscripts.videoId,
      videoTitle: ytTranscripts.videoTitle,
      rawText: ytTranscripts.rawText,
    })
    .from(ytTranscripts)
    .where(and(inArray(ytTranscripts.videoId, ids), eq(ytTranscripts.status, "fetched")));

  const built = q.toSQL();
  console.log("sql   :", built.sql);
  console.log("params:", JSON.stringify(built.params));

  try {
    const rows = await q;
    console.log(`EXECUTED OK — ${rows.length} rows`);
    for (const r of rows) console.log(`  ${r.videoId} — ${r.videoTitle}`);
  } catch (err: any) {
    console.log("EXECUTION FAILED:", String(err.message).split("\n")[0]);
    if (err.cause) console.log("cause:", String(err.cause.message).split("\n")[0]);
  }

  console.log();
  console.log("=".repeat(72));
  console.log("CONTROL: same query with a HARD-CODED literal array");
  console.log("=".repeat(72));
  const q2 = db
    .select({ videoId: ytTranscripts.videoId })
    .from(ytTranscripts)
    .where(and(inArray(ytTranscripts.videoId, ["lHEg6dNHTBk", "-orMGt5tzuY"]), eq(ytTranscripts.status, "fetched")));
  console.log("sql   :", q2.toSQL().sql);
  try {
    const rows2 = await q2;
    console.log(`EXECUTED OK — ${rows2.length} rows`);
  } catch (err: any) {
    console.log("EXECUTION FAILED:", String(err.message).split("\n")[0]);
  }

  process.exit(0);
}

main();
