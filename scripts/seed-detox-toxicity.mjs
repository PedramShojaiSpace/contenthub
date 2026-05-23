/**
 * Seed script: creates the "Detox & Toxicity Authority" keyword campaign
 * and populates it with a curated pillar + cluster + conversion keyword set.
 * Run: node scripts/seed-detox-toxicity.mjs
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
    keyword: "heavy metal detox",
    keywordType: "pillar",
    funnelStage: "tofu",
    monetizationTag: "academy",
    priority: 1,
    notes: "Pillar page — hub for all detox/toxicity content. Pedram's angle: Taoist purification practices, TCM liver support, modern environmental toxin burden, chelation vs natural detox. Target: 'The Complete Guide to Heavy Metal Detox'. Connects to Interconnected documentary CTA.",
  },

  // ── Cluster — Educational / TOFU ────────────────────────────────────────────
  {
    keyword: "how to detox your body naturally",
    keywordType: "cluster",
    funnelStage: "tofu",
    monetizationTag: "academy",
    priority: 2,
    notes: "Highest-volume entry point — what detox means, organ systems involved (liver, kidneys, lymph, skin), natural vs medical detox. Strong awareness post linking to pillar.",
  },
  {
    keyword: "environmental toxins",
    keywordType: "cluster",
    funnelStage: "tofu",
    monetizationTag: "academy",
    priority: 3,
    notes: "Broad awareness content — what environmental toxins are, where they come from (food, water, air, personal care), how they accumulate. Connects to Interconnected documentary narrative.",
  },
  {
    keyword: "signs of toxin buildup in body",
    keywordType: "cluster",
    funnelStage: "tofu",
    monetizationTag: "free_lead",
    priority: 4,
    notes: "Symptom-based diagnostic query — fatigue, brain fog, skin issues, joint pain as toxin signals. Strong lead magnet CTA (toxicity quiz or free guide).",
  },
  {
    keyword: "liver detox",
    keywordType: "cluster",
    funnelStage: "tofu",
    monetizationTag: "supplements",
    priority: 5,
    notes: "Massive search volume — TCM liver as the 'general of the army', phase I/II liver detoxification pathways, milk thistle, dandelion. Supplement store driver.",
  },
  {
    keyword: "glyphosate toxicity",
    keywordType: "cluster",
    funnelStage: "tofu",
    monetizationTag: "academy",
    priority: 6,
    notes: "High-awareness topic — Roundup/glyphosate in food supply, gut microbiome disruption, Pedram's Interconnected documentary angle. Strong content differentiator.",
  },
  {
    keyword: "mold toxicity symptoms",
    keywordType: "cluster",
    funnelStage: "tofu",
    monetizationTag: "testing",
    priority: 7,
    notes: "Emerging high-volume topic — mycotoxins, CIRS, brain fog, fatigue. Functional medicine testing upsell (mycotoxin panel).",
  },
  {
    keyword: "detox diet",
    keywordType: "cluster",
    funnelStage: "tofu",
    monetizationTag: "academy",
    priority: 8,
    notes: "Broad awareness — Pedram's angle: elimination diet vs juice cleanse, TCM seasonal cleansing, food as medicine. Differentiates from generic 'detox tea' content.",
  },
  {
    keyword: "BPA and plastics health effects",
    keywordType: "cluster",
    funnelStage: "tofu",
    monetizationTag: "academy",
    priority: 9,
    notes: "Endocrine disruptors — BPA, BPS, phthalates, microplastics. Connects to Interconnected documentary and modern toxin burden narrative.",
  },
  {
    keyword: "lymphatic drainage benefits",
    keywordType: "cluster",
    funnelStage: "mofu",
    monetizationTag: "academy",
    priority: 10,
    notes: "Detox pathway content — lymphatic system as the body's waste removal network; dry brushing, rebounding, qigong lymph flow. Academy differentiator.",
  },
  {
    keyword: "heavy metals in food",
    keywordType: "cluster",
    funnelStage: "mofu",
    monetizationTag: "testing",
    priority: 11,
    notes: "Specific exposure content — arsenic in rice, mercury in fish, lead in spices. Functional medicine testing upsell (heavy metals panel).",
  },
  {
    keyword: "how to remove heavy metals from body",
    keywordType: "cluster",
    funnelStage: "mofu",
    monetizationTag: "supplements",
    priority: 12,
    notes: "Protocol + supplement hybrid — cilantro/chlorella protocol, DMSA chelation overview, zeolite, activated charcoal. Supplement store driver.",
  },
  {
    keyword: "detox and gut health",
    keywordType: "cluster",
    funnelStage: "mofu",
    monetizationTag: "academy",
    priority: 13,
    notes: "Cross-links gut health pillar — leaky gut and toxin absorption, LPS endotoxemia, microbiome as detox organ. Strong Academy differentiator.",
  },
  {
    keyword: "infrared sauna detox",
    keywordType: "cluster",
    funnelStage: "mofu",
    monetizationTag: "academy",
    priority: 14,
    notes: "Biohacking-adjacent content — sweat as detox pathway, infrared vs traditional sauna, Pedram's Taoist sweating practices. High engagement topic.",
  },
  {
    keyword: "toxins and fatigue",
    keywordType: "cluster",
    funnelStage: "mofu",
    monetizationTag: "academy",
    priority: 15,
    notes: "Symptom-solution content — mitochondrial toxicity, heavy metals and energy production. Bridges to sleep and stress pillars.",
  },

  // ── Conversion — BOFU ────────────────────────────────────────────────────────
  {
    keyword: "natural detox program",
    keywordType: "conversion",
    funnelStage: "bofu",
    monetizationTag: "academy",
    priority: 16,
    notes: "Direct Academy landing page keyword — high conversion intent; positions Urban Monk Academy as the structured, science-backed detox solution.",
  },
  {
    keyword: "functional medicine detox protocol",
    keywordType: "conversion",
    funnelStage: "bofu",
    monetizationTag: "academy",
    priority: 17,
    notes: "High-intent searcher — positions Pedram as the authority practitioner for comprehensive toxin burden reduction.",
  },
  {
    keyword: "urban monk detox",
    keywordType: "conversion",
    funnelStage: "bofu",
    monetizationTag: "academy",
    priority: 18,
    notes: "Brand + topic — captures existing audience searching for Pedram's detox approach.",
  },
  {
    keyword: "interconnected documentary",
    keywordType: "conversion",
    funnelStage: "bofu",
    monetizationTag: "academy",
    priority: 19,
    notes: "Direct documentary CTA — Pedram's Interconnected film about environmental toxins. Highest conversion intent in this campaign.",
  },

  // ── Pedram-Specific Long-Tail (zero competition) ─────────────────────────────
  {
    keyword: "taoist approach to detox",
    keywordType: "cluster",
    funnelStage: "tofu",
    monetizationTag: "academy",
    priority: 20,
    notes: "Zero-competition Pedram-specific keyword — Taoist seasonal cleansing, five-element theory and organ detox cycles. Fast-ranking opportunity.",
  },
  {
    keyword: "qigong for detoxification",
    keywordType: "cluster",
    funnelStage: "tofu",
    monetizationTag: "academy",
    priority: 21,
    notes: "Zero-competition Pedram-specific keyword — qigong movements that stimulate liver, lymph, and kidney detox pathways. Fast-ranking opportunity.",
  },
  {
    keyword: "urban monk toxicity protocol",
    keywordType: "conversion",
    funnelStage: "bofu",
    monetizationTag: "academy",
    priority: 22,
    notes: "Zero-competition brand keyword — Pedram's specific detox protocol name. Captures brand-aware searchers.",
  },
  {
    keyword: "pedram shojai detox",
    keywordType: "conversion",
    funnelStage: "bofu",
    monetizationTag: "academy",
    priority: 23,
    notes: "Zero-competition brand keyword — direct name search for Pedram's detox content. Fast-ranking opportunity.",
  },
  {
    keyword: "ancient chinese medicine detox",
    keywordType: "cluster",
    funnelStage: "tofu",
    monetizationTag: "academy",
    priority: 24,
    notes: "Zero-competition Pedram-specific keyword — TCM liver and kidney cleansing herbs, seasonal detox practices. Fast-ranking opportunity.",
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
      ["heavy metal detox", userId]
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
        "Detox & Toxicity Authority",
        "heavy metal detox",
        "academy",
        "Own the detox and environmental toxicity topic space to drive Urban Monk Academy memberships, supplement sales, and Interconnected documentary views. Pedram's unique angle: Taoist purification practices, TCM liver/kidney support, modern environmental toxin burden (glyphosate, heavy metals, BPA, mold), and the toxin-gut-brain connection.",
        "active",
      ]
    );
    const campaignId = campResult.insertId;
    console.log(`✓ Created campaign "Detox & Toxicity Authority" (id=${campaignId})`);

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
    console.log('  Next: run node scripts/enrich-detox-volumes.mjs to fetch DataForSEO volumes.');
  } finally {
    await conn.end();
  }
}

main().catch((err) => {
  console.error("Seed failed:", err.message);
  process.exit(1);
});
