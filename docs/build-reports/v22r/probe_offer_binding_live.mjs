/**
 * PART 3B live proof — runs against the SANDBOX app (scratch DB only).
 *
 * Proves three things with raw output rather than assertion:
 *  1. Extraction pulls a real offer from real copy, and is idempotent.
 *  2. A bound CTA names the offer and cites deliverables.
 *  3. An unbound generation does NOT invent an offer, and an override replaces it.
 *
 * Also runs the invented-guarantee check: extraction on copy with no stated
 * guarantee must yield guarantee=null, and the resulting script must not promise
 * a refund.
 */
import mysql from "mysql2/promise";
import { readFileSync } from "node:fs";

const BASE = process.env.SANDBOX_URL ?? "http://localhost:3000";
const TARGET_DB = "contenthub_v22_sandbox";

const env = Object.fromEntries(
  readFileSync("/home/ubuntu/contenthub/.env", "utf8")
    .split("\n")
    .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")];
    })
);
const password = env.DATABASE_URL?.match(/mysql:\/\/chstaging:([^@]+)@/)?.[1];

const line = (t) => console.log(`\n${"=".repeat(72)}\n${t}\n${"=".repeat(72)}`);

const cookieJar = await (async () => {
  const r = await fetch(`${BASE}/api/dev/login`, { redirect: "manual" });
  const c = (r.headers.getSetCookie?.() ?? []).join("; ");
  if (!c) throw new Error("dev login returned no cookie");
  return c;
})();

async function trpc(path, json, kind = "mutation") {
  const url = `${BASE}/api/trpc/${path}?batch=1`;
  const opts = kind === "mutation"
    ? { method: "POST", headers: { "content-type": "application/json", cookie: cookieJar }, body: JSON.stringify({ 0: { json } }) }
    : { headers: { cookie: cookieJar } };
  const r = await fetch(kind === "mutation" ? url : `${url}&input=${encodeURIComponent(JSON.stringify({ 0: { json } }))}`, opts);
  const text = await r.text();
  let parsed = null;
  try { parsed = JSON.parse(text); } catch {}
  return {
    status: r.status,
    data: parsed?.[0]?.result?.data?.json,
    error: parsed?.[0]?.error?.json?.message ?? null,
    raw: text.slice(0, 600),
  };
}

const conn = await mysql.createConnection({
  host: "127.0.0.1", port: 3306, user: "chstaging", password, database: TARGET_DB,
});
const [[{ db }]] = await conn.query("SELECT DATABASE() AS db");
if (db !== TARGET_DB) { console.error(`REFUSING: db is ${db}`); process.exit(1); }

// ── Seed two analog entries: one WITH a guarantee, one WITHOUT. ──────────────
// Written as marketing copy for a real offer shape, so extraction has something
// genuine to read rather than a keyword soup.
const WITH_GUARANTEE = `
The 90-Day Gut Reset

Most people chasing energy are treating the wrong organ. The 90-Day Gut Reset is a
structured program that rebuilds the gut lining first, then rebuilds energy on top of it.

What you get:
- 12 weekly live coaching calls with our clinical team
- The full GI-MAP stool panel and a written interpretation
- A 90-day meal and supplement protocol
- Access to the private member community

Investment: $1,997, or three payments of $699.

Our promise: complete the first module, do the work, and if you don't see measurable
change in your energy within 30 days, we refund you in full.

Enroll in the 90-Day Gut Reset at theurbanmonk.com/gut-reset
`.trim();

const NO_GUARANTEE = `
Vagus Nerve Reset Intensive

A two-week intensive for people whose nervous system never switches off.

Includes:
- 6 recorded training modules on vagal tone
- A daily 12-minute breathwork practice library
- One live group Q&A

Price: $297.

Join the Vagus Nerve Reset Intensive at theurbanmonk.com/vagus
`.trim();

line("SEED — inserting two analog entries into the scratch DB");
const seeded = [];
for (const [label, content] of [["with_guarantee", WITH_GUARANTEE], ["no_guarantee", NO_GUARANTEE]]) {
  const [res] = await conn.query(
    `INSERT INTO analog_data_entries (title, type, content, inCorpus) VALUES (?, 'sales_page', ?, 1)`,
    [`__probe_${label}`, content]
  );
  seeded.push({ label, id: res.insertId });
  console.log(`inserted ${label} → id=${res.insertId}`);
}
const withId = seeded.find((s) => s.label === "with_guarantee").id;
const withoutId = seeded.find((s) => s.label === "no_guarantee").id;

// ── 1. Extraction ────────────────────────────────────────────────────────────
line("1. EXTRACTION — real copy, real offer");
const ex1 = await trpc("analogData.extractOfferProfile", { id: withId });
console.log(`HTTP ${ex1.status} · cached=${ex1.data?.cached} · reason=${ex1.data?.reason}`);
console.log("PROFILE (verbatim):");
console.log(JSON.stringify(ex1.data?.profile, null, 2));

line("1b. IDEMPOTENCE — second call must not re-extract");
const ex2 = await trpc("analogData.extractOfferProfile", { id: withId });
console.log(`HTTP ${ex2.status} · cached=${ex2.data?.cached}`);
console.log(`same offerName: ${ex1.data?.profile?.offerName === ex2.data?.profile?.offerName}`);

line("1c. NO-GUARANTEE COPY — guarantee must be null, not invented");
const ex3 = await trpc("analogData.extractOfferProfile", { id: withoutId });
console.log(`HTTP ${ex3.status}`);
console.log(JSON.stringify(ex3.data?.profile, null, 2));
console.log(`\nguarantee is null: ${ex3.data?.profile?.guarantee === null}`);

// ── 2. Generation ────────────────────────────────────────────────────────────
// Marker embedded in the topic so cleanup can match on IDENTITY, not an id range.
// An earlier version of this probe cleaned up by `id >= 30000` and swept away
// unrelated rows from a previous proof; never do that again.
const MARKER = "__probe3b__";
const TOPIC = `why your afternoon energy crash starts in the gut lining ${MARKER}`;
const generated = [];

async function gen(label, extra) {
  const r = await trpc("scriptFactory.generate", {
    topic: TOPIC, format: "youtube_script", useCorpusSearch: true,
    targetLengthMinutes: 10, storyMode: "brief", ...extra,
  });
  if (r.data?.id) generated.push(r.data.id);
  return r;
}

function ctaSection(body) {
  const i = body.lastIndexOf("[CTA]");
  return i >= 0 ? body.slice(i, i + 1100) : "(no [CTA] section found)";
}

/** Does `body` contain `needle`? Guards against a null/empty needle. */
function mentions(body, needle) {
  return typeof needle === "string" && needle.length > 0 && body.includes(needle);
}

line("2. BOUND — generate with the offer entry selected as North Star");
const g1 = await gen("bound", { analogDataEntryIds: [withId] });
console.log(`HTTP ${g1.status} · binding=${JSON.stringify(g1.data?.offerBinding)}`);
if (g1.data) {
  const body = String(g1.data.scriptBody ?? "");
  console.log("\n--- CTA VERBATIM ---");
  console.log(ctaSection(body));
  console.log("--- END ---");
  const p = ex1.data?.profile;
  const cited = (p?.deliverables ?? []).filter((d) => {
    const key = d.split(/\s+/).filter((w) => w.length > 4)[0];
    return key && body.toLowerCase().includes(key.toLowerCase());
  });
  console.log(`\nnames the offer:            ${mentions(body, p?.offerName)}`);
  console.log(`deliverables cited:         ${cited.length} (${cited.join(" | ")})`);
  console.log(`mentions the guarantee:     ${/refund|money[- ]back|full refund/i.test(body)}`);
} else {
  console.log(`ERROR: ${g1.error}\n${g1.raw}`);
}

line("3. UNBOUND — same topic, no offer entry selected");
const g2 = await gen("unbound", {});
console.log(`HTTP ${g2.status} · binding=${JSON.stringify(g2.data?.offerBinding)}`);
if (g2.data) {
  const body = String(g2.data.scriptBody ?? "");
  console.log("\n--- CTA VERBATIM ---");
  console.log(ctaSection(body));
  console.log("--- END ---");
  console.log(`\ndoes NOT name the seeded offer: ${!body.includes("90-Day Gut Reset")}`);
  console.log(`invents no refund promise:      ${!/refund|money[- ]back guarantee/i.test(body)}`);
}

line("4. OVERRIDE — operator's own close replaces binding");
const g3 = await gen("override", {
  analogDataEntryIds: [withId],
  ctaOverride: "Download the free 3-day gut reset checklist at theurbanmonk.com/checklist",
});
console.log(`HTTP ${g3.status} · binding=${JSON.stringify(g3.data?.offerBinding)}`);
if (g3.data) {
  const body = String(g3.data.scriptBody ?? "");
  console.log("\n--- CTA VERBATIM ---");
  console.log(ctaSection(body));
  console.log("--- END ---");
  console.log(`\ndrives the override:        ${/checklist/i.test(body)}`);
  console.log(`does NOT sell the program: ${!/enroll/i.test(ctaSection(body))}`);
}

line("5. NO-GUARANTEE OFFER — the invented-refund guard end to end");
const g4 = await gen("no_guarantee", { analogDataEntryIds: [withoutId] });
console.log(`HTTP ${g4.status} · binding=${JSON.stringify(g4.data?.offerBinding)}`);
if (g4.data) {
  const body = String(g4.data.scriptBody ?? "");
  console.log("\n--- CTA VERBATIM ---");
  console.log(ctaSection(body));
  console.log("--- END ---");
  console.log(`\nnames the offer:              ${/Vagus Nerve Reset/i.test(body)}`);
  console.log(`invents NO refund/guarantee:  ${!/refund|money[- ]back|guarantee/i.test(body)}`);
}

// ── Cleanup ──────────────────────────────────────────────────────────────────
line("CLEANUP");
// Delete by marker AND by collected id, so rows still go even if a generation
// returned no id, and nothing outside this probe can ever match.
const [byMarker] = await conn.query(
  `SELECT id FROM script_factory_outputs WHERE topic LIKE ?`,
  [`%${MARKER}%`]
);
const ids = [...new Set([...generated, ...byMarker.map((r) => r.id)])];
if (ids.length) {
  await conn.query(
    `DELETE FROM script_factory_outputs WHERE id IN (${ids.map(() => "?").join(",")})`,
    ids
  );
  console.log(`deleted probe scripts: ${ids.join(", ")}`);
}
await conn.query(`DELETE FROM analog_data_entries WHERE id IN (?, ?)`, [withId, withoutId]);
console.log(`deleted probe analog entries: ${withId}, ${withoutId}`);
const [[after]] = await conn.query(`SELECT COUNT(*) AS n FROM analog_data_entries`);
console.log(`analog_data_entries now: ${after.n} row(s)`);
await conn.end();
console.log("\nDONE");
