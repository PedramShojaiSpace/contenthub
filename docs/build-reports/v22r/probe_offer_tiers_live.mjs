/**
 * PART 3B MULTI-TIER — live proof against the REAL corpus entry.
 *
 * Entry id=3 ("Beyond Normal Labs") is the only analog entry in the corpus and
 * it ladders several tiers. The single-offer extractor rejected it outright, so
 * this probe verifies:
 *   1. extraction now returns MULTIPLE tiers from the real page
 *   2. generation with no tier chosen stays UNBOUND and reports the choices
 *   3. generation with an explicit tier closes on THAT tier's price/guarantee
 *   4. an unknown tier does NOT silently fall back to another tier
 *
 * Probe rows carry the marker below so cleanup matches on identity, never on an
 * id range (an earlier cleanup by `id >= 30000` deleted unrelated proof rows).
 */
const BASE = "http://localhost:3000";
const MARKER = "__probe3btiers__";
const TOPIC = `why normal labs miss gut inflammation ${MARKER}`;
const ENTRY_ID = 3;

const login = await fetch(`${BASE}/api/dev/login`, { redirect: "manual" });
const cookie = (login.headers.getSetCookie?.() ?? []).join("; ");

async function trpc(path, json, kind = "mutation") {
  const url = `${BASE}/api/trpc/${path}?batch=1`;
  const res =
    kind === "mutation"
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
    raw: text.slice(0, 500),
  };
}

const line = (t) => console.log(`\n${"=".repeat(72)}\n${t}\n${"=".repeat(72)}`);
function ctaSection(body) {
  const i = String(body ?? "").lastIndexOf("[CTA]");
  return i >= 0 ? String(body).slice(i, i + 1000) : "(no [CTA] section found)";
}

line("1. EXTRACT TIERS FROM THE REAL SALES PAGE (id=3)");
const ex = await trpc("analogData.extractOfferProfile", { id: ENTRY_ID, force: true });
console.log(`HTTP ${ex.status} · cached=${ex.data?.cached} · error=${ex.error}`);
console.log(`reason: ${ex.data?.reason ?? "(none — tiers found)"}`);
if (ex.data?.rawExtraction) console.log(`raw model output (diagnostic):\n${ex.data.rawExtraction}`);
const tiers = ex.data?.tiers ?? [];
console.log(`\nTIER COUNT: ${tiers.length}`);
for (const t of tiers) {
  console.log(`\n  --- ${t.offerName} ---`);
  console.log(`  type:        ${t.offerType}`);
  console.log(`  price:       ${t.pricePoint ?? "(none stated)"}`);
  console.log(`  guarantee:   ${t.guarantee ?? "(none stated — must NOT be invented)"}`);
  console.log(`  timeline:    ${t.timeline ?? "(none stated)"}`);
  console.log(`  action:      ${t.targetAction}`);
  console.log(`  deliverables:`);
  for (const d of t.deliverables) console.log(`    - ${d}`);
}

const generated = [];
async function generate(label, extra) {
  const res = await trpc("scriptFactory.generate", {
    topic: TOPIC,
    format: "youtube_script",
    targetLengthMinutes: 10,
    useCorpusSearch: false,
    useDeepResearch: false,
    storyMode: "none",
    analogDataEntryIds: [ENTRY_ID],
    ...extra,
  });
  if (res.data?.id) generated.push(res.data.id);
  console.log(`HTTP ${res.status} · error=${res.error}`);
  console.log(`offerBinding:  ${JSON.stringify(res.data?.offerBinding)}`);
  console.log(`bindReason:    ${res.data?.offerBindReason}`);
  console.log(`unresolved:    ${JSON.stringify(res.data?.unresolvedOfferTiers)}`);
  console.log(`--- CTA VERBATIM ---\n${ctaSection(res.data?.scriptBody)}\n--- END ---`);
  return res.data;
}

line("2. NO TIER CHOSEN — must stay UNBOUND and report the options");
const a = await generate("unchosen", {});
console.log(`\nstayed unbound:              ${a?.offerBinding?.mode === "unbound"}`);
console.log(`reported the tier choices:   ${(a?.unresolvedOfferTiers ?? []).length > 1}`);

const target = tiers.find((t) => /bundle/i.test(t.offerName)) ?? tiers[0];
line(`3. EXPLICIT TIER — "${target?.offerName}"`);
const b = await generate("explicit", { offerTier: target?.offerName });
const bodyB = String(b?.scriptBody ?? "");
console.log(`\nbound to that tier:          ${b?.offerBinding?.offerName === target?.offerName}`);
console.log(`names the tier in the CTA:   ${target ? bodyB.includes(target.offerName) : false}`);
if (target?.pricePoint) {
  const bare = target.pricePoint.match(/\$[\d,]+/)?.[0];
  console.log(`states that tier's price:    ${bare ? bodyB.includes(bare) : "n/a"} (${bare ?? "no numeric price"})`);
}
// A tier with no guarantee must not acquire one; a tier with one may state it.
const mentionsRefund = /refund|money[- ]back|guarantee|promise/i.test(ctaSection(bodyB));
console.log(`guarantee on this tier:      ${target?.guarantee ?? "(none)"}`);
console.log(`CTA mentions a guarantee:    ${mentionsRefund}`);
console.log(`  → correct: ${target?.guarantee ? mentionsRefund || "allowed either way" : !mentionsRefund}`);

line("4. UNKNOWN TIER — must NOT fall back to a different price point");
const c = await generate("unknown", { offerTier: "Tier That Does Not Exist" });
console.log(`\nstayed unbound:              ${c?.offerBinding?.mode === "unbound"}`);
console.log(`reason is not-found:         ${c?.offerBindReason === "requested_tier_not_found"}`);

line("CLEANUP");
const { default: mysql } = await import("mysql2/promise");
const { readFileSync } = await import("node:fs");
const env = Object.fromEntries(
  readFileSync("/home/ubuntu/contenthub/.env", "utf8")
    .split("\n")
    .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")];
    })
);
const conn = await mysql.createConnection({
  host: "127.0.0.1", port: 3306, user: "chstaging",
  password: env.DATABASE_URL?.match(/mysql:\/\/chstaging:([^@]+)@/)?.[1],
  database: "contenthub_v22_sandbox",
});
const [[{ db }]] = await conn.query("SELECT DATABASE() AS db");
if (db !== "contenthub_v22_sandbox") { console.error(`REFUSING cleanup: db is ${db}`); process.exit(1); }
const [byMarker] = await conn.query(`SELECT id FROM script_factory_outputs WHERE topic LIKE ?`, [`%${MARKER}%`]);
const ids = [...new Set([...generated, ...byMarker.map((r) => r.id)])];
if (ids.length) {
  await conn.query(`DELETE FROM script_factory_outputs WHERE id IN (${ids.map(() => "?").join(",")})`, ids);
  console.log(`deleted probe scripts: ${ids.join(", ")}`);
}
// The extracted ladder is left on entry 3 deliberately: it is real data about a
// real offer, and the operator will want it. Nothing else is mutated.
console.log(`entry ${ENTRY_ID} keeps its extracted ladder (real data, not a probe artifact)`);
await conn.end();
console.log("DONE");
