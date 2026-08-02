/*
 * Why does the structure-summary pass never persist? (v2.2 Part 3C)
 *
 * Every research job so far records `structure_summary=no`, including jobs that
 * completed with real transcripts. The validator rejects silently, and the
 * diagnostic I added logs to the server process — which had already been
 * restarted, so nothing was captured. This probe calls the SAME prompt and the
 * SAME validator directly against real transcript text from the scratch DB, and
 * prints the model's raw response, so the rejection becomes inspectable.
 */
import fs from "node:fs";

// env must be loaded before importing anything that reads it at module scope.
const envText = fs.readFileSync(new URL("../../../.env", import.meta.url), "utf8");
for (const line of envText.split("\n")) {
  if (!line.includes("=") || line.trim().startsWith("#")) continue;
  const i = line.indexOf("=");
  const k = line.slice(0, i).trim();
  const v = line.slice(i + 1).trim().replace(/^["']|["']$/g, "");
  process.env[k] = v; // .env wins over inherited shell values
}
process.env.DATABASE_URL = process.env.DATABASE_URL!.replace(
  /\/[^/?]+(\?|$)/,
  "/contenthub_v22_sandbox$1"
);

const { invokeLLM } = await import("../../../server/llm.js").catch(async () => {
  // fall back to whatever module actually exports invokeLLM
  return await import("../../../server/_core/llm.js");
});
const { STRUCTURE_SUMMARY_PROMPT, validateStructureSummary } = await import(
  "../../../server/researchGrounding.js"
);
const mysql = (await import("mysql2/promise")).default;

const url = new URL(process.env.DATABASE_URL!);
const conn = await mysql.createConnection({
  host: url.hostname,
  port: Number(url.port || 3306),
  user: decodeURIComponent(url.username),
  password: decodeURIComponent(url.password),
  database: url.pathname.slice(1),
});

const [rows]: any = await conn.query(
  `SELECT video_id, video_title, transcript_text
     FROM yt_transcripts
    WHERE transcript_text IS NOT NULL AND CHAR_LENGTH(transcript_text) > 500
    ORDER BY id DESC LIMIT 3`
);
console.log(`transcripts pulled: ${rows.length}`);
for (const r of rows) {
  console.log(`  ${r.video_id} · ${String(r.video_title).slice(0, 70)} · ${String(r.transcript_text).length} chars`);
}

const transcriptBlock = rows
  .map((t: any, i: number) => `--- VIDEO ${i + 1}: ${t.video_title} ---\n${String(t.transcript_text).slice(0, 6000)}`)
  .join("\n\n");

console.log("\n=== PROMPT (first 600 chars) ===");
console.log(STRUCTURE_SUMMARY_PROMPT.slice(0, 600));

console.log("\n=== calling the model ===");
const resp: any = await invokeLLM({
  messages: [
    { role: "system", content: STRUCTURE_SUMMARY_PROMPT },
    { role: "user", content: transcriptBlock },
  ],
});

const raw = String(resp?.choices?.[0]?.message?.content ?? "").trim();
console.log(`\nraw length: ${raw.length}`);
console.log("=== RAW RESPONSE (first 1200 chars) ===");
console.log(raw.slice(0, 1200));

const unfenced = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
console.log(`\nunfenced differs from raw: ${unfenced !== raw}`);

let parsed: any = null;
try {
  parsed = JSON.parse(unfenced);
  console.log("JSON.parse: OK");
  console.log("top-level keys:", Object.keys(parsed));
  console.log("sectionFlow isArray:", Array.isArray(parsed.sectionFlow), "len:", parsed.sectionFlow?.length);
  console.log("pacingNotes:", JSON.stringify(String(parsed.pacingNotes ?? "").slice(0, 120)));
} catch (e: any) {
  console.log("JSON.parse FAILED:", e.message);
}

const validated = validateStructureSummary(unfenced, rows.map((r: any) => r.video_id));
console.log(`\nvalidateStructureSummary -> ${validated === null ? "NULL (rejected)" : "ACCEPTED"}`);
if (validated) console.log(JSON.stringify(validated, null, 2).slice(0, 900));

await conn.end();
