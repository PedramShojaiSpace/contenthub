import { getDb } from "./server/db";
import { sql } from "drizzle-orm";

async function main() {
  const db = await getDb();
  const rows = await db.execute(sql`SELECT id, kt_keyword, kt_keyword_type, kt_published_url, kt_content_status FROM keyword_targets WHERE kt_keyword_type = 'pillar' LIMIT 10`);
  const targets = (rows as any).rows || rows;
  console.log("Pillar keyword targets:");
  for (const row of targets as any[]) {
    console.log(JSON.stringify(row));
  }
}
main().catch(console.error);
