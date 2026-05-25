import 'dotenv/config';

const WP_URL = process.env.WORDPRESS_URL;
const WP_USER = process.env.WORDPRESS_USERNAME;
const WP_PASS = process.env.WORDPRESS_APP_PASSWORD;
const auth = Buffer.from(`${WP_USER}:${WP_PASS}`).toString('base64');

const POST_ID = 9769;

// Get current post content
const postRes = await fetch(`${WP_URL}/wp-json/wp/v2/posts/${POST_ID}?context=edit`, {
  headers: { Authorization: `Basic ${auth}` },
});
const postData = await postRes.json();
let content = postData.content?.raw || '';

console.log('Current content length:', content.length);
console.log('Current keyphrase count in raw:', (content.toLowerCase().match(/heal your gut for good/g) || []).length);

// Add 4 more natural occurrences of the keyphrase in strategic locations
// 1. Add to the intro paragraph - after "Many people struggle to heal your gut for good"
// 2. Add to the "What Most People Get Wrong" section
// 3. Add to the "How Do You Start This Week" section
// 4. Add to the conclusion

// Patch 1: Add to the systemic imbalance section
content = content.replace(
  'Therefore, we must address these root causes to truly heal your gut for good.',
  'Therefore, we must address these root causes to truly heal your gut for good. Understanding this systemic view is the foundation of everything we do to heal your gut for good.'
);

// Patch 2: Add to the "What Most People Get Wrong" section
content = content.replace(
  'This fragmented approach yields fragmented results. We must adopt a holistic strategy to truly resolve these issues.',
  'This fragmented approach yields fragmented results. We must adopt a holistic strategy to truly resolve these issues and heal your gut for good.'
);

// Patch 3: Add to the "How Do You Start This Week" intro
content = content.replace(
  'Starting your gut healing journey does not require radical changes overnight.',
  'Starting your journey to heal your gut for good does not require radical changes overnight.'
);

// Patch 4: Add to the conclusion
content = content.replace(
  'Your journey to optimal gut health is a profound one.',
  'Your journey to heal your gut for good is a profound one.'
);

const newCount = (content.toLowerCase().match(/heal your gut for good/g) || []).length;
console.log('New keyphrase count in raw:', newCount);

// Update the post
const res = await fetch(`${WP_URL}/wp-json/wp/v2/posts/${POST_ID}`, {
  method: 'POST',
  headers: {
    Authorization: `Basic ${auth}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ content }),
});

const data = await res.json();
if (data.id) {
  console.log('✅ Post content updated successfully');
  // Verify rendered count
  const rendered = (data.content?.rendered || '').replace(/<[^>]+>/g, ' ').toLowerCase();
  const renderedCount = (rendered.match(/heal your gut for good/g) || []).length;
  console.log('Keyphrase count in rendered body:', renderedCount, '(Yoast needs 6)');
} else {
  console.log('❌ Error:', JSON.stringify(data).substring(0, 200));
}
