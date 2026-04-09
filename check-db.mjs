import mysql from "mysql2/promise";
import * as dotenv from "dotenv";
dotenv.config();

const conn = await mysql.createConnection(process.env.DATABASE_URL);

// Check all content items - show id, title, platform, status, and whether textContent is populated
const [rows] = await conn.execute(
  `SELECT id, title, platform, status, 
   CASE WHEN textContent IS NULL THEN 'NULL' 
        WHEN textContent = '' THEN 'EMPTY'
        ELSE CONCAT('HAS_CONTENT(', CHAR_LENGTH(textContent), ' chars)')
   END as textContentStatus,
   CASE WHEN imageUrl IS NULL THEN 'NULL' ELSE 'HAS_IMAGE' END as imageStatus,
   createdAt
   FROM content_items 
   ORDER BY id DESC 
   LIMIT 30`
);

console.log("=== Content Items in Database ===");
console.table(rows);

// Count totals
const [counts] = await conn.execute(
  `SELECT 
    COUNT(*) as total,
    SUM(CASE WHEN textContent IS NOT NULL AND textContent != '' THEN 1 ELSE 0 END) as withContent,
    SUM(CASE WHEN textContent IS NULL OR textContent = '' THEN 1 ELSE 0 END) as withoutContent
   FROM content_items`
);
console.log("\n=== Summary ===");
console.table(counts);

// Show a sample of the actual textContent for the most recent item that has it
const [sample] = await conn.execute(
  `SELECT id, title, platform, LEFT(textContent, 300) as contentPreview
   FROM content_items 
   WHERE textContent IS NOT NULL AND textContent != ''
   ORDER BY id DESC 
   LIMIT 3`
);
console.log("\n=== Sample Content (first 300 chars) ===");
console.table(sample);

await conn.end();
