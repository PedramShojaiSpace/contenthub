/**
 * fix-schema-blocks.mjs
 *
 * Finds all WordPress posts that have the broken <!-- wp:html --> JSON-LD blocks
 * rendering as visible text (Classic Editor doesn't process Gutenberg blocks).
 * Strips the broken blocks from post content and saves the cleaned version.
 *
 * Run with: node scripts/fix-schema-blocks.mjs
 */

import "dotenv/config";

const WP_URL = process.env.WORDPRESS_URL;
const WP_USER = process.env.WORDPRESS_USERNAME;
const WP_PASS = process.env.WORDPRESS_APP_PASSWORD;

if (!WP_URL || !WP_USER || !WP_PASS) {
  console.error("Missing WORDPRESS_URL, WORDPRESS_USERNAME, or WORDPRESS_APP_PASSWORD");
  process.exit(1);
}

const authHeader = "Basic " + Buffer.from(`${WP_USER}:${WP_PASS}`).toString("base64");
const baseUrl = WP_URL.replace(/\/$/, "");

async function wpFetch(url, options = {}) {
  const res = await fetch(url, {
    ...options,
    headers: {
      Authorization: authHeader,
      "Content-Type": "application/json",
      ...(options.headers ?? {}),
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`WP API error ${res.status}: ${text.slice(0, 300)}`);
  }
  return res.json();
}

/**
 * Remove the broken <!-- wp:html --> JSON-LD blocks from post content.
 * These were injected by the old schema injection strategy and render as
 * visible preformatted text in Classic Editor.
 */
function cleanSchemaBlocks(content) {
  if (!content) return content;

  // Pattern 1: <!-- wp:html -->\n<script type="application/ld+json">...</script>\n<!-- /wp:html -->
  // The Classic Editor renders the <!-- wp:html --> wrapper as literal text,
  // exposing the raw JSON to readers.
  let cleaned = content;

  // Remove wp:html blocks containing JSON-LD script tags
  cleaned = cleaned.replace(
    /<!-- wp:html -->\s*<script type="application\/ld\+json">[\s\S]*?<\/script>\s*<!-- \/wp:html -->/gi,
    ""
  );

  // Also remove any bare <script type="application/ld+json"> blocks that may have leaked
  cleaned = cleaned.replace(
    /<script type="application\/ld\+json">[\s\S]*?<\/script>/gi,
    ""
  );

  // Clean up any double blank lines left behind
  cleaned = cleaned.replace(/\n{3,}/g, "\n\n").trim();

  return cleaned;
}

async function getAllPosts() {
  const posts = [];
  let page = 1;
  const perPage = 100;

  while (true) {
    const batch = await wpFetch(
      `${baseUrl}/wp-json/wp/v2/posts?per_page=${perPage}&page=${page}&context=edit&status=publish,draft`
    );
    if (!Array.isArray(batch) || batch.length === 0) break;
    posts.push(...batch);
    if (batch.length < perPage) break;
    page++;
  }

  return posts;
}

async function main() {
  console.log("Fetching all WordPress posts...");
  const posts = await getAllPosts();
  console.log(`Found ${posts.length} posts total.`);

  let fixed = 0;
  let skipped = 0;

  for (const post of posts) {
    const rawContent = post.content?.raw ?? "";

    // Check if this post has the broken schema blocks
    const hasWpHtmlSchema =
      rawContent.includes("<!-- wp:html -->") &&
      rawContent.includes("application/ld+json");

    const hasBareScript =
      rawContent.includes('<script type="application/ld+json">');

    if (!hasWpHtmlSchema && !hasBareScript) {
      skipped++;
      continue;
    }

    const cleanedContent = cleanSchemaBlocks(rawContent);

    if (cleanedContent === rawContent) {
      skipped++;
      continue;
    }

    console.log(`Fixing post ID ${post.id}: "${post.title?.rendered ?? post.title?.raw ?? "untitled"}"`);

    try {
      await wpFetch(`${baseUrl}/wp-json/wp/v2/posts/${post.id}`, {
        method: "POST",
        body: JSON.stringify({
          content: cleanedContent,
        }),
      });
      console.log(`  ✅ Fixed post ${post.id}`);
      fixed++;
    } catch (err) {
      console.error(`  ❌ Failed to fix post ${post.id}:`, err.message);
    }

    // Rate limit: 200ms between requests
    await new Promise((r) => setTimeout(r, 200));
  }

  console.log(`\nDone. Fixed: ${fixed}, Skipped (no schema blocks): ${skipped}`);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
