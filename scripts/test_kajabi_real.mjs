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

// Get tag ID
const tagSearchRes = await fetch(`${API_BASE}/contact_tags?filter[name_cont]=${encodeURIComponent(TAG_NAME)}&page[size]=25`, {
  headers: {Authorization: `Bearer ${token}`, Accept: 'application/vnd.api+json'}
});
const tagSearchData = await tagSearchRes.json();
const exactTag = (tagSearchData.data || []).find(t => t.attributes?.name?.toLowerCase() === TAG_NAME.toLowerCase());
const tagId = exactTag?.id;
console.log(`Tag ID: ${tagId}`);

// Try finding an existing contact by email (don't create test ones)
// Instead, look up a known lead from our DB and try tagging them
const testEmail = 'pedram@theurbanmonk.com'; // Use a real email to test
const searchRes = await fetch(`${API_BASE}/contacts?filter[email_eq]=${encodeURIComponent(testEmail)}&page[size]=1`, {
  headers: {Authorization: `Bearer ${token}`, Accept: 'application/vnd.api+json'}
});
const searchData = await searchRes.json();
const contact = searchData.data?.[0];
if (!contact) {
  console.log(`Contact not found for ${testEmail} — creating...`);
  const createRes = await fetch(`${API_BASE}/contacts`, {
    method: 'POST',
    headers: {'Content-Type': 'application/vnd.api+json', Accept: 'application/vnd.api+json', Authorization: `Bearer ${token}`},
    body: JSON.stringify({data: {type: 'contacts', attributes: {email: testEmail, first_name: 'Pedram', last_name: 'Shojai'}, relationships: {site: {data: {type: 'sites', id: URBAN_MONK_SITE_ID}}}}})
  });
  const createData = await createRes.json();
  console.log('Create result:', createRes.status, JSON.stringify(createData).substring(0, 200));
} else {
  const contactId = contact.id;
  console.log(`Found contact: ${testEmail} ID: ${contactId}`);
  
  // Apply tag
  const tagRes = await fetch(`${API_BASE}/contacts/${contactId}/relationships/tags`, {
    method: 'POST',
    headers: {Authorization: `Bearer ${token}`, 'Content-Type': 'application/vnd.api+json', Accept: 'application/vnd.api+json'},
    body: JSON.stringify({data: [{id: tagId, type: 'contact_tags'}]})
  });
  const tagBody = tagRes.status === 204 ? '(no body - success)' : await tagRes.text();
  console.log(`Tag apply: ${tagRes.status}`, tagBody.substring(0, 300));
}
