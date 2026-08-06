/**
 * Discovery-source comparison — the evidence behind the 3C deviation request.
 *
 * The spec makes `vidiq_outliers` the PRIMARY research source and
 * `vidiq_trending_videos` a fallback used only when outliers returns empty.
 * The Part 2b pipeline run produced a `complete` job whose mined transcripts
 * were a Sprunki gaming video and a Corpus Christi water-supply news clip for
 * the seed "leaky gut fatigue" — i.e. outliers ignores the keyword.
 *
 * This probe prints both sources for several real health seeds side by side so
 * the operator can judge topical relevance from raw titles rather than my
 * summary of them. It also prints the raw outlierScore distribution, because
 * the pipeline's `effectiveness = min(0.9, max(0.5, score/10))` saturated at
 * 0.9 for all 15 patterns, which would make the effectiveness signal constant.
 *
 * Reproduce: pnpm tsx docs/build-reports/v22r/probe_discovery_sources.ts
 */
import fs from "node:fs";
import path from "node:path";

const envPath = path.resolve(import.meta.dirname, "../../../.env");
for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*"?([^"\r\n]*)"?\s*$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}

// Dynamic import AFTER env population: vidiq.ts reads the key at module load.
const { vidiqOutliers, vidiqTrendingVideos } = await import("../../../server/vidiq");

const SEEDS = ["leaky gut fatigue", "vagus nerve anxiety", "gut health sleep"];

/** Crude topical check: does the title contain any health-domain token? */
const HEALTH_TOKENS = [
  "gut", "leaky", "microbiome", "digest", "bloat", "inflam", "vagus", "nerve",
  "anxiety", "stress", "cortisol", "sleep", "insomnia", "fatigue", "tired",
  "energy", "health", "heal", "hormone", "thyroid", "immune", "probiotic",
  "lps", "toxin", "detox", "diet", "food", "nutrition", "supplement", "body",
  "brain", "mental", "doctor", "symptom", "disease", "pain", "blood", "sugar",
];
const topical = (t: string) => HEALTH_TOKENS.some((k) => t.toLowerCase().includes(k));

const hr = (t: string) => console.log("\n" + "=".repeat(78) + "\n" + t + "\n" + "=".repeat(78));

console.log(`Discovery-source comparison — ${new Date().toISOString()}`);
console.log(`VIDIQ_API_KEY resolved: ${process.env.VIDIQ_API_KEY ? "yes" : "NO"}`);

const tally: Record<string, { topical: number; total: number; scores: number[] }> = {
  outliers: { topical: 0, total: 0, scores: [] },
  trending: { topical: 0, total: 0, scores: [] },
};

for (const seed of SEEDS) {
  hr(`SEED: "${seed}"`);
  for (const [label, key, fn] of [
    ["vidiq_outliers   (spec: PRIMARY) ", "outliers", vidiqOutliers],
    ["vidiq_trending   (spec: FALLBACK)", "trending", vidiqTrendingVideos],
  ] as const) {
    console.log(`\n  ${label}`);
    try {
      const vids: any[] = await fn(seed, 5);
      if (!vids.length) console.log("    (empty)");
      vids.slice(0, 5).forEach((v, i) => {
        const t = String(v.title ?? "");
        const isTopical = topical(t);
        tally[key].total++;
        if (isTopical) tally[key].topical++;
        if (typeof v.outlierScore === "number" && v.outlierScore > 0) tally[key].scores.push(v.outlierScore);
        console.log(`    ${i + 1}. [${isTopical ? "ON-TOPIC " : "OFF-TOPIC"}] ${t.slice(0, 62)}`);
        console.log(`       ${String(v.channelTitle ?? "").slice(0, 34)} · views=${v.viewCount} · outlierScore=${v.outlierScore ?? "n/a"}`);
      });
    } catch (err: any) {
      console.log(`    THREW ${err?.name}: ${String(err?.message).slice(0, 180)}`);
    }
  }
}

hr("TALLY — topical hit rate by source");
for (const [k, v] of Object.entries(tally)) {
  const pct = v.total ? ((v.topical / v.total) * 100).toFixed(0) : "0";
  console.log(`  ${k.padEnd(10)} ${v.topical}/${v.total} on-topic (${pct}%)`);
}

hr("outlierScore distribution vs the pipeline's effectiveness mapping");
console.log("  pipeline: effectiveness = min(0.9, max(0.5, outlierScore / 10))");
for (const [k, v] of Object.entries(tally)) {
  if (!v.scores.length) {
    console.log(`  ${k}: no positive scores returned`);
    continue;
  }
  const mapped = v.scores.map((s) => Math.min(0.9, Math.max(0.5, s / 10)));
  const distinct = [...new Set(mapped.map((m) => m.toFixed(3)))];
  console.log(`  ${k}: raw scores    = ${v.scores.map((s) => s.toFixed(1)).join(", ")}`);
  console.log(`  ${k.padEnd(10)} mapped eff   = ${mapped.map((m) => m.toFixed(2)).join(", ")}`);
  console.log(`  ${k.padEnd(10)} distinct eff = ${distinct.length} value(s) -> ${distinct.length === 1 ? "SATURATED, carries no signal" : "has variance"}`);
}
