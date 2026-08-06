/**
 * Test the page[number] pagination syntax on purchases endpoint
 * and find the $67 OTO sales using the orders endpoint.
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
  return data.access_token;
}

async function main() {
  const token = await getToken();
  const headers = { Authorization: `Bearer ${token}`, Accept: 'application/json' };

  // Test 1: page[number]=2 on purchases
  console.log('=== TEST: page[number]=2 on purchases ===');
  const r1 = await fetch(`${KAJABI_API_BASE}/purchases?page[number]=2`, { headers });
  console.log('Status:', r1.status);
  if (r1.ok) {
    const d1 = await r1.json();
    console.log('Count:', d1.data?.length);
    console.log('Links:', JSON.stringify(d1.links));
    // Show first item
    if (d1.data?.[0]) {
      const p = d1.data[0];
      console.log('First: $' + (p.attributes?.amount_in_cents/100) + ' | offer:' + p.relationships?.offer?.data?.id + ' | ' + p.attributes?.created_at?.split('T')[0]);
    }
  }

  // Test 2: orders with page[number]=2
  console.log('\n=== TEST: orders page[number]=2 ===');
  const r2 = await fetch(`${KAJABI_API_BASE}/orders?page[number]=2`, { headers });
  console.log('Status:', r2.status);
  if (r2.ok) {
    const d2 = await r2.json();
    console.log('Count:', d2.data?.length);
    // Show structure of first order
    if (d2.data?.[0]) {
      const o = d2.data[0];
      console.log('First order attrs:', Object.keys(o.attributes || {}).join(', '));
      console.log('First order relationships:', Object.keys(o.relationships || {}).join(', '));
      console.log('First order total: $' + (o.attributes?.total_price_in_cents/100));
      console.log('First order created_at:', o.attributes?.created_at);
      // Show relationships
      for (const [key, val] of Object.entries(o.relationships || {})) {
        console.log(`  rel.${key}:`, JSON.stringify(val?.data));
      }
    }
  }

  // Test 3: orders filtered by offer_id with page[number]
  console.log('\n=== TEST: orders?offer_id=OFFER_ID&page[number]=1 ===');
  const r3 = await fetch(`${KAJABI_API_BASE}/orders?offer_id=${OFFER_ID}&page[number]=1`, { headers });
  console.log('Status:', r3.status);
  if (r3.ok) {
    const d3 = await r3.json();
    console.log('Count:', d3.data?.length);
    console.log('Links:', JSON.stringify(d3.links));
    // Show first 3 orders
    for (const o of (d3.data || []).slice(0, 3)) {
      console.log('  Order $' + (o.attributes?.total_price_in_cents/100) + ' | ' + o.attributes?.created_at?.split('T')[0]);
      for (const [key, val] of Object.entries(o.relationships || {})) {
        if (val?.data) console.log(`    rel.${key}:`, JSON.stringify(val.data));
      }
    }
  }

  // Test 4: orders with include=line_items to see offer info
  console.log('\n=== TEST: orders?include=line_items ===');
  const r4 = await fetch(`${KAJABI_API_BASE}/orders?include=line_items`, { headers });
  console.log('Status:', r4.status);
  if (r4.ok) {
    const d4 = await r4.json();
    console.log('Count:', d4.data?.length);
    console.log('Included types:', [...new Set((d4.included || []).map(i => i.type))].join(', '));
    // Show included line items
    for (const item of (d4.included || []).slice(0, 5)) {
      console.log('  included:', item.type, JSON.stringify(item.attributes));
    }
  }

  // Test 5: transactions with site_id
  console.log('\n=== TEST: transactions with filter[site_id]=2148432935 ===');
  const r5 = await fetch(`${KAJABI_API_BASE}/transactions?filter[site_id]=2148432935`, { headers });
  console.log('Status:', r5.status);
  if (r5.ok) {
    const d5 = await r5.json();
    console.log('Count:', d5.data?.length);
    console.log('Links:', JSON.stringify(d5.links));
    if (d5.data?.[0]) {
      const t = d5.data[0];
      console.log('First transaction attrs:', Object.keys(t.attributes || {}).join(', '));
      console.log('First transaction amount:', t.attributes?.amount_in_cents);
      console.log('First transaction created_at:', t.attributes?.created_at);
    }
  } else {
    const errText = await r5.text();
    console.log('Error:', errText.substring(0, 200));
  }

  // Test 6: transactions with site_id + offer filter
  console.log('\n=== TEST: transactions with site_id + offer_id ===');
  const r6 = await fetch(`${KAJABI_API_BASE}/transactions?filter[site_id]=2148432935&filter[offer_id]=${OFFER_ID}`, { headers });
  console.log('Status:', r6.status);
  if (r6.ok) {
    const d6 = await r6.json();
    console.log('Count:', d6.data?.length);
    console.log('Links:', JSON.stringify(d6.links));
    for (const t of (d6.data || []).slice(0, 5)) {
      console.log('  $' + (t.attributes?.amount_in_cents/100) + ' | ' + t.attributes?.created_at?.split('T')[0]);
    }
  } else {
    const errText = await r6.text();
    console.log('Error:', errText.substring(0, 300));
  }
}

main().catch(console.error);
