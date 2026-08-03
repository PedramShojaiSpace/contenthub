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

async function fetchTransactionsForOffer(token, offerId, since) {
  const headers = { Authorization: `Bearer ${token}`, Accept: 'application/json' };
  const results = [];
  
  for (let page = 1; page <= 3; page++) {
    const url = `${KAJABI_API_BASE}/transactions?filter[site_id]=${SITE_ID}&filter[offer_id]=${offerId}&page[number]=${page}`;
    const res = await fetch(url, { headers });
    if (!res.ok) break;
    const data = await res.json();
    const rows = data.data || [];
    let hitOld = false;
    
    for (const row of rows) {
      const dateStr = row.attributes?.created_at?.split('T')[0] || '';
      if (dateStr < since) { hitOld = true; break; }
      const state = row.attributes?.state || '';
      const action = row.attributes?.action || '';
      const amount = row.attributes?.amount_in_cents || 0;
      if (amount > 0 && state !== 'failed' && state !== 'refunded' && action !== 'refund') {
        results.push({ offerId, amountCents: amount, createdAt: row.attributes?.created_at, state });
      }
    }
    if (hitOld || !data.links?.next) break;
  }
  return results;
}

async function main() {
  const token = await getToken();
  
  // Test for last 30 days
  const since = new Date(); since.setDate(since.getDate() - 30);
  const sinceStr = since.toISOString().split('T')[0];
  
  console.log(`\n=== KAJABI SALES via TRANSACTIONS API (since ${sinceStr}) ===\n`);
  
  const allTx = [];
  for (const [offerId, info] of Object.entries(FUNNEL_OFFERS)) {
    const txs = await fetchTransactionsForOffer(token, offerId, sinceStr);
    if (txs.length > 0) {
      const revenue = txs.reduce((s, t) => s + t.amountCents, 0);
      console.log(`✓ ${info.label}: ${txs.length} sales · $${revenue/100}`);
      for (const tx of txs) {
        console.log(`    $${tx.amountCents/100} | ${tx.createdAt?.split('T')[0]} | state:${tx.state}`);
      }
    }
    allTx.push(...txs);
  }
  
  const totalRev = allTx.reduce((s, t) => s + t.amountCents, 0);
  console.log(`\n=== TOTAL: ${allTx.length} transactions · $${totalRev/100} revenue ===`);
  
  // Also check today specifically
  const today = new Date().toISOString().split('T')[0];
  const todayTx = allTx.filter(t => t.createdAt?.split('T')[0] === today);
  const todayRev = todayTx.reduce((s, t) => s + t.amountCents, 0);
  console.log(`\n=== TODAY (${today}): ${todayTx.length} transactions · $${todayRev/100} ===`);
}

main().catch(console.error);
