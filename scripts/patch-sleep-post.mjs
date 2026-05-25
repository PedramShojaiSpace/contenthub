import 'dotenv/config';

const WP_URL = process.env.WORDPRESS_URL;
const WP_USER = process.env.WORDPRESS_USERNAME;
const WP_PASS = process.env.WORDPRESS_APP_PASSWORD;
const auth = Buffer.from(`${WP_USER}:${WP_PASS}`).toString('base64');

// 1. Find the post
const searchRes = await fetch(
  `${WP_URL}/wp-json/wp/v2/posts?slug=natural-sleep-remedies-beyond-melatonin-i05y&context=edit`,
  { headers: { Authorization: `Basic ${auth}` } }
);
const posts = await searchRes.json();
const post = posts[0];
if (!post) { console.log('Post not found'); process.exit(1); }

console.log('Post ID:', post.id);
console.log('Focus keyword:', post.meta?._yoast_wpseo_focuskw);
console.log('Current metadesc:', post.meta?._yoast_wpseo_metadesc);
console.log('Metadesc length:', (post.meta?._yoast_wpseo_metadesc || '').length);

const kw = (post.meta?._yoast_wpseo_focuskw || 'natural sleep remedies').toLowerCase();
console.log('\nFocus keyword:', kw);

// 2. Audit H2s in rendered content
const rendered = post.content?.rendered || '';
const h2s = rendered.match(/<h2[^>]*>(.*?)<\/h2>/gi) || [];
console.log('\nH2 headings:');
h2s.forEach(h => {
  const text = h.replace(/<[^>]+>/g, '');
  const hasKw = text.toLowerCase().includes(kw) || 
    kw.split(' ').filter(w => w.length > 4).every(w => text.toLowerCase().includes(w));
  console.log(`  ${hasKw ? '✅' : '❌'} "${text}"`);
});

// 3. Check raw content for keyphrase in headings
const raw = post.content?.raw || '';
const rawH2s = raw.match(/^## .+$/gm) || [];
console.log('\nRaw H2 headings:');
rawH2s.forEach(h => {
  const hasKw = h.toLowerCase().includes(kw);
  console.log(`  ${hasKw ? '✅' : '❌'} "${h}"`);
});

// 4. Fix: Add keyphrase to one H2 and shorten meta description
const kwTitle = kw.split(' ').map(w => w[0].toUpperCase() + w.slice(1)).join(' ');

// Find the first H2 that doesn't have the keyphrase and rename it
let newRaw = raw;

// Strategy: rename the framework/protocol H2 to include the keyphrase
// Common pattern: "The [X] Protocol" or "The [X] Framework" → "Natural Sleep Remedies: The [X] Protocol"
const h2Match = rawH2s.find(h => !h.toLowerCase().includes(kw) && 
  (h.toLowerCase().includes('protocol') || h.toLowerCase().includes('framework') || 
   h.toLowerCase().includes('approach') || h.toLowerCase().includes('system') ||
   h.toLowerCase().includes('method') || h.toLowerCase().includes('solution')));

if (h2Match) {
  const newH2 = h2Match.replace(/^## /, `## ${kwTitle}: `);
  newRaw = newRaw.replace(h2Match, newH2);
  console.log('\nRenaming H2:');
  console.log('  From:', h2Match);
  console.log('  To:', newH2);
} else {
  // Just add the keyphrase to the first H2 that doesn't have it
  const firstH2WithoutKw = rawH2s.find(h => !h.toLowerCase().includes(kw));
  if (firstH2WithoutKw) {
    const newH2 = firstH2WithoutKw + ` with ${kwTitle}`;
    newRaw = newRaw.replace(firstH2WithoutKw, newH2);
    console.log('\nAppending to H2:');
    console.log('  From:', firstH2WithoutKw);
    console.log('  To:', newH2);
  }
}

// 5. Fix meta description — shorten to under 145 chars
const currentMeta = post.meta?._yoast_wpseo_metadesc || '';
let newMeta = currentMeta;
if (currentMeta.length > 145) {
  // Truncate at last complete word before 145 chars
  newMeta = currentMeta.substring(0, 145).replace(/\s+\S*$/, '');
  // Make sure it ends cleanly
  if (!newMeta.endsWith('.')) newMeta = newMeta.replace(/[,;:—\-]+$/, '') + '.';
  console.log('\nShortened meta description:');
  console.log('  From:', currentMeta.length, 'chars:', currentMeta);
  console.log('  To:', newMeta.length, 'chars:', newMeta);
}

// 6. Apply patches
const updates = {};
if (newRaw !== raw) updates.content = newRaw;
if (newMeta !== currentMeta) {
  updates.meta = { ...post.meta, _yoast_wpseo_metadesc: newMeta };
}

if (Object.keys(updates).length === 0) {
  console.log('\nNo patches needed.');
  process.exit(0);
}

const patchRes = await fetch(`${WP_URL}/wp-json/wp/v2/posts/${post.id}`, {
  method: 'POST',
  headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json' },
  body: JSON.stringify(updates),
});
const patchData = await patchRes.json();
if (patchData.id) {
  console.log('\n✅ Post patched successfully');
  // Verify
  const newRendered = patchData.content?.rendered || '';
  const newH2s = newRendered.match(/<h2[^>]*>(.*?)<\/h2>/gi) || [];
  const kwInH2 = newH2s.some(h => h.toLowerCase().includes(kw));
  console.log('Keyphrase in H2 after patch:', kwInH2 ? '✅' : '❌');
  console.log('New metadesc length:', (patchData.meta?._yoast_wpseo_metadesc || '').length);
} else {
  console.log('\n❌ Patch failed:', JSON.stringify(patchData).substring(0, 300));
}
