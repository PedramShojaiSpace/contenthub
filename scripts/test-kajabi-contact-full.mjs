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
  return d.access_token;
}

const token = await getToken();
const SITE_ID = '2148432935';

// Test 1: Create contact with site relationship (exact same payload as kajabiApi.ts)
console.log('=== TEST: Create contact with site relationship ===');
const body = {
  data: {
    type: 'contacts',
    attributes: { email: 'sharonsz@aol.com', first_name: 'Sharon' },
    relationships: {
      site: { data: { type: 'sites', id: SITE_ID } }
    }
  }
};
const res = await fetch('https://api.kajabi.com/v1/contacts', {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/vnd.api+json', 'Content-Type': 'application/vnd.api+json' },
  body: JSON.stringify(body)
});
const text = await res.text();
console.log('Status:', res.status);
console.log('Response:', text.slice(0, 600));

// Test 2: Look up existing contact by email
console.log('\n=== TEST: Find contact by email ===');
const findRes = await fetch(`https://api.kajabi.com/v1/contacts?filter[email_eq]=sharonsz@aol.com&page[size]=1`, {
  headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/vnd.api+json' }
});
const findData = await findRes.json();
console.log('Find status:', findRes.status);
if (findData.data?.length > 0) {
  const c = findData.data[0];
  console.log('Found contact:', c.id, '|', c.attributes?.email, '|', c.attributes?.first_name);
  
  // Test 3: Add "Interconnected Opt In" tag
  console.log('\n=== TEST: Find/create "Interconnected Opt In" tag ===');
  const tagSearchRes = await fetch(`https://api.kajabi.com/v1/contact_tags?filter[name_cont]=Interconnected+Opt+In&page[size]=25`, {
    headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/vnd.api+json' }
  });
  const tagData = await tagSearchRes.json();
  console.log('Tag search status:', tagSearchRes.status);
  const tags = tagData.data || [];
  const exactTag = tags.find(t => t.attributes?.name === 'Interconnected Opt In');
  
  if (exactTag) {
    console.log('Tag found:', exactTag.id, '|', exactTag.attributes.name);
    
    // Apply tag to contact
    console.log('\n=== TEST: Apply tag to contact ===');
    const tagBody = {
      data: [{ id: exactTag.id, type: 'contact_tags' }]
    };
    const applyRes = await fetch(`https://api.kajabi.com/v1/contacts/${c.id}/relationships/tags`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/vnd.api+json', 'Content-Type': 'application/vnd.api+json' },
      body: JSON.stringify(tagBody)
    });
    const applyText = await applyRes.text();
    console.log('Apply tag status:', applyRes.status, applyText.slice(0, 200));
  } else {
    console.log('Tag "Interconnected Opt In" NOT found. Available tags with "Interconnected":');
    tags.forEach(t => console.log(' -', t.id, ':', t.attributes?.name));
  }
} else {
  console.log('Contact not found:', JSON.stringify(findData).slice(0, 300));
}
