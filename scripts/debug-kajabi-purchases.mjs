import 'dotenv/config';

const KAJABI_TOKEN_URL = 'https://api.kajabi.com/v1/oauth/token';
const OFFER_IDS = {
  '2151314475': '$67 OTO',
  '2151019899': '$299 Upstream',
  '2150211911': '$399 Gut Test',
  '2151178828': '$399 Alt',
  '2151031660': '$499 Bundle',
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

async function fetchPage(token, page, perPage = 30) {
  const res = await fetch(
    `https://api.kajabi.com/v1/purchases?per_page=${perPage}&page=${page}`,
    { headers: { Authorization: 'Bearer ' + token, Accept: 'application/json' } }
  );
  if (!res.ok) {
    const t = await res.text();
    console.log(`Page ${page} HTTP ${res.status}:`, t.substring(0, 200));
    return null;
  }
  return res.json();
}

async function main() {
  const token = await getToken();
  console.log('Token OK\n');

  let allPurchases = [];
  let page = 1;
  let hasMore = true;

  while (hasMore && page <= 20) { // cap at 20 pages = 600 purchases
    const data = await fetchPage(token, page);
    if (!data || !data.data || data.data.length === 0) {
      hasMore = false;
      break;
    }
    allPurchases = allPurchases.concat(data.data);
    console.log(`Page ${page}: ${data.data.length} purchases (total so far: ${allPurchases.length})`);
    if (data.data.length < 30) hasMore = false;
    page++;
  }

  console.log('\n=== ALL PAID PURCHASES ===');
  const paid = allPurchases.filter(p => p.attributes.amount_in_cents > 0);
  console.log('Total paid:', paid.length);

  // Sort by date descending
  paid.sort((a, b) => new Date(b.attributes.created_at) - new Date(a.attributes.created_at));

  paid.forEach(p => {
    const a = p.attributes;
    const offerId = p.relationships?.offer?.data?.id || 'unknown';
    const offerName = OFFER_IDS[offerId] || 'other (offer:' + offerId + ')';
    console.log(
      '  $' + (a.amount_in_cents / 100).toFixed(0).padStart(5) +
      ' | ' + a.created_at.substring(0, 10) +
      ' | ' + offerName
    );
  });

  // Summary by offer
  console.log('\n=== BY OFFER (last 30 days) ===');
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const recent = paid.filter(p => new Date(p.attributes.created_at) >= thirtyDaysAgo);
  
  const byOffer = {};
  for (const p of recent) {
    const offerId = p.relationships?.offer?.data?.id || 'unknown';
    const name = OFFER_IDS[offerId] || 'other:' + offerId;
    if (!byOffer[name]) byOffer[name] = { count: 0, revenue: 0 };
    byOffer[name].count++;
    byOffer[name].revenue += p.attributes.amount_in_cents / 100;
  }
  
  for (const [name, stats] of Object.entries(byOffer)) {
    console.log(`  ${name}: ${stats.count} sales · $${stats.revenue.toFixed(0)}`);
  }

  // Today and yesterday
  const today = new Date().toISOString().split('T')[0];
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
  const todayPaid = paid.filter(p => p.attributes.created_at.startsWith(today));
  const yesterdayPaid = paid.filter(p => p.attributes.created_at.startsWith(yesterday));
  
  console.log('\n=== TODAY (' + today + ') ===');
  console.log('Paid purchases:', todayPaid.length);
  todayPaid.forEach(p => {
    const offerId = p.relationships?.offer?.data?.id || 'unknown';
    console.log('  $' + (p.attributes.amount_in_cents/100).toFixed(0) + ' | ' + (OFFER_IDS[offerId] || offerId));
  });

  console.log('\n=== YESTERDAY (' + yesterday + ') ===');
  console.log('Paid purchases:', yesterdayPaid.length);
  yesterdayPaid.forEach(p => {
    const offerId = p.relationships?.offer?.data?.id || 'unknown';
    console.log('  $' + (p.attributes.amount_in_cents/100).toFixed(0) + ' | ' + (OFFER_IDS[offerId] || offerId));
  });
}

main().catch(console.error);
