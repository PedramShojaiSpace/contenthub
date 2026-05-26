/**
 * Fix WP#9800 GI Map post:
 * 1. Add focus keyphrase "GI Map test results" to at least 2 H2/H3 subheadings
 * 2. Trim meta description to under 155 chars
 * 3. Fix SEO title to under 60 chars
 * 4. Push all changes to WordPress via Yoast REST API
 */
import { createConnection } from 'mysql2/promise';
import { config } from 'dotenv';
config();

const WP_URL = process.env.WORDPRESS_URL;
const WP_USER = process.env.WORDPRESS_USERNAME;
const WP_PASS = process.env.WORDPRESS_APP_PASSWORD;
const auth = Buffer.from(`${WP_USER}:${WP_PASS}`).toString('base64');

async function wpRequest(path, method = 'GET', body = null) {
  const opts = {
    method,
    headers: {
      'Authorization': `Basic ${auth}`,
      'Content-Type': 'application/json',
    },
  };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${WP_URL}/wp-json${path}`, opts);
  return res.json();
}

async function main() {
  const conn = await createConnection(process.env.DATABASE_URL);

  // Get the DB record
  const [rows] = await conn.query(
    `SELECT id, title, textContent, focusKeyword, yoastSeoTitle, yoastMetaDescription, wpPostId, ctaBannerUrl
     FROM content_items WHERE wpPostId = 9800 LIMIT 1`
  );
  
  if (!rows.length) {
    console.error('Post not found in DB');
    await conn.end();
    return;
  }
  
  const post = rows[0];
  console.log('Post:', post.title);
  console.log('Keyphrase:', post.focusKeyword);
  console.log('Current SEO title:', post.yoastSeoTitle, `[${(post.yoastSeoTitle||'').length}]`);
  console.log('Current meta desc:', post.yoastMetaDescription, `[${(post.yoastMetaDescription||'').length}]`);

  // Fix 1: SEO title — trim to under 60 chars
  // Current: "GI Map Test Results Explained: Your Gut Health | The Urban Monk" (63)
  // Fix: "GI Map Test Results Explained | The Urban Monk" (46)
  const newSeoTitle = 'GI Map Test Results Explained | The Urban Monk';
  console.log('\nNew SEO title:', newSeoTitle, `[${newSeoTitle.length}]`);

  // Fix 2: Meta description — trim to under 155 chars and keep keyphrase
  // Current: "GI Map test results explained: Understand your GI Map test results through a functional lens. Learn why conventional labs miss key issues and how to hea..." (155 but truncated)
  // Need to check actual stored value
  const currentDesc = post.yoastMetaDescription || '';
  console.log('\nActual stored meta desc:', currentDesc, `[${currentDesc.length}]`);
  
  let newMetaDesc = currentDesc;
  if (currentDesc.length > 155) {
    // Trim to 155 chars at a word boundary
    newMetaDesc = currentDesc.substring(0, 152).replace(/\s\S+$/, '') + '...';
    // Ensure keyphrase is present
    if (!newMetaDesc.toLowerCase().includes('gi map')) {
      newMetaDesc = 'GI Map test results explained: ' + newMetaDesc.substring(31);
    }
  }
  console.log('New meta desc:', newMetaDesc, `[${newMetaDesc.length}]`);

  // Fix 3: Update subheadings in WordPress content to include keyphrase
  // Current H2s that don't have keyphrase:
  // "Why Your Gut Feels Broken (Even When Labs Say Otherwise)" → add "GI Map"
  // "What Most People Get Wrong About Gut Health" → add "GI Map test results"
  // Strategy: update 2 H2s to include keyphrase naturally
  
  // Get current WP content
  const wpPost = await wpRequest('/wp/v2/posts/9800?_fields=id,content');
  let content = wpPost.content?.raw || wpPost.content?.rendered || '';
  
  if (!content) {
    console.log('Could not get raw content, trying rendered...');
    const wpPost2 = await wpRequest('/wp/v2/posts/9800?context=edit&_fields=id,content');
    content = wpPost2.content?.raw || '';
  }
  
  console.log('\nContent length:', content.length);
  console.log('Content starts with:', content.substring(0, 100));

  // Update specific subheadings to include keyphrase
  // H2: "Why Your Gut Feels Broken (Even When Labs Say Otherwise)" 
  //   → "Why Your GI Map Test Results Show What Labs Miss"
  // H2: "What Most People Get Wrong About Gut Health"
  //   → "What GI Map Test Results Reveal About Gut Health"
  
  let updatedContent = content;
  
  const subheadingFixes = [
    {
      from: 'Why Your Gut Feels Broken (Even When Labs Say Otherwise)',
      to: 'Why Your GI Map Test Results Show What Labs Miss'
    },
    {
      from: 'What Most People Get Wrong About Gut Health',
      to: 'What GI Map Test Results Reveal About Gut Health'
    }
  ];
  
  for (const fix of subheadingFixes) {
    if (updatedContent.includes(fix.from)) {
      updatedContent = updatedContent.replace(fix.from, fix.to);
      console.log(`\nReplaced: "${fix.from}"\n     with: "${fix.to}"`);
    } else {
      console.log(`\nCould not find: "${fix.from}" in content`);
    }
  }

  // Push content update to WordPress
  if (updatedContent !== content) {
    console.log('\nPushing content update to WordPress...');
    const contentUpdate = await wpRequest('/wp/v2/posts/9800', 'POST', {
      content: updatedContent
    });
    if (contentUpdate.id) {
      console.log('Content updated successfully');
    } else {
      console.log('Content update response:', JSON.stringify(contentUpdate).substring(0, 200));
    }
  }

  // Push Yoast SEO fields
  console.log('\nPushing Yoast SEO fields...');
  const yoastUpdate = await wpRequest('/wp/v2/posts/9800', 'POST', {
    meta: {
      _yoast_wpseo_title: newSeoTitle,
      _yoast_wpseo_metadesc: newMetaDesc,
      _yoast_wpseo_focuskw: post.focusKeyword || 'GI Map test results explained',
    }
  });
  
  if (yoastUpdate.id) {
    console.log('Yoast fields updated successfully');
  } else {
    console.log('Yoast update response:', JSON.stringify(yoastUpdate).substring(0, 200));
  }

  // Update DB
  await conn.query(
    `UPDATE content_items SET yoastSeoTitle = ?, yoastMetaDescription = ? WHERE wpPostId = 9800`,
    [newSeoTitle, newMetaDesc]
  );
  console.log('\nDB updated');

  await conn.end();
  console.log('\nDone!');
}

main().catch(console.error);
