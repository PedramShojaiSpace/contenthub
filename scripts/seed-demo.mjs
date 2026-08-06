/**
 * Reproducible demo state for the Script Factory workspace.
 *
 * WHY THIS EXISTS
 * Demo scripts used to be created by clicking through the UI. When the sandbox was
 * reset on 2026-08-04 those rows were gone, and with them the only scripts that had
 * an enabled Regenerate group — because that group is enabled only for rows carrying
 * frozen `generation_params`, which pre-v2.3 rows do not have. Rebuilding demo state
 * by hand is slow and produces something slightly different each time. This file
 * makes it a command.
 *
 * WHAT IT PRODUCES
 *   - 2 original long-form scripts (different topics, both 10-min, persona-bound)
 *   - 1 persona variant of the first script, created through regenerateVariant
 *     so the lineage columns are written by the real code path, not by hand
 *
 * WHY IT CALLS runScriptGeneration DIRECTLY rather than the tRPC endpoint: the
 * mutation is a thin wrapper over that function (v2.3 Part 3 extraction), so calling
 * it exercises the same pipeline without needing a running server or a session
 * cookie. Lineage is likewise written via regenerateVariant's own planner, so if the
 * planner regresses this seed fails rather than papering over it with hand-built rows.
 *
 * IDEMPOTENCE: re-running is safe but ADDITIVE — it generates new scripts rather than
 * reusing existing ones. Generation is nondeterministic, so "the same" script cannot
 * be recreated; pass FORCE=1 to acknowledge that and generate anyway when demo
 * scripts already exist.
 *
 * COST: each script is a real LLM generation, roughly 2-3 minutes and real tokens.
 * Three generations, so budget ~8 minutes.
 *
 * Run with:  npx tsx scripts/seed-demo.mjs
 * (tsx, not node — it imports TypeScript server modules and their @shared aliases.)
 */
import mysql from "mysql2/promise";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("[demo] DATABASE_URL is not set");
  process.exit(1);
}

if (!process.env.OPENAI_API_KEY) {
  console.error("[demo] OPENAI_API_KEY is not set — generation would fail");
  process.exit(1);
}

if (!process.env.VIDIQ_API_KEY) {
  console.warn(
    "[demo] VIDIQ_API_KEY absent: research-first generation runs in DEGRADED MODE\n" +
    "[demo] (vidiqOutliers is the primary outlier source; Supadata trending is the fallback).\n" +
    "[demo] Scripts produced by this run must NOT be presented as fully grounded."
  );
}

const { runScriptGeneration, planRegeneration } = await import(
  "../server/scriptFactoryRouter.ts"
);

const conn = await mysql.createConnection(url);

// ─── Preconditions ──────────────────────────────────────────────────────────
// The demo depends on seed-sandbox.mjs having run: a persona to bind and an
// offer profile to close on. Generating without them produces an unbound script
// whose Regenerate group works but whose content demos nothing.
const [[persona]] = await conn.query(
  "SELECT id, name FROM personas WHERE slug = 'exhausted-optimizer' LIMIT 1"
);
if (!persona) {
  console.error("[demo] persona 'exhausted-optimizer' not found — run scripts/seed-sandbox.mjs first");
  await conn.end();
  process.exit(1);
}

const [[analog]] = await conn.query(
  "SELECT id, title FROM analog_data_entries WHERE type = 'sales_page' ORDER BY id LIMIT 1"
);
if (!analog) {
  console.error("[demo] no sales_page analog entry — run scripts/seed-sandbox.mjs first");
  await conn.end();
  process.exit(1);
}

console.log(`[demo] persona: ${persona.name} (id=${persona.id})`);
console.log(`[demo] analog:  ${analog.title} (id=${analog.id})`);

const [[existing]] = await conn.query(
  "SELECT COUNT(*) AS n FROM script_factory_outputs WHERE generation_params IS NOT NULL"
);
if (existing.n > 0 && process.env.FORCE !== "1") {
  console.log(
    `[demo] ${existing.n} script(s) with frozen params already exist.\n` +
    "[demo] Generation is nondeterministic, so this would ADD scripts rather than\n" +
    "[demo] reproduce the existing ones. Pass FORCE=1 to generate anyway."
  );
  await conn.end();
  process.exit(0);
}

// ─── Demo topics ────────────────────────────────────────────────────────────
// Both are drawn from the seeded sales page's own subject matter so the offer
// binding is coherent and the grounded claims have something real to bind to.
// The offerTier is pinned to the exact stored offerName: omitting it with a
// laddered offer leaves the script deliberately UNBOUND (generation returns the
// choices instead of picking a price point), which is correct behaviour but makes
// a poor demo.
const [[offerRow]] = await conn.query(
  "SELECT offer_profile FROM analog_data_entries WHERE id = ? LIMIT 1",
  [analog.id]
);
let offerTier;
try {
  const profile = JSON.parse(offerRow.offer_profile);
  offerTier = profile?.tiers?.[0]?.offerName;
} catch {
  offerTier = undefined;
}
console.log(`[demo] offer tier: ${offerTier ?? "(none found — script will be unbound)"}`);

const BASE = {
  format: "youtube_script",
  personaId: persona.id,
  analogDataEntryIds: [analog.id],
  targetLengthMinutes: 10,
  patternTypes: ["hook", "pain_point", "proof_element", "cta", "transformation_arc"],
  minPatternEffectiveness: 0.5,
  topPatternsPerType: 3,
  useCorpusSearch: true,
  useDeepResearch: false,
  skipResearch: false,
  storyMode: "brief",
  ...(offerTier ? { offerTier } : {}),
};

const TOPICS = [
  "Why your blood work comes back normal while you still feel exhausted, bloated and inflamed every single day",
  "The three gut barrier problems that standard food allergy panels are structurally unable to detect",
];

const created = [];

for (const [i, topic] of TOPICS.entries()) {
  console.log(`\n[demo] === generating script ${i + 1}/${TOPICS.length} ===`);
  console.log(`[demo] topic: ${topic.slice(0, 70)}...`);
  const started = Date.now();
  const result = await runScriptGeneration({ ...BASE, topic });
  const secs = ((Date.now() - started) / 1000).toFixed(0);
  created.push(result.scriptId ?? result.id);
  console.log(
    `[demo] script id=${result.scriptId ?? result.id} in ${secs}s, ` +
    `${result.wordCount ?? "?"} words`
  );
}

// ─── The variant ────────────────────────────────────────────────────────────
// Created through planRegeneration + runScriptGeneration with lineage, i.e. the
// exact path regenerateVariant takes. A second persona is needed for a persona
// variant to be a real change rather than a no-op diff.
const [[altPersona]] = await conn.query(
  "SELECT id, name FROM personas WHERE id <> ? ORDER BY id LIMIT 1",
  [persona.id]
);

const sourceId = created[0];
let overrides;
let labelNote;
if (altPersona) {
  overrides = { personaId: altPersona.id };
  labelNote = `persona -> ${altPersona.name}`;
} else {
  // Only one persona seeded, so fall back to a length variant. Stated rather than
  // silently producing a variant whose diff is empty.
  console.log("[demo] only one persona exists; using a LENGTH variant instead of persona");
  overrides = { targetLengthMinutes: 20 };
  labelNote = "length -> 20 min";
}

console.log(`\n[demo] === generating variant of script ${sourceId} (${labelNote}) ===`);
const plan = await planRegeneration(sourceId, overrides);
console.log(`[demo] planned changes: ${JSON.stringify(plan.changed)}`);
const started = Date.now();
const variant = await runScriptGeneration(plan.input, {
  parentScriptId: plan.source.id,
  variantOfRootId: plan.source.variantOfRootId ?? plan.source.id,
  variantLabel: plan.autoLabel,
});
const vsecs = ((Date.now() - started) / 1000).toFixed(0);
const variantId = variant.scriptId ?? variant.id;
console.log(`[demo] variant id=${variantId} in ${vsecs}s, label="${plan.autoLabel}"`);

// ─── Verify what actually landed ────────────────────────────────────────────
// Reading the columns back rather than trusting the return values: the point of
// this seed is that the demo works, and the demo works only if lineage and frozen
// params are really in the table.
const [rows] = await conn.query(
  `SELECT id, LEFT(title, 48) AS title, parent_script_id, variant_of_root_id,
          variant_label, generation_params IS NOT NULL AS has_params, word_count
     FROM script_factory_outputs
    WHERE id IN (?)
    ORDER BY id`,
  [[...created, variantId]]
);

console.log("\n[demo] final state:");
for (const r of rows) {
  const kind = r.parent_script_id === null ? "original" : `variant of ${r.parent_script_id}`;
  console.log(
    `[demo]   id=${r.id} ${kind} root=${r.variant_of_root_id ?? "-"} ` +
    `label=${r.variant_label ?? "-"} params=${r.has_params ? "yes" : "NO"} ` +
    `words=${r.word_count} :: ${r.title}`
  );
}

const missingParams = rows.filter((r) => !r.has_params);
if (missingParams.length > 0) {
  console.error(
    `[demo] FAIL: ${missingParams.length} script(s) have no frozen generation_params, ` +
    "so their Regenerate group will be disabled."
  );
  process.exitCode = 1;
} else {
  console.log(`\n[demo] all ${rows.length} scripts carry frozen params — Regenerate enabled on all`);
  console.log(`[demo] demo-ready ids: ${rows.map((r) => r.id).join(", ")}`);
}

await conn.end();
