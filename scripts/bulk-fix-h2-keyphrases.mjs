/**
 * Bulk H2 Keyphrase Backfill Script
 * Scans all published blog posts in the DB, finds those where the focus keyphrase
 * is missing from all H2 headings, rewrites the 3rd H2 to include it, saves to DB,
 * and pushes the updated HTML to WordPress.
 *
 * Usage:
 *   node scripts/bulk-fix-h2-keyphrases.mjs          # live run
 *   node scripts/bulk-fix-h2-keyphrases.mjs --dry-run # preview only
 */

import "dotenv/config";
import mysql from "mysql2/promise";
import { marked } from "marked";

const DRY_RUN = process.argv.includes("--dry-run");

// ─── WordPress helpers ────────────────────────────────────────────────────────
const WP_BASE = (process.env.WORDPRESS_URL ?? "").replace(/\/$/, "");
const WP_AUTH = "Basic " + Buffer.from(
  `${process.env.WORDPRESS_USERNAME}:${process.env.WORDPRESS_APP_PASSWORD}`
).toString("base64");

async function updateWpPostContent(wpPostId, htmlContent) {
  const res = await fetch(`${WP_BASE}/wp-json/wp/v2/posts/${wpPostId}`, {
    method: "POST",
    headers: { Authorization: WP_AUTH, "Content-Type": "application/json" },
    body: JSON.stringify({ content: htmlContent }),
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`WP update failed (${res.status}): ${text.slice(0, 200)}`);
  }
  return true;
}

// ─── Markdown → HTML (minimal, mirrors wpContentUtils.markdownToWpHtml) ──────
function markdownToHtml(md) {
  return marked.parse(md, { breaks: true });
}

// ─── H2 keyphrase fix logic (mirrors Step 2c in blog.publish) ────────────────
function fixH2Keyphrase(body, focusKeyword) {
  const kw = focusKeyword.toLowerCase();
  const h2Regex = /^## .+$/gm;
  const h2Matches = Array.from(body.matchAll(h2Regex));
  const keyphraseInH2 = h2Matches.some((m) => m[0].toLowerCase().includes(kw));
  if (keyphraseInH2 || h2Matches.length < 2) return null; // nothing to fix

  const targetIndex = h2Matches.length >= 3 ? 2 : 1;
  const originalH2 = h2Matches[targetIndex][0];
  const headingText = originalH2.replace(/^## /, "").trim();
  const kwCapitalised = focusKeyword.charAt(0).toUpperCase() + focusKeyword.slice(1);
  const newHeading = `## ${kwCapitalised}: ${headingText}`;
  const finalHeading = newHeading.length <= 80 ? newHeading : `## How ${kwCapitalised} ${headingText}`;
  const escapedOriginal = originalH2.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const patchedBody = body.replace(new RegExp(escapedOriginal, "m"), finalHeading);
  return { patchedBody, originalH2, finalHeading };
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log(`\n🔧 Bulk H2 Keyphrase Backfill${DRY_RUN ? " (DRY RUN)" : ""}\n`);

  const conn = await mysql.createConnection(process.env.DATABASE_URL);

  const [rows] = await conn.execute(
    `SELECT id, title, textContent, focusKeyword, wpPostId
     FROM content_items
     WHERE platform = 'blog'
       AND status = 'published'
       AND wpPostId IS NOT NULL
       AND textContent IS NOT NULL
       AND focusKeyword IS NOT NULL
     ORDER BY createdAt DESC`
  );

  console.log(`Found ${rows.length} published blog posts to check.\n`);

  let fixed = 0, alreadyOk = 0, skipped = 0, errors = 0;
  const fixedList = [];

  for (const row of rows) {
    const { id, title, textContent: body, focusKeyword: focusKw, wpPostId } = row;

    const result = fixH2Keyphrase(body, focusKw);

    if (!result) {
      alreadyOk++;
      continue;
    }

    const { patchedBody, originalH2, finalHeading } = result;
    const patchedHtml = markdownToHtml(patchedBody);

    console.log(`[FIX] "${title}" (DB#${id}, WP#${wpPostId})`);
    console.log(`  "${originalH2}" → "${finalHeading}"`);

    if (!DRY_RUN) {
      try {
        // Update DB
        await conn.execute(
          `UPDATE content_items SET textContent = ? WHERE id = ?`,
          [patchedBody, id]
        );
        // Update WordPress
        await updateWpPostContent(wpPostId, patchedHtml);
        fixed++;
        fixedList.push({ id, title, wpPostId, from: originalH2, to: finalHeading });
        console.log(`  ✅ Done`);
      } catch (err) {
        errors++;
        console.error(`  ❌ Error: ${err.message}`);
      }
    } else {
      fixed++;
      fixedList.push({ id, title, wpPostId, from: originalH2, to: finalHeading });
      console.log(`  (dry run — no changes made)`);
    }
  }

  await conn.end();

  console.log(`\n─── Summary ───────────────────────────────────────────────`);
  console.log(`Total posts checked:  ${rows.length}`);
  console.log(`Fixed${DRY_RUN ? " (would fix)" : ""}:             ${fixed}`);
  console.log(`Already OK:           ${alreadyOk}`);
  console.log(`Skipped:              ${skipped}`);
  console.log(`Errors:               ${errors}`);
  if (DRY_RUN) console.log(`\n(Re-run without --dry-run to apply changes)`);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
