import 'dotenv/config';

const KAJABI_API_BASE = "https://api.kajabi.com/v1";
const KAJABI_TOKEN_URL = "https://api.kajabi.com/v1/oauth/token";

const tokenRes = await fetch(KAJABI_TOKEN_URL, {
  method: "POST",
  headers: { "Content-Type": "application/x-www-form-urlencoded" },
  body: new URLSearchParams({
    grant_type: "client_credentials",
    client_id: process.env.KAJABI_CLIENT_ID,
    client_secret: process.env.KAJABI_CLIENT_SECRET,
  }),
});
const tokenData = await tokenRes.json();
const token = tokenData.access_token;

const headers = {
  Authorization: `Bearer ${token}`,
  Accept: "application/vnd.api+json",
};

// The Urban Monk Academy site ID
const SITE_ID = "2148432935";

// Target offer IDs to track (from the offers list)
// We need to find the $67, $299, $399, $499 offers
// Known: 2150989697 = Lights On Course ($297/yr subscription)
// Let's pull all offers for this site and filter by price

console.log("=== ALL OFFERS FOR THE URBAN MONK ACADEMY SITE ===");
const offersRes = await fetch(
  `${KAJABI_API_BASE}/offers?filter[site_id]=${SITE_ID}&page[size]=100`,
  { headers }
);
const offersData = await offersRes.json();

if (offersData.errors) {
  console.error("Offers error:", JSON.stringify(offersData.errors));
} else {
  const offers = offersData.data || [];
  console.log(`Found ${offers.length} offers for site ${SITE_ID}:`);
  for (const o of offers) {
    const attrs = o.attributes || {};
    const priceUSD = attrs.price_in_cents ? (attrs.price_in_cents / 100).toFixed(2) : 'N/A';
    console.log(`  ID: ${o.id} | ${attrs.title} | $${priceUSD} | ${attrs.payment_type} | ${attrs.subscription ? 'subscription' : 'one-time'}`);
  }
}

// Now pull purchases for this site, last 30 days, with offer included
console.log("\n=== PURCHASES LAST 30 DAYS (with offer info) ===");
const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

// Fetch all pages
let allPurchases = [];
let page = 1;
while (true) {
  const pRes = await fetch(
    `${KAJABI_API_BASE}/purchases?filter[site_id]=${SITE_ID}&filter[created_at_gteq]=${thirtyDaysAgo}&include=offer&page[size]=100&page[number]=${page}`,
    { headers }
  );
  const pData = await pRes.json();
  if (pData.errors) {
    console.error("Purchases error:", JSON.stringify(pData.errors));
    break;
  }
  const rows = pData.data || [];
  allPurchases = allPurchases.concat(rows);
  
  // Build offer lookup from included
  if (page === 1 && pData.included) {
    const offerMap = {};
    for (const inc of pData.included) {
      if (inc.type === 'offers') {
        offerMap[inc.id] = inc.attributes?.title || 'Unknown';
      }
    }
    console.log("Offer map from included:", offerMap);
  }
  
  if (!pData.links?.next || rows.length < 100) break;
  page++;
}

console.log(`\nTotal purchases: ${allPurchases.length}`);

// Group by offer_id and sum revenue
const byOffer = {};
for (const p of allPurchases) {
  const offerId = p.relationships?.offer?.data?.id || 'unknown';
  const amountCents = p.attributes?.amount_in_cents || 0;
  if (!byOffer[offerId]) byOffer[offerId] = { count: 0, revenueCents: 0 };
  byOffer[offerId].count++;
  byOffer[offerId].revenueCents += amountCents;
}

// Match offer IDs to names
const offerNames = {};
if (offersData.data) {
  for (const o of offersData.data) {
    offerNames[o.id] = `${o.attributes?.title} ($${o.attributes?.price_in_cents ? (o.attributes.price_in_cents/100).toFixed(0) : 'N/A'})`;
  }
}

console.log("\nPurchases by offer (last 30 days):");
for (const [offerId, data] of Object.entries(byOffer)) {
  const name = offerNames[offerId] || `Offer ${offerId}`;
  console.log(`  ${name}: ${data.count} purchases, $${(data.revenueCents/100).toFixed(2)} revenue`);
}
