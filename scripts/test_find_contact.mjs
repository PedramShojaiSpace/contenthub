import { createRequire } from 'module';
const require = createRequire(import.meta.url);
require('dotenv').config();

const CLIENT_ID = process.env.KAJABI_CLIENT_ID;
const CLIENT_SECRET = process.env.KAJABI_CLIENT_SECRET;
const TOKEN_URL = 'https://api.kajabi.com/v1/oauth/token';
const API_BASE = 'https://api.kajabi.com/v1';
const URBAN_MONK_SITE_ID = '2148432935';

const tokenRes = await fetch(TOKEN_URL, {
  method: 'POST',
  headers: {'Content-Type': 'application/x-www-form-urlencoded'},
  body: new URLSearchParams({grant_type:'client_credentials', client_id:CLIENT_ID, client_secret:CLIENT_SECRET})
});
const tokenData = await tokenRes.json();
const token = tokenData.access_token;

const testEmail = 'pedram@theurbanmonk.com';

// Try different filter approaches
const approaches = [
  `${API_BASE}/contacts?filter[email_eq]=${encodeURIComponent(testEmail)}&page[size]=5`,
  `${API_BASE}/contacts?filter[email_cont]=${encodeURIComponent(testEmail)}&page[size]=5`,
  `${API_BASE}/contacts?filter[site_id]=${URBAN_MONK_SITE_ID}&filter[email_eq]=${encodeURIComponent(testEmail)}&page[size]=5`,
];

for (const url of approaches) {
  const res = await fetch(url, {headers: {Authorization: `Bearer ${token}`, Accept: 'application/vnd.api+json'}});
  const data = await res.json();
  const contacts = data.data || [];
  console.log(`URL: ${url.replace(API_BASE,'')}`);
  console.log(`  Status: ${res.status} | Contacts found: ${contacts.length}`);
  if (contacts.length > 0) {
    console.log(`  First: ID=${contacts[0].id} email=${contacts[0].attributes?.email}`);
  }
}
