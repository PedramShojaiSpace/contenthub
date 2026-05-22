/**
 * Seed script: creates the "Gut Health Authority" keyword campaign
 * and populates it with a curated pillar + cluster + conversion keyword set.
 * Run: node scripts/seed-gut-health.mjs
 *
 * Column prefixes: keyword_campaigns uses kc_*, keyword_targets uses kt_*
 * userId 1 = owner (Pedram)
 */
import "dotenv/config";
import mysql from "mysql2/promise";

const DB_URL = process.env.DATABASE_URL;
if (!DB_URL) throw new Error("DATABASE_URL not set");

function parseDbUrl(url) {
  const u = new URL(url);
  return {
    host: u.hostname,
    port: parseInt(u.port || "3306"),
    user: u.username,
    password: u.password,
    database: u.pathname.replace(/^\//, ""),
    ssl: { rejectUnauthorized: false },
  };
}

// Owner user id — look up from DB dynamically
async function getOwnerId(conn) {
  const [rows] = await conn.execute("SELECT id FROM users ORDER BY id ASC LIMIT 1");
  if (!rows.length) throw new Error("No users found — log in first to create your account");
  return rows[0].id;
}

const KEYWORDS = [
  // ── Pillar ──────────────────────────────────────────────────────────────────
  { keyword: "gut health", keywordType: "pillar", funnelStage: "tofu", monetizationTag: "academy", priority: 1, notes: "Pillar page — the hub that links to all cluster content. Target: 'The Complete Guide to Gut Health'" },

  // ── Cluster — Educational / TOFU ────────────────────────────────────────────
  { keyword: "leaky gut syndrome", keywordType: "cluster", funnelStage: "tofu", monetizationTag: "academy", priority: 2, notes: "High-awareness topic, strong search volume, links back to pillar" },
  { keyword: "gut microbiome", keywordType: "cluster", funnelStage: "tofu", monetizationTag: "academy", priority: 3, notes: "Foundation science post — what the microbiome is and why it matters" },
  { keyword: "gut brain connection", keywordType: "cluster", funnelStage: "tofu", monetizationTag: "academy", priority: 4, notes: "Bridges gut health with mental performance — Pedram's core angle" },
  { keyword: "signs of poor gut health", keywordType: "cluster", funnelStage: "tofu", monetizationTag: "free_lead", priority: 5, notes: "High-intent diagnostic content — great for lead magnet CTA" },
  { keyword: "foods that damage gut health", keywordType: "cluster", funnelStage: "tofu", monetizationTag: "free_lead", priority: 6, notes: "Negative framing drives clicks — pairs with elimination diet content" },
  { keyword: "how to improve gut health naturally", keywordType: "cluster", funnelStage: "mofu", monetizationTag: "academy", priority: 7, notes: "Action-oriented MOFU — bridge from awareness to solution" },
  { keyword: "best probiotics for gut health", keywordType: "cluster", funnelStage: "mofu", monetizationTag: "supplements", priority: 8, notes: "Commercial intent — supplement store upsell opportunity" },
  { keyword: "gut health diet plan", keywordType: "cluster", funnelStage: "mofu", monetizationTag: "academy", priority: 9, notes: "Structured content — ideal for a downloadable guide lead magnet" },
  { keyword: "elimination diet for gut healing", keywordType: "cluster", funnelStage: "mofu", monetizationTag: "academy", priority: 10, notes: "Protocol-style content — drives Academy enrollment" },
  { keyword: "vagus nerve and gut health", keywordType: "cluster", funnelStage: "mofu", monetizationTag: "academy", priority: 11, notes: "Unique Pedram angle — bridges nervous system and gut" },
  { keyword: "oral gut connection microbiome", keywordType: "cluster", funnelStage: "mofu", monetizationTag: "testing", priority: 12, notes: "Orobiome testing upsell — mouth-gut axis is a differentiator" },
  { keyword: "GI map test results explained", keywordType: "cluster", funnelStage: "mofu", monetizationTag: "testing", priority: 13, notes: "Functional testing content — bridges diagnosis to protocol" },
  { keyword: "gut health supplements that work", keywordType: "cluster", funnelStage: "mofu", monetizationTag: "supplements", priority: 14, notes: "Supplement store direct driver — high commercial intent" },

  // ── Conversion — BOFU ────────────────────────────────────────────────────────
  { keyword: "gut health program online", keywordType: "conversion", funnelStage: "bofu", monetizationTag: "academy", priority: 15, notes: "Direct Academy landing page keyword — high conversion intent" },
  { keyword: "gut healing protocol", keywordType: "conversion", funnelStage: "bofu", monetizationTag: "academy", priority: 16, notes: "Protocol framing — positions Academy as the structured solution" },
  { keyword: "urban monk gut health", keywordType: "conversion", funnelStage: "bofu", monetizationTag: "academy", priority: 17, notes: "Brand + topic — captures existing audience searching for Pedram's approach" },
  { keyword: "functional medicine gut health doctor", keywordType: "conversion", funnelStage: "bofu", monetizationTag: "academy", priority: 18, notes: "High-intent searcher looking for a practitioner — positions Pedram as the authority" },
  { keyword: "best gut health course", keywordType: "conversion", funnelStage: "bofu", monetizationTag: "academy", priority: 19, notes: "Direct competitor to other online gut health courses — Academy differentiator page" },
];

async function main() {
  const conn = await mysql.createConnection(parseDbUrl(DB_URL));

  try {
    const userId = await getOwnerId(conn);
    console.log(`✓ Owner user id: ${userId}`);

    // Check if campaign already exists
    const [existing] = await conn.execute(
      "SELECT id FROM keyword_campaigns WHERE kc_pillar_keyword = ? AND kc_user_id = ? LIMIT 1",
      ["gut health", userId]
    );
    if (existing.length > 0) {
      console.log(`✓ Campaign already exists (id=${existing[0].id}). Skipping creation.`);
      await conn.end();
      return;
    }

    // Create campaign
    const [campResult] = await conn.execute(
      `INSERT INTO keyword_campaigns (kc_user_id, kc_name, kc_pillar_keyword, kc_monetization_goal, kc_description, kc_status)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        userId,
        "Gut Health Authority",
        "gut health",
        "academy",
        "Own the gut health topic space to drive Urban Monk Academy memberships ($297/yr) and supplement sales. Pedram's unique angle: gut-brain connection, vagus nerve, oral-gut axis, functional medicine protocols.",
        "active",
      ]
    );
    const campaignId = campResult.insertId;
    console.log(`✓ Created campaign "Gut Health Authority" (id=${campaignId})`);

    // Insert all keywords
    for (const kw of KEYWORDS) {
      await conn.execute(
        `INSERT INTO keyword_targets
           (kt_campaign_id, kt_user_id, kt_keyword, kt_keyword_type, kt_funnel_stage, kt_monetization_tag, kt_content_status, kt_priority, kt_notes)
         VALUES (?, ?, ?, ?, ?, ?, 'not_started', ?, ?)`,
        [campaignId, userId, kw.keyword, kw.keywordType, kw.funnelStage, kw.monetizationTag, kw.priority, kw.notes]
      );
      console.log(`  + ${kw.keywordType.padEnd(10)} [${kw.funnelStage.toUpperCase().padEnd(4)}] ${kw.keyword}`);
    }

    console.log(`\n✓ Seeded ${KEYWORDS.length} keywords into campaign ${campaignId}`);
    console.log('  Next: open /keyword-strategy and click "Get Volumes" to enrich with DataForSEO data.');
  } finally {
    await conn.end();
  }
}

main().catch((err) => {
  console.error("Seed failed:", err.message);
  process.exit(1);
});
