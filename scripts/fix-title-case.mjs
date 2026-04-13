import { createConnection } from "mysql2/promise";
import * as dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, "../.env") });

const LOWERCASE_WORDS = new Set([
  "a", "an", "the",
  "and", "but", "or", "nor", "for", "so", "yet",
  "as", "at", "by", "in", "of", "on", "to", "up",
  "via", "vs", "vs.",
]);

function toTitleCase(str) {
  // Skip strings that look like markdown/HTML content (## headers, long sentences)
  if (str.startsWith("##") || str.startsWith("<") || str.length > 120) return str;

  const words = str.split(/\s+/);
  let afterColon = false;

  return words
    .map((word, i) => {
      if (!word) return word;

      // Strip leading/trailing punctuation for comparison
      const core = word.replace(/^[^a-zA-Z0-9']+|[^a-zA-Z0-9']+$/g, "");
      const lower = core.toLowerCase();

      // Always capitalize: first word, last word, word after colon/em-dash
      const isFirst = i === 0;
      const isLast = i === words.length - 1;
      const shouldCapitalize = isFirst || isLast || afterColon || !LOWERCASE_WORDS.has(lower);

      // Track if next word should be capitalized (after colon or em-dash)
      afterColon = word.endsWith(":") || word.endsWith("—") || word.endsWith("-");

      if (!shouldCapitalize) return word.toLowerCase();

      // Capitalize the first alphabetic character in the word
      return word.replace(/([a-zA-Z])/, (m) => m.toUpperCase());
    })
    .join(" ");
}

async function main() {
  const conn = await createConnection(process.env.DATABASE_URL);

  // Only fix titles that are clearly lowercase (not already proper titles or markdown)
  const [rows] = await conn.execute(
    "SELECT id, title FROM content_items WHERE title NOT LIKE '##%' AND title NOT LIKE '<%' AND LENGTH(title) < 120"
  );
  console.log(`Found ${rows.length} content items to check.`);

  let updated = 0;
  for (const row of rows) {
    const fixed = toTitleCase(row.title.trim()).slice(0, 255);
    if (fixed !== row.title) {
      await conn.execute("UPDATE content_items SET title = ? WHERE id = ?", [fixed, row.id]);
      console.log(`  [${row.id}] "${row.title}"\n       → "${fixed}"`);
      updated++;
    }
  }

  console.log(`\nDone. Updated ${updated} of ${rows.length} titles.`);
  await conn.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
