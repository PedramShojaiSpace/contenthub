import "dotenv/config";
import { getDb } from "../server/db";
import { sql } from "drizzle-orm";

async function main() {
  const db = await getDb();
  if (!db) { console.log("No DB connection"); process.exit(1); }

  console.log("Adding 'upstream' to hlp_campaign enum...");
  await db.execute(sql`
    ALTER TABLE hosted_landing_pages
    MODIFY COLUMN hlp_campaign ENUM('lo','gut','sleep','webinar','upstream') NOT NULL DEFAULT 'lo'
  `);
  console.log("✅ Migration complete — 'upstream' added to hlp_campaign enum");
  process.exit(0);
}

main().catch((err) => { console.error("Migration failed:", err); process.exit(1); });
