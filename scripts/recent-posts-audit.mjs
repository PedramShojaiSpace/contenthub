import { createConnection } from 'mysql2/promise';
import { config } from 'dotenv';
config();

async function main() {
  const conn = await createConnection(process.env.DATABASE_URL);
  
  const [recent] = await conn.query(`
    SELECT id, title, status, wpPostId, focusKeyword, 
           LENGTH(yoastSeoTitle) as titleLen, LENGTH(yoastMetaDescription) as descLen,
           yoastSeoTitle, publishUrl, createdAt, updatedAt
    FROM content_items
    WHERE status = 'published'
    ORDER BY updatedAt DESC
    LIMIT 10
  `);
  
  console.log('=== 10 Most Recently Updated Published Posts ===');
  recent.forEach(p => {
    const tl = p.titleLen || 0;
    const titleStatus = !p.yoastSeoTitle ? 'MISSING' : tl > 70 ? 'RED' : tl > 60 ? 'AMBER' : 'GREEN';
    const wpId = p.wpPostId ? `WP#${p.wpPostId}` : 'NO-WP-ID';
    const updated = p.updatedAt ? new Date(Number(p.updatedAt)).toISOString() : 'unknown';
    console.log(`[${wpId}] ${p.title}`);
    console.log(`  Title[${tl}]:${titleStatus} | Desc[${p.descLen || 0}] | Keyphrase: ${p.focusKeyword || 'MISSING'}`);
    console.log(`  Updated: ${updated}`);
  });
  
  await conn.end();
}

main().catch(console.error);
