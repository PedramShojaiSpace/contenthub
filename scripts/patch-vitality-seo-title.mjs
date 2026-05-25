/**
 * Fix the SEO title duplicate on the vitality post.
 * The focus keyword is "Dr Pedram Shojai" and the post title already starts with
 * "Dr. Pedram Shojai" — so the SEO title should just be the post title as-is,
 * since the keyphrase is already at the start.
 * 
 * Also fix the H2 headings — "Dr Pedram Shojai: Key Takeaways" is awkward.
 * Better: "Dr. Pedram Shojai's Approach to Reclaiming Vitality" for the framework H2.
 */

import * as dotenv from "dotenv";
dotenv.config({ path: "/home/ubuntu/lights-on-optin/.env" });

const WP_BASE = process.env.WORDPRESS_URL || "https://theurbanmonk.com";
const WP_USER = process.env.WORDPRESS_USERNAME;
const WP_PASS = process.env.WORDPRESS_APP_PASSWORD;
const authHeader = "Basic " + Buffer.from(`${WP_USER}:${WP_PASS}`).toString("base64");

async function wpFetch(url, options = {}) {
  const res = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: authHeader,
      ...(options.headers || {}),
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`WP API ${res.status}: ${text.slice(0, 400)}`);
  }
  return res.json();
}

async function main() {
  // Fetch current post state
  const posts = await wpFetch(
    `${WP_BASE}/wp-json/wp/v2/posts?slug=dr-pedram-shojai-reclaim-vitality-7x0t&_fields=id,title,content,meta,excerpt`
  );
  const post = posts[0];
  console.log(`Post ID: ${post.id}`);

  const rawContent = post.content.raw || post.content.rendered || "";
  const meta = post.meta || {};
  
  console.log("Current SEO title:", meta._yoast_wpseo_title);
  console.log("Current meta desc:", meta._yoast_wpseo_metadesc);
  console.log("Current focus kw:", meta._yoast_wpseo_focuskw);

  // The focus keyword is "Dr Pedram Shojai"
  // The post title is "Dr. Pedram Shojai: Reclaim Your Vitality"
  // The SEO title should be: "Dr. Pedram Shojai: Reclaim Your Vitality | The Urban Monk"
  // (The title already starts with the keyphrase — the dot is just punctuation)
  const cleanSeoTitle = "Dr. Pedram Shojai: Reclaim Your Vitality | The Urban Monk";
  
  // Fix the H2s — replace the awkward "Dr Pedram Shojai: Key Takeaways" 
  // with natural headings that still contain the keyphrase
  let newContent = rawContent;
  
  // Fix "Dr Pedram Shojai: Key Takeaways" → "Key Takeaways"
  newContent = newContent.replace(
    /Dr Pedram Shojai: Key Takeaways/g,
    "Key Takeaways"
  );
  
  // Fix "Dr Pedram Shojai: What Most People Get Wrong About Healing"
  // → "Dr. Pedram Shojai on What Most People Get Wrong About Healing"
  newContent = newContent.replace(
    /Dr Pedram Shojai: What Most People Get Wrong About Healing/g,
    "Dr. Pedram Shojai on What Most People Get Wrong About Healing"
  );

  // Check H2s now
  const h2Regex = /<h2[^>]*>(.*?)<\/h2>/gi;
  const h2s = [...newContent.matchAll(h2Regex)];
  console.log("\nH2 headings after fix:");
  h2s.forEach((m, i) => console.log(`  ${i+1}. ${m[1]}`));
  
  const kwLower = "dr pedram shojai";
  const h2WithKw = h2s.filter(m => m[1].toLowerCase().includes(kwLower));
  console.log(`\nH2s with keyphrase: ${h2WithKw.length} / ${h2s.length} = ${Math.round(h2WithKw.length/h2s.length*100)}%`);

  // Count total keyphrase occurrences
  const allText = newContent.replace(/<[^>]+>/g, " ").toLowerCase();
  const count = (allText.match(/dr\.?\s*pedram\s+shojai/gi) || []).length;
  console.log(`Total keyphrase occurrences: ${count}`);

  // Push the fix
  const updateBody = {
    content: newContent,
    meta: {
      _yoast_wpseo_focuskw: "Dr Pedram Shojai",
      _yoast_wpseo_metadesc: "Dr. Pedram Shojai shares his approach to reclaiming vitality. Integrate ancient wisdom & modern science to restore energy, clarity, and lasting health.",
      _yoast_wpseo_title: cleanSeoTitle,
    },
    yoast_meta: {
      yoast_wpseo_focuskw: "Dr Pedram Shojai",
      yoast_wpseo_metadesc: "Dr. Pedram Shojai shares his approach to reclaiming vitality. Integrate ancient wisdom & modern science to restore energy, clarity, and lasting health.",
      yoast_wpseo_title: cleanSeoTitle,
    },
  };

  await wpFetch(`${WP_BASE}/wp-json/wp/v2/posts/${post.id}`, {
    method: "POST",
    body: JSON.stringify(updateBody),
  });

  console.log("\n✅ Fixed!");
  console.log(`  SEO title: "${cleanSeoTitle}"`);
  console.log(`  Meta desc: "Dr. Pedram Shojai shares his approach to reclaiming vitality..."`);
  console.log(`  Focus keyword: "Dr Pedram Shojai"`);
  console.log(`\nOpen the WP editor and click Update to trigger Yoast re-analysis.`);
}

main().catch(console.error);
