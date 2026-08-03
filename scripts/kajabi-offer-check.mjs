import 'dotenv/config';

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
  const OFFER_ID = '2151314475';

  // 1. Fetch the offer directly
  console.log('=== OFFER DETAILS ===');
  const offerRes = await fetch(`https://api.kajabi.com/v1/offers/${OFFER_ID}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' }
  });
  const offerText = await offerRes.text();
  console.log(`HTTP ${offerRes.status}:`, offerText.substring(0, 500));

  // 2. Try fetching purchases for this specific offer via different URL patterns
  console.log('\n=== PURCHASES ENDPOINT VARIANTS ===');
  const urls = [
    `https://api.kajabi.com/v1/offers/${OFFER_ID}/purchases`,
    `https://api.kajabi.com/v1/purchases?offer_id=${OFFER_ID}`,
    `https://api.kajabi.com/v1/purchases?filter%5Boffer_id%5D=${OFFER_ID}`,
    `https://app.kajabi.com/api/v1/offers/${OFFER_ID}/purchases`,
  ];
  for (const url of urls) {
    const r = await fetch(url, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' }
    });
    const t = await r.text();
    const preview = t.length > 200 ? t.substring(0, 200) + '...' : t;
    console.log(`\n${r.status} ${url.replace('https://','').substring(0,70)}`);
    console.log(preview);
  }

  // 3. List all offers to see what's available
  console.log('\n=== ALL OFFERS ===');
  const offersRes = await fetch('https://api.kajabi.com/v1/offers', {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' }
  });
  const offersData = await offersRes.json();
  const offers = offersData.data || [];
  console.log(`Total offers: ${offers.length}`);
  offers.forEach(o => {
    const a = o.attributes;
    console.log(`  ID:${o.id} | $${(a.price_in_cents/100).toFixed(0)} | ${a.name || a.title || 'no name'} | active:${a.is_active}`);
  });
}

main().catch(console.error);
