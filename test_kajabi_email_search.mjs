import { config } from 'dotenv';
config();

const tokenRes = await fetch('https://api.kajabi.com/v1/oauth/token', {
  method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams({ grant_type: 'client_credentials', client_id: process.env.KAJABI_CLIENT_ID, client_secret: process.env.KAJABI_CLIENT_SECRET })
});
const { access_token } = await tokenRes.json();
const SITE_ID = '2148432935';
const TEST_EMAIL = 'kdweldon@gmail.com';

// Test different filter approaches
const filters = [
  `filter[email_eq]=${encodeURIComponent(TEST_EMAIL)}`,
  `filter[email_cont]=${encodeURIComponent(TEST_EMAIL)}`,
  `filter[email_cont]=${encodeURIComponent('kdweldon')}`,
  `q=${encodeURIComponent(TEST_EMAIL)}`,
  `search=${encodeURIComponent(TEST_EMAIL)}`,
];

for (const filter of filters) {
  const url = `https://api.kajabi.com/v1/contacts?${filter}&filter[site_id]=${SITE_ID}&page[size]=5`;
  const res = await fetch(url, { headers: { 'Authorization': `Bearer ${access_token}`, 'Accept': 'application/vnd.api+json' } });
  const data = await res.json();
  const count = data?.data?.length ?? 0;
  const emails = data?.data?.slice(0,3).map(c => c.attributes?.email).join(', ');
  console.log(`${filter.split('=')[0]}: status=${res.status} count=${count} emails=[${emails}]`);
}
