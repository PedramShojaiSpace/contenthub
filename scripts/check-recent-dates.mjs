import dotenv from 'dotenv';
dotenv.config();

const KAJABI_TOKEN_URL = 'https://api.kajabi.com/v1/oauth/token';
const KAJABI_API_BASE = 'https://api.kajabi.com/v1';
const SITE_ID = '2148432935';

const tokenRes = await fetch(KAJABI_TOKEN_URL, {
  method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams({ grant_type: 'client_credentials', client_id: process.env.KAJABI_CLIENT_ID, client_secret: process.env.KAJABI_CLIENT_SECRET })
});
const tokenData = await tokenRes.json();
const token = tokenData.access_token;
console.log('Token OK:', !!token);

const url = `${KAJABI_API_BASE}/transactions?filter[site_id]=${SITE_ID}&page[number]=1`;
const res = await fetch(url, { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } });
const data = await res.json();
const txns = data.transactions || data.data || [];
console.log('\nMost recent 10 transactions:');
txns.slice(0, 10).forEach(t => {
  const ct = new Date(t.created_at).toLocaleString('en-US', { timeZone: 'America/Chicago' });
  console.log(`  ${ct} CT | $${(t.amount_in_cents||0)/100} | ${t.status}`);
});
console.log('\nServer time now:', new Date().toLocaleString('en-US', { timeZone: 'America/Chicago' }), 'CT');
