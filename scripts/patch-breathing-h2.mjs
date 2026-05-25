import 'dotenv/config';

const WP_URL = process.env.WORDPRESS_URL;
const WP_USER = process.env.WORDPRESS_USERNAME;
const WP_PASS = process.env.WORDPRESS_APP_PASSWORD;
const auth = Buffer.from(`${WP_USER}:${WP_PASS}`).toString('base64');

// Find post by slug
const res = await fetch(
  `${WP_URL}/wp-json/wp/v2/posts?slug=breathing-exercises-anxiety-relief-cycd&context=edit`,
  { headers: { Authorization: `Basic ${auth}` } }
);
const posts = await res.json();
const post = posts[0];
if (!post) { console.log('Post not found'); process.exit(1); }

console.log('Post ID:', post.id);
const kw = (post.meta?._yoast_wpseo_focuskw || '').toLowerCase();
console.log('Focus keyword:', kw);

// Show all H2 headings from rendered content
const rendered = post.content?.rendered || '';
const h2s = rendered.match(/<h2[^>]*>(.*?)<\/h2>/gi) || [];
console.log('\nH2 headings:');
h2s.forEach(h => {
  const text = h.replace(/<[^>]+>/g, '');
  const hasKw = text.toLowerCase().includes(kw);
  console.log(`  ${hasKw ? '✅' : '❌'} "${text}"`);
});

// Show raw content H2 tags
const raw = post.content?.raw || '';
const rawH2s = raw.match(/<h2[^>]*>.*?<\/h2>/gi) || [];
console.log('\nRaw H2 tags:');
rawH2s.forEach(h => {
  const text = h.replace(/<[^>]+>/g, '');
  const hasKw = text.toLowerCase().includes(kw);
  console.log(`  ${hasKw ? '✅' : '❌'} "${text}"`);
});

// Find first H2 without the keyphrase that makes sense to rename
// Strategy: pick one that sounds like a protocol/framework/method section
const kwTitle = kw.split(' ').map(w => w[0].toUpperCase() + w.slice(1)).join(' ');

// Find the best candidate to prepend the keyphrase to
const candidatePatterns = ['protocol', 'framework', 'approach', 'method', 'technique', 'practice', 'exercise', 'system', 'guide', 'reset', 'solution'];
let bestCandidate = null;

for (const rawH2 of rawH2s) {
  const text = rawH2.replace(/<[^>]+>/g, '').toLowerCase();
  if (text.includes(kw)) continue; // already has it
  if (candidatePatterns.some(p => text.includes(p))) {
    bestCandidate = rawH2;
    break;
  }
}

// If no pattern match, just use the first H2 that doesn't have the keyphrase
if (!bestCandidate) {
  bestCandidate = rawH2s.find(h => !h.replace(/<[^>]+>/g, '').toLowerCase().includes(kw));
}

if (!bestCandidate) {
  console.log('\n✅ All H2s already contain the keyphrase. No patch needed.');
  process.exit(0);
}

const originalText = bestCandidate.replace(/<[^>]+>/g, '');
const newText = `${kwTitle}: ${originalText}`;
const newH2 = bestCandidate.replace(originalText, newText);

console.log('\nProposed rename:');
console.log('  From:', originalText);
console.log('  To:', newText);

// Apply patch
const newRaw = raw.replace(bestCandidate, newH2);
const patchRes = await fetch(`${WP_URL}/wp-json/wp/v2/posts/${post.id}`, {
  method: 'POST',
  headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ content: newRaw }),
});
const patchData = await patchRes.json();
if (patchData.id) {
  const newRendered = patchData.content?.rendered || '';
  const newH2s = newRendered.match(/<h2[^>]*>(.*?)<\/h2>/gi) || [];
  const kwInH2 = newH2s.some(h => h.toLowerCase().includes(kw));
  console.log('\n✅ Post patched');
  console.log('Keyphrase in H2:', kwInH2 ? '✅ YES' : '❌ NO');
  console.log('H2 headings now:');
  newH2s.forEach(h => console.log(' -', h.replace(/<[^>]+>/g, '')));
} else {
  console.log('\n❌ Patch failed:', JSON.stringify(patchData).substring(0, 300));
}
