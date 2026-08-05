import { createRequire } from 'module';
const require = createRequire(import.meta.url);
require('dotenv').config();

const CLIENT_ID = process.env.KAJABI_CLIENT_ID;
const CLIENT_SECRET = process.env.KAJABI_CLIENT_SECRET;
const TOKEN_URL = 'https://api.kajabi.com/v1/oauth/token';
const API_BASE = 'https://api.kajabi.com/v1';
const URBAN_MONK_SITE_ID = '2148432935';
const TAG_NAME = 'Interconnected Opt In';

const tokenRes = await fetch(TOKEN_URL, {
  method: 'POST',
  headers: {'Content-Type': 'application/x-www-form-urlencoded'},
  body: new URLSearchParams({grant_type:'client_credentials', client_id:CLIENT_ID, client_secret:CLIENT_SECRET})
});
const tokenData = await tokenRes.json();
const token = tokenData.access_token;
console.log('Token OK:', token.substring(0,12)+'...');

// Step 1: Resolve tag ID
const tagSearchRes = await fetch(`${API_BASE}/contact_tags?filter[name_cont]=${encodeURIComponent(TAG_NAME)}&page[size]=25`, {
  headers: {Authorization: `Bearer ${token}`, Accept: 'application/vnd.api+json'}
});
const tagSearchData = await tagSearchRes.json();
const exactTag = (tagSearchData.data || []).find(t => t.attributes?.name?.toLowerCase() === TAG_NAME.toLowerCase());
if (!exactTag) { console.error('Tag not found!', tagSearchData.data?.map(t => t.attributes?.name)); process.exit(1); }
const tagId = exactTag.id;
console.log(`Tag found: "${TAG_NAME}" ID: ${tagId}`);

// Step 2: Create a test contact
const testEmail = `bulk_tag_test_${Date.now()}@test.com`;
const contactRes = await fetch(`${API_BASE}/contacts`, {
  method: 'POST',
  headers: {'Content-Type': 'application/vnd.api+json', Accept: 'application/vnd.api+json', Authorization: `Bearer ${token}`},
  body: JSON.stringify({data: {type: 'contacts', attributes: {email: testEmail, first_name: 'Bulk', last_name: 'Test'}, relationships: {site: {data: {type: 'sites', id: URBAN_MONK_SITE_ID}}}}})
});
const contactData = await contactRes.json();
if (!contactRes.ok) { console.error('Create contact failed:', contactRes.status, JSON.stringify(contactData)); process.exit(1); }
const contactId = contactData.data?.id;
console.log(`Test contact created: ${testEmail} ID: ${contactId}`);

// Step 3: Apply tag
const tagRes = await fetch(`${API_BASE}/contacts/${contactId}/relationships/tags`, {
  method: 'POST',
  headers: {Authorization: `Bearer ${token}`, 'Content-Type': 'application/vnd.api+json', Accept: 'application/vnd.api+json'},
  body: JSON.stringify({data: [{id: tagId, type: 'contact_tags'}]})
});
if (!tagRes.ok) {
  const txt = await tagRes.text();
  console.error(`Tag apply failed: ${tagRes.status}`, txt.substring(0, 500));
} else {
  console.log(`✅ Tag applied successfully! Status: ${tagRes.status}`);
}
