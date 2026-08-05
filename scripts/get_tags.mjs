import { createRequire } from 'module';
const require = createRequire(import.meta.url);
require('dotenv').config();

const CLIENT_ID = process.env.KAJABI_CLIENT_ID;
const CLIENT_SECRET = process.env.KAJABI_CLIENT_SECRET;
const TOKEN_URL = 'https://api.kajabi.com/v1/oauth/token';
const API_BASE = 'https://api.kajabi.com/v1';

const tokenRes = await fetch(TOKEN_URL, {
  method: 'POST',
  headers: {'Content-Type': 'application/x-www-form-urlencoded'},
  body: new URLSearchParams({grant_type:'client_credentials', client_id:CLIENT_ID, client_secret:CLIENT_SECRET})
});
const tokenData = await tokenRes.json();
const token = tokenData.access_token;

// Get all tags - paginate
let allTags = [];
let page = 1;
while (true) {
  const res = await fetch(`${API_BASE}/contact_tags?page[size]=100&page[number]=${page}`, {
    headers: {Authorization: `Bearer ${token}`, Accept: 'application/vnd.api+json'}
  });
  const data = await res.json();
  const tags = data.data || [];
  allTags = allTags.concat(tags);
  if (tags.length < 100) break;
  page++;
}

console.log(`Total tags: ${allTags.length}`);
console.log('\n=== ALL TAGS (sorted by count) ===');
allTags.sort((a,b) => (b.attributes?.contacts_count||0) - (a.attributes?.contacts_count||0));
for (const t of allTags) {
  const name = t.attributes?.name || '';
  const count = t.attributes?.contacts_count || 0;
  const mark = name.toLowerCase().includes('interconnect') ? ' <<<< INTERCONNECTED' : '';
  if (count > 0 || name.toLowerCase().includes('interconnect')) {
    console.log(`  [${t.id}] "${name}" — ${count} contacts${mark}`);
  }
}
