/**
 * Seed script: adds 5 Pedram-specific long-tail keywords to each of the
 * three existing campaigns (Gut Health, Sleep & Recovery, Stress & Cortisol).
 *
 * These are low-competition, high-conversion keywords that leverage Pedram's
 * unique methodology (Taoist framework, qigong, Urban Monk brand) where he
 * faces ZERO competition from Healthline/WebMD/Cleveland Clinic.
 *
 * Run: node scripts/seed-longtail-pedram.mjs
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
  if (!rows.length) throw new Error("No users found — log in first");
  return rows[0].id;
}

// ── Long-tail keywords by campaign pillar ────────────────────────────────────
// These are Pedram-specific: his methodology, brand, and unique angles.
// Competition = near zero. Rank in 30-60 days. Convert at 3-5x generic keywords.

const LONGTAIL_BY_PILLAR = {
  // ── Gut Health / Upstream ──────────────────────────────────────────────────
  "gut health": [
    {
      keyword: "taoist approach to gut health",
      keywordType: "cluster",
      funnelStage: "mofu",
      monetizationTag: "academy",
      priority: 50,
      notes: "Zero competition. Pedram's unique angle — Taoist five-element theory applied to digestive health. Immediate top-10 ranking potential. High Academy conversion.",
    },
    {
      keyword: "urban monk gut protocol",
      keywordType: "conversion",
      funnelStage: "bofu",
      monetizationTag: "academy",
      priority: 51,
      notes: "Brand + methodology keyword. Captures audience already familiar with Pedram. Direct Academy enrollment driver.",
    },
    {
      keyword: "qigong for digestion",
      keywordType: "cluster",
      funnelStage: "mofu",
      monetizationTag: "academy",
      priority: 52,
      notes: "Pedram's core competency. No mainstream competitor covers this. Ranks fast. Strong Academy differentiator.",
    },
    {
      keyword: "pedram shojai gut health",
      keywordType: "conversion",
      funnelStage: "bofu",
      monetizationTag: "academy",
      priority: 53,
      notes: "Name + topic brand keyword. Captures high-intent audience searching specifically for Pedram's approach.",
    },
    {
      keyword: "ancient chinese medicine gut health",
      keywordType: "cluster",
      funnelStage: "tofu",
      monetizationTag: "academy",
      priority: 54,
      notes: "Bridges TCM and modern gut science — Pedram's unique positioning. Low competition, growing search volume.",
    },
  ],

  // ── Sleep & Recovery ───────────────────────────────────────────────────────
  "sleep optimization": [
    {
      keyword: "qigong for sleep",
      keywordType: "cluster",
      funnelStage: "mofu",
      monetizationTag: "academy",
      priority: 50,
      notes: "Zero competition from mainstream health sites. Pedram's core practice. Ranks in 30 days. Strong Academy CTA.",
    },
    {
      keyword: "taoist sleep practices",
      keywordType: "cluster",
      funnelStage: "mofu",
      monetizationTag: "academy",
      priority: 51,
      notes: "Unique methodology keyword. No WebMD/Healthline competition. Positions Pedram as the authority on ancient sleep wisdom.",
    },
    {
      keyword: "urban monk sleep method",
      keywordType: "conversion",
      funnelStage: "bofu",
      monetizationTag: "academy",
      priority: 52,
      notes: "Brand + methodology. Captures audience familiar with Pedram. Direct Academy enrollment.",
    },
    {
      keyword: "pedram shojai sleep",
      keywordType: "conversion",
      funnelStage: "bofu",
      monetizationTag: "academy",
      priority: 53,
      notes: "Name + topic brand keyword. High intent. Immediate top-3 ranking potential.",
    },
    {
      keyword: "five element theory sleep",
      keywordType: "cluster",
      funnelStage: "tofu",
      monetizationTag: "academy",
      priority: 54,
      notes: "TCM five-element theory applied to sleep cycles. Unique content moat. Zero mainstream competition.",
    },
  ],

  // ── Stress & Cortisol ──────────────────────────────────────────────────────
  "cortisol and stress": [
    {
      keyword: "taoist stress management",
      keywordType: "cluster",
      funnelStage: "mofu",
      monetizationTag: "academy",
      priority: 50,
      notes: "Zero competition. Pedram's unique angle — Taoist philosophy applied to modern stress. Ranks fast. Academy differentiator.",
    },
    {
      keyword: "qigong for stress relief",
      keywordType: "cluster",
      funnelStage: "mofu",
      monetizationTag: "academy",
      priority: 51,
      notes: "Pedram's core practice. Growing search volume. No mainstream health site covers qigong specifically. Strong Academy CTA.",
    },
    {
      keyword: "urban monk cortisol reset",
      keywordType: "conversion",
      funnelStage: "bofu",
      monetizationTag: "academy",
      priority: 52,
      notes: "Brand + protocol keyword. Named protocol framing ('reset') drives Academy enrollment. Zero competition.",
    },
    {
      keyword: "pedram shojai stress",
      keywordType: "conversion",
      funnelStage: "bofu",
      monetizationTag: "academy",
      priority: 53,
      notes: "Name + topic brand keyword. Captures high-intent audience searching for Pedram's stress approach.",
    },
    {
      keyword: "ancient wisdom for modern stress",
      keywordType: "cluster",
      funnelStage: "tofu",
      monetizationTag: "academy",
      priority: 54,
      notes: "Bridges Pedram's brand promise (ancient wisdom + modern science). Unique positioning. Strong brand awareness content.",
    },
  ],
};

async function main() {
  const conn = await mysql.createConnection(parseDbUrl(DB_URL));

  try {
    const userId = await getOwnerId(conn);
    console.log(`✓ Owner user id: ${userId}`);

    let totalAdded = 0;

    for (const [pillarKeyword, keywords] of Object.entries(LONGTAIL_BY_PILLAR)) {
      // Find the campaign by pillar keyword
      const [campaigns] = await conn.execute(
        "SELECT id, kc_name FROM keyword_campaigns WHERE kc_pillar_keyword LIKE ? AND kc_user_id = ? LIMIT 1",
        [`%${pillarKeyword}%`, userId]
      );

      if (!campaigns.length) {
        console.warn(`⚠ No campaign found for pillar: "${pillarKeyword}" — skipping`);
        continue;
      }

      const campaign = campaigns[0];
      console.log(`\n📌 Campaign: "${campaign.kc_name}" (id=${campaign.id})`);

      for (const kw of keywords) {
        // Check if keyword already exists in this campaign
        const [existing] = await conn.execute(
          "SELECT id FROM keyword_targets WHERE kt_campaign_id = ? AND kt_keyword = ? LIMIT 1",
          [campaign.id, kw.keyword]
        );

        if (existing.length > 0) {
          console.log(`  ↩ Already exists: "${kw.keyword}"`);
          continue;
        }

        await conn.execute(
          `INSERT INTO keyword_targets
             (kt_campaign_id, kt_user_id, kt_keyword, kt_keyword_type, kt_funnel_stage,
              kt_monetization_tag, kt_content_status, kt_priority, kt_notes)
           VALUES (?, ?, ?, ?, ?, ?, 'not_started', ?, ?)`,
          [
            campaign.id,
            userId,
            kw.keyword,
            kw.keywordType,
            kw.funnelStage,
            kw.monetizationTag,
            kw.priority,
            kw.notes,
          ]
        );
        console.log(`  + ${kw.keywordType.padEnd(10)} [${kw.funnelStage.toUpperCase().padEnd(4)}] ${kw.keyword}`);
        totalAdded++;
      }
    }

    console.log(`\n✓ Added ${totalAdded} Pedram-specific long-tail keywords across all campaigns`);
    console.log("  Next: run node scripts/enrich-longtail-volumes.mjs to fetch DataForSEO volumes.");
  } finally {
    await conn.end();
  }
}

main().catch((err) => {
  console.error("Seed failed:", err.message);
  process.exit(1);
});
