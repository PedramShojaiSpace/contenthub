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

  // Test 1: orders with offer_id — check if it actually filters
  console.log('=== orders?offer_id=2151314475 page 1 ===');
  const r1 = await fetch(`${KAJABI_API_BASE}/orders?offer_id=${OFFER_ID}&page[number]=1`, { headers });
  console.log('Status:', r1.status);
  const d1 = await r1.json();
  console.log('Count:', d1.data?.length);
  console.log('Links:', JSON.stringify(d1.links));
  // Show all orders with amounts
  for (const o of (d1.data || [])) {
    const amount = o.attributes?.total_price_in_cents || 0;
    const date = o.attributes?.created_at?.split('T')[0] || '';
    const orderNum = o.attributes?.order_number || '';
    console.log(`  $${amount/100} | ${date} | order#${orderNum}`);
  }

  // Test 2: orders without filter to compare
  console.log('\n=== orders (no filter) page 1 ===');
  const r2 = await fetch(`${KAJABI_API_BASE}/orders?page[number]=1`, { headers });
  console.log('Status:', r2.status);
  const d2 = await r2.json();
  console.log('Count:', d2.data?.length);
  // Show first 5
  for (const o of (d2.data || []).slice(0, 5)) {
    const amount = o.attributes?.total_price_in_cents || 0;
    const date = o.attributes?.created_at?.split('T')[0] || '';
    const orderNum = o.attributes?.order_number || '';
    console.log(`  $${amount/100} | ${date} | order#${orderNum}`);
  }

  // Test 3: Check if the orders with offer_id filter are the same as without
  const orderNums1 = new Set((d1.data || []).map(o => o.attributes?.order_number));
  const orderNums2 = new Set((d2.data || []).slice(0, 5).map(o => o.attributes?.order_number));
  console.log('\nFirst 5 order numbers match (filter ignored)?', 
    [...orderNums2].every(n => orderNums1.has(n)));

  // Test 4: orders with a different offer_id to see if results change
  console.log('\n=== orders?offer_id=2151104453 (Upstream $100) page 1 ===');
  const r3 = await fetch(`${KAJABI_API_BASE}/orders?offer_id=2151104453&page[number]=1`, { headers });
  const d3 = await r3.json();
  console.log('Count:', d3.data?.length);
  for (const o of (d3.data || []).slice(0, 3)) {
    const amount = o.attributes?.total_price_in_cents || 0;
    const date = o.attributes?.created_at?.split('T')[0] || '';
    console.log(`  $${amount/100} | ${date}`);
  }
  
  // Check if same order numbers as offer_id=2151314475
  const orderNums3 = new Set((d3.data || []).map(o => o.attributes?.order_number));
  const overlap = [...orderNums1].filter(n => orderNums3.has(n));
  console.log(`Overlap between offer 2151314475 and 2151104453: ${overlap.length} orders (if same, filter is ignored)`);
  
  // Test 5: Check what the orders look like — do they have offer relationships?
  console.log('\n=== First order full structure ===');
  const firstOrder = d1.data?.[0];
  if (firstOrder) {
    console.log('id:', firstOrder.id);
    console.log('type:', firstOrder.type);
    console.log('attributes:', JSON.stringify(firstOrder.attributes, null, 2));
    console.log('relationships:', JSON.stringify(firstOrder.relationships, null, 2));
  }
}

main().catch(console.error);
