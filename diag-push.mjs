import "dotenv/config";
import mysql from "mysql2/promise";

const conn = await mysql.createConnection(process.env.DATABASE_URL);

// Check approved articles and their URLs
const [rows] = await conn.execute(
  `SELECT id, title, url, status, commentary IS NOT NULL as has_commentary, 
          LEFT(url, 100) as url_preview
   FROM newsfeed_articles 
   WHERE status = 'approved' 
   ORDER BY id DESC 
   LIMIT 10`
);

console.log("=== Approved articles ===");
for (const row of rows) {
  console.log(`ID: ${row.id} | URL: ${row.url_preview} | Has commentary: ${row.has_commentary}`);
}

// Also check recent articles regardless of status
const [recent] = await conn.execute(
  `SELECT id, title, url, status, LEFT(url, 120) as url_preview
   FROM newsfeed_articles 
   ORDER BY id DESC 
   LIMIT 5`
);
console.log("\n=== Most recent articles (any status) ===");
for (const row of recent) {
  console.log(`ID: ${row.id} | Status: ${row.status} | URL: ${row.url_preview}`);
}

await conn.end();
