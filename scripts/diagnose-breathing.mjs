import 'dotenv/config';

const WP_URL = process.env.WORDPRESS_URL;
const WP_USER = process.env.WORDPRESS_USERNAME;
const WP_PASS = process.env.WORDPRESS_APP_PASSWORD;
const auth = Buffer.from(`${WP_USER}:${WP_PASS}`).toString('base64');

const res = await fetch(
  `${WP_URL}/wp-json/wp/v2/posts?slug=breathing-exercises-anxiety-relief-cycd&context=edit`,
  { headers: { Authorization: `Basic ${auth}` } }
);
const posts = await res.json();
const post = posts[0];
const kw = (post.meta?._yoast_wpseo_focuskw || '').toLowerCase();
console.log('Focus keyword:', `"${kw}"`);

const raw = post.content?.raw || '';

// 1. Show every H2 tag exactly as stored in DB
console.log('\n=== RAW H2 TAGS IN DATABASE ===');
const rawH2s = raw.match(/<h2[^>]*>[\s\S]*?<\/h2>/gi) || [];
rawH2s.forEach((h, i) => {
  const text = h.replace(/<[^>]+>/g, '').trim();
  const hasKw = text.toLowerCase().includes(kw);
  console.log(`\n[${i}] ${hasKw ? '✅ HAS KW' : '❌ NO KW'}`);
  console.log('  Full tag:', h.substring(0, 200));
  console.log('  Text:', text);
});

// 2. Check for any H3 tags
const rawH3s = raw.match(/<h3[^>]*>[\s\S]*?<\/h3>/gi) || [];
console.log(`\n=== RAW H3 TAGS (${rawH3s.length}) ===`);
rawH3s.forEach((h, i) => {
  const text = h.replace(/<[^>]+>/g, '').trim();
  const hasKw = text.toLowerCase().includes(kw);
  console.log(`[${i}] ${hasKw ? '✅ HAS KW' : '❌ NO KW'} "${text}"`);
});

// 3. Check the Yoast focus keyword stored in meta
console.log('\n=== YOAST META ===');
console.log('focuskw:', post.meta?._yoast_wpseo_focuskw);
console.log('title:', post.meta?._yoast_wpseo_title);
console.log('metadesc:', post.meta?._yoast_wpseo_metadesc);

// 4. Show the first 200 chars around the H2 with the keyphrase
const kwH2 = rawH2s.find(h => h.toLowerCase().includes(kw));
if (kwH2) {
  const idx = raw.indexOf(kwH2);
  console.log('\n=== CONTEXT AROUND KW H2 ===');
  console.log(raw.substring(Math.max(0, idx - 100), idx + kwH2.length + 100));
}

// 5. Check if there's a wp:heading block wrapper
const hasGutenbergHeadings = raw.includes('<!-- wp:heading');
console.log('\n=== GUTENBERG BLOCKS? ===');
console.log('Has wp:heading blocks:', hasGutenbergHeadings);
console.log('Has wp:paragraph blocks:', raw.includes('<!-- wp:paragraph'));

// 6. Show a 300-char sample of the raw content to see the format
console.log('\n=== RAW CONTENT SAMPLE (first 500 chars) ===');
console.log(raw.substring(0, 500));
