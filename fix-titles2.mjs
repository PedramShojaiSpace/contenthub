import mysql from "mysql2/promise";
import * as dotenv from "dotenv";
dotenv.config();

const conn = await mysql.createConnection(process.env.DATABASE_URL);

// Get all items and extract better titles from their textContent
const [rows] = await conn.execute(
  `SELECT id, title, platform, textContent FROM content_items WHERE textContent IS NOT NULL AND textContent != ''`
);

console.log(`Processing ${rows.length} items to extract better titles from content...`);

for (const row of rows) {
  const content = row.textContent || '';
  let betterTitle = null;
  
  // Strategy 1: Look for a headline/title in the content
  // Match patterns like "**Headline:** ...", "Title: ...", "# ...", or first bold text
  const headlineMatch = content.match(/(?:\*\*(?:Headline|Title|Hook)[:\s*]+\*?\*?)([^\n*]+)/i);
  if (headlineMatch) {
    betterTitle = headlineMatch[1].trim().replace(/\*+/g, '').trim();
  }
  
  // Strategy 2: For LinkedIn/Meta posts, grab first non-empty line that looks like a hook
  if (!betterTitle) {
    const lines = content.split('\n').map(l => l.trim()).filter(l => l && l.length > 20 && !l.startsWith('#') && !l.startsWith('-'));
    if (lines.length > 0) {
      betterTitle = lines[0].replace(/\*+/g, '').trim();
      if (betterTitle.length > 80) betterTitle = betterTitle.substring(0, 77) + '...';
    }
  }
  
  if (betterTitle && betterTitle !== row.title && betterTitle.length > 10) {
    console.log(`\nID ${row.id} [${row.platform}]:`);
    console.log(`  OLD: ${row.title.substring(0, 70)}`);
    console.log(`  NEW: ${betterTitle.substring(0, 70)}`);
    
    await conn.execute(
      `UPDATE content_items SET title = ? WHERE id = ?`,
      [betterTitle.substring(0, 255), row.id]
    );
  }
}

console.log(`\n✅ Done.`);

// Show final state
const [final] = await conn.execute(`SELECT id, platform, title FROM content_items ORDER BY id DESC LIMIT 20`);
console.log('\n=== Final Titles ===');
console.table(final);

await conn.end();
