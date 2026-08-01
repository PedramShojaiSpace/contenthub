/**
 * Part 2b — PIPELINE PROOF.
 *
 * Establishes that Part 1's fixes actually unblocked Deep Research, which has
 * never once completed in this codebase (Part 0: the single research_jobs row
 * was `failed`). Everything in Part 3 composes from the patterns this pipeline
 * produces, so if this does not work, nothing after it is trustworthy.
 *
 * Runs against the SANDBOX app on the SCRATCH database. Real vidIQ credits and
 * real Supadata transcript quota are spent, so exactly one research job is run.
 *
 * Sections:
 *   1. Before-state row counts (scratch).
 *   2. Side-by-side outliers vs trending for the same seed keyword — the
 *      operator judges topical relevance from real output, which is the open
 *      question for 3C's hook references.
 *   3. One Deep Research job end-to-end via the real tRPC procedure.
 *   4. research_jobs row printed; content_patterns > 0; 3 sample patterns;
 *      yt_transcripts rows printed (proving the Part 1 name fixes work in situ).
 *   5. Supercharge on >=3 un-enriched ideas; persisted vidiqData re-read.
 *   6. Claims-review insert through the existing creation path, then removed.
 *
 * Reproduce: node docs/build-reports/v22r/probe_pipeline_live.mjs
 */
import fs from "node:fs";
import path from "node:path";
import mysql from "mysql2/promise";

const APP = process.env.APP_URL || "http://localhost:3000";
const SCRATCH_DB = "contenthub_v22_sandbox";
const SEED = process.env.SEED_KEYWORD || "leaky gut fatigue";

const envPath = path.resolve(import.meta.dirname, "../../../.env");
const envText = fs.readFileSync(envPath, "utf8");

// server/vidiq.ts captures VIDIQ_API_KEY at import time from ENV, so the key
// must be in process.env BEFORE that module is dynamically imported below.
// The first run of this probe printed "VIDIQ_API_KEY is not configured" for
// section 2 purely because of this ordering — the app itself was fine.
for (const line of envText.split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*"?([^"\r\n]*)"?\s*$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}

const baseUrl = envText.match(/^DATABASE_URL\s*=\s*"?([^"\r\n]+)"?/m)?.[1]?.trim();
if (!baseUrl) throw new Error("DATABASE_URL not found");
const u = new URL(baseUrl);
const db = await mysql.createConnection({
  host: u.hostname,
  port: Number(u.port || 3306),
  user: decodeURIComponent(u.username),
  password: decodeURIComponent(u.password),
  database: SCRATCH_DB,
});

const hr = (t) => console.log("\n" + "=".repeat(78) + "\n" + t + "\n" + "=".repeat(78));
const q = async (sql, args = []) => (await db.query(sql, args))[0];
const count = async (t) => (await q(`SELECT COUNT(*) AS n FROM \`${t}\``))[0].n;

console.log(`Part 2b pipeline proof — ${new Date().toISOString()}`);
console.log(`app: ${APP} · db: ${SCRATCH_DB} · seed keyword: "${SEED}"`);

// Authenticate once.
const loginRes = await fetch(`${APP}/api/dev/login`, { redirect: "manual" });
const cookie = (loginRes.headers.get("set-cookie") ?? "").split(";")[0];
if (!cookie.startsWith("app_session_id=")) throw new Error("dev login failed");
const headers = { "Content-Type": "application/json", Cookie: cookie };

async function trpcMutate(procedure, json, timeoutMs = 900_000) {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), timeoutMs);
  try {
    const r = await fetch(`${APP}/api/trpc/${procedure}`, {
      method: "POST",
      headers,
      body: JSON.stringify({ json }),
      signal: ac.signal,
    });
    return { status: r.status, body: await r.text() };
  } finally {
    clearTimeout(timer);
  }
}

hr("1. BEFORE state (scratch DB)");
const TABLES = ["research_jobs", "content_patterns", "yt_transcripts", "yt_video_outliers", "claims_reviews", "suggested_ideas"];
const before = {};
for (const t of TABLES) {
  before[t] = await count(t);
  console.log(`  ${t.padEnd(20)} ${before[t]}`);
}

hr("2. Discovery source comparison for the SAME seed — outliers vs trending");
console.log("  (3C mines hook references from whichever source wins; the spec makes");
console.log("   outliers primary. Judge topical relevance from the real titles below.)");
{
  const { vidiqOutliers, vidiqTrendingVideos } = await import("../../../server/vidiq.ts");
  for (const [label, fn] of [["vidiq_outliers (spec: PRIMARY)", vidiqOutliers], ["vidiq_trending_videos (spec: FALLBACK)", vidiqTrendingVideos]]) {
    console.log(`\n  --- ${label} — "${SEED}" ---`);
    try {
      const vids = await fn(SEED, 5);
      vids.slice(0, 5).forEach((v, i) => {
        console.log(`   ${i + 1}. ${String(v.title).slice(0, 68)}`);
        console.log(`      channel: ${String(v.channelTitle).slice(0, 40)} · views: ${v.viewCount} · score: ${v.outlierScore ?? "n/a"}`);
      });
      if (!vids.length) console.log("   (empty)");
    } catch (err) {
      console.log(`   THREW: ${err?.name}: ${String(err?.message).slice(0, 200)}`);
    }
  }
}

hr("3. Deep Research end-to-end via the real tRPC procedure");
console.log("  POST scriptFactory.runDeepResearch (this spends real credits/quota)...");
const t0 = Date.now();
const research = await trpcMutate("scriptFactory.runDeepResearch", {
  topic: "Why leaky gut leaves you exhausted all day",
  seedKeyword: SEED,
  maxTranscripts: 3,
});
console.log(`  HTTP ${research.status} after ${((Date.now() - t0) / 1000).toFixed(1)}s`);
console.log(`  body: ${research.body.slice(0, 700)}`);

hr("4. Did the pipeline actually persist? (raw rows)");
// NB: the physical column is `research_status`, not `status` — the drizzle
// declaration aliases it. Using `status` here fails with ER_BAD_FIELD_ERROR.
const jobs = await q("SELECT id, topic, seed_keyword, research_status AS status, transcripts_fetched, transcripts_cached, transcripts_failed, quota_blocked, notes, error_message FROM research_jobs ORDER BY id DESC LIMIT 3");
console.log("  research_jobs (latest 3):");
for (const j of jobs) {
  console.log(`   id=${j.id} status=${j.status}`);
  console.log(`     seed="${j.seed_keyword}" fetched=${j.transcripts_fetched} cached=${j.transcripts_cached} failed=${j.transcripts_failed} quotaBlocked=${j.quota_blocked}`);
  console.log(`     notes: ${j.notes ?? "(null)"}`);
  console.log(`     error: ${j.error_message ?? "(null)"}`);
}

const afterPatterns = await count("content_patterns");
console.log(`\n  content_patterns: ${before.content_patterns} -> ${afterPatterns}  (spec requires > 0)`);
const samples = await q("SELECT id, source_video_id, pattern_type, effectiveness_score, LEFT(pattern_text, 150) AS txt, tags FROM content_patterns ORDER BY id DESC LIMIT 3");
samples.forEach((p, i) => {
  console.log(`   sample ${i + 1}: id=${p.id} type=${p.pattern_type} eff=${p.effectiveness_score} video=${p.source_video_id}`);
  console.log(`     tags: ${typeof p.tags === "string" ? p.tags : JSON.stringify(p.tags)}`);
  console.log(`     text: ${String(p.txt).replace(/\s+/g, " ")}`);
});

// Selecting `status`/`created_at` here exercises the Part 1 fix-6 corrections
// through the real column names; the old declarations would ER_BAD_FIELD_ERROR.
const trs = await q("SELECT video_id, LEFT(video_title,60) AS t, status, word_count, CHAR_LENGTH(raw_text) AS chars, created_at FROM yt_transcripts ORDER BY id DESC LIMIT 5");
console.log(`\n  yt_transcripts: ${before.yt_transcripts} -> ${await count("yt_transcripts")}`);
trs.forEach((t) => console.log(`   ${t.video_id} · status=${t.status} · ${t.word_count ?? 0} words / ${t.chars ?? 0} chars · ${t.created_at} · ${t.t}`));

hr("5. Supercharge on >=3 un-enriched ideas");
const cands = await q("SELECT id, LEFT(topic,60) AS topic, seed_keyword FROM suggested_ideas WHERE vidiq_data IS NULL ORDER BY id DESC LIMIT 3");
console.log(`  un-enriched candidates: ${cands.map((c) => c.id).join(", ") || "(none)"}`);
if (cands.length) {
  const ids = cands.map((c) => c.id);
  const sc = await trpcMutate("scriptFactory.superchargeIdeas", { ideaIds: ids }, 600_000);
  console.log(`  HTTP ${sc.status}`);
  console.log(`  body: ${sc.body.slice(0, 900)}`);
  const rows = await q(`SELECT id, vidiq_data IS NOT NULL AS has_data, LEFT(CAST(vidiq_data AS CHAR), 220) AS d FROM suggested_ideas WHERE id IN (${ids.map(() => "?").join(",")})`, ids);
  console.log("  persisted vidiqData (re-read from DB, i.e. survives reload):");
  rows.forEach((r) => console.log(`   id=${r.id} hasData=${r.has_data} ${String(r.d ?? "").replace(/\s+/g, " ")}`));
}

hr("6. Claims-review insert via the existing creation path");
{
  const listBefore = await count("claims_reviews");
  const [script] = await q("SELECT id, title, LEFT(script_body, 4000) AS body FROM script_factory_outputs ORDER BY id DESC LIMIT 1");
  console.log(`  using script id=${script.id} "${String(script.title).slice(0, 50)}"`);
  // The real creation path is `reviewContent` (there is no `create`). Its zod
  // enum does NOT yet include "youtube_script" — that is exactly what 3E adds.
  // Proving the path works today therefore uses an accepted value, and the
  // rejection of "youtube_script" is captured as the baseline 3E must change.
  const rejected = await trpcMutate("claimsReview.reviewContent", {
    contentType: "youtube_script",
    contentId: String(script.id),
    contentTitle: script.title,
    contentText: String(script.body ?? "").slice(0, 4000),
  }, 600_000);
  console.log(`  [3E baseline] contentType="youtube_script" → HTTP ${rejected.status}`);
  console.log(`    ${rejected.body.slice(0, 260)}`);

  const res = await trpcMutate("claimsReview.reviewContent", {
    contentType: "other",
    contentId: String(script.id),
    contentTitle: script.title,
    contentText: String(script.body ?? "").slice(0, 4000),
  }, 600_000);
  console.log(`  POST claimsReview.reviewContent (contentType="other") → HTTP ${res.status}`);
  console.log(`  body: ${res.body.slice(0, 500)}`);
  const after = await count("claims_reviews");
  console.log(`  claims_reviews: ${listBefore} -> ${after}`);
  const rows = await q("SELECT id, content_type, content_id, status, flag_count, overall_flag FROM claims_reviews ORDER BY id DESC LIMIT 2");
  rows.forEach((r) => console.log(`   id=${r.id} content_type=${r.content_type} content_id=${r.content_id} status=${r.status} flags=${r.flag_count} overallFlag=${r.overall_flag}`));
  if (after > listBefore) {
    const [newest] = await q("SELECT id FROM claims_reviews ORDER BY id DESC LIMIT 1");
    await q("DELETE FROM claims_reviews WHERE id = ?", [newest.id]);
    console.log(`  removed probe row id=${newest.id}; claims_reviews now ${await count("claims_reviews")}`);
  }
}

await db.end();
console.log("\nDONE.");
