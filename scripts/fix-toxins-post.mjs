/**
 * Fix the "Toxins & Fatigue" post that has raw JSON stored as its textContent.
 * Extracts the article body from the JSON blob and updates the DB record.
 */
import mysql from "mysql2/promise";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, "../.env") });

const db = await mysql.createConnection(process.env.DATABASE_URL);

// Find all posts where textContent looks like a JSON blob
const [rows] = await db.execute(
  `SELECT id, title, status, wpPostId, textContent FROM content_items 
   WHERE textContent LIKE '%"article"%' AND textContent LIKE '%"focusKeyword"%'
   LIMIT 20`
);

console.log(`Found ${rows.length} posts with potential JSON blob content`);

for (const row of rows) {
  const raw = row.textContent || "";
  if (!raw.startsWith("{") && !raw.startsWith("```")) {
    console.log(`  [SKIP] ID ${row.id} "${row.title}" — doesn't look like JSON`);
    continue;
  }

  console.log(`\n[FIXING] ID ${row.id} "${row.title}"`);
  console.log(`  Content length: ${raw.length} chars`);
  console.log(`  Preview: ${raw.substring(0, 100)}`);

  // Try to extract the article field
  const extracted = extractArticleFromJson(raw);
  if (extracted) {
    console.log(`  ✓ Extracted article: ${extracted.length} chars`);
    console.log(`  Preview: ${extracted.substring(0, 150)}`);

    // Also extract metadata fields if available
    let focusKeyword = null;
    let seoTitle = null;
    let metaDesc = null;
    try {
      const stripped = raw.replace(/^```+\s*json\s*\n?/i, "").replace(/\n?```+\s*$/i, "").trim();
      const parsed = JSON.parse(stripped);
      focusKeyword = parsed.focusKeyword || null;
      seoTitle = parsed.seoTitle || parsed.title || null;
      metaDesc = parsed.metaDescription || null;
    } catch {
      // JSON.parse failed — metadata not extractable
    }

    // Update the record
    await db.execute(
      `UPDATE content_items SET textContent = ?, focusKeyword = COALESCE(?, focusKeyword), yoastSeoTitle = COALESCE(?, yoastSeoTitle), yoastMetaDescription = COALESCE(?, yoastMetaDescription) WHERE id = ?`,
      [extracted, focusKeyword, seoTitle, metaDesc, row.id]
    );
    console.log(`  ✓ Updated DB record for ID ${row.id}`);
  } else {
    console.log(`  ✗ Could not extract article from JSON blob`);
  }
}

await db.end();
console.log("\nDone.");

// ── Extraction logic (mirrors the server-side function) ──────────────────────
function extractArticleFromJson(raw) {
  try {
    const stripped = raw
      .replace(/^```+\s*json\s*\n?/i, "")
      .replace(/^```+\s*\n?/i, "")
      .replace(/\n?```+\s*$/i, "")
      .trim();

    // Strategy 1: JSON.parse
    try {
      const firstBrace = stripped.indexOf("{");
      const lastBrace = stripped.lastIndexOf("}");
      if (firstBrace !== -1 && lastBrace !== -1) {
        const jsonStr = stripped.slice(firstBrace, lastBrace + 1);
        const parsed = JSON.parse(jsonStr);
        if (parsed.article && typeof parsed.article === "string" && parsed.article.length > 200) {
          return parsed.article;
        }
      }
    } catch {
      // fall through
    }

    // Strategy 2: Character walk
    const articleKeyMatch = stripped.match(/"article"\s*:\s*"/);
    if (articleKeyMatch && articleKeyMatch.index !== undefined) {
      const valueStart = articleKeyMatch.index + articleKeyMatch[0].length;
      let i = valueStart;
      let result = "";
      while (i < stripped.length) {
        const ch = stripped[i];
        if (ch === "\\" && i + 1 < stripped.length) {
          const next = stripped[i + 1];
          if (next === "n") { result += "\n"; i += 2; continue; }
          if (next === "t") { result += "\t"; i += 2; continue; }
          if (next === "\\") { result += "\\"; i += 2; continue; }
          if (next === '"') { result += '"'; i += 2; continue; }
          result += next; i += 2; continue;
        }
        if (ch === '"') break;
        result += ch;
        i++;
      }
      if (result.length > 200) return result;
    }

    // Strategy 3: Find "article": then grab until next top-level key
    const articleKeyIdx = stripped.indexOf('"article":');
    if (articleKeyIdx !== -1) {
      const openQuoteIdx = stripped.indexOf('"', articleKeyIdx + '"article":'.length);
      if (openQuoteIdx !== -1) {
        const afterValue = stripped.slice(openQuoteIdx + 1);
        const nextKeyMatch = afterValue.match(/\n\s{0,4}"[a-zA-Z]+"\s*:/);
        if (nextKeyMatch && nextKeyMatch.index !== undefined) {
          const candidateEnd = nextKeyMatch.index;
          const commaIdx = afterValue.lastIndexOf(',', candidateEnd);
          const endIdx = commaIdx !== -1 ? commaIdx : candidateEnd;
          let articleValue = afterValue.slice(0, endIdx);
          if (articleValue.endsWith('"')) articleValue = articleValue.slice(0, -1);
          articleValue = articleValue
            .replace(/\\n/g, "\n")
            .replace(/\\t/g, "\t")
            .replace(/\\\\/g, "\\")
            .replace(/\\"/g, '"');
          if (articleValue.length > 200) return articleValue;
        } else {
          let articleValue = afterValue;
          articleValue = articleValue.replace(/"?\s*\}\s*$/, "");
          if (articleValue.endsWith('"')) articleValue = articleValue.slice(0, -1);
          articleValue = articleValue
            .replace(/\\n/g, "\n")
            .replace(/\\t/g, "\t")
            .replace(/\\\\/g, "\\")
            .replace(/\\"/g, '"');
          if (articleValue.length > 200) return articleValue;
        }
      }
    }

    return null;
  } catch {
    return null;
  }
}
