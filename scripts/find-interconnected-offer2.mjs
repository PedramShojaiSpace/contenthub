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

  // The Kajabi API only returns 30 purchases at a time and the per_page/page params cause 500
  // Try fetching with different filters to find the $67 / $201 purchases
  // $402 for 2 purchases = $201 each OR $67 each (maybe 6 units at $67 = $402)
  
  console.log('=== Searching for $67 purchases (6000 cents) ===\n');
  
  // Try fetching purchases without include first to see all available data
  const res = await fetch(`${KAJABI_API_BASE}/purchases`, { headers });
  const data = await res.json();
  
  console.log('Response keys:', Object.keys(data));
  console.log('Total purchases in response:', data.data?.length);
  console.log('Meta:', JSON.stringify(data.meta || {}));
  
  // Show ALL purchases with amounts to find the $67 ones
  console.log('\n=== ALL PURCHASES (sorted by amount) ===\n');
  const purchases = data.data || [];
  
  // Sort by amount
  purchases.sort((a, b) => (b.attributes?.amount_in_cents || 0) - (a.attributes?.amount_in_cents || 0));
  
  for (const p of purchases) {
    const amount = p.attributes?.amount_in_cents || 0;
    const offerId = p.relationships?.offer?.data?.id || 'no-offer';
    const createdAt = p.attributes?.created_at || '';
    const status = p.attributes?.status || '';
    const email = p.attributes?.email || p.attributes?.customer_email || '';
    console.log(`$${amount/100} | status:${status} | offer:${offerId} | ${createdAt.split('T')[0]} | ${email}`);
  }
  
  // Now try with include=offer to get offer names
  console.log('\n=== WITH OFFER NAMES (include=offer) ===\n');
  const res2 = await fetch(`${KAJABI_API_BASE}/purchases?include=offer`, { headers });
  const data2 = await res2.json();
  
  const included = data2.included || [];
  const offerMap = {};
  for (const item of included) {
    if (item.type === 'offers') {
      offerMap[item.id] = item.attributes?.title;
    }
  }
  
  console.log('Included offers found:', Object.keys(offerMap).length);
  for (const [id, name] of Object.entries(offerMap)) {
    console.log(`  Offer ${id}: "${name}"`);
  }
  
  // Find $67 purchases specifically
  console.log('\n=== PURCHASES AT $67 (6700 cents) or $201 (20100 cents) ===\n');
  for (const p of (data2.data || [])) {
    const amount = p.attributes?.amount_in_cents || 0;
    if (amount === 6700 || amount === 20100 || amount === 40200 || amount === 6000) {
      const offerId = p.relationships?.offer?.data?.id || 'no-offer';
      const offerName = offerMap[offerId] || 'unknown';
      console.log(`$${amount/100} | offer:${offerId} | "${offerName}" | ${p.attributes?.created_at?.split('T')[0]}`);
    }
  }
  
  // Try fetching the specific offer ID that was given
  console.log('\n=== CHECKING OFFER ID 2151314475 DIRECTLY ===\n');
  const offerRes = await fetch(`${KAJABI_API_BASE}/offers/2151314475`, { headers });
  console.log('Status:', offerRes.status);
  if (offerRes.ok) {
    const offerData = await offerRes.json();
    console.log('Offer data:', JSON.stringify(offerData, null, 2));
  } else {
    const errText = await offerRes.text();
    console.log('Error:', errText.substring(0, 200));
  }
  
  // Try fetching purchases for that specific offer using filter
  console.log('\n=== PURCHASES FILTERED BY OFFER 2151314475 ===\n');
  const filtRes = await fetch(`${KAJABI_API_BASE}/purchases?filter[offer_id]=2151314475`, { headers });
  console.log('Status:', filtRes.status);
  const filtData = await filtRes.json();
  console.log('Count:', filtData.data?.length);
  for (const p of (filtData.data || [])) {
    const amount = p.attributes?.amount_in_cents || 0;
    const offerId = p.relationships?.offer?.data?.id || 'no-offer';
    console.log(`$${amount/100} | offer:${offerId} | ${p.attributes?.created_at?.split('T')[0]}`);
  }
}

main().catch(console.error);
