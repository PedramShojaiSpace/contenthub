/**
 * Test the /orders endpoint with offer_id filter — this correctly returns
 * orders for a specific offer (unlike transactions which ignores the filter).
 * The orders endpoint has proper pagination with page[number].
 */
import 'dotenv/config';

const KAJABI_API_BASE = 'https://api.kajabi.com/v1';
const KAJABI_TOKEN_URL = 'https://api.kajabi.com/v1/oauth/token';
const SITE_ID = '2148432935';

const FUNNEL_OFFERS = {
  '2151314475': { label: 'Interconnected $67 Bundle OTO', priceCents: 6700 },
  '2151104453': { label: 'Upstream: Complete Microbiome $100', priceCents: 10000 },
  '2150918578': { label: 'Orobiome Testing Package $399', priceCents: 39900 },
  '2150678415': { label: 'Gateway to Health Testing $399', priceCents: 39900 },
  '2150129988': { label: 'Gut Test Kit $399', priceCents: 39900 },
  '2150080605': { label: 'Supported Package $499', priceCents: 49900 },
  '2151024712': { label: 'Explore Testing Tier DSS $1650', priceCents: 165000 },
  '2150311612': { label: 'Catalyst Coaching $5850 (a)', priceCents: 585000 },
  '2150129918': { label: 'Catalyst Coaching $5850 (b)', priceCents: 585000 },
};

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

async function fetchOrdersForOffer(token, offerId, since) {
  const headers = { Authorization: `Bearer ${token}`, Accept: 'application/json' };
  const results = [];
  
  for (let page = 1; page <= 5; page++) {
    const url = `${KAJABI_API_BASE}/orders?offer_id=${offerId}&page[number]=${page}`;
    const res = await fetch(url, { headers });
    if (!res.ok) { console.log(`  orders page ${page}: ${res.status}`); break; }
    const data = await res.json();
    const rows = data.data || [];
    let hitOld = false;
    
    for (const row of rows) {
      const dateStr = row.attributes?.created_at?.split('T')[0] || '';
      if (dateStr < since) { hitOld = true; break; }
      const amount = row.attributes?.total_price_in_cents || 0;
      if (amount > 0) {
        results.push({ 
          offerId, 
          amountCents: amount, 
          createdAt: row.attributes?.created_at,
          orderNumber: row.attributes?.order_number,
        });
      }
    }
    if (hitOld || !data.links?.next) break;
  }
  return results;
}

async function main() {
  const token = await getToken();
  
  // Last 30 days
  const since = new Date(); since.setDate(since.getDate() - 30);
  const sinceStr = since.toISOString().split('T')[0];
  const today = new Date().toISOString().split('T')[0];
  
  console.log(`\n=== KAJABI SALES via ORDERS API (since ${sinceStr}) ===\n`);
  
  const allOrders = [];
  for (const [offerId, info] of Object.entries(FUNNEL_OFFERS)) {
    const orders = await fetchOrdersForOffer(token, offerId, sinceStr);
    if (orders.length > 0) {
      const revenue = orders.reduce((s, o) => s + o.amountCents, 0);
      const todayOrders = orders.filter(o => o.createdAt?.split('T')[0] === today);
      const todayRev = todayOrders.reduce((s, o) => s + o.amountCents, 0);
      console.log(`✓ ${info.label}:`);
      console.log(`  30d: ${orders.length} orders · $${revenue/100}`);
      if (todayOrders.length > 0) {
        console.log(`  TODAY: ${todayOrders.length} orders · $${todayRev/100}`);
      }
      for (const o of orders.slice(0, 5)) {
        console.log(`    $${o.amountCents/100} | ${o.createdAt?.split('T')[0]} | order#${o.orderNumber}`);
      }
      if (orders.length > 5) console.log(`    ... and ${orders.length - 5} more`);
    }
    allOrders.push(...orders);
  }
  
  const totalRev = allOrders.reduce((s, o) => s + o.amountCents, 0);
  const todayAll = allOrders.filter(o => o.createdAt?.split('T')[0] === today);
  const todayRev = todayAll.reduce((s, o) => s + o.amountCents, 0);
  
  console.log(`\n=== TOTAL (30d): ${allOrders.length} orders · $${totalRev/100} ===`);
  console.log(`=== TODAY (${today}): ${todayAll.length} orders · $${todayRev/100} ===`);
  
  // Verify: check the $67 OTO specifically
  console.log('\n=== VERIFY: All $67 OTO orders ===');
  const otoOrders = allOrders.filter(o => o.offerId === '2151314475');
  for (const o of otoOrders) {
    console.log(`  $${o.amountCents/100} | ${o.createdAt?.split('T')[0]} | order#${o.orderNumber}`);
  }
  console.log(`Total $67 OTO: ${otoOrders.length} orders · $${otoOrders.reduce((s,o)=>s+o.amountCents,0)/100}`);
}

main().catch(console.error);
