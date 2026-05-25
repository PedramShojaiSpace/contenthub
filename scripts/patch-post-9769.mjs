import 'dotenv/config';

const WP_URL = process.env.WORDPRESS_URL;
const WP_USER = process.env.WORDPRESS_USERNAME;
const WP_PASS = process.env.WORDPRESS_APP_PASSWORD;
const auth = Buffer.from(`${WP_USER}:${WP_PASS}`).toString('base64');

const POST_ID = 9769;

// Fix 1: Shorten meta description to under 150 chars
const newMetadesc = 'Discover why elimination diets fail to heal your gut for good. Learn to rebuild your gut ecosystem for lasting relief from bloating and brain fog.';
console.log('New metadesc length:', newMetadesc.length, 'chars');

// Fix 2: Shorten SEO title to under 48 chars (Yoast adds " | The Urban Monk")
const newTitle = 'Heal Your Gut for Good: Beyond Diets';
console.log('New title length:', newTitle.length, 'chars');
console.log('Full with site:', newTitle + ' | The Urban Monk', '=', (newTitle + ' | The Urban Monk').length, 'chars');

// Patch the post meta
const res = await fetch(`${WP_URL}/wp-json/wp/v2/posts/${POST_ID}`, {
  method: 'POST',
  headers: {
    Authorization: `Basic ${auth}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    meta: {
      _yoast_wpseo_metadesc: newMetadesc,
      _yoast_wpseo_title: `${newTitle} %%page%% %%sep%% %%sitename%%`,
    },
  }),
});

const data = await res.json();
if (data.id) {
  console.log('✅ Post patched successfully');
  console.log('Updated metadesc:', data.meta?._yoast_wpseo_metadesc);
  console.log('Updated title:', data.meta?._yoast_wpseo_title);
} else {
  console.log('❌ Error:', JSON.stringify(data));
}

// Also check the actual rendered content to see if headings are h2 tags
const postRes = await fetch(`${WP_URL}/wp-json/wp/v2/posts/${POST_ID}?context=edit`, {
  headers: { Authorization: `Basic ${auth}` },
});
const postData = await postRes.json();
const content = postData.content?.rendered || '';

// Count h2 tags
const h2Count = (content.match(/<h2/gi) || []).length;
const h3Count = (content.match(/<h3/gi) || []).length;
console.log('\n=== RENDERED CONTENT HEADING TAGS ===');
console.log('H2 tags:', h2Count);
console.log('H3 tags:', h3Count);

// Check keyphrase in h2
const h2Matches = content.match(/<h2[^>]*>.*?<\/h2>/gi) || [];
console.log('H2 contents:');
h2Matches.forEach(h => console.log(' -', h.replace(/<[^>]+>/g, '')));

// Count keyphrase in body (excluding title)
const bodyText = content.replace(/<[^>]+>/g, ' ').toLowerCase();
const kwCount = (bodyText.match(/heal your gut for good/g) || []).length;
console.log('\nKeyphrase count in rendered body:', kwCount);
