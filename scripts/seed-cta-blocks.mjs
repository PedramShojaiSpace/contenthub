/**
 * Seed new CTA blocks into the database.
 * Run: node scripts/seed-cta-blocks.mjs
 */
import "dotenv/config";
import mysql from "mysql2/promise";

const conn = await mysql.createConnection(process.env.DATABASE_URL);

const NEW_BLOCKS = [
  {
    label: "Upstream Course",
    ctaText: "If you're serious about fixing your gut for good — not just managing symptoms — the Upstream program is the most comprehensive gut health curriculum Dr. Pedram Shojai has ever built. It covers the microbiome, leaky gut, the oral-gut-brain axis, and the testing protocols that actually show you what's happening. Visit upstream.theurbanmonk.com to get started.",
    url: "https://upstream.theurbanmonk.com/",
    keywords: JSON.stringify(["upstream", "gut course", "gut program", "microbiome course", "leaky gut program", "gut healing", "gut protocol", "oral gut brain", "gut curriculum"]),
    isDefault: false,
    active: true,
  },
  {
    label: "Lights On Course",
    ctaText: "The Lights On Method is Dr. Pedram Shojai's flagship program for reclaiming your energy, focus, and vitality. It's a practical, science-backed system built on 30 years of clinical practice and Taoist philosophy — designed for high-performers who are done running on empty. Visit lightson.theurbanmonk.com to enroll.",
    url: "https://lightson.theurbanmonk.com/",
    keywords: JSON.stringify(["lights on", "lights on course", "lights on method", "urban monk course", "energy course", "vitality program", "pedram course", "flagship program"]),
    isDefault: false,
    active: true,
  },
  {
    label: "Interconnected Documentary",
    ctaText: "The Interconnected documentary series explores the hidden connections between your gut, your brain, your immune system, and your environment. It's the film that changes how you see your health — and what you can actually do about it. Watch the free screening at the link below.",
    url: "https://theacademy.theurbanmonk.com/ic-interconnected-free-screening-Meta",
    keywords: JSON.stringify(["interconnected", "documentary", "film", "screening", "free screening", "gut brain connection", "immune system", "microbiome documentary", "health documentary", "watch"]),
    isDefault: false,
    active: true,
  },
  {
    label: "Lights On Webinar (Free)",
    ctaText: "Before you invest in any program, Dr. Pedram Shojai wants to show you exactly how the Lights On Method works — and why it's different from anything you've tried before. Reserve your free seat at the webinar and see the full framework. Visit the link below to register.",
    url: "https://theacademy.theurbanmonk.com/LightsOn-opt-in-The-Lights-On-Method",
    keywords: JSON.stringify(["lights on webinar", "free webinar", "lights on opt in", "lights on method webinar", "free training", "free class", "register", "webinar"]),
    isDefault: false,
    active: true,
  },
  {
    label: "Deep Sleep Webinar (Free)",
    ctaText: "Dr. Pedram Shojai is hosting a free masterclass on the science of deep, restorative sleep — covering the circadian protocols, nervous system resets, and supplement strategies that actually move the needle. Reserve your free seat at the link below.",
    url: "https://theacademy.theurbanmonk.com/dss-webinar-kajabi",
    keywords: JSON.stringify(["sleep webinar", "sleep masterclass", "restorative sleep", "deep sleep webinar", "sleep training", "free sleep class", "sleep register"]),
    isDefault: false,
    active: true,
  },
  {
    label: "Gateway to Health Test",
    ctaText: "Before you can fix your health, you need to know what's actually broken. The Gateway to Health test gives you a comprehensive picture of your metabolic, hormonal, and gut health — so you can stop guessing and start targeting. Visit gth.theurbanmonk.com to get tested.",
    url: "https://gth.theurbanmonk.com",
    keywords: JSON.stringify(["gateway to health", "health test", "testing", "lab test", "blood test", "metabolic test", "hormone test", "gut test", "kbmo", "gi map", "orobiome", "biomarkers", "functional testing"]),
    isDefault: false,
    active: true,
  },
];

// Get existing labels
const [existing] = await conn.query("SELECT label FROM cta_blocks");
const existingLabels = new Set(existing.map((r) => r.label));

let inserted = 0;
for (const block of NEW_BLOCKS) {
  if (existingLabels.has(block.label)) {
    console.log(`  SKIP (already exists): ${block.label}`);
    continue;
  }
  await conn.execute(
    "INSERT INTO cta_blocks (label, ctaText, url, keywords, isDefault, active, createdAt) VALUES (?, ?, ?, ?, ?, ?, NOW())",
    [block.label, block.ctaText, block.url, block.keywords, block.isDefault ? 1 : 0, block.active ? 1 : 0]
  );
  console.log(`  INSERTED: ${block.label} → ${block.url}`);
  inserted++;
}

console.log(`\nDone. ${inserted} new blocks inserted.`);
await conn.end();
