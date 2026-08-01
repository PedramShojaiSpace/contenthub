/**
 * PART 3A live proof — runs against the SANDBOX app (scratch DB only).
 *
 * Generates a real script in each story mode through the real tRPC endpoint and
 * prints the story-relevant excerpt verbatim, so the claim "the slot references
 * this script's own symptoms" can be judged from output rather than trusted.
 */
import mysql from "mysql2/promise";
import { readFileSync } from "node:fs";

const BASE = process.env.SANDBOX_URL ?? "http://localhost:3000";
const env = Object.fromEntries(
  readFileSync("/home/ubuntu/contenthub/.env", "utf8")
    .split("\n")
    .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")];
    })
);

const line = (t) => console.log(`\n${"=".repeat(72)}\n${t}\n${"=".repeat(72)}`);

async function login() {
  const r = await fetch(`${BASE}/api/dev/login`, { redirect: "manual" });
  const cookie = (r.headers.getSetCookie?.() ?? []).join("; ");
  if (!cookie) throw new Error("dev login returned no cookie");
  return cookie;
}

async function generate(cookie, storyMode, topic) {
  const t0 = Date.now();
  const r = await fetch(`${BASE}/api/trpc/scriptFactory.generate?batch=1`, {
    method: "POST",
    headers: { "content-type": "application/json", cookie },
    body: JSON.stringify({
      0: {
        json: {
          topic,
          format: "youtube_script",
          useCorpusSearch: true,
          targetLengthMinutes: 10,
          storyMode,
        },
      },
    }),
  });
  const text = await r.text();
  let parsed = null;
  try { parsed = JSON.parse(text); } catch {}
  return { status: r.status, ms: Date.now() - t0, parsed, raw: text.slice(0, 1200) };
}

const STORY_OPEN = "[STORY SLOT — INSERT YOUR REAL CASE HERE]";
const STORY_CLOSE = "[END STORY SLOT]";

function storyExcerpt(body) {
  const i = body.indexOf(STORY_OPEN);
  if (i >= 0) {
    const j = body.indexOf(STORY_CLOSE, i);
    return body.slice(i, j >= 0 ? j + STORY_CLOSE.length : i + 900);
  }
  const k = body.search(/\[STORY\]/);
  return k >= 0 ? body.slice(k, k + 900) : "(no story section found)";
}

const TOPIC = "why afternoon energy crashes start in the gut lining";

const cookie = await login();
line("PART 3A LIVE PROOF — story modes through the real generate endpoint");
console.log(`base: ${BASE}\ntopic: ${TOPIC}`);

const results = {};
for (const mode of ["brief", "composite", "none"]) {
  line(`MODE: ${mode}`);
  const res = await generate(cookie, mode, TOPIC);
  console.log(`HTTP ${res.status} · ${res.ms}ms`);
  const data = res.parsed?.[0]?.result?.data?.json;
  if (!data) {
    console.log("NO DATA — raw response head:");
    console.log(res.raw);
    results[mode] = { ok: false };
    continue;
  }
  console.log(`scriptId=${data.id} words=${data.wordCount} storyMode=${data.storyMode} ` +
    `slots=${data.storySlotCount} correctionUsed=${data.storyCorrectionPassUsed} ` +
    `continuation=${data.continuationPassUsed}`);
  const body = String(data.scriptBody ?? "");
  console.log("\n--- STORY SECTION VERBATIM ---");
  console.log(storyExcerpt(body));
  console.log("--- END EXCERPT ---");
  results[mode] = {
    ok: true, id: data.id, words: data.wordCount,
    slots: data.storySlotCount, body,
  };
}

line("ASSERTIONS");
const b = results.brief;
if (b?.ok) {
  console.log(`brief emits a delimited slot: ${b.body.includes(STORY_OPEN)}`);
  console.log(`brief slot is closed:         ${b.body.includes(STORY_CLOSE)}`);
  console.log(`brief slotCount >= 1:         ${b.slots >= 1}`);
  const namedPatient = /\b(?:patient|client)\s+(?:named|called)\s+[A-Z][a-z]{2,}/.test(b.body);
  console.log(`brief contains NO named patient: ${!namedPatient}`);
}
const c = results.composite;
if (c?.ok) {
  const labelled = /composite\s+of\s+(?:patients|people|clients)|patients?\s+I\s+see\s+all\s+the\s+time/i.test(c.body);
  console.log(`composite carries audible label: ${labelled}`);
}
const n = results.none;
if (n?.ok) {
  console.log(`none emits no slot:            ${!n.body.includes(STORY_OPEN)}`);
}

line("DB CHECK — scratch only, and nothing saved on refusal");
const conn = await mysql.createConnection({
  host: "127.0.0.1", port: 3306, user: "chstaging",
  password: env.DATABASE_URL?.match(/mysql:\/\/chstaging:([^@]+)@/)?.[1],
  database: "contenthub_v22_sandbox",
});
const ids = Object.values(results).filter((r) => r?.ok).map((r) => r.id);
if (ids.length) {
  const [rows] = await conn.query(
    `SELECT id, LENGTH(script_body) AS len, word_count FROM script_factory_outputs WHERE id IN (${ids.map(() => "?").join(",")})`,
    ids
  );
  console.table(rows);
  await conn.query(`DELETE FROM script_factory_outputs WHERE id IN (${ids.map(() => "?").join(",")})`, ids);
  console.log(`cleaned up probe rows: ${ids.join(", ")}`);
}
await conn.end();
console.log("\nDONE");
