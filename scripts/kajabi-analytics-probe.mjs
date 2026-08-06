/**
 * Probe Kajabi API for analytics/reports endpoints and alternative purchase data sources
 * that might give us more than 30 records or allow filtering by offer ID.
 */
import 'dotenv/config';

const KAJABI_API_BASE = 'https://api.kajabi.com/v1';
const KAJABI_TOKEN_URL = 'https://api.kajabi.com/v1/oauth/token';
const OFFER_ID = '2151314475'; // Interconnected $67 Bundle OTO

async function getToken() {
  const res = await fetch(KAJABI_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: process.env.KAJABI_CLIENT_ID,
      client_secret: process.env.KAJABI_CLIENT_SECRET,
    }),
  });
  const data = await res.json();
  if (!data.access_token) throw new Error('No token: ' + JSON.stringify(data));
  return data.access_token;
}

async function probe(token, path, label) {
  const url = `${KAJABI_API_BASE}${path}`;
  console.log(`\n[${label}] GET ${url}`);
  try {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    });
    console.log(`  Status: ${res.status} ${res.statusText}`);
    if (res.ok) {
      const text = await res.text();
      const data = JSON.parse(text);
      const keys = Object.keys(data);
      console.log(`  Top-level keys: ${keys.join(', ')}`);
      if (data.data) console.log(`  data.length: ${data.data.length}`);
      if (data.meta) console.log(`  meta: ${JSON.stringify(data.meta)}`);
      if (data.links) console.log(`  links: ${JSON.stringify(data.links)}`);
      // Show first item structure
      if (data.data && data.data[0]) {
        const first = data.data[0];
        console.log(`  First item type: ${first.type}`);
        console.log(`  First item attrs: ${Object.keys(first.attributes || {}).join(', ')}`);
        // If it looks like a purchase, show amount
        if (first.attributes?.amount_in_cents !== undefined) {
          console.log(`  First item amount: $${first.attributes.amount_in_cents / 100}`);
          console.log(`  First item offer_id: ${first.relationships?.offer?.data?.id}`);
          console.log(`  First item created_at: ${first.attributes.created_at}`);
        }
      }
      return data;
    } else {
      const text = await res.text();
      console.log(`  Error body: ${text.substring(0, 300)}`);
    }
  } catch (e) {
    console.log(`  Exception: ${e.message}`);
  }
  return null;
}

async function main() {
  const token = await getToken();
  console.log('Token acquired ✓\n');

  // 1. Try purchases with per_page=100 (may cause 500)
  await probe(token, '/purchases?per_page=100', 'purchases per_page=100');
  
  // 2. Try purchases with per_page=25 (just under the 500 threshold)
  await probe(token, '/purchases?per_page=25', 'purchases per_page=25');

  // 3. Try purchases with created_at filter
  await probe(token, `/purchases?filter[created_at_gteq]=2026-07-01`, 'purchases filter[created_at_gteq]');

  // 4. Try purchases with offer_id in filter brackets
  await probe(token, `/purchases?filter[offer_id]=${OFFER_ID}`, 'purchases filter[offer_id]');

  // 5. Try the offer's purchases sub-resource
  await probe(token, `/offers/${OFFER_ID}/purchases`, 'offer sub-resource /purchases');

  // 6. Try offer members
  await probe(token, `/offers/${OFFER_ID}/members`, 'offer sub-resource /members');

  // 7. Try offer grant_accesses
  await probe(token, `/offers/${OFFER_ID}/grant_accesses`, 'offer sub-resource /grant_accesses');

  // 8. Try grant_accesses top-level
  await probe(token, `/grant_accesses?offer_id=${OFFER_ID}`, 'grant_accesses?offer_id');
  await probe(token, `/grant_accesses?filter[offer_id]=${OFFER_ID}`, 'grant_accesses filter[offer_id]');

  // 9. Try orders endpoint (different from purchases)
  await probe(token, '/orders', 'orders');
  await probe(token, `/orders?offer_id=${OFFER_ID}`, 'orders?offer_id');

  // 10. Try transactions endpoint
  await probe(token, '/transactions', 'transactions');
  await probe(token, `/transactions?offer_id=${OFFER_ID}`, 'transactions?offer_id');

  // 11. Try sales endpoint
  await probe(token, '/sales', 'sales');

  // 12. Try analytics endpoint
  await probe(token, '/analytics', 'analytics');
  await probe(token, `/analytics/purchases`, 'analytics/purchases');
  await probe(token, `/analytics/revenue`, 'analytics/revenue');

  // 13. Try reports endpoint
  await probe(token, '/reports', 'reports');
  await probe(token, `/reports/purchases`, 'reports/purchases');

  // 14. Try events endpoint
  await probe(token, '/events', 'events');
  await probe(token, `/events?type=purchase`, 'events?type=purchase');

  // 15. Try webhooks endpoint (to see if we can register one)
  await probe(token, '/webhooks', 'webhooks');
  await probe(token, '/webhook_subscriptions', 'webhook_subscriptions');
}

main().catch(console.error);
