import 'dotenv/config';

const base = (process.env.WORDPRESS_URL || 'https://theurbanmonk.com').replace(/\/$/, '');
const user = process.env.WORDPRESS_USERNAME;
const pass = process.env.WORDPRESS_APP_PASSWORD;
const auth = Buffer.from(`${user}:${pass}`).toString('base64');

async function testPost(wpPostId, label) {
  try {
    const res = await fetch(`${base}/wp-json/wp/v2/posts/${wpPostId}?context=edit`, {
      headers: { Authorization: `Basic ${auth}` }
    });
    const body = await res.text();
    if (!res.ok) {
      console.log(`POST ${wpPostId} (${label}) → HTTP ${res.status}: ${body.slice(0, 300)}`);
    } else {
      const data = JSON.parse(body);
      console.log(`POST ${wpPostId} (${label}) → OK | status: ${data.status} | content len: ${data.content?.rendered?.length ?? 'N/A'} | raw len: ${data.content?.raw?.length ?? 'N/A'}`);
    }
  } catch (e) {
    console.log(`POST ${wpPostId} (${label}) → EXCEPTION: ${e.message}`);
  }
}

// Also test updateWpPostContent to see if it throws
async function testUpdate(wpPostId, label) {
  try {
    const res = await fetch(`${base}/wp-json/wp/v2/posts/${wpPostId}`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ content: '<p>test</p>' }),
    });
    const body = await res.text();
    if (!res.ok) {
      console.log(`UPDATE ${wpPostId} (${label}) → HTTP ${res.status}: ${body.slice(0, 300)}`);
    } else {
      console.log(`UPDATE ${wpPostId} (${label}) → OK`);
    }
  } catch (e) {
    console.log(`UPDATE ${wpPostId} (${label}) → EXCEPTION: ${e.message}`);
  }
}

console.log('Testing fetch...');
await testPost(9725, 'Gut Dysbiosis');
await testPost(9739, 'Complete Gut Health Guide');

console.log('\nTesting update (dry-run with dummy content)...');
await testUpdate(9725, 'Gut Dysbiosis');
await testUpdate(9739, 'Complete Gut Health Guide');
