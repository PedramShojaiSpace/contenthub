import { createConnection } from 'mysql2/promise';
import { config } from 'dotenv';
config();

async function main() {
  const conn = await createConnection(process.env.DATABASE_URL);

  // 1. WP Post ID coverage
  const [wpIds] = await conn.query(`
    SELECT 
      COUNT(*) AS total_published,
      SUM(CASE WHEN wpPostId IS NOT NULL THEN 1 ELSE 0 END) AS has_wp_id,
      SUM(CASE WHEN wpPostId IS NULL THEN 1 ELSE 0 END) AS missing_wp_id
    FROM content_items
    WHERE status = 'published'
  `);
  console.log('=== WP Post ID Coverage ===');
  console.log(JSON.stringify(wpIds[0], null, 2));

  // 2. SEO field length violations
  const [seoViolations] = await conn.query(`
    SELECT 
      COUNT(*) AS total,
      SUM(CASE WHEN LENGTH(yoastSeoTitle) > 60 THEN 1 ELSE 0 END) AS title_over_60,
      SUM(CASE WHEN LENGTH(yoastSeoTitle) > 70 THEN 1 ELSE 0 END) AS title_over_70,
      SUM(CASE WHEN LENGTH(yoastMetaDescription) > 160 THEN 1 ELSE 0 END) AS desc_over_160,
      SUM(CASE WHEN yoastSeoTitle IS NULL OR yoastSeoTitle = '' THEN 1 ELSE 0 END) AS missing_title,
      SUM(CASE WHEN yoastMetaDescription IS NULL OR yoastMetaDescription = '' THEN 1 ELSE 0 END) AS missing_desc,
      SUM(CASE WHEN focusKeyword IS NULL OR focusKeyword = '' THEN 1 ELSE 0 END) AS missing_keyphrase
    FROM content_items
    WHERE status = 'published'
  `);
  console.log('\n=== SEO Field Length Violations (published posts) ===');
  console.log(JSON.stringify(seoViolations[0], null, 2));

  // 3. Posts still missing wpPostId
  const [missingIds] = await conn.query(`
    SELECT id, title, wpPostId, yoastSeoTitle, 
           LENGTH(yoastSeoTitle) as titleLen, 
           LENGTH(yoastMetaDescription) as descLen
    FROM content_items
    WHERE status = 'published' AND wpPostId IS NULL
    ORDER BY createdAt DESC
  `);
  console.log('\n=== Posts Missing WP Post ID ===');
  if (missingIds.length === 0) {
    console.log('✅ All published posts have a WP Post ID!');
  } else {
    missingIds.forEach(p => console.log(`  - [${p.id}] ${p.title}`));
  }

  // 4. Posts with oversized SEO titles
  const [longTitles] = await conn.query(`
    SELECT id, title, yoastSeoTitle, LENGTH(yoastSeoTitle) as titleLen
    FROM content_items
    WHERE status = 'published' AND LENGTH(yoastSeoTitle) > 60
    ORDER BY titleLen DESC
  `);
  console.log('\n=== Posts with SEO Title > 60 chars ===');
  if (longTitles.length === 0) {
    console.log('✅ All SEO titles are within 60 chars!');
  } else {
    longTitles.forEach(p => console.log(`  [${p.titleLen}] ${p.title}\n       → "${p.yoastSeoTitle}"`));
  }

  // 5. Posts with oversized meta descriptions
  const [longDescs] = await conn.query(`
    SELECT id, title, LENGTH(yoastMetaDescription) as descLen, 
           SUBSTRING(yoastMetaDescription, 1, 80) as descPreview
    FROM content_items
    WHERE status = 'published' AND LENGTH(yoastMetaDescription) > 160
    ORDER BY descLen DESC
  `);
  console.log('\n=== Posts with Meta Description > 160 chars ===');
  if (longDescs.length === 0) {
    console.log('✅ All meta descriptions are within 160 chars!');
  } else {
    longDescs.forEach(p => console.log(`  [${p.descLen}] ${p.title}\n       → "${p.descPreview}..."`));
  }

  // 6. All published posts — full SEO snapshot
  const [allPosts] = await conn.query(`
    SELECT id, title, wpPostId, focusKeyword,
           yoastSeoTitle, LENGTH(yoastSeoTitle) as titleLen,
           LENGTH(yoastMetaDescription) as descLen,
           yoastScore, publishUrl
    FROM content_items
    WHERE status = 'published'
    ORDER BY createdAt DESC
  `);
  console.log('\n=== All Published Posts — SEO Snapshot ===');
  allPosts.forEach(p => {
    const titleStatus = !p.yoastSeoTitle ? '❌ MISSING' : p.titleLen > 70 ? '🔴 TOO LONG' : p.titleLen > 60 ? '🟡 AMBER' : '✅';
    const descStatus = !p.descLen ? '❌ MISSING' : p.descLen > 160 ? '🔴 TOO LONG' : '✅';
    const wpStatus = p.wpPostId ? `WP#${p.wpPostId}` : '❌ NO WP ID';
    console.log(`  [${wpStatus}] ${p.title}`);
    console.log(`    Title[${p.titleLen || 0}]: ${titleStatus} | Desc[${p.descLen || 0}]: ${descStatus} | Keyphrase: ${p.focusKeyword || '❌ MISSING'}`);
  });

  await conn.end();
}
main().catch(console.error);
