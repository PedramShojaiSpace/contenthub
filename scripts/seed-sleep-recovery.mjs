/**
 * Seed script: creates the "Sleep & Recovery Authority" keyword campaign
 * and populates it with a curated pillar + cluster + conversion keyword set.
 * Run: node scripts/seed-sleep-recovery.mjs
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
  {
    keyword: "sleep optimization",
    keywordType: "pillar",
    funnelStage: "tofu",
    monetizationTag: "academy",
    priority: 1,
    notes: "Pillar page — hub for all sleep content. Target: 'The Complete Guide to Sleep Optimization'. Pedram's angle: Taoist sleep cycles, cortisol rhythm, circadian biology.",
  },

  // ── Cluster — Educational / TOFU ────────────────────────────────────────────
  {
    keyword: "how to sleep better",
    keywordType: "cluster",
    funnelStage: "tofu",
    monetizationTag: "academy",
    priority: 2,
    notes: "Highest-volume entry point — broad awareness post linking to pillar and protocol content",
  },
  {
    keyword: "sleep deprivation effects",
    keywordType: "cluster",
    funnelStage: "tofu",
    monetizationTag: "free_lead",
    priority: 3,
    notes: "Problem-aware content — shock value drives clicks; strong lead magnet CTA opportunity",
  },
  {
    keyword: "circadian rhythm reset",
    keywordType: "cluster",
    funnelStage: "tofu",
    monetizationTag: "academy",
    priority: 4,
    notes: "Science-forward post — Pedram's Taoist clock angle differentiates from generic sleep advice",
  },
  {
    keyword: "cortisol and sleep problems",
    keywordType: "cluster",
    funnelStage: "tofu",
    monetizationTag: "academy",
    priority: 5,
    notes: "Bridges stress and sleep — connects to Pedram's cortisol narrative and Urban Monk brand",
  },
  {
    keyword: "why am I always tired",
    keywordType: "cluster",
    funnelStage: "tofu",
    monetizationTag: "free_lead",
    priority: 6,
    notes: "High-volume diagnostic query — great for quiz or lead magnet entry point",
  },
  {
    keyword: "natural sleep remedies",
    keywordType: "cluster",
    funnelStage: "mofu",
    monetizationTag: "supplements",
    priority: 7,
    notes: "Commercial intent — supplement store upsell (magnesium, adaptogens, ashwagandha)",
  },
  {
    keyword: "sleep hygiene tips",
    keywordType: "cluster",
    funnelStage: "mofu",
    monetizationTag: "academy",
    priority: 8,
    notes: "Action-oriented MOFU — protocol-style content that bridges to Academy enrollment",
  },
  {
    keyword: "best supplements for sleep",
    keywordType: "cluster",
    funnelStage: "mofu",
    monetizationTag: "supplements",
    priority: 9,
    notes: "High commercial intent — direct supplement store driver; review-style post",
  },
  {
    keyword: "meditation for sleep",
    keywordType: "cluster",
    funnelStage: "mofu",
    monetizationTag: "academy",
    priority: 10,
    notes: "Pedram's core competency — qigong and meditation for sleep recovery; Academy differentiator",
  },
  {
    keyword: "adrenal fatigue and sleep",
    keywordType: "cluster",
    funnelStage: "mofu",
    monetizationTag: "testing",
    priority: 11,
    notes: "Functional medicine angle — bridges to cortisol testing and Explore tier",
  },
  {
    keyword: "sleep and gut health connection",
    keywordType: "cluster",
    funnelStage: "mofu",
    monetizationTag: "academy",
    priority: 12,
    notes: "Cross-links to gut health pillar — microbiome-sleep axis is an emerging differentiator",
  },
  {
    keyword: "how to fix sleep schedule",
    keywordType: "cluster",
    funnelStage: "mofu",
    monetizationTag: "academy",
    priority: 13,
    notes: "Practical protocol post — step-by-step guide drives Academy enrollment",
  },
  {
    keyword: "deep sleep stages explained",
    keywordType: "cluster",
    funnelStage: "tofu",
    monetizationTag: "academy",
    priority: 14,
    notes: "Educational science post — builds authority; links to recovery and performance content",
  },

  // ── Conversion — BOFU ────────────────────────────────────────────────────────
  {
    keyword: "sleep optimization program",
    keywordType: "conversion",
    funnelStage: "bofu",
    monetizationTag: "academy",
    priority: 15,
    notes: "Direct Academy landing page keyword — high conversion intent; positions Academy as the solution",
  },
  {
    keyword: "urban monk sleep course",
    keywordType: "conversion",
    funnelStage: "bofu",
    monetizationTag: "academy",
    priority: 16,
    notes: "Brand + topic — captures existing audience searching for Pedram's sleep approach",
  },
  {
    keyword: "functional medicine sleep doctor",
    keywordType: "conversion",
    funnelStage: "bofu",
    monetizationTag: "academy",
    priority: 17,
    notes: "High-intent searcher — positions Pedram as the authority practitioner for sleep issues",
  },
  {
    keyword: "best sleep course online",
    keywordType: "conversion",
    funnelStage: "bofu",
    monetizationTag: "academy",
    priority: 18,
    notes: "Direct competitor comparison page — Academy differentiator vs generic sleep courses",
  },
  {
    keyword: "sleep recovery protocol",
    keywordType: "conversion",
    funnelStage: "bofu",
    monetizationTag: "academy",
    priority: 19,
    notes: "Protocol framing — positions Academy as the structured, science-backed recovery system",
  },
];

async function main() {
  const conn = await mysql.createConnection(parseDbUrl(DB_URL));

  try {
    const userId = await getOwnerId(conn);
    console.log(`✓ Owner user id: ${userId}`);

    // Check if campaign already exists
    const [existing] = await conn.execute(
      "SELECT id FROM keyword_campaigns WHERE kc_pillar_keyword = ? AND kc_user_id = ? LIMIT 1",
      ["sleep optimization", userId]
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
        "Sleep & Recovery Authority",
        "sleep optimization",
        "academy",
        "Own the sleep optimization topic space to drive Urban Monk Academy memberships ($297/yr) and supplement sales. Pedram's unique angle: Taoist sleep cycles, cortisol rhythm, circadian biology, qigong for recovery, and the gut-sleep axis.",
        "active",
      ]
    );
    const campaignId = campResult.insertId;
    console.log(`✓ Created campaign "Sleep & Recovery Authority" (id=${campaignId})`);

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
    console.log('  Next: run node scripts/enrich-sleep-volumes.mjs to fetch DataForSEO volumes.');
  } finally {
    await conn.end();
  }
}

main().catch((err) => {
  console.error("Seed failed:", err.message);
  process.exit(1);
});
