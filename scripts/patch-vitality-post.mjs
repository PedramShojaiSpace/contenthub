/**
 * Patch the dr-pedram-shojai-reclaim-vitality post to fix 3 Yoast red issues:
 * 1. Keyphrase density (only 3 uses, needs 7+)
 * 2. Keyphrase in meta description (missing)
 * 3. Keyphrase in subheadings (missing from H2s)
 * 4. Keyphrase in SEO title (not at start)
 */

import * as dotenv from "dotenv";
dotenv.config({ path: "/home/ubuntu/lights-on-optin/.env" });

const WP_BASE = process.env.WORDPRESS_URL || "https://theurbanmonk.com";
const WP_USER = process.env.WORDPRESS_USERNAME;
const WP_PASS = process.env.WORDPRESS_APP_PASSWORD;

if (!WP_USER || !WP_PASS) {
  console.error("Missing WORDPRESS_USERNAME or WORDPRESS_APP_PASSWORD");
  process.exit(1);
}

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
    throw new Error(`WP API ${res.status}: ${text.slice(0, 300)}`);
  }
  return res.json();
}

// First, find the post by slug
async function findPost() {
  const data = await wpFetch(
    `${WP_BASE}/wp-json/wp/v2/posts?slug=dr-pedram-shojai-reclaim-vitality-7x0t&_fields=id,title,content,meta,excerpt,slug`
  );
  if (!data.length) throw new Error("Post not found by slug");
  return data[0];
}

async function main() {
  console.log("Fetching post...");
  const post = await findPost();
  console.log(`Found post ID: ${post.id} — "${post.title.rendered}"`);

  // Get current content
  const rawContent = post.content.raw || post.content.rendered || "";
  console.log(`Content length: ${rawContent.length} chars`);

  // Get current meta
  const meta = post.meta || {};
  console.log("Current Yoast meta:", {
    focuskw: meta._yoast_wpseo_focuskw,
    metadesc: meta._yoast_wpseo_metadesc,
    title: meta._yoast_wpseo_title,
  });

  // Determine focus keyword — check what's stored, or infer from title
  const focusKeyword = meta._yoast_wpseo_focuskw || "reclaim vitality";
  console.log(`Focus keyword: "${focusKeyword}"`);

  // Count current occurrences in content
  const contentLower = rawContent.toLowerCase();
  const kwLower = focusKeyword.toLowerCase();
  const currentCount = (contentLower.match(new RegExp(kwLower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length;
  console.log(`Current keyphrase occurrences in content: ${currentCount}`);

  // Fix 1: SEO title — put keyphrase at the start
  const currentSeoTitle = meta._yoast_wpseo_title || post.title.rendered;
  let newSeoTitle = currentSeoTitle;
  if (!currentSeoTitle.toLowerCase().startsWith(kwLower)) {
    const kwCapitalised = focusKeyword.charAt(0).toUpperCase() + focusKeyword.slice(1);
    // Use the article title without the | The Urban Monk suffix if present
    const baseTitle = post.title.rendered.replace(/ \| The Urban Monk$/, "");
    newSeoTitle = `${kwCapitalised}: ${baseTitle} | The Urban Monk`;
    console.log(`New SEO title: "${newSeoTitle}"`);
  } else {
    console.log("SEO title already starts with keyphrase — no change needed");
  }

  // Fix 2: Meta description — ensure keyphrase is in it
  const currentMetaDesc = meta._yoast_wpseo_metadesc || post.excerpt?.rendered?.replace(/<[^>]+>/g, "") || "";
  let newMetaDesc = currentMetaDesc;
  if (!currentMetaDesc.toLowerCase().includes(kwLower)) {
    const kwCapitalised = focusKeyword.charAt(0).toUpperCase() + focusKeyword.slice(1);
    const prefix = `${kwCapitalised}: `;
    const combined = prefix + currentMetaDesc;
    newMetaDesc = combined.length <= 155 ? combined : combined.slice(0, 152) + "...";
    console.log(`New meta description: "${newMetaDesc}"`);
  } else {
    console.log("Meta description already contains keyphrase — no change needed");
  }

  // Fix 3: Add keyphrase to H2 subheadings if not present
  let newContent = rawContent;
  
  // Check if any H2 contains the keyphrase
  const h2Regex = /<h2[^>]*>(.*?)<\/h2>/gi;
  const h2s = [...rawContent.matchAll(h2Regex)];
  console.log(`Found ${h2s.length} H2 headings`);
  
  const h2WithKw = h2s.filter(m => m[1].toLowerCase().includes(kwLower));
  console.log(`H2s containing keyphrase: ${h2WithKw.length}`);

  if (h2WithKw.length === 0 && h2s.length > 0) {
    // Add keyphrase to the first H2 that makes sense
    // Strategy: prepend keyphrase to the first H2
    const firstH2 = h2s[0];
    const kwCapitalised = focusKeyword.charAt(0).toUpperCase() + focusKeyword.slice(1);
    const newH2Text = `${kwCapitalised}: ${firstH2[1]}`;
    const newH2Tag = firstH2[0].replace(firstH2[1], newH2Text);
    newContent = newContent.replace(firstH2[0], newH2Tag);
    console.log(`Updated first H2 to: "${newH2Text}"`);
    
    // Also add to a second H2 if there are enough (for 30%+ coverage)
    if (h2s.length >= 4 && h2s[2]) {
      const secondH2 = h2s[2];
      const newH2Text2 = `${kwCapitalised}: ${secondH2[1]}`;
      const newH2Tag2 = secondH2[0].replace(secondH2[1], newH2Text2);
      newContent = newContent.replace(secondH2[0], newH2Tag2);
      console.log(`Updated third H2 to: "${newH2Text2}"`);
    }
  }

  // Fix 4: Boost keyphrase density if below 7
  if (currentCount < 7) {
    const needed = 7 - currentCount;
    console.log(`Need to add ${needed} more keyphrase occurrences`);
    
    // Add keyphrase occurrences to paragraph text naturally
    // Strategy: find paragraphs that discuss the topic and add the keyphrase
    const kwCapitalised = focusKeyword.charAt(0).toUpperCase() + focusKeyword.slice(1);
    
    // Add to the first paragraph if not already there
    const firstParaMatch = newContent.match(/<p>(.*?)<\/p>/i);
    if (firstParaMatch && !firstParaMatch[1].toLowerCase().includes(kwLower)) {
      const newFirstPara = firstParaMatch[0].replace(
        '</p>',
        ` The path to ${focusKeyword} starts here.</p>`
      );
      newContent = newContent.replace(firstParaMatch[0], newFirstPara);
      console.log("Added keyphrase to first paragraph");
    }
    
    // Find paragraphs after H2s and inject the keyphrase where natural
    let addedCount = 0;
    const paraRegex = /<p>((?!.*<\/h[23]>)[\s\S]*?)<\/p>/gi;
    const paras = [...newContent.matchAll(paraRegex)];
    
    for (const para of paras) {
      if (addedCount >= needed - 1) break;
      if (para[1].toLowerCase().includes(kwLower)) continue;
      if (para[1].length < 100) continue; // Skip short paras
      
      // Add at the end of a paragraph
      const newPara = para[0].replace(
        '</p>',
        ` This is the essence of ${focusKeyword}.</p>`
      );
      newContent = newContent.replace(para[0], newPara);
      addedCount++;
      console.log(`Added keyphrase occurrence ${addedCount} to a paragraph`);
    }
  }

  // Now push all fixes to WordPress
  console.log("\nPushing fixes to WordPress...");
  
  const updateBody = {
    content: newContent,
    meta: {
      _yoast_wpseo_focuskw: focusKeyword,
      _yoast_wpseo_metadesc: newMetaDesc,
      _yoast_wpseo_title: newSeoTitle,
    },
    yoast_meta: {
      yoast_wpseo_focuskw: focusKeyword,
      yoast_wpseo_metadesc: newMetaDesc,
      yoast_wpseo_title: newSeoTitle,
    },
  };

  const result = await wpFetch(`${WP_BASE}/wp-json/wp/v2/posts/${post.id}`, {
    method: "POST",
    body: JSON.stringify(updateBody),
  });

  console.log("\n✅ Post updated successfully!");
  console.log(`Post URL: ${result.link}`);
  console.log(`\nFixes applied:`);
  console.log(`  SEO title: "${newSeoTitle}"`);
  console.log(`  Meta desc: "${newMetaDesc}"`);
  console.log(`  Focus keyword: "${focusKeyword}"`);
  console.log(`\nNext step: Open the post in WP editor and click Update to trigger Yoast re-analysis.`);
}

main().catch(console.error);
