import 'dotenv/config';

const KAJABI_API_BASE = 'https://api.kajabi.com/v1';
const KAJABI_TOKEN_URL = 'https://api.kajabi.com/v1/oauth/token';

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

  // Pull all offers and search for anything with "interconnected" or "67" or "bundle" in the name
  console.log('=== ALL OFFERS — searching for Interconnected $67 Bundle OTO ===\n');
  
  // Try paginated offers
  for (let page = 1; page <= 5; page++) {
    const res = await fetch(`${KAJABI_API_BASE}/offers?per_page=50&page=${page}`, { headers });
    if (!res.ok) { console.log(`Page ${page}: ${res.status}`); break; }
    const data = await res.json();
    const offers = data.data || [];
    if (offers.length === 0) break;
    
    for (const o of offers) {
      const title = o.attributes?.title || '';
      const price = o.attributes?.price_in_cents || 0;
      const id = o.id;
      // Show anything with interconnected, 67, bundle, OTO in name
      if (/interconnected|bundle|oto|\b67\b/i.test(title)) {
        console.log(`*** MATCH *** ID:${id} | $${price/100} | ${title}`);
      } else {
        console.log(`  ID:${id} | $${price/100} | ${title}`);
      }
    }
    console.log(`--- Page ${page}: ${offers.length} offers ---`);
    if (offers.length < 50) break;
  }

  // Also check recent purchases and show their offer IDs + names via relationships
  console.log('\n=== RECENT PURCHASES with offer details ===\n');
  const purchRes = await fetch(`${KAJABI_API_BASE}/purchases?include=offer`, { headers });
  const purchData = await purchRes.json();
  
  // Check included data
  const included = purchData.included || [];
  const offerMap = {};
  for (const item of included) {
    if (item.type === 'offers') {
      offerMap[item.id] = item.attributes?.title;
    }
  }
  
  for (const p of (purchData.data || []).slice(0, 15)) {
    const offerId = p.relationships?.offer?.data?.id;
    const offerName = offerMap[offerId] || 'unknown';
    const amount = p.attributes?.amount_in_cents || 0;
    const createdAt = p.attributes?.created_at || '';
    if (amount > 0) {
      console.log(`$${amount/100} | offer:${offerId} | "${offerName}" | ${createdAt.split('T')[0]}`);
    }
  }
}

main().catch(console.error);
