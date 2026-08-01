/**
 * PART 3C LIVE PROOF — research-first generation against the sandbox app.
 *
 * Proves, on the real pipeline with real vidIQ/Supadata/LLM calls:
 *   1. A long-form generate with NO research flags runs research automatically
 *      and comes back grounded (the v2.1 default is inverted).
 *   2. A SECOND generate on the same seed REUSES that job — no new spend.
 *   3. `skipResearch: true` produces a script with no research at all.
 *   4. An unresearchable seed FAILS OPEN: script still returned, reason stated.
 *   5. The relevance gate deprioritises off-topic discovery results.
 *   6. Hook references and structure summary are persisted and reported.
 *
 * Costs real vidIQ credits and Supadata units. Prints balances before/after.
 * Probe rows are marked with a title prefix and removed by marker, never by id
 * range — an earlier version's `id >= 30000` filter swept up unrelated rows.
 */
import mysql from "mysql2/promise";
import fs from "node:fs";

const BASE = "http://localhost:3000";
const MARKER = "[P3C-PROBE]";

// ── env (never echoed) ───────────────────────────────────────────────────────
const envText = fs.readFileSync(new URL("../../../.env", import.meta.url), "utf8");
const env = {};
for (const line of envText.split("\n")) {
  const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)$/.exec(line);
  if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
}
const dbUrl = new URL(env.DATABASE_URL_SANDBOX ?? env.DATABASE_URL);
// Force the SCRATCH database regardless of what .env points at.
const conn = await mysql.createConnection({
  host: dbUrl.hostname,
  port: Number(dbUrl.port || 3306),
  user: decodeURIComponent(dbUrl.username),
  password: decodeURIComponent(dbUrl.password),
  database: "contenthub_v22_sandbox",
});

async function login() {
  const r = await fetch(`${BASE}/api/dev/login`, { redirect: "manual" });
  const cookie = (r.headers.getSetCookie?.() ?? []).map((c) => c.split(";")[0]).join("; ");
  if (!cookie) throw new Error("dev login returned no cookie");
  return cookie;
}

/**
 * tRPC v11 batch envelope: `{0:{json:input}}`, response `[0].result.data.json`.
 * The bare-body form returns 400 "expected object, received undefined" — that
 * was a probe-harness bug, not an app bug, and it is worth keeping this note so
 * the next probe does not rediscover it.
 */
async function trpc(cookie, path, json, kind = "mutation") {
  const url = `${BASE}/api/trpc/${path}?batch=1`;
  const res = kind === "mutation"
    ? await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json", cookie },
        body: JSON.stringify({ 0: { json } }),
      })
    : await fetch(`${url}&input=${encodeURIComponent(JSON.stringify({ 0: { json } }))}`, {
        headers: { cookie },
      });
  const text = await res.text();
  let parsed = null;
  try { parsed = JSON.parse(text); } catch {}
  return {
    status: res.status,
    data: parsed?.[0]?.result?.data?.json,
    error: parsed?.[0]?.error?.json?.message ?? null,
    raw: text.slice(0, 400),
  };
}

const line = (s = "") => console.log(s);
const hr = (t) => { line(); line("=".repeat(78)); line(t); line("=".repeat(78)); };

const cookie = await login();
line(`dev login OK (cookie acquired)`);

// ── Baseline counts ─────────────────────────────────────────────────────────
async function counts() {
  const [[j]] = await conn.query("SELECT COUNT(*) c FROM research_jobs");
  const [[p]] = await conn.query("SELECT COUNT(*) c FROM content_patterns");
  const [[h]] = await conn.query("SELECT COUNT(*) c FROM content_patterns WHERE pattern_context LIKE 'HOOK REFERENCE%'");
  const [[t]] = await conn.query("SELECT COUNT(*) c FROM yt_transcripts");
  return { jobs: j.c, patterns: p.c, hooks: h.c, transcripts: t.c };
}
const before = await counts();
hr("0. BASELINE (scratch DB)");
line(JSON.stringify(before));

const bal0 = await trpc(cookie, "scriptFactory.vidiqBalance", {}, "query");
const credits0 = bal0.data?.totalCredits ?? null;
line(`vidIQ totalCredits before: ${credits0}`);

const SEED = "morning cortisol spike gut";
const TOPIC = `${MARKER} Why your 5am cortisol spike is really a gut lining problem and what to do about it`;

// ── 1. Research-first by DEFAULT ────────────────────────────────────────────
hr("1. GENERATE WITH NO RESEARCH FLAGS — must research automatically");
line(`topic: ${TOPIC}`);
line(`seedKeyword: ${SEED}`);
line("flags sent: NONE (no useDeepResearch, no researchJobId, no skipResearch)");
const t1 = Date.now();
const g1 = await trpc(cookie, "scriptFactory.generate", {
  topic: TOPIC,
  format: "youtube_script",
  seedKeyword: SEED,
  targetLengthMinutes: 10,
});
const d1 = g1.data;
line(`HTTP ${g1.status} · elapsed ${((Date.now() - t1) / 1000).toFixed(1)}s`);
if (!d1) { line("FAILED: " + (g1.error ?? g1.raw)); }
else {
  line(`scriptId: ${d1.id}`);
  line(`researchAttempted: ${d1.researchAttempted}`);
  line(`researchGrounded:  ${d1.researchGrounded}`);
  line(`researchReused:    ${d1.researchReused}`);
  line(`researchJobId:     ${d1.researchJobId}`);
  line(`researchFailureReason: ${JSON.stringify(d1.researchFailureReason)}`);
  line(`hookReferencesUsed:    ${d1.hookReferencesUsed}`);
  line(`structureSummaryUsed:  ${d1.structureSummaryUsed}`);
  line(`researchOutliersUsed:  ${d1.researchOutliersUsed}`);
  line(`researchTranscriptsUsed: ${d1.researchTranscriptsUsed}`);
  line(`wordCount: ${d1.wordCount} / target ${d1.targetWordCount}`);
  line();
  line("--- first 400 chars of script ---");
  line(String(d1.scriptBody).slice(0, 400));
}

// ── 2. REUSE on a second run ────────────────────────────────────────────────
hr("2. SECOND GENERATE, SAME SEED — must REUSE, not re-research");
const bal1 = await trpc(cookie, "scriptFactory.vidiqBalance", {}, "query");
const credits1 = bal1.data?.totalCredits ?? null;
const t2 = Date.now();
const g2 = await trpc(cookie, "scriptFactory.generate", {
  topic: TOPIC + " (second pass)",
  format: "youtube_script",
  seedKeyword: SEED,
  targetLengthMinutes: 10,
});
const d2 = g2.data;
const bal2 = await trpc(cookie, "scriptFactory.vidiqBalance", {}, "query");
const credits2 = bal2.data?.totalCredits ?? null;
line(`HTTP ${g2.status} · elapsed ${((Date.now() - t2) / 1000).toFixed(1)}s`);
if (d2) {
  line(`researchReused: ${d2.researchReused}   <-- must be true`);
  line(`researchJobId:  ${d2.researchJobId} (run 1 was ${d1?.researchJobId})`);
  line(`same job reused: ${d2.researchJobId === d1?.researchJobId}`);
}
line(`vidIQ credits before run2: ${credits1} · after run2: ${credits2} · delta: ${credits1 !== null && credits2 !== null ? credits1 - credits2 : "n/a"}`);
line("(delta 0 proves reuse cost nothing)");

// ── 3. skipResearch ────────────────────────────────────────────────────────
hr("3. skipResearch: true — Quick generate, no research at all");
const g3 = await trpc(cookie, "scriptFactory.generate", {
  topic: `${MARKER} Three signs your gut lining is driving afternoon fatigue`,
  format: "youtube_script",
  skipResearch: true,
  targetLengthMinutes: 10,
});
const d3 = g3.data;
if (d3) {
  line(`researchAttempted: ${d3.researchAttempted}  <-- must be false`);
  line(`researchGrounded:  ${d3.researchGrounded}`);
  line(`researchJobId:     ${d3.researchJobId}`);
  line(`researchFailureReason: ${JSON.stringify(d3.researchFailureReason)} <-- must be null (not a failure, a choice)`);
  line(`hookReferencesUsed: ${d3.hookReferencesUsed}`);
}

// ── 4. FAIL-OPEN on an unresearchable seed ─────────────────────────────────
hr("4. FAIL-OPEN — nonsense seed must still return a script");
const g4 = await trpc(cookie, "scriptFactory.generate", {
  topic: `${MARKER} An honest look at whether the qwzxjkv protocol helps gut healing`,
  format: "youtube_script",
  seedKeyword: "qwzxjkvbnm zzzqqq nonexistent keyword 9182",
  targetLengthMinutes: 10,
});
const d4 = g4.data;
line(`HTTP ${g4.status}`);
if (!d4) {
  line("*** FAIL-OPEN VIOLATED: no script returned ***");
  line(g4.error ?? g4.raw);
} else {
  line(`script returned: YES (id ${d4.id}, ${d4.wordCount} words)  <-- fail-open holds`);
  line(`researchAttempted: ${d4.researchAttempted}`);
  line(`researchGrounded:  ${d4.researchGrounded}`);
  line(`researchFailureReason: ${JSON.stringify(d4.researchFailureReason)}`);
}

// ── 5. Relevance gate + persisted grounding ────────────────────────────────
hr("5. RELEVANCE GATE + PERSISTED GROUNDING (from research_jobs.notes)");
const [jobRows] = await conn.query(
  "SELECT id, seed_keyword, research_status, notes, structure_summary IS NOT NULL AS has_summary FROM research_jobs ORDER BY id DESC LIMIT 4"
);
for (const r of jobRows) {
  line(`job #${r.id} seed=${JSON.stringify(r.seed_keyword)} status=${r.research_status} has_structure_summary=${r.has_summary}`);
  line(`  notes: ${r.notes}`);
}

const [hookRows] = await conn.query(
  "SELECT id, source_video_id, effectiveness_score, LEFT(pattern_context, 150) ctx, LEFT(pattern_text, 180) txt FROM content_patterns WHERE pattern_context LIKE 'HOOK REFERENCE%' ORDER BY id DESC LIMIT 5"
);
line();
line(`hook reference rows: ${hookRows.length}`);
for (const h of hookRows) {
  line(`  #${h.id} eff=${h.effectiveness_score} ${h.ctx}`);
  line(`     opening: ${h.txt.replace(/\s+/g, " ")}`);
}

const [effRows] = await conn.query(
  "SELECT effectiveness_score, COUNT(*) c FROM content_patterns WHERE pattern_context LIKE 'HOOK REFERENCE%' GROUP BY effectiveness_score ORDER BY effectiveness_score DESC"
);
line();
line("hook-reference effectiveness distribution (must NOT be all 0.9):");
for (const e of effRows) line(`  ${e.effectiveness_score} × ${e.c}`);

const after = await counts();
hr("6. DELTAS");
line(`research_jobs:   ${before.jobs} -> ${after.jobs}`);
line(`content_patterns:${before.patterns} -> ${after.patterns}`);
line(`hook references: ${before.hooks} -> ${after.hooks}`);
line(`yt_transcripts:  ${before.transcripts} -> ${after.transcripts}`);
const bal3 = await trpc(cookie, "scriptFactory.vidiqBalance", {}, "query");
line(`vidIQ totalCredits: ${credits0} -> ${bal3.data?.totalCredits ?? "n/a"}`);

// ── Cleanup by MARKER, never by id range ───────────────────────────────────
hr("7. CLEANUP (marker-based)");
const [del] = await conn.query("DELETE FROM script_factory_outputs WHERE topic LIKE ?", [`${MARKER}%`]);
line(`deleted ${del.affectedRows} probe script rows matching ${MARKER}`);
line("research_jobs / content_patterns / yt_transcripts INTENTIONALLY KEPT:");
line("  they are real grounding the next probes and 3D composition will read.");

await conn.end();
line();
line("PROBE COMPLETE");
