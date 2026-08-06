/*
 * v2.4 live smoke.
 *
 * Generates the SAME topic twice — once value_first, once balanced — so the
 * difference in sell density is attributable to ctaStyle and nothing else.
 * Input shape copied from scripts/seed-demo.mjs BASE (the flat object the
 * extracted pipeline actually takes; there is no ctx/input envelope).
 */
import mysql from "mysql2/promise";
const conn = await mysql.createConnection(process.env.DATABASE_URL!);

const [[persona]]: any = await conn.query(
  "SELECT id, name FROM personas WHERE slug = 'exhausted-optimizer' LIMIT 1"
);
const [[analog]]: any = await conn.query(
  "SELECT id FROM analog_data_entries WHERE offer_profile IS NOT NULL ORDER BY id DESC LIMIT 1"
);
const [[tier]]: any = await conn.query(
  "SELECT offer_profile FROM analog_data_entries WHERE id = ?", [analog.id]
);
const prof = typeof tier.offer_profile === "string" ? JSON.parse(tier.offer_profile) : tier.offer_profile;
const offerTier = prof?.tiers?.[0]?.offerName ?? undefined;
console.log("[smoke] persona:", persona?.name, "| analog:", analog?.id, "| tier:", offerTier);

const { runScriptGeneration } = await import("./server/scriptFactoryRouter.ts");

const BASE: any = {
  format: "youtube_script",
  personaId: persona.id,
  analogDataEntryIds: [analog.id],
  targetLengthMinutes: 12,
  patternTypes: ["hook", "pain_point", "proof_element", "cta", "transformation_arc"],
  minPatternEffectiveness: 0.5,
  topPatternsPerType: 3,
  useCorpusSearch: true,
  useDeepResearch: false,
  skipResearch: false,
  storyMode: "brief",
  ...(offerTier ? { offerTier } : {}),
};

const TOPIC =
  "Why your normal thyroid panel misses the food inflammation driving your fatigue";

for (const style of ["value_first", "balanced"] as const) {
  console.log(`\n[smoke] ===== generating ${style} =====`);
  const t0 = Date.now();
  const r: any = await runScriptGeneration({ ...BASE, topic: TOPIC, ctaStyle: style });
  const id = r.scriptId ?? r.id;
  console.log(`[smoke] ${style}: id=${id} ${r.wordCount} words in ${((Date.now()-t0)/1000).toFixed(0)}s`);
  console.log(`[smoke] ctaStyleWarning: ${JSON.stringify(r.ctaStyleWarning ?? null)}`);
  console.log(`[smoke] sellDensity: ${JSON.stringify(r.sellDensity, null, 2)}`);
}
await conn.end();
process.exit(0);
