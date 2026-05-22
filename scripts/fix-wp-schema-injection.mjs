/**
 * Patches the gut health post (ID 9721) to remove the JSON-LD schema block
 * that was incorrectly injected into the post body content.
 */
import * as dotenv from "dotenv";
dotenv.config({ path: "/home/ubuntu/lights-on-optin/.env" });

const WP_URL = process.env.WORDPRESS_URL;
const WP_USER = process.env.WORDPRESS_USERNAME;
const WP_PASS = process.env.WORDPRESS_APP_PASSWORD;

if (!WP_URL || !WP_USER || !WP_PASS) {
  console.error("Missing WordPress env vars");
  process.exit(1);
}

const authHeader = "Basic " + Buffer.from(`${WP_USER}:${WP_PASS}`).toString("base64");

// Fetch the post
const res = await fetch(`${WP_URL}/wp-json/wp/v2/posts/9721?context=edit`, {
  headers: { Authorization: authHeader },
});

if (!res.ok) {
  console.error("Failed to fetch post:", await res.text());
  process.exit(1);
}

const post = await res.json();
const rawContent = post.content.raw;

console.log("Original content length:", rawContent.length);
console.log("First 300 chars:", rawContent.substring(0, 300));

// Strip all <script type="application/ld+json">...</script> blocks from the content
const cleaned = rawContent
  .replace(/<script\s+type="application\/ld\+json"[\s\S]*?<\/script>/gi, "")
  .replace(/^\s*\n+/, "") // remove leading blank lines
  .trim();

console.log("\nCleaned content length:", cleaned.length);
console.log("First 300 chars of cleaned:", cleaned.substring(0, 300));

// Patch the post
const patchRes = await fetch(`${WP_URL}/wp-json/wp/v2/posts/9721`, {
  method: "POST",
  headers: {
    Authorization: authHeader,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ content: cleaned }),
});

if (!patchRes.ok) {
  console.error("Failed to patch post:", await patchRes.text());
  process.exit(1);
}

const patched = await patchRes.json();
console.log("\n✅ Post patched successfully. Post ID:", patched.id, "| Status:", patched.status);
console.log("URL:", patched.link);
