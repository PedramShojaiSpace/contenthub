/**
 * Fetch all transactions for the site and match by amount to identify funnel sales.
 * The Kajabi API has broken offer_id filters on all endpoints.
 * The only working approach is: GET /transactions?filter[site_id]=SITE_ID&page[number]=N
 * then match amounts to known offer price tiers.
 */
import 'dotenv/config';

const KAJABI_API_BASE = 'https://api.kajabi.com/v1';
const KAJABI_TOKEN_URL = 'https://api.kajabi.com/v1/oauth/token';
const SITE_ID = '2148432935';

// Map of amount_in_cents → tier label (for the funnel offers we care about)
const AMOUNT_TO_TIER = {
  6700:   { tier: '67',   label: 'Interconnected $67 Bundle OTO' },
  10000:  { tier: '100',  label: 'Upstream: Complete Microbiome $100' },
  39900:  { tier: '399',  label: 'Testing Package $399' },
  49900:  { tier: '499',  label: 'Supported Package $499' },
  165000: { tier: '1650', label: 'Explore Testing Tier DSS $1650' },
  585000: { tier: '5850', label: 'Catalyst Coaching $5850' },
  // Also track these
  29700:  { tier: '297',  label: 'Academy Annual $297' },
  36900:  { tier: '369',  label: 'Lights On Annual $369' },
  29900:  { tier: '299',  label: 'Mid-tier $299' },
  19700:  { tier: '197',  label: 'Deep Sleep Solution $197' },
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

async function main() {
  const token = await getToken();
  const headers = { Authorization: `Bearer ${token}`, Accept: 'application/json' };
  
  // Last 30 days
  const since = new Date(); since.setDate(since.getDate() - 30);
  const sinceStr = since.toISOString().split('T')[0];
  const today = new Date().toISOString().split('T')[0];
  
  console.log(`Fetching all transactions since ${sinceStr}...\n`);
  
  const allTx = [];
  let hitOldData = false;
  
  for (let page = 1; page <= 20 && !hitOldData; page++) {
    const url = `${KAJABI_API_BASE}/transactions?filter[site_id]=${SITE_ID}&page[number]=${page}`;
    const res = await fetch(url, { headers });
    if (!res.ok) { console.log(`Page ${page}: ${res.status}`); break; }
    const data = await res.json();
    const rows = data.data || [];
    
    for (const row of rows) {
      const dateStr = row.attributes?.created_at?.split('T')[0] || '';
      if (dateStr < sinceStr) { hitOldData = true; break; }
      const amount = row.attributes?.amount_in_cents || 0;
      const state = row.attributes?.state || '';
      const action = row.attributes?.action || '';
      if (amount > 0 && state !== 'failed' && action !== 'refund') {
        allTx.push({
          amountCents: amount,
          createdAt: row.attributes?.created_at,
          state,
          action,
        });
      }
    }
    
    process.stdout.write(`\rPage ${page}: ${allTx.length} transactions found...`);
    if (!data.links?.next) break;
  }
  
  console.log(`\nTotal transactions in date range: ${allTx.length}\n`);
  
  // Group by tier
  const tierMap = {};
  const unknownAmounts = {};
  
  for (const tx of allTx) {
    const tierInfo = AMOUNT_TO_TIER[tx.amountCents];
    if (tierInfo) {
      if (!tierMap[tierInfo.tier]) {
        tierMap[tierInfo.tier] = { ...tierInfo, count: 0, revenueCents: 0, today: 0, todayRev: 0 };
      }
      tierMap[tierInfo.tier].count++;
      tierMap[tierInfo.tier].revenueCents += tx.amountCents;
      if (tx.createdAt?.split('T')[0] === today) {
        tierMap[tierInfo.tier].today++;
        tierMap[tierInfo.tier].todayRev += tx.amountCents;
      }
    } else {
      unknownAmounts[tx.amountCents] = (unknownAmounts[tx.amountCents] || 0) + 1;
    }
  }
  
  console.log('=== FUNNEL SALES (last 30 days) ===\n');
  const tiers = Object.values(tierMap).sort((a, b) => a.amountCents - b.amountCents);
  let totalRev = 0;
  let totalCount = 0;
  let todayRev = 0;
  let todayCount = 0;
  
  for (const t of tiers) {
    const todayStr = t.today > 0 ? ` | TODAY: ${t.today} · $${t.todayRev/100}` : '';
    console.log(`${t.label}: ${t.count} sales · $${t.revenueCents/100}${todayStr}`);
    totalRev += t.revenueCents;
    totalCount += t.count;
    todayRev += t.todayRev;
    todayCount += t.today;
  }
  
  console.log(`\nTOTAL (30d): ${totalCount} sales · $${totalRev/100}`);
  console.log(`TODAY: ${todayCount} sales · $${todayRev/100}`);
  
  if (Object.keys(unknownAmounts).length > 0) {
    console.log('\n=== UNMATCHED AMOUNTS (not in our tier map) ===');
    for (const [amount, count] of Object.entries(unknownAmounts).sort((a,b) => b[1]-a[1])) {
      console.log(`  $${amount/100}: ${count} transactions`);
    }
  }
}

main().catch(console.error);
