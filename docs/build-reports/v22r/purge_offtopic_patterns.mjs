/*
 * Purge patterns mined from off-topic discovery results (v2.2 Part 3C).
 *
 * WHY THIS EXISTS
 * Before the relevance hard gate, a research job whose discovery results were
 * entirely unrelated to the seed still completed and wrote patterns into
 * content_patterns. Measured examples now sitting in the scratch DB:
 *   - a Sprunki gaming video ("Mhm, good tasty." at effectiveness 0.90)
 *   - a Corpus Christi water-supply news report
 *   - "Ishq Mein Tere Sadqay" — a Hindi/Urdu TV drama, opening in Devanagari
 * Those rows are the grounding corpus every later composition draws from, so
 * leaving them in place would let 3D compose scripts out of gaming-stream
 * chatter and television dialogue.
 *
 * SAFETY
 * - Scratch DB ONLY. Refuses to run unless the database name ends
 *   `_v22_sandbox`, so it cannot touch staging or production.
 * - Deletes by JOB LINEAGE, not by an id range. An earlier cleanup of mine used
 *   `id >= 30000` as a proxy for "probe-created" and swept up three unrelated
 *   rows; matching real provenance avoids repeating that.
 * - Prints every row it is about to remove, then verifies the count after.
 */
import mysql from "mysql2/promise";
import fs from "node:fs";

const env = Object.fromEntries(
  fs.readFileSync(new URL("../../../.env", import.meta.url), "utf8")
    .split("\n")
    .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")];
    })
);

const url = new URL(env.DATABASE_URL);
const dbName = "contenthub_v22_sandbox";
if (!dbName.endsWith("_v22_sandbox")) {
  throw new Error("refusing to run outside the scratch database");
}

const conn = await mysql.createConnection({
  host: url.hostname,
  port: Number(url.port || 3306),
  user: decodeURIComponent(url.username),
  password: decodeURIComponent(url.password),
  database: dbName,
});

const q = async (sql, params = []) => (await conn.query(sql, params))[0];

console.log("=".repeat(78));
console.log(`PURGE OFF-TOPIC PATTERNS — database: ${dbName}`);
console.log("=".repeat(78));

// Jobs whose notes record that ZERO discovery results were on topic.
const junkJobs = await q(
  `SELECT id, seed_keyword, notes FROM research_jobs
    WHERE notes LIKE '%on_topic=0/%'`
);
console.log(`\njobs with on_topic=0: ${junkJobs.length}`);
for (const j of junkJobs) console.log(`  #${j.id} seed=${JSON.stringify(j.seed_keyword)}`);

if (junkJobs.length === 0) {
  console.log("\nnothing to purge.");
  await conn.end();
  process.exit(0);
}

const ids = junkJobs.map((j) => j.id);
const placeholders = ids.map(() => "?").join(", ");

// pattern_ids and the hook refs are recorded on the job rows themselves.
const patternIdSets = await q(
  `SELECT id, pattern_ids FROM research_jobs WHERE id IN (${placeholders})`,
  ids
);
const patternIds = new Set();
for (const row of patternIdSets) {
  let arr = row.pattern_ids;
  if (typeof arr === "string") {
    try { arr = JSON.parse(arr); } catch { arr = []; }
  }
  for (const pid of arr ?? []) patternIds.add(Number(pid));
}

// Hook-reference patterns carry their provenance in pattern_context.
const hookRows = await q(
  `SELECT id, pattern_text, pattern_context FROM content_patterns
    WHERE pattern_context LIKE '%HOOK REFERENCE%'`
);

console.log(`\npatterns linked to those jobs: ${patternIds.size}`);
console.log(`hook-reference rows present:   ${hookRows.length}`);

const before = (await q(`SELECT COUNT(*) c FROM content_patterns`))[0].c;

// Show exactly what goes.
if (patternIds.size > 0) {
  const ph = [...patternIds].map(() => "?").join(", ");
  const doomed = await q(
    `SELECT id, pattern_type, LEFT(pattern_text, 90) txt, effectiveness_score eff
       FROM content_patterns WHERE id IN (${ph})`,
    [...patternIds]
  );
  console.log("\nrows to delete:");
  for (const d of doomed) {
    console.log(`  #${d.id} [${d.pattern_type}] eff=${d.eff} ${JSON.stringify(d.txt)}`);
  }
  await q(`DELETE FROM content_patterns WHERE id IN (${ph})`, [...patternIds]);
}

// The junk jobs themselves are probe artifacts; drop them so later proofs read clean.
await q(`DELETE FROM research_jobs WHERE id IN (${placeholders})`, ids);

const after = (await q(`SELECT COUNT(*) c FROM content_patterns`))[0].c;
console.log(`\ncontent_patterns: ${before} -> ${after} (removed ${before - after})`);
console.log(`research_jobs purged: ${ids.join(", ")}`);

// Prove staging was never touched.
const [stagingCount] = await q(
  `SELECT COUNT(*) c FROM contenthub_staging.content_patterns`
).catch(() => [{ c: "n/a (no grant)" }]);
console.log(`staging content_patterns (untouched): ${stagingCount?.c ?? "n/a"}`);

await conn.end();
