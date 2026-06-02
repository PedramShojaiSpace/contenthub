import { createConnection } from 'mysql2/promise';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env' });

const conn = await createConnection(process.env.DATABASE_URL);

// 1. Check the ingest_reports rows for the recent pushes
const [ingests] = await conn.execute(
  'SELECT id, source, format, title, contentItemId, pushedAt FROM ingest_reports WHERE id IN (60023,60024,60025,60026,60027) ORDER BY id'
);
console.log('\n=== INGEST ROWS ===');
console.log(JSON.stringify(ingests, null, 2));

// 2. Check content_items linked via ingestReportId
const [byIngestId] = await conn.execute(
  'SELECT id, title, platform, status, ingestReportId FROM content_items WHERE ingestReportId IN (60023,60024,60025,60026,60027) ORDER BY ingestReportId'
);
console.log('\n=== CONTENT ITEMS (by ingestReportId) ===');
console.log(JSON.stringify(byIngestId, null, 2));

// 3. Check content_items linked via ingest_reports.contentItemId
const contentItemIds = ingests.filter(r => r.contentItemId).map(r => r.contentItemId);
if (contentItemIds.length > 0) {
  const placeholders = contentItemIds.map(() => '?').join(',');
  const [byContentItemId] = await conn.execute(
    `SELECT id, title, platform, status, ingestReportId FROM content_items WHERE id IN (${placeholders})`,
    contentItemIds
  );
  console.log('\n=== CONTENT ITEMS (by ingest_reports.contentItemId) ===');
  console.log(JSON.stringify(byContentItemId, null, 2));
}

// 4. Show the status distribution to understand what the Kanban shows
const [statuses] = await conn.execute(
  'SELECT platform, status, COUNT(*) as cnt FROM content_items GROUP BY platform, status ORDER BY cnt DESC LIMIT 30'
);
console.log('\n=== STATUS DISTRIBUTION ===');
console.log(JSON.stringify(statuses, null, 2));

// 5. Check the most recent content items created to see where they land
const [recent] = await conn.execute(
  'SELECT id, title, platform, status, ingestReportId, createdAt FROM content_items ORDER BY createdAt DESC LIMIT 20'
);
console.log('\n=== MOST RECENT CONTENT ITEMS ===');
console.log(JSON.stringify(recent, null, 2));

await conn.end();
