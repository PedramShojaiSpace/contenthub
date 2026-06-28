import { getDb } from "./server/db";
import { sql } from "drizzle-orm";

async function main() {
  const db = await getDb();
  
  // Check ALL blog content items with their status
  const rows = await db.execute(sql`
    SELECT id, title, status, wpPostId, publishUrl, focusKeyword
    FROM content_items 
    WHERE platform = 'blog' 
    ORDER BY id DESC
    LIMIT 50
  `);
  const items = (rows as any).rows || rows;
  console.log(`Found ${items.length} blog posts total:`);
  for (const item of items as any[]) {
    if (Array.isArray(item)) {
      console.log(`  ID:${item[0]} status:${item[2]} wpId:${item[3] || 'null'} title:"${String(item[1]).slice(0, 60)}"`);
    } else {
      console.log(`  ID:${item.id} status:${item.status} wpId:${item.wpPostId || 'null'} title:"${String(item.title).slice(0, 60)}"`);
    }
  }
}
main().catch(console.error);
