import 'dotenv/config';

const WP_URL = process.env.WORDPRESS_URL;
const WP_USER = process.env.WORDPRESS_USERNAME;
const WP_PASS = process.env.WORDPRESS_APP_PASSWORD;
const auth = Buffer.from(`${WP_USER}:${WP_PASS}`).toString('base64');

// Fetch with context=edit to get the raw content
const res = await fetch(
  `${WP_URL}/wp-json/wp/v2/posts/9779?context=edit`,
  { headers: { Authorization: `Basic ${auth}` } }
);
const post = await res.json();
const raw = post.content?.raw || '';

// Patch the second H2 to include the keyphrase
const oldH2 = '<h2>The Breath Reset Protocol: Instant Calm, Lasting Resilience</h2>';
const newH2 = '<h2>Breathing Exercises for Anxiety: The Breath Reset Protocol</h2>';

if (!raw.includes(oldH2)) {
  console.log('❌ Target H2 not found. Current H2s:');
  const h2s = raw.match(/<h2[^>]*>[\s\S]*?<\/h2>/gi) || [];
  h2s.forEach(h => console.log(' -', h));
  process.exit(1);
}

const newRaw = raw.replace(oldH2, newH2);
console.log('Patching:');
console.log('  From:', oldH2);
console.log('  To:  ', newH2);

const patchRes = await fetch(`${WP_URL}/wp-json/wp/v2/posts/9779`, {
  method: 'POST',
  headers: {
    Authorization: `Basic ${auth}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    content: newRaw,
    status: post.status,
  }),
});

const result = await patchRes.json();
if (!result.id) {
  console.log('❌ Patch failed:', JSON.stringify(result).substring(0, 400));
  process.exit(1);
}

// Verify
const verifyRes = await fetch(
  `${WP_URL}/wp-json/wp/v2/posts/9779?context=edit`,
  { headers: { Authorization: `Basic ${auth}` } }
);
const verified = await verifyRes.json();
const verifiedRaw = verified.content?.raw || '';
const h2sAfter = verifiedRaw.match(/<h2[^>]*>[\s\S]*?<\/h2>/gi) || [];
const kw = 'breathing exercises for anxiety';

console.log('\n=== VERIFICATION — ALL H2s AFTER PATCH ===');
let kwCount = 0;
h2sAfter.forEach(h => {
  const text = h.replace(/<[^>]+>/g, '').trim();
  const hasKw = text.toLowerCase().includes('breathing exercises') && text.toLowerCase().includes('anxiety');
  if (hasKw) kwCount++;
  console.log(`  ${hasKw ? '✅' : '  '} "${text}"`);
});

const pct = Math.round((kwCount / h2sAfter.length) * 100);
console.log(`\nKeyphrase in ${kwCount}/${h2sAfter.length} H2s = ${pct}% (Yoast needs ≥30%)`);
console.log(pct >= 30 ? '✅ Should pass Yoast subheading check' : '❌ Still below threshold');
