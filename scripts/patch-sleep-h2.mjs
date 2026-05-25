import 'dotenv/config';

const WP_URL = process.env.WORDPRESS_URL;
const WP_USER = process.env.WORDPRESS_USERNAME;
const WP_PASS = process.env.WORDPRESS_APP_PASSWORD;
const auth = Buffer.from(`${WP_USER}:${WP_PASS}`).toString('base64');

const POST_ID = 9773;

// Get raw content
const res = await fetch(`${WP_URL}/wp-json/wp/v2/posts/${POST_ID}?context=edit`, {
  headers: { Authorization: `Basic ${auth}` }
});
const post = await res.json();
let raw = post.content?.raw || '';

console.log('Raw content length:', raw.length);

// Show all lines that look like headings (plain text headings in Classic Editor)
const lines = raw.split('\n');
console.log('\nAll heading-like lines:');
lines.forEach((line, i) => {
  if (line.trim().length > 10 && line.trim().length < 120 && 
      /^[A-Z]/.test(line.trim()) && !line.startsWith(' ') &&
      !line.includes('http') && !line.includes('[') && !line.includes('**')) {
    console.log(`  Line ${i}: "${line.trim()}"`);
  }
});

// The key insight: in Classic Editor, headings are stored as plain text lines
// that get wrapped in <p> tags — UNLESS they're formatted as HTML in the raw content
// Let's check if there are any <h2> tags in the raw content
const rawH2Count = (raw.match(/<h2/gi) || []).length;
console.log('\nRaw <h2> tag count:', rawH2Count);

// Show raw h2 tags if any
const rawH2s = raw.match(/<h2[^>]*>.*?<\/h2>/gi) || [];
rawH2s.forEach(h => console.log('  Raw H2:', h.replace(/<[^>]+>/g, '')));

// The fix: rename "The Circadian Reset Protocol: Three Pillars for Natural Sleep"
// to include "natural sleep remedies" explicitly
const targetH2 = 'The Circadian Reset Protocol: Three Pillars for Natural Sleep';
const newH2 = 'Natural Sleep Remedies: The Circadian Reset Protocol';

if (raw.includes(targetH2)) {
  raw = raw.replace(targetH2, newH2);
  console.log('\n✅ Found and replaced target H2');
  console.log('  From:', targetH2);
  console.log('  To:', newH2);
} else {
  // Try to find it in rendered H2 tags
  console.log('\n⚠️ Target H2 not found as plain text, checking for HTML H2 tags...');
  
  // Try replacing in HTML format
  const htmlTarget = `<h2>${targetH2}</h2>`;
  const htmlTarget2 = `<h2 class="wp-block-heading">${targetH2}</h2>`;
  
  if (raw.includes(htmlTarget)) {
    raw = raw.replace(htmlTarget, `<h2>${newH2}</h2>`);
    console.log('✅ Replaced HTML H2 (no class)');
  } else if (raw.includes(htmlTarget2)) {
    raw = raw.replace(htmlTarget2, `<h2 class="wp-block-heading">${newH2}</h2>`);
    console.log('✅ Replaced HTML H2 (with class)');
  } else {
    // Show a snippet of raw content around "Circadian"
    const idx = raw.indexOf('Circadian');
    if (idx > -1) {
      console.log('Found "Circadian" at index', idx);
      console.log('Context:', raw.substring(idx - 50, idx + 150));
    } else {
      console.log('❌ "Circadian" not found in raw content at all');
      // Show first 500 chars of raw
      console.log('First 500 chars of raw:', raw.substring(0, 500));
    }
  }
}

// Apply the patch
const patchRes = await fetch(`${WP_URL}/wp-json/wp/v2/posts/${POST_ID}`, {
  method: 'POST',
  headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ content: raw }),
});
const patchData = await patchRes.json();
if (patchData.id) {
  const newRendered = patchData.content?.rendered || '';
  const h2s = newRendered.match(/<h2[^>]*>(.*?)<\/h2>/gi) || [];
  const kwInH2 = h2s.some(h => h.toLowerCase().includes('natural sleep remedies'));
  console.log('\n✅ Post updated');
  console.log('Keyphrase in H2:', kwInH2 ? '✅ YES' : '❌ NO');
  console.log('H2 headings now:');
  h2s.forEach(h => console.log(' -', h.replace(/<[^>]+>/g, '')));
} else {
  console.log('❌ Update failed:', JSON.stringify(patchData).substring(0, 200));
}
