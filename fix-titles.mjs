import mysql from "mysql2/promise";
import * as dotenv from "dotenv";
dotenv.config();

const conn = await mysql.createConnection(process.env.DATABASE_URL);

// Find all items with messy titles (start with ## or are very long raw idea text)
const [rows] = await conn.execute(
  `SELECT id, title, platform, textContent FROM content_items WHERE title LIKE '##%' OR title LIKE 'Answer this%' OR CHAR_LENGTH(title) > 80`
);

console.log(`Found ${rows.length} items with messy titles to clean up:`);

for (const row of rows) {
  let cleanTitle = row.title;
  
  // Extract clean title from ## Content Brief: ... patterns
  const briefMatch = row.title.match(/##\s+(?:Urban Monk\s+)?Content Brief:\s*(.+?)(?:\n|$)/);
  if (briefMatch) {
    cleanTitle = briefMatch[1].trim();
    // Remove trailing quotes and punctuation
    cleanTitle = cleanTitle.replace(/["""'']+$/, '').trim();
    // Truncate to 120 chars
    if (cleanTitle.length > 120) cleanTitle = cleanTitle.substring(0, 117) + '...';
  }
  
  // Extract from "Answer this LLM search query for the persona..." patterns
  const answerMatch = row.title.match(/Answer this LLM search query for the persona "([^"]+)":\s*(.+?)(?:\?|$)/);
  if (answerMatch) {
    const persona = answerMatch[1];
    const query = answerMatch[2].trim();
    cleanTitle = `${query.substring(0, 80)} [${persona}]`;
  }
  
  // If still long, just truncate
  if (cleanTitle.length > 120) {
    cleanTitle = cleanTitle.substring(0, 117) + '...';
  }
  
  // Also try to extract from textContent if title is still messy
  if (cleanTitle.startsWith('##') && row.textContent) {
    // Try to get first non-empty line from textContent
    const lines = row.textContent.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('#'));
    if (lines.length > 0) {
      cleanTitle = lines[0].substring(0, 100);
    }
  }
  
  console.log(`\nID ${row.id} [${row.platform}]:`);
  console.log(`  OLD: ${row.title.substring(0, 80)}...`);
  console.log(`  NEW: ${cleanTitle}`);
  
  await conn.execute(
    `UPDATE content_items SET title = ? WHERE id = ?`,
    [cleanTitle, row.id]
  );
}

console.log(`\n✅ Updated ${rows.length} titles.`);
await conn.end();
