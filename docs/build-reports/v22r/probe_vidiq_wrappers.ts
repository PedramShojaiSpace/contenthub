/**
 * Part 1 live proof, wrapper level — calls the ACTUAL fixed application code
 * (server/vidiq.ts) against the real vidIQ endpoint, with no mocking.
 *
 * probe_vidiq_live.mjs proves what the API sends. This proves what our code
 * hands to the rest of the app, which is the claim that actually matters and the
 * one the earlier probe could not make. Fix 9 was found precisely because those
 * two things had silently diverged.
 *
 * Reproduce: pnpm tsx docs/build-reports/v22r/probe_vidiq_wrappers.ts
 */
// The env file must be loaded BEFORE server/vidiq.ts is imported, because
// server/_core/env.ts snapshots process.env at module-eval time.
import fs from "node:fs";
import path from "node:path";

const envPath = path.resolve(import.meta.dirname, "../../../.env");
const envText = fs.readFileSync(envPath, "utf8");
let loaded = 0;
for (const line of envText.split(/\r?\n/)) {
  const m = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
  if (!m) continue;
  const [, k, rawV] = m;
  if (process.env[k] !== undefined && process.env[k] !== "") continue;
  process.env[k] = rawV.trim().replace(/^["']|["']$/g, "");
  loaded++;
}
console.log(`[env] parsed ${envText.split(/\r?\n/).length} lines, set ${loaded} vars`);
console.log(
  `[env] VIDIQ_API_KEY resolved: ${
    process.env.VIDIQ_API_KEY ? `yes (...${process.env.VIDIQ_API_KEY.slice(-6)})` : "NO"
  }`
);
console.log(
  `[env] keys matching /VIDIQ/i in file: ${JSON.stringify(
    envText.split(/\r?\n/).map((l) => l.split("=")[0].trim()).filter((k) => /vidiq/i.test(k))
  )}`
);

// MUST be a dynamic import: ESM hoists every static `import` above the
// env-loading code above, so server/_core/env.ts would snapshot process.env
// before VIDIQ_API_KEY was set and every call would fail "not configured".
const {
  isVidIQToolError,
  spendableCredits,
  vidiqBalance,
  vidiqOutliers,
  vidiqTrendingVideos,
  vidiqKeywordResearch,
} = await import("../../../server/vidiq");

function hr(t: string) {
  console.log("\n" + "=".repeat(78) + "\n" + t + "\n" + "=".repeat(78));
}

console.log(`Part 1 wrapper-level proof — ${new Date().toISOString()}`);
console.log("calling the real exported functions from server/vidiq.ts, unmocked");

hr("A. vidiqBalance() — fix 5, through the real wrapper");
const balance = await vidiqBalance();
console.log(JSON.stringify(balance, null, 2));
console.log(`spendableCredits(balance) = ${spendableCredits(balance)}`);
console.log(
  `(balance as any).credits = ${JSON.stringify((balance as unknown as { credits?: number }).credits)} <- v2.1 read this`
);

hr("B. vidiqOutliers() — fixes 1, 2, 3 and 9, through the real wrapper");
const outliers = await vidiqOutliers("leaky gut fatigue", 5);
console.log(`returned ${outliers.length} row(s)\n`);
outliers.forEach((v, i) => {
  console.log(`${i + 1}. "${v.title}"`);
  console.log(`     channel: ${v.channelTitle} (${v.channelId})`);
  console.log(`     subs: ${v.subscriberCount} · views: ${v.viewCount} · vph: ${v.vph}`);
  console.log(`     outlierScore: ${v.outlierScore} · engagement: ${v.engagementRate}`);
  console.log(`     publishedAt: ${v.publishedAt} · duration: ${v.durationSec}s`);
});
console.log("\nASSERTIONS:");
const titlesOk = outliers.every((v) => typeof v.title === "string" && v.title !== "Untitled");
const scoresOk = outliers.some((v) => v.outlierScore > 0);
const datesOk = outliers.every((v) => v.publishedAt === null || !Number.isNaN(Date.parse(v.publishedAt)));
console.log(`  every title is real (not "Untitled"/undefined): ${titlesOk}`);
console.log(`  at least one outlierScore > 0 (ranking is meaningful): ${scoresOk}`);
console.log(`  every publishedAt parses or is null: ${datesOk}`);
console.log(`  ranked descending by outlierScore: ${JSON.stringify(outliers.map((v) => v.outlierScore))}`);

hr("C. vidiqTrendingVideos() — fixes 4 and 9, through the real wrapper");
const trending = await vidiqTrendingVideos("leaky gut fatigue", 5);
console.log(`returned ${trending.length} row(s)\n`);
trending.forEach((v, i) => {
  console.log(`${i + 1}. "${v.title}" — ${v.viewCount} views · vph ${v.vph?.toFixed(1)} · ${v.publishedAt}`);
});

hr("D. vidiqKeywordResearch() — fix 2 (prose text + structuredContent)");
const kw = await vidiqKeywordResearch("gut health fatigue", true);
console.log(JSON.stringify({ ...kw, related: `${kw.related.length} related` }, null, 2));
console.log("\ntop 3 related by overall score:");
kw.related.slice(0, 3).forEach((r, i) => {
  console.log(`  ${i + 1}. ${r.keyword} — overall ${r.overall}, competition ${r.competition}`);
});

hr("E. Fix 1 end-to-end — a real tool error is now a typed, readable failure");
try {
  // `limit: -5` is invalid, so the server rejects it the same way it rejected
  // contentType:"video" — HTTP 200 + isError, no JSON-RPC error member.
  await vidiqOutliers("leaky gut fatigue", -5 as number);
  console.log("no error raised (the server accepted it) — see note below");
} catch (err) {
  console.log(`isVidIQToolError(err): ${isVidIQToolError(err)}`);
  console.log(`err.name: ${(err as Error).name}`);
  console.log(`err.name === "SyntaxError" (the v2.1 symptom): ${(err as Error).name === "SyntaxError"}`);
  if (isVidIQToolError(err)) {
    console.log(`err.tool: ${err.tool}`);
    console.log(`err.rawMessage (verbatim from vidIQ):\n${err.rawMessage}`);
  }
}

console.log("\nDONE.");
console.log(
  "\nNOTE: the wrapper deliberately does NOT sort — it preserves vidIQ's own\n" +
    "ordering. Ranking happens at the deep-research call site, verified below."
);

hr("B2. Ranking — the sort that fix 9 has just made functional for the first time");
// Replicates the comparator at server/scriptFactoryRouter.ts (deep research):
//   .sort((a, b) => (b.outlierScore - a.outlierScore) || (b.views - a.views))
// Pre-fix, outlierScore was 0 on every row, so this comparator always returned
// 0 and was a silent no-op: vidIQ's ordering passed straight through. With real
// values present it finally reorders, so its behaviour needs proving, not
// assuming.
const stored = outliers.map((v) => ({
  title: v.title,
  views: v.viewCount,
  outlierScore: v.outlierScore,
}));

const preFix = [...stored]
  .map((r) => ({ ...r, outlierScore: 0 })) // what v2.1 actually held
  .sort((a, b) => b.outlierScore - a.outlierScore || b.views - a.views);
console.log("v2.1 comparator input (outlierScore all 0) → order by views only:");
preFix.forEach((r, i) => console.log(`  ${i + 1}. ${r.views} views — "${r.title.slice(0, 55)}"`));

const postFix = [...stored].sort(
  (a, b) => b.outlierScore - a.outlierScore || b.views - a.views
);
console.log("\nv2.2 comparator input (real breakoutScore) → order by score:");
postFix.forEach((r, i) =>
  console.log(`  ${i + 1}. score ${r.outlierScore} · ${r.views} views — "${r.title.slice(0, 55)}"`)
);

const scores = postFix.map((r) => r.outlierScore);
const isDesc = scores.every((s, i) => i === 0 || scores[i - 1] >= s);
console.log(`\nsorted descending: ${isDesc} → ${JSON.stringify(scores)}`);
console.log(
  `top-ranked row is now: "${postFix[0].title}" (score ${postFix[0].outlierScore}, ${postFix[0].views} views)`
);
console.log(
  "\nOBSERVATION for the operator: breakoutScore is an unbounded\n" +
    "over-performance-vs-channel-baseline figure, NOT a view multiplier. The UI\n" +
    'renders it as `outlier ${score.toFixed(1)}x`, so a score of 330.3 displays as\n' +
    '"330.3x", which is meaningless. Flagged in the Part 1 report; the `x` suffix\n' +
    "is removed as part of the honest-metrics work in Part 3E."
);
