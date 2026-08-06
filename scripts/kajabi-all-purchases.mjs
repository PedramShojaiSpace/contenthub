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

  // Pull without page param — returns 30 results
  const r = await fetch('https://api.kajabi.com/v1/purchases', {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' }
  });
  const data = await r.json();
  const all = data.data || [];
  console.log(`Total returned: ${all.length}`);
  console.log(`Meta: ${JSON.stringify(data.meta || {})}`);

  // Show ALL purchases (paid and free) sorted by date
  const sorted = all.sort((a, b) => new Date(b.attributes.created_at) - new Date(a.attributes.created_at));
  
  console.log('\n=== ALL PURCHASES (most recent first) ===');
  sorted.forEach(p => {
    const a = p.attributes;
    const offerId = p.relationships?.offer?.data?.id || 'unknown';
    const name = OFFER_IDS[offerId] || `offer:${offerId}`;
    const amount = `$${(a.amount_in_cents/100).toFixed(0)}`;
    console.log(`  ${amount.padStart(6)} | ${a.created_at.substring(0,10)} | ${a.payment_type.padEnd(10)} | ${name}`);
  });

  // Check if the offer IDs we know about appear at all
  console.log('\n=== OFFER ID BREAKDOWN ===');
  const offerCounts = {};
  for (const p of all) {
    const offerId = p.relationships?.offer?.data?.id || 'unknown';
    if (!offerCounts[offerId]) offerCounts[offerId] = { count: 0, paid: 0, revenue: 0 };
    offerCounts[offerId].count++;
    if (p.attributes.amount_in_cents > 0) {
      offerCounts[offerId].paid++;
      offerCounts[offerId].revenue += p.attributes.amount_in_cents / 100;
    }
  }
  for (const [id, s] of Object.entries(offerCounts)) {
    const name = OFFER_IDS[id] || `unknown:${id}`;
    console.log(`  ${name}: ${s.count} total, ${s.paid} paid, $${s.revenue.toFixed(0)}`);
  }

  // Try to find purchases by looking at different sort/filter options
  console.log('\n=== TRYING SORTED BY CREATED_AT DESC ===');
  const r2 = await fetch('https://api.kajabi.com/v1/purchases?sort=-created_at', {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' }
  });
  const d2 = await r2.json();
  console.log(`HTTP ${r2.status}, count: ${d2.data?.length}`);
  if (d2.data && d2.data.length > 0) {
    const first = d2.data[0].attributes;
    console.log('Most recent:', first.created_at, '$' + (first.amount_in_cents/100).toFixed(0));
  }

  // Try filtering by offer ID directly
  console.log('\n=== FILTERING BY $67 OFFER ID ===');
  const r3 = await fetch('https://api.kajabi.com/v1/purchases?filter[offer_id]=2151314475', {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' }
  });
  const d3 = await r3.json();
  console.log(`HTTP ${r3.status}, count: ${d3.data?.length || 0}`);
  if (d3.data) {
    d3.data.forEach(p => {
      console.log('  $' + (p.attributes.amount_in_cents/100).toFixed(0) + ' | ' + p.attributes.created_at);
    });
  }
}

main().catch(console.error);
