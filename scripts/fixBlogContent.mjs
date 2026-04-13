/**
 * fixBlogContent.mjs
 * One-time cleanup script:
 * 1. Strips TL;DR blockquote blocks from blog post textContent
 * 2. Replaces all occurrences of urbanmonk.com/academy (and variants) with theurbanmonk.com
 * 3. Removes hashtag lines (lines starting with #hashtag patterns at end of content)
 * 4. Updates ctaBlocks table to fix wrong URLs
 *
 * Run: node scripts/fixBlogContent.mjs
 */

import "dotenv/config";
import mysql from "mysql2/promise";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("DATABASE_URL not set");
  process.exit(1);
}

const connection = await mysql.createConnection(DATABASE_URL);

// ── 1. Fix ctaBlocks table ────────────────────────────────────────────────────
console.log("\n[1] Fixing ctaBlocks table...");
const [ctaRows] = await connection.execute(
  "SELECT id, label, ctaText, url FROM cta_blocks WHERE url LIKE '%urbanmonk.com/academy%' OR ctaText LIKE '%urbanmonk.com/academy%'"
);
console.log(`   Found ${ctaRows.length} CTA blocks with wrong URLs`);
for (const row of ctaRows) {
  const newUrl = "https://theurbanmonk.com";
  const newText = row.ctaText
    .replace(/https?:\/\/urbanmonk\.com\/academy/g, "https://theurbanmonk.com")
    .replace(/urbanmonk\.com\/academy/g, "theurbanmonk.com");
  await connection.execute(
    "UPDATE cta_blocks SET url = ?, ctaText = ? WHERE id = ?",
    [newUrl, newText, row.id]
  );
  console.log(`   Fixed CTA block: "${row.label}"`);
}

// ── 2. Fix blog post textContent ─────────────────────────────────────────────
console.log("\n[2] Fixing blog post textContent...");
const [blogRows] = await connection.execute(
  "SELECT id, title, textContent FROM content_items WHERE platform = 'blog' AND textContent IS NOT NULL"
);
console.log(`   Found ${blogRows.length} blog posts to check`);

let fixedCount = 0;
for (const row of blogRows) {
  let content = row.textContent;
  let changed = false;

  // Remove TL;DR blockquote block (> **TL;DR:** ... up to the next blank line or heading)
  const tldrPattern = /^>\s*\*\*TL;DR:\*\*.*?(?=\n\n|\n##|\n###|\z)/gms;
  if (tldrPattern.test(content)) {
    content = content.replace(tldrPattern, "").replace(/\n{3,}/g, "\n\n").trim();
    changed = true;
    console.log(`   Removed TL;DR block from: "${row.title}"`);
  }

  // Fix wrong URLs
  if (content.includes("urbanmonk.com/academy") || content.includes("https://urbanmonk.com")) {
    // Fix mismatched markdown links like [urbanmonk.com/academy](https://theurbanmonk.com)
    content = content.replace(
      /\[urbanmonk\.com\/academy\]\(https?:\/\/[^)]+\)/g,
      "[theurbanmonk.com](https://theurbanmonk.com)"
    );
    // Fix plain URLs
    content = content.replace(/https?:\/\/urbanmonk\.com\/academy/g, "https://theurbanmonk.com");
    content = content.replace(/https?:\/\/urbanmonk\.com(?!\w)/g, "https://theurbanmonk.com");
    content = content.replace(/\burbanmonk\.com\/academy\b/g, "theurbanmonk.com");
    changed = true;
    console.log(`   Fixed wrong URL in: "${row.title}"`);
  }

  // Remove trailing hashtag lines (social media hashtags that leaked into blog posts)
  // Pattern: lines that are purely hashtags like "#guthealth #microbiome" at the end
  const hashtagLinePattern = /\n+((?:#\w+\s*)+)\s*$/g;
  if (hashtagLinePattern.test(content)) {
    content = content.replace(/\n+((?:#\w+\s*)+)\s*$/g, "").trim();
    changed = true;
    console.log(`   Removed trailing hashtags from: "${row.title}"`);
  }

  // Remove "As featured in The New York Times" type fabricated citations
  const fabricatedCitations = [
    /As featured in \*?The New York Times\*?[.,]?/gi,
    /As seen in \*?The New York Times\*?[.,]?/gi,
    /As featured in \*?[A-Z][^*\n]+\*?[.,]?(?= this)/gi,
  ];
  for (const pattern of fabricatedCitations) {
    if (pattern.test(content)) {
      content = content.replace(pattern, "");
      changed = true;
      console.log(`   Removed fabricated citation from: "${row.title}"`);
    }
  }

  if (changed) {
    await connection.execute(
      "UPDATE content_items SET textContent = ? WHERE id = ?",
      [content, row.id]
    );
    fixedCount++;
  }
}

console.log(`\n   Fixed ${fixedCount} of ${blogRows.length} blog posts`);

await connection.end();
console.log("\n✅ Blog content cleanup complete.");
