import { getDb } from "./server/db";
import { sql } from "drizzle-orm";

async function main() {
  const db = await getDb();
  
  // Check content items for gut health and sleep cluster posts
  const rows = await db.execute(sql`
    SELECT id, title, platform, status, wpPostId, publishUrl, focusKeyword
    FROM content_items 
    WHERE platform = 'blog' 
    AND (
      title LIKE '%gut%' OR title LIKE '%microbiome%' OR title LIKE '%leaky gut%' OR title LIKE '%probiotics%'
      OR title LIKE '%sleep%' OR title LIKE '%circadian%' OR title LIKE '%insomnia%' OR title LIKE '%melatonin%'
    )
    ORDER BY createdAt DESC
    LIMIT 30
  `);
  const items = (rows as any).rows || rows;
  console.log(`Found ${items.length} cluster posts:`);
  if (items.length > 0) console.log('Sample row:', JSON.stringify(items[0]).slice(0, 200));
  for (const item of items as any[]) {
    console.log(JSON.stringify(item).slice(0, 200));
  }
  
  // Also check keyword targets for cluster keywords
  const kwRows = await db.execute(sql`
    SELECT id, kt_keyword, kt_keyword_type, kt_content_status, kt_published_url
    FROM keyword_targets 
    WHERE kt_keyword_type = 'cluster'
    AND (kt_keyword LIKE '%gut%' OR kt_keyword LIKE '%sleep%' OR kt_keyword LIKE '%microbiome%' OR kt_keyword LIKE '%circadian%')
    LIMIT 20
  `);
  const kwItems = (kwRows as any).rows || kwRows;
  console.log(`\nFound ${kwItems.length} cluster keyword targets:`);
  for (const kw of kwItems as any[]) {
    console.log(`  ID:${kw.id} status:${kw.kt_content_status} keyword:"${kw.kt_keyword}" url:${kw.kt_published_url || 'null'}`);
  }
}
main().catch(console.error);
