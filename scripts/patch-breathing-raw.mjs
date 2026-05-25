import 'dotenv/config';

const WP_URL = process.env.WORDPRESS_URL;
const WP_USER = process.env.WORDPRESS_USERNAME;
const WP_PASS = process.env.WORDPRESS_APP_PASSWORD;
const auth = Buffer.from(`${WP_USER}:${WP_PASS}`).toString('base64');

// Fetch with context=edit to get the raw content
const res = await fetch(
  `${WP_URL}/wp-json/wp/v2/posts?slug=breathing-exercises-anxiety-relief-cycd&context=edit`,
  { headers: { Authorization: `Basic ${auth}` } }
);
const posts = await res.json();
const post = posts[0];
const kw = (post.meta?._yoast_wpseo_focuskw || '').toLowerCase();
const kwTitle = kw.split(' ').map(w => w[0].toUpperCase() + w.slice(1)).join(' ');

console.log('Post ID:', post.id);
console.log('Focus keyword:', kw);

// The raw content is in post.content.raw
const raw = post.content?.raw || '';

// Patch the H2 directly in the raw content
const oldH2 = '<h2>Why Your Nervous System Stays Stuck in Overdrive</h2>';
const newH2 = `<h2>${kwTitle}: Why Your Nervous System Stays Stuck in Overdrive</h2>`;

if (!raw.includes(oldH2)) {
  console.log('❌ Target H2 not found in raw content. Current H2s:');
  const h2s = raw.match(/<h2[^>]*>[\s\S]*?<\/h2>/gi) || [];
  h2s.forEach(h => console.log(' -', h));
  process.exit(1);
}

const newRaw = raw.replace(oldH2, newH2);
console.log('\nPatching:');
console.log('  From:', oldH2);
console.log('  To:  ', newH2);

// IMPORTANT: Must send as { content: { raw: "..." } } for Gutenberg-aware REST API
// OR as { content: "..." } for classic editor posts
// Since this post has no wp:heading blocks, it's classic HTML — send as plain string
const patchRes = await fetch(`${WP_URL}/wp-json/wp/v2/posts/${post.id}`, {
  method: 'POST',
  headers: {
    Authorization: `Basic ${auth}`,
    'Content-Type': 'application/json',
    'X-WP-Nonce': '',
  },
  body: JSON.stringify({
    content: newRaw,
    // Also explicitly set status to keep it published
    status: post.status,
  }),
});

const result = await patchRes.json();
if (!result.id) {
  console.log('❌ Patch failed:', JSON.stringify(result).substring(0, 400));
  process.exit(1);
}

// Verify: re-fetch with context=edit and check raw content
const verifyRes = await fetch(
  `${WP_URL}/wp-json/wp/v2/posts/${post.id}?context=edit`,
  { headers: { Authorization: `Basic ${auth}` } }
);
const verified = await verifyRes.json();
const verifiedRaw = verified.content?.raw || '';
const h2sAfter = verifiedRaw.match(/<h2[^>]*>[\s\S]*?<\/h2>/gi) || [];

console.log('\n=== VERIFICATION — RAW H2s IN DB AFTER PATCH ===');
h2sAfter.forEach(h => {
  const text = h.replace(/<[^>]+>/g, '').trim();
  const hasKw = text.toLowerCase().includes(kw);
  console.log(`  ${hasKw ? '✅ HAS KW' : '❌ NO KW'} "${text}"`);
});

const success = h2sAfter.some(h => h.toLowerCase().includes(kw));
console.log('\nResult:', success ? '✅ Keyphrase now in raw H2 — Yoast will see it' : '❌ Still not in raw H2');
