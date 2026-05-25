/**
 * Strip embedded <div class="um-cta-banner">...</div> HTML blocks from
 * all content_items.textContent fields. These were injected by an older
 * version of the blog pipeline and should not appear in the Markdown body.
 */
import mysql from "mysql2/promise";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, "../.env") });

const db = await mysql.createConnection(process.env.DATABASE_URL);

// Find all blog posts with embedded CTA HTML
const [rows] = await db.execute(
  `SELECT id, title, LENGTH(textContent) as len FROM content_items 
   WHERE textContent LIKE '%um-cta-banner%' AND platform = 'blog'`
);

console.log(`Found ${rows.length} posts with embedded CTA HTML`);

for (const row of rows) {
  // Fetch the full textContent
  const [[full]] = await db.execute(
    `SELECT textContent FROM content_items WHERE id = ?`,
    [row.id]
  );
  const original = full.textContent || "";
  
  // Strip the CTA HTML block (handles multi-line div)
  const cleaned = original
    .replace(/<div[^>]*class=["']um-cta-banner["'][\s\S]*?<\/div>\s*/gi, "")
    .trim();
  
  if (cleaned !== original) {
    const removed = original.length - cleaned.length;
    console.log(`  [FIX] ID ${row.id} "${row.title}" — removed ${removed} chars of CTA HTML`);
    await db.execute(
      `UPDATE content_items SET textContent = ? WHERE id = ?`,
      [cleaned, row.id]
    );
  } else {
    console.log(`  [SKIP] ID ${row.id} "${row.title}" — no change needed`);
  }
}

await db.end();
console.log("\nDone.");
