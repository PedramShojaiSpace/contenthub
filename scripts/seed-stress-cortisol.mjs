/**
 * Seed script: creates the "Stress & Cortisol Authority" keyword campaign
 * and populates it with a curated pillar + cluster + conversion keyword set.
 * Run: node scripts/seed-stress-cortisol.mjs
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

async function getOwnerId(conn) {
  const [rows] = await conn.execute("SELECT id FROM users ORDER BY id ASC LIMIT 1");
  if (!rows.length) throw new Error("No users found — log in first to create your account");
  return rows[0].id;
}

const KEYWORDS = [
  // ── Pillar ──────────────────────────────────────────────────────────────────
  {
    keyword: "cortisol and stress",
    keywordType: "pillar",
    funnelStage: "tofu",
    monetizationTag: "academy",
    priority: 1,
    notes: "Pillar page — hub for all stress/cortisol content. Pedram's angle: Taoist nervous system regulation, HPA axis, adrenal recovery, qigong as cortisol reset. Target: 'The Complete Guide to Cortisol and Stress'.",
  },

  // ── Cluster — Educational / TOFU ────────────────────────────────────────────
  {
    keyword: "cortisol levels",
    keywordType: "cluster",
    funnelStage: "tofu",
    monetizationTag: "academy",
    priority: 2,
    notes: "Highest-volume entry point — what cortisol is, normal ranges, how to test. Strong awareness post linking to pillar.",
  },
  {
    keyword: "chronic stress symptoms",
    keywordType: "cluster",
    funnelStage: "tofu",
    monetizationTag: "free_lead",
    priority: 3,
    notes: "Problem-aware content — symptom checklist format; strong lead magnet CTA (stress quiz or free guide).",
  },
  {
    keyword: "how to reduce cortisol",
    keywordType: "cluster",
    funnelStage: "tofu",
    monetizationTag: "academy",
    priority: 4,
    notes: "High-intent educational query — Pedram's protocol: qigong, breathwork, cold exposure, sleep timing. Differentiates from generic listicles.",
  },
  {
    keyword: "adrenal fatigue",
    keywordType: "cluster",
    funnelStage: "tofu",
    monetizationTag: "testing",
    priority: 5,
    notes: "Massive search volume — bridges to functional medicine testing (cortisol panels, DUTCH test). Explore tier upsell.",
  },
  {
    keyword: "stress and inflammation",
    keywordType: "cluster",
    funnelStage: "tofu",
    monetizationTag: "academy",
    priority: 6,
    notes: "Science-forward post — HPA-immune axis; connects stress to gut health and sleep pillars.",
  },
  {
    keyword: "signs of high cortisol",
    keywordType: "cluster",
    funnelStage: "tofu",
    monetizationTag: "free_lead",
    priority: 7,
    notes: "Diagnostic query — symptom-based content drives quiz/lead magnet conversions.",
  },
  {
    keyword: "stress and gut health",
    keywordType: "cluster",
    funnelStage: "mofu",
    monetizationTag: "academy",
    priority: 8,
    notes: "Cross-links gut health pillar — stress-gut axis (vagus nerve, leaky gut, microbiome disruption). Strong Academy differentiator.",
  },
  {
    keyword: "cortisol weight gain",
    keywordType: "cluster",
    funnelStage: "mofu",
    monetizationTag: "academy",
    priority: 9,
    notes: "High commercial intent — belly fat, metabolic syndrome, cortisol-insulin connection. Bridges to Lights On course.",
  },
  {
    keyword: "adaptogens for stress",
    keywordType: "cluster",
    funnelStage: "mofu",
    monetizationTag: "supplements",
    priority: 10,
    notes: "Direct supplement store driver — ashwagandha, rhodiola, holy basil. Review-style post with product links.",
  },
  {
    keyword: "breathing exercises for anxiety",
    keywordType: "cluster",
    funnelStage: "mofu",
    monetizationTag: "academy",
    priority: 11,
    notes: "Pedram's core competency — qigong breathing, box breathing, 4-7-8. Academy differentiator vs generic wellness.",
  },
  {
    keyword: "how to lower cortisol naturally",
    keywordType: "cluster",
    funnelStage: "mofu",
    monetizationTag: "supplements",
    priority: 12,
    notes: "Protocol + supplement hybrid — natural interventions list; supplement CTA at bottom.",
  },
  {
    keyword: "stress and sleep connection",
    keywordType: "cluster",
    funnelStage: "mofu",
    monetizationTag: "academy",
    priority: 13,
    notes: "Cross-links sleep pillar — cortisol disrupts sleep architecture; bridges both topic clusters.",
  },
  {
    keyword: "cortisol test at home",
    keywordType: "cluster",
    funnelStage: "mofu",
    monetizationTag: "testing",
    priority: 14,
    notes: "Explore tier upsell — DUTCH test, saliva cortisol panels. Functional medicine positioning.",
  },
  {
    keyword: "nervous system regulation",
    keywordType: "cluster",
    funnelStage: "mofu",
    monetizationTag: "academy",
    priority: 15,
    notes: "Emerging high-volume topic — vagus nerve, parasympathetic activation, polyvagal theory. Pedram's Taoist framework is a strong differentiator.",
  },

  // ── Conversion — BOFU ────────────────────────────────────────────────────────
  {
    keyword: "stress management program",
    keywordType: "conversion",
    funnelStage: "bofu",
    monetizationTag: "academy",
    priority: 16,
    notes: "Direct Academy landing page keyword — high conversion intent; positions Lights On as the structured solution.",
  },
  {
    keyword: "urban monk stress course",
    keywordType: "conversion",
    funnelStage: "bofu",
    monetizationTag: "academy",
    priority: 17,
    notes: "Brand + topic — captures existing audience searching for Pedram's stress approach.",
  },
  {
    keyword: "functional medicine stress treatment",
    keywordType: "conversion",
    funnelStage: "bofu",
    monetizationTag: "academy",
    priority: 18,
    notes: "High-intent searcher — positions Pedram as the authority practitioner for HPA axis dysfunction.",
  },
  {
    keyword: "cortisol reset protocol",
    keywordType: "conversion",
    funnelStage: "bofu",
    monetizationTag: "academy",
    priority: 19,
    notes: "Protocol framing — positions Academy as the structured, science-backed cortisol recovery system.",
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
      ["cortisol and stress", userId]
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
        "Stress & Cortisol Authority",
        "cortisol and stress",
        "academy",
        "Own the stress and cortisol topic space to drive Urban Monk Academy (Lights On course) memberships and supplement sales. Pedram's unique angle: Taoist nervous system regulation, HPA axis recovery, qigong as cortisol reset, vagus nerve activation, and the stress-gut-sleep triangle.",
        "active",
      ]
    );
    const campaignId = campResult.insertId;
    console.log(`✓ Created campaign "Stress & Cortisol Authority" (id=${campaignId})`);

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
    console.log('  Next: run node scripts/enrich-stress-volumes.mjs to fetch DataForSEO volumes.');
  } finally {
    await conn.end();
  }
}

main().catch((err) => {
  console.error("Seed failed:", err.message);
  process.exit(1);
});
