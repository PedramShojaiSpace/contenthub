/**
 * Sandbox seed — the MINIMUM data set needed to exercise the Script Factory.
 *
 * Inserts exactly:
 *   1. one persona
 *   2. one analog_data_entries row of type 'sales_page' holding the operator's
 *      REAL sales page copy, verbatim, byte for byte
 *   3. a corpus_entries mirror of (2) so corpus retrieval can reach it
 *   4. a PINNED single-tier offer_profile on (2)
 *
 * On (4): the extractor would legitimately surface three purchasable tiers from
 * this page (the $399 diagnostic intake, the 6-month rebuild, the 12-month
 * restoration). A multi-tier ladder deliberately refuses to auto-bind
 * (selectOfferTier -> "tier_not_chosen") and would surface a tier picker. The
 * operator asked for the $399 Diagnostic Intake ONLY, so the ladder is seeded
 * with that single tier — which makes selectOfferTier return "single_tier",
 * binds automatically, and surfaces no picker.
 *
 * Idempotent: re-running replaces the seeded rows rather than duplicating them.
 * Verbatim guarantee: the sales page body is read from disk and inserted as a
 * bound parameter. Nothing is reformatted, escaped, or summarised.
 */
import { readFileSync } from "node:fs";
import mysql from "mysql2/promise";

const SALES_PAGE_PATH = "/home/ubuntu/salespage_verbatim.txt";
const ENTRY_TITLE = "KBMO Clinical Ecosystem — Diagnostic Intake ($399)";
const PERSONA_SLUG = "exhausted-optimizer";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set");
  process.exit(1);
}

const content = readFileSync(SALES_PAGE_PATH, "utf8");
console.log(`[seed] sales page read: ${content.length} chars, ${content.split("\n").length} lines`);

/**
 * Pinned single tier. Every field below is quoted from the page copy.
 *
 * CORRECTED 2026-08-03 (v2.3 Part 0). The first version of this block said
 * "KBMO FIT 176 food inflammation test (176 foods, IgG + complement C3)".
 * The string "176" appears ZERO times in the sales page; the page says
 * "KBMO FIT 22 & Gut Barrier Permeability Panel" and "Screens 22 primary
 * inflammatory food triggers". The 176 figure was written from outside
 * knowledge of KBMO's product line rather than from the page — exactly the
 * fabrication this pipeline exists to prevent, committed in the seed data.
 * The generator then faithfully reproduced it. Every deliverable below is now
 * traceable to a line number in /home/ubuntu/salespage_verbatim.txt.
 */
const offerLadder = {
  tiers: [
    {
      offerName: "KBMO Clinical Ecosystem — Diagnostic Intake",
      offerType: "service",
      deliverables: [
        // page line 131
        "KBMO FIT 22 & Gut Barrier Permeability Panel, shipped directly to your door",
        // page lines 138, 60-61
        "Screens 22 primary inflammatory food triggers",
        // page lines 139, 266
        "Measures Zonulin/Occludin for leaky gut",
        // page lines 59-61 ($149 value)
        "Clinical-Grade Gut Biome Test Kit — a simple, painless at-home collection kit, no doctor's office required",
        // page lines 63-65 ($200 value)
        "Full Lab Analysis & Detailed Report — comprehensive report of your exact gut health markers, colour-coded red, yellow and green",
        // page lines 67-69 ($300 value), 131, 267
        "1-Hour Private 1-on-1 Clinical Health Coach Session reviewing YOUR specific results",
        // page lines 134-135, 268-269
        "Personalized Upstream Action Plan detailing your exact food sensitivity triggers and gut barrier status",
      ],
      // page line 9 "100% Money-Back Guarantee"; lines 268-269 "No-Rejection
      // Guarantee". Both are stated on the page, so both are quoted here. The
      // earlier null was also wrong, in the safer direction.
      guarantee:
        "100% Money-Back Guarantee. Plus the No-Rejection Guarantee: regardless of whether you qualify for the 6- or 12-month programs, you walk away with your complete food sensitivity report, leaky gut markers, and a personalized Upstream Action Plan.",
      // page line 8
      timeline: "Results in 3–5 Weeks",
      pricePoint: "$399",
      primaryCtaUrl: null,
      // page lines 85, 277 "Get My Clinical Ecosystem — $399" / "Order Your Kit — $399"
      targetAction: "Order the $399 Clinical Ecosystem kit and reserve a clinical coaching slot",
    },
  ],
};

const persona = {
  name: "The Exhausted Optimizer",
  slug: PERSONA_SLUG,
  description:
    "45-60, health-literate, has already done the obvious things. Labs come back 'normal' but they feel persistently inflamed, foggy and tired. Sceptical of both conventional dismissal and wellness hype.",
  painPoints: JSON.stringify([
    "Told their labs are normal while still feeling terrible",
    "Has tried elimination diets without knowing what to eliminate",
    "Brain fog and fatigue that no one will name",
    "Distrusts direct-to-consumer tests with no clinician attached",
  ]),
  aspirations: JSON.stringify([
    "A specific, testable explanation instead of a shrug",
    "An expert who reads the results with them",
    "Energy and clarity back without guesswork",
  ]),
  topQuestions: JSON.stringify([
    "Why are my labs normal if I feel this bad?",
    "How is this different from the gut tests I see online?",
    "What happens after I get my results?",
  ]),
  primaryGoal: "audience_growth",
  icon: "🔬",
  color: "#2F6F62",
};

const conn = await mysql.createConnection(url);

try {
  await conn.beginTransaction();

  // ── 1. persona (idempotent on slug) ────────────────────────────────────────
  const [existingPersona] = await conn.execute(
    "SELECT id FROM personas WHERE slug = ?",
    [PERSONA_SLUG]
  );
  let personaId;
  if (existingPersona.length > 0) {
    personaId = existingPersona[0].id;
    await conn.execute(
      `UPDATE personas SET name=?, description=?, painPoints=?, aspirations=?,
         topQuestions=?, primaryGoal=?, icon=?, color=?, updatedAt=NOW()
       WHERE id=?`,
      [persona.name, persona.description, persona.painPoints, persona.aspirations,
       persona.topQuestions, persona.primaryGoal, persona.icon, persona.color, personaId]
    );
    console.log(`[seed] persona updated id=${personaId}`);
  } else {
    const [res] = await conn.execute(
      `INSERT INTO personas
         (name, slug, description, painPoints, aspirations, topQuestions,
          primaryGoal, icon, color, createdAt, updatedAt)
       VALUES (?,?,?,?,?,?,?,?,?,NOW(),NOW())`,
      [persona.name, PERSONA_SLUG, persona.description, persona.painPoints,
       persona.aspirations, persona.topQuestions, persona.primaryGoal,
       persona.icon, persona.color]
    );
    personaId = res.insertId;
    console.log(`[seed] persona inserted id=${personaId}`);
  }

  // ── 2. analog_data_entries (verbatim content) ──────────────────────────────
  const tags = JSON.stringify(["north_star", "sales_page", "kbmo", "gut_health"]);
  const offerJson = JSON.stringify(offerLadder);

  const [existingEntry] = await conn.execute(
    "SELECT id FROM analog_data_entries WHERE title = ?",
    [ENTRY_TITLE]
  );
  let entryId;
  if (existingEntry.length > 0) {
    entryId = existingEntry[0].id;
    await conn.execute(
      `UPDATE analog_data_entries
         SET type='sales_page', tags=?, personaId=?, content=?, inCorpus=1,
             offer_profile=?, ad_updatedAt=NOW()
       WHERE id=?`,
      [tags, personaId, content, offerJson, entryId]
    );
    console.log(`[seed] analog entry updated id=${entryId}`);
  } else {
    const [res] = await conn.execute(
      `INSERT INTO analog_data_entries
         (title, type, tags, personaId, content, inCorpus, offer_profile,
          ad_createdAt, ad_updatedAt)
       VALUES (?, 'sales_page', ?, ?, ?, 1, ?, NOW(), NOW())`,
      [ENTRY_TITLE, tags, personaId, content, offerJson]
    );
    entryId = res.insertId;
    console.log(`[seed] analog entry inserted id=${entryId}`);
  }

  // ── 3. corpus_entries mirror ───────────────────────────────────────────────
  // The generate path reaches analog material two ways: explicit North Star
  // selection (analog_data_entries) and corpus retrieval (corpus_entries).
  // Seeding only the first would leave "use corpus" returning nothing, which
  // looks like a retrieval bug rather than an empty corpus.
  const wordCount = content.trim().split(/\s+/).length;
  const [existingCorpus] = await conn.execute(
    "SELECT id FROM corpus_entries WHERE source_type='analog_data' AND source_id=?",
    [String(entryId)]
  );
  if (existingCorpus.length > 0) {
    await conn.execute(
      `UPDATE corpus_entries
         SET title=?, content=?, tags=?, persona_id=?, word_count=?, in_corpus=1,
             updated_at=NOW()
       WHERE id=?`,
      [ENTRY_TITLE, content, tags, personaId, wordCount, existingCorpus[0].id]
    );
    console.log(`[seed] corpus entry updated id=${existingCorpus[0].id}`);
  } else {
    const [res] = await conn.execute(
      `INSERT INTO corpus_entries
         (source_type, source_id, title, content, tags, persona_id, word_count,
          in_corpus, created_at, updated_at)
       VALUES ('analog_data', ?, ?, ?, ?, ?, ?, 1, NOW(), NOW())`,
      [String(entryId), ENTRY_TITLE, content, tags, personaId, wordCount]
    );
    console.log(`[seed] corpus entry inserted id=${res.insertId}`);
  }

  await conn.commit();

  // ── verification ───────────────────────────────────────────────────────────
  const [check] = await conn.execute(
    `SELECT a.id, a.title, a.type, a.inCorpus, a.personaId,
            CHAR_LENGTH(a.content) AS content_chars,
            CHAR_LENGTH(a.offer_profile) AS offer_chars
       FROM analog_data_entries a WHERE a.id=?`,
    [entryId]
  );
  console.log("[seed] verification:", JSON.stringify(check[0], null, 2));

  const [tierCheck] = await conn.execute(
    "SELECT offer_profile FROM analog_data_entries WHERE id=?",
    [entryId]
  );
  const stored = JSON.parse(tierCheck[0].offer_profile);
  console.log(`[seed] stored tiers: ${stored.tiers.length} — ${stored.tiers.map((t) => t.offerName).join(" | ")}`);

  /**
   * Verbatim check must compare BYTES, not MySQL CHAR_LENGTH against JS
   * .length. Those two count differently: CHAR_LENGTH counts codepoints, while
   * JS .length counts UTF-16 code units, so each astral-plane emoji (📦 🔬 👨)
   * counts as 2 in JS and 1 in MySQL. With three emoji the numbers differ by
   * exactly 3 even when storage is perfect — which is what an earlier version of
   * this check reported as a MISMATCH.
   */
  const [rt] = await conn.execute(
    "SELECT content FROM analog_data_entries WHERE id=?",
    [entryId]
  );
  const identical =
    Buffer.compare(Buffer.from(content, "utf8"), Buffer.from(rt[0].content, "utf8")) === 0;
  const emoji = [...rt[0].content].filter((c) => c.codePointAt(0) > 0xffff);
  console.log(`[seed] round-trip: ${identical ? "BYTE-FOR-BYTE IDENTICAL" : "DIFFERS — investigate"}`);
  console.log(`[seed]   bytes ${Buffer.byteLength(content, "utf8")} local / ${Buffer.byteLength(rt[0].content, "utf8")} stored`);
  console.log(`[seed]   4-byte chars preserved: ${emoji.join(" ")} (${emoji.length})`);
  if (!identical) process.exitCode = 1;
} catch (err) {
  await conn.rollback();
  console.error("[seed] FAILED, rolled back:", err);
  process.exitCode = 1;
} finally {
  await conn.end();
}
