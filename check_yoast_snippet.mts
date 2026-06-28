/**
 * Check if the Yoast REST meta snippet is active on WordPress
 */
import "dotenv/config";

const WP_URL = process.env.WORDPRESS_URL;
const WP_USER = process.env.WORDPRESS_USERNAME;
const WP_PASS = process.env.WORDPRESS_APP_PASSWORD;

if (!WP_URL || !WP_USER || !WP_PASS) {
  console.error("Missing WordPress credentials");
  process.exit(1);
}

const auth = Buffer.from(`${WP_USER}:${WP_PASS}`).toString("base64");

async function main() {
  console.log(`Checking Yoast REST meta fields on ${WP_URL}...`);

  // Check the REST API schema for the post type to see if Yoast meta keys are registered
  const schemaRes = await fetch(`${WP_URL}/wp-json/wp/v2/posts?per_page=1`, {
    headers: { Authorization: `Basic ${auth}` },
  });

  if (!schemaRes.ok) {
    console.error(`WP API error: ${schemaRes.status} ${await schemaRes.text()}`);
    process.exit(1);
  }

  const posts = await schemaRes.json() as any[];
  if (posts.length === 0) {
    console.log("No posts found to check");
    process.exit(0);
  }

  const post = posts[0];
  const metaKeys = Object.keys(post.meta ?? {});
  console.log(`\nPost ID ${post.id}: "${post.title?.rendered}"`);
  console.log(`Meta keys exposed via REST: ${metaKeys.length > 0 ? metaKeys.join(", ") : "(none)"}`);

  const yoastKeys = ["_yoast_wpseo_focuskw", "_yoast_wpseo_metadesc", "_yoast_wpseo_title", "_yoast_wpseo_canonical"];
  const foundKeys = yoastKeys.filter(k => metaKeys.includes(k));
  const missingKeys = yoastKeys.filter(k => !metaKeys.includes(k));

  if (foundKeys.length === yoastKeys.length) {
    console.log("\n✅ SNIPPET ACTIVE — All 4 Yoast meta keys are exposed via REST API:");
    foundKeys.forEach(k => console.log(`   ✓ ${k} = "${post.meta?.[k] ?? "(empty)"}"`));
  } else if (foundKeys.length > 0) {
    console.log(`\n⚠️  PARTIAL — ${foundKeys.length}/${yoastKeys.length} Yoast keys found:`);
    foundKeys.forEach(k => console.log(`   ✓ ${k}`));
    missingKeys.forEach(k => console.log(`   ✗ ${k} (missing)`));
  } else {
    console.log("\n❌ SNIPPET NOT ACTIVE — No Yoast meta keys found in REST API");
    console.log("   Make sure the snippet is activated in WPCode Lite");
  }

  // Also check the /wp/v2/posts schema endpoint
  const schemaEndpointRes = await fetch(`${WP_URL}/wp-json/wp/v2/posts?context=edit&per_page=1`, {
    headers: { Authorization: `Basic ${auth}` },
  });
  if (schemaEndpointRes.ok) {
    const editPost = await schemaEndpointRes.json() as any[];
    if (editPost.length > 0) {
      const editMeta = editPost[0].meta ?? {};
      const editYoastKeys = yoastKeys.filter(k => k in editMeta);
      console.log(`\nEdit context meta keys: ${Object.keys(editMeta).join(", ") || "(none)"}`);
      if (editYoastKeys.length > 0) {
        console.log(`✅ Edit context confirms: ${editYoastKeys.join(", ")}`);
      }
    }
  }
}

main().catch(console.error);
