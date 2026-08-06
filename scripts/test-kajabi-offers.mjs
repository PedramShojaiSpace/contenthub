import 'dotenv/config';

const KAJABI_API_BASE = "https://api.kajabi.com/v1";
const KAJABI_TOKEN_URL = "https://api.kajabi.com/v1/oauth/token";

// Get token
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
if (!tokenData.access_token) {
  console.error("Token error:", JSON.stringify(tokenData));
  process.exit(1);
}
const token = tokenData.access_token;
console.log("Token obtained OK");

const headers = {
  Authorization: `Bearer ${token}`,
  Accept: "application/vnd.api+json",
};

// 1. List offers (products/SKUs)
console.log("\n=== OFFERS ===");
const offersRes = await fetch(`${KAJABI_API_BASE}/offers?page[size]=50`, { headers });
const offersData = await offersRes.json();
if (offersData.errors) {
  console.error("Offers error:", JSON.stringify(offersData.errors));
} else {
  const offers = offersData.data || [];
  console.log(`Found ${offers.length} offers:`);
  for (const o of offers) {
    const attrs = o.attributes || {};
    console.log(`  ID: ${o.id} | Name: ${attrs.name || attrs.title} | Price: $${attrs.price || attrs.amount || 'N/A'} | Status: ${attrs.status || attrs.state}`);
  }
}

// 2. Try purchases endpoint
console.log("\n=== PURCHASES (last 30 days) ===");
const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
const purchasesRes = await fetch(
  `${KAJABI_API_BASE}/purchases?filter[created_at_gteq]=${thirtyDaysAgo}&page[size]=50`,
  { headers }
);
const purchasesData = await purchasesRes.json();
if (purchasesData.errors) {
  console.error("Purchases error:", JSON.stringify(purchasesData.errors));
  
  // Try orders endpoint instead
  console.log("\n=== ORDERS ===");
  const ordersRes = await fetch(`${KAJABI_API_BASE}/orders?page[size]=20`, { headers });
  const ordersData = await ordersRes.json();
  if (ordersData.errors) {
    console.error("Orders error:", JSON.stringify(ordersData.errors));
  } else {
    console.log("Orders sample:", JSON.stringify(ordersData.data?.slice(0,2), null, 2));
  }
} else {
  const purchases = purchasesData.data || [];
  console.log(`Found ${purchases.length} purchases in last 30 days`);
  
  // Group by offer
  const byOffer = {};
  for (const p of purchases) {
    const attrs = p.attributes || {};
    const offerName = attrs.offer_name || attrs.name || 'Unknown';
    const amount = parseFloat(attrs.amount || attrs.price || 0);
    if (!byOffer[offerName]) byOffer[offerName] = { count: 0, revenue: 0 };
    byOffer[offerName].count++;
    byOffer[offerName].revenue += amount;
  }
  
  console.log("\nBy offer:");
  for (const [name, data] of Object.entries(byOffer)) {
    console.log(`  ${name}: ${data.count} purchases, $${data.revenue.toFixed(2)} revenue`);
  }
}

// 3. Try the sales/transactions endpoint
console.log("\n=== TRANSACTIONS ===");
const txRes = await fetch(`${KAJABI_API_BASE}/transactions?page[size]=20`, { headers });
const txData = await txRes.json();
if (txData.errors) {
  console.error("Transactions error:", JSON.stringify(txData.errors));
} else {
  console.log("Transactions sample:", JSON.stringify(txData.data?.slice(0,2), null, 2));
}
