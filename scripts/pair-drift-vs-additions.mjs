#!/usr/bin/env node
/**
 * Separate TRUE additive DDL from NAME DRIFT.
 *
 * THE TRAP THIS EXISTS TO AVOID
 * -----------------------------
 * A naive live-vs-declared diff reports the same drifted column TWICE, from
 * opposite directions:
 *
 *   ab_tests:  declared `ab_test_status`  -> "missing from production, ADD it"
 *   ab_tests:  live     `status`          -> "undeclared in schema.ts"
 *
 * They are the same column under two names. Executing the "ADD" side would
 * leave production holding BOTH `status` (with all the real data) and
 * `ab_test_status` (empty), with the app reading and writing the empty one.
 * No error is raised. That is silent data divergence, and it is exactly what
 * the deployment's hard prohibition against reconciling drift is protecting.
 *
 * HOW A PAIR IS RECOGNISED
 * Drift in this repo follows a small number of mechanical shapes, all of which
 * are normalisation-equivalent to the live name:
 *   snake_case vs camelCase        status        <-> scriptStatus
 *   table-prefixed                 ab_test_status <-> status
 *   abbreviation-prefixed          asr_status    <-> status
 *   both at once                   redditAttributionType <-> attributionType
 *
 * So: strip a leading table-derived prefix from both sides, lowercase, remove
 * underscores, and compare. A declared column that collapses onto ANY
 * undeclared live column on the same table is treated as DRIFT (no DDL) and
 * reported for the record, never emitted as SQL.
 *
 * Anything left over is a genuine addition. Those, and only those, become DDL —
 * and each is printed with the live table's row count so the reviewer can see
 * the blast radius before approving.
 */
import { readFileSync, writeFileSync } from "node:fs";

const diff = JSON.parse(readFileSync("/tmp/diff_final.json", "utf8"));

/** Candidate prefixes derived from a table name: full, initials, and singular. */
function prefixesFor(table) {
  const parts = table.split("_");
  const out = new Set();
  out.add(table);
  out.add(parts.map((p) => p[0]).join("")); // ab_tests -> at ; apollo_sync_runs -> asr
  out.add(parts[0]);
  // singularised first word: retreat_events -> retreat ; ab_tests -> ab_test
  out.add(parts.map((p) => p.replace(/s$/, "")).join("_"));
  out.add(parts[0].replace(/s$/, ""));
  // common shorthands seen in this repo
  if (table === "youtube_pipeline_videos") { out.add("yt"); out.add("yt_pipeline"); }
  if (table === "video_jobs") { out.add("vj"); out.add("video_job"); }
  if (table === "collective_sourcing_candidates") out.add("csc");
  if (table === "urban_monk_chat_messages") out.add("umcm");
  if (table === "hosted_landing_pages") out.add("hlp");
  if (table === "lead_prospects") out.add("lp");
  if (table === "llm_assets") out.add("llm_asset");
  if (table === "llm_projects") out.add("llm_project");
  if (table === "seo_content_tracker") out.add("seo");
  if (table === "blog_to_youtube_items") out.add("blogToYoutube");
  if (table === "book_snippets") { out.add("snippet"); out.add("titleCard"); }
  if (table === "backlink_prospects") out.add("backlink_prospect");
  if (table === "syndication_jobs") out.add("syndication");
  if (table === "webinar_sessions") out.add("webinar");
  if (table === "podcast_episodes") out.add("podcastEpisode");
  if (table === "ebook_chapters") out.add("ebookChapter");
  if (table === "uploaded_books") out.add("uploadedBook");
  if (table === "media_assets") out.add("mediaAsset");
  if (table === "reddit_conversions") out.add("reddit");
  if (table === "landing_pages") out.add("landingPage");
  if (table === "content_items") out.add("content");
  if (table === "scripts") out.add("script");
  if (table === "testimonials") out.add("testimonial");
  if (table === "webinar_intelligence") out.add("webinar");
  if (table === "ab_tests") out.add("ab_test");
  if (table === "ab_conversions") out.add("ab_conversion");
  if (table === "apollo_sync_runs") out.add("asr");
  if (table === "retreat_events") out.add("retreat");
  return [...out].filter(Boolean);
}

/** Normalise: drop table prefixes, lowercase, drop separators. */
function normalise(col, table) {
  let c = col;
  for (const p of prefixesFor(table).sort((a, b) => b.length - a.length)) {
    const pl = p.toLowerCase();
    const cl = c.toLowerCase();
    if (cl.startsWith(pl + "_")) { c = c.slice(p.length + 1); break; }
    if (cl.startsWith(pl) && c.length > p.length) {
      const rest = c.slice(p.length);
      if (/^[A-Z_]/.test(rest)) { c = rest.replace(/^_/, ""); break; }
    }
  }
  return c.toLowerCase().replace(/_/g, "");
}

/**
 * Second-pass normalisation, added after the first pass left THREE known drift
 * pairs unpaired. Each was a mechanical gap in the prefix logic, not a new fact:
 *
 *   ab_conversions:  declared ab_conversion_type  vs live conversion_type
 *       The `ab_conversion` prefix stripped to "type" on one side while the live
 *       name kept "conversiontype" — one side over-stripped.
 *   llm_assets:      declared asset_type          vs live llm_asset_type
 *       Mirror image: the live name carried the prefix, the declared one did not.
 *   book_snippets:   declared title_card_status    vs live titleCardStatus
 *       Pure case/separator difference with no prefix involved at all.
 *
 * Rather than pile more prefix guesses on, compare the two names with ALL
 * separators and case removed AND with every table-derived prefix removed from
 * both, then test whether either result contains the other. Containment (not
 * equality) is what catches the over/under-stripping pairs above.
 */
function looselyEquivalent(declared, live, table) {
  const bare = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
  const stripAll = (s) => {
    let out = bare(s);
    for (const p of prefixesFor(table).sort((a, b) => b.length - a.length)) {
      const pb = bare(p);
      if (pb && out.startsWith(pb) && out.length > pb.length) out = out.slice(pb.length);
    }
    return out;
  };
  const a = stripAll(declared);
  const b = stripAll(live);
  if (a === b) return true;
  // Containment handles asymmetric prefixing (asset_type vs llm_asset_type).
  if (a.length >= 4 && b.length >= 4 && (a.includes(b) || b.includes(a))) return true;
  return false;
}

/**
 * Columns this script REFUSES to classify, because the two candidate readings
 * imply opposite correct actions and only the owner can decide.
 *
 *   scripts.production_status (declared) vs scripts.scriptStatus (live)
 *     Reading A: a rename of the same lifecycle field -> DRIFT, add nothing.
 *     Reading B: a genuinely new v2.2 field tracking send-to-production state,
 *                with scriptStatus remaining the draft/approved lifecycle
 *                -> TRUE ADDITION, must be added or writes silently vanish.
 *   Guessing A when B is true loses data. Guessing B when A is true creates the
 *   divergence the prohibition forbids. So: escalate, never assume.
 */
const ESCALATE = new Set(["scripts.production_status"]);

const trueAdditions = {};
const driftPairs = {};
const needsOwnerDecision = [];

for (const [table, missing] of Object.entries(diff.add_columns)) {
  const undeclaredLive = diff.undeclared_live[table] ?? [];
  for (const col of missing) {
    if (ESCALATE.has(`${table}.${col}`)) {
      needsOwnerDecision.push({ table, declared: col, liveCandidates: undeclaredLive });
      continue;
    }
    const nCol = normalise(col, table);
    let match = undeclaredLive.find((live) => normalise(live, table) === nCol);
    if (!match) match = undeclaredLive.find((live) => looselyEquivalent(col, live, table));
    if (match) {
      (driftPairs[table] ??= []).push({ declared: col, live: match, normalised: nCol });
    } else {
      (trueAdditions[table] ??= []).push(col);
    }
  }
}

console.log("=== DRIFT PAIRS — SAME COLUMN, TWO NAMES. NO DDL. ===");
let driftCount = 0;
for (const [t, pairs] of Object.entries(driftPairs)) {
  for (const p of pairs) {
    driftCount++;
    console.log(`  ${t}: declared "${p.declared}"  ==  live "${p.live}"   [${p.normalised}]`);
  }
}
console.log(`  total drift pairs: ${driftCount}  (these would have been ${driftCount} data-divergence bugs)`);

console.log("\n=== TRUE ADDITIONS — GENUINELY ABSENT, DDL REQUIRED ===");
let addCount = 0;
for (const [t, cols] of Object.entries(trueAdditions)) {
  addCount += cols.length;
  console.log(`  ${t}: +${cols.length}`);
  for (const c of cols) console.log(`      ${c}`);
}
console.log(`  total columns needing DDL: ${addCount}`);

console.log("\n=== REFUSED TO CLASSIFY — OWNER DECISION REQUIRED ===");
if (needsOwnerDecision.length === 0) {
  console.log("  none");
} else {
  for (const e of needsOwnerDecision) {
    console.log(`  ${e.table}.${e.declared}`);
    console.log(`      live undeclared columns on this table: ${e.liveCandidates.join(", ") || "(none)"}`);
    console.log(`      -> if a RENAME: add nothing. if a NEW field: must be added.`);
  }
}

console.log("\n=== UNPAIRED UNDECLARED LIVE COLUMNS (legacy, left alone) ===");
let legacy = 0;
for (const [t, cols] of Object.entries(diff.undeclared_live)) {
  const paired = new Set((driftPairs[t] ?? []).map((p) => p.live));
  const orphans = cols.filter((c) => !paired.has(c));
  if (orphans.length) { legacy += orphans.length; console.log(`  ${t}: ${orphans.join(", ")}`); }
}
console.log(`  total legacy columns (no action): ${legacy}`);

writeFileSync(
  "/tmp/ddl_plan.json",
  JSON.stringify({ trueAdditions, driftPairs, needsOwnerDecision, createTables: diff.create_tables }, null, 2),
);
console.log("\nwrote /tmp/ddl_plan.json");
