import mysql from "mysql2/promise";
const c = await mysql.createConnection(process.env.DATABASE_URL);
const [rows] = await c.query(
  "SELECT id, title, word_count, generation_params, script_body FROM script_factory_outputs WHERE id IN (1,2) ORDER BY id"
);
for (const r of rows) {
  const gp = typeof r.generation_params === "string" ? JSON.parse(r.generation_params) : r.generation_params;
  const body = r.script_body;
  // Split CTA/CLOSE from the rest, same rule the lint uses.
  const idx = body.search(/\[CTA\]/i);
  const pre = idx > 0 ? body.slice(0, idx) : body;
  const cta = idx > 0 ? body.slice(idx) : "";
  const count = (s, re) => (s.match(re) || []).length;
  console.log(`\n===== script ${r.id} =====`);
  console.log(`ctaStyle frozen : ${gp?.ctaStyle}`);
  console.log(`words           : ${r.word_count}`);
  console.log(`-- OUTSIDE CTA/CLOSE --`);
  console.log(`  "KBMO"        : ${count(pre, /KBMO/gi)}`);
  console.log(`  "FIT 22"      : ${count(pre, /FIT\s?22/gi)}`);
  console.log(`  "$399"        : ${count(pre, /\$399/g)}`);
  console.log(`  urgency       : ${count(pre, /limited time|act now|spots? (are )?(filling|limited)|don't wait|today only|before (it'?s too late|the price)/gi)}`);
  console.log(`-- CTA FIDELITY (inside CTA/CLOSE) --`);
  console.log(`  "FIT 22"      : ${count(cta, /FIT\s?22/gi)}`);
  console.log(`  "176"         : ${count(cta, /176/g)}  <-- must be 0`);
  console.log(`  "$399"        : ${count(cta, /\$399/g)}`);
  console.log(`  money-back    : ${count(cta, /money-?back/gi)}`);
  console.log(`  no-rejection  : ${count(cta, /no-?rejection/gi)}`);
  console.log(`  Zonulin/Occl. : ${count(cta, /zonulin|occludin/gi)}`);
}
await c.end();
