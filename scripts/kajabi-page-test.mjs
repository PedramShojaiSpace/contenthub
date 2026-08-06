import 'dotenv/config';

const OFFER_IDS = {
  '2151314475': '$67 OTO',
  '2151019899': '$299 Upstream',
  '2150211911': '$399 Gut Test',
  '2151178828': '$399 Alt',
  '2151031660': '$499 Bundle',
};

async function getToken() {
  const res = await fetch('https://api.kajabi.com/v1/oauth/token', {
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
  console.log('Token OK\n');

  // Test which per_page values work
  console.log('=== TESTING PAGE SIZES ===');
  for (const pp of [5, 10, 15, 20]) {
    const r = await fetch(`https://api.kajabi.com/v1/purchases?per_page=${pp}`, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' }
    });
    const t = await r.text();
    const isJson = t.charAt(0) === '{';
    const count = isJson ? JSON.parse(t).data?.length : 'NOT JSON';
    console.log(`per_page=${pp} -> HTTP ${r.status} count=${count}`);
  }

  // Paginate with per_page=10
  console.log('\n=== PAGINATING WITH per_page=10 ===');
  let allPurchases = [];
  for (let page = 1; page <= 30; page++) {
    const r = await fetch(`https://api.kajabi.com/v1/purchases?per_page=10&page=${page}`, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' }
    });
    const t = await r.text();
    if (!r.ok || t.charAt(0) !== '{') {
      console.log(`Page ${page} failed: HTTP ${r.status}`);
      break;
    }
    const data = JSON.parse(t);
    const rows = data.data || [];
    if (rows.length === 0) {
      console.log(`Page ${page}: empty — stopping`);
      break;
    }
    allPurchases = allPurchases.concat(rows);
    console.log(`Page ${page}: ${rows.length} rows (total: ${allPurchases.length})`);
    if (rows.length < 10) break;
  }

  // Show all paid purchases sorted by date
  const paid = allPurchases
    .filter(p => p.attributes.amount_in_cents > 0)
    .sort((a, b) => new Date(b.attributes.created_at) - new Date(a.attributes.created_at));

  console.log(`\n=== ALL PAID PURCHASES (${paid.length} total) ===`);
  paid.forEach(p => {
    const a = p.attributes;
    const offerId = p.relationships?.offer?.data?.id || 'unknown';
    const name = OFFER_IDS[offerId] || `other:${offerId}`;
    console.log(`  $${(a.amount_in_cents/100).toFixed(0).padStart(5)} | ${a.created_at.substring(0,10)} | ${name}`);
  });

  // Last 30 days summary
  const cutoff = new Date(Date.now() - 30 * 86400000);
  const recent = paid.filter(p => new Date(p.attributes.created_at) >= cutoff);
  console.log(`\n=== LAST 30 DAYS (${recent.length} paid purchases) ===`);
  const byOffer = {};
  for (const p of recent) {
    const offerId = p.relationships?.offer?.data?.id || 'unknown';
    const name = OFFER_IDS[offerId] || `other:${offerId}`;
    if (!byOffer[name]) byOffer[name] = { count: 0, revenue: 0 };
    byOffer[name].count++;
    byOffer[name].revenue += p.attributes.amount_in_cents / 100;
  }
  for (const [name, s] of Object.entries(byOffer)) {
    console.log(`  ${name}: ${s.count} sales · $${s.revenue.toFixed(0)}`);
  }
  const totalRevenue = recent.reduce((sum, p) => sum + p.attributes.amount_in_cents / 100, 0);
  console.log(`  TOTAL: $${totalRevenue.toFixed(0)}`);
}

main().catch(console.error);
