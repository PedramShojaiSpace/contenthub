import * as dotenv from 'dotenv';
dotenv.config();

async function getToken() {
  const res = await fetch('https://api.kajabi.com/v1/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: process.env.KAJABI_CLIENT_ID,
      client_secret: process.env.KAJABI_CLIENT_SECRET,
    })
  });
  const d = await res.json();
  if (!res.ok) throw new Error('Token failed: ' + JSON.stringify(d).slice(0,200));
  return d.access_token;
}

const token = await getToken();
console.log('Kajabi token obtained ✓');

// Test 1: Create a contact (Sharon from our DB)
console.log('\n=== TEST: Create Contact ===');
const contactBody = {
  data: {
    type: 'contacts',
    attributes: {
      email: 'sharonsz@aol.com',
      name: 'Sharon',
    }
  }
};
const cRes = await fetch('https://api.kajabi.com/v1/contacts', {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/vnd.api+json', 'Content-Type': 'application/vnd.api+json' },
  body: JSON.stringify(contactBody)
});
const cText = await cRes.text();
console.log('Create contact status:', cRes.status);
console.log('Response:', cText.slice(0, 500));

// Test 2: List available tags
console.log('\n=== AVAILABLE TAGS ===');
const tRes = await fetch('https://api.kajabi.com/v1/contact_tags?page[size]=20', {
  headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/vnd.api+json' }
});
const tData = await tRes.json();
console.log('Tags status:', tRes.status);
if (tData.data) {
  tData.data.forEach(t => console.log(' -', t.id, ':', t.attributes?.name));
} else {
  console.log(JSON.stringify(tData).slice(0,400));
}
