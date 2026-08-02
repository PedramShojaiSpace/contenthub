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

// Resolve the unknown offer IDs from purchases
const unknownIds = [
  "2149724803",
  "2149725501",
  "2150211911",
  "2150918674",
  "2151004748",
  "2151019899",
  "2151031660",
  "2151178828",
  "2151314475",
];

console.log("=== RESOLVING UNKNOWN OFFER IDs ===\n");
for (const id of unknownIds) {
  const res = await fetch(`${KAJABI_API_BASE}/offers/${id}`, { headers });
  const data = await res.json();
  if (data.data) {
    const attrs = data.data.attributes;
    const priceUSD = attrs.price_in_cents ? (attrs.price_in_cents / 100).toFixed(2) : 'N/A';
    console.log(`ID: ${id}`);
    console.log(`  Title: ${attrs.title}`);
    console.log(`  Internal: ${attrs.internal_title || 'N/A'}`);
    console.log(`  Price: $${priceUSD}`);
    console.log(`  Type: ${attrs.payment_type} | Subscription: ${attrs.subscription}`);
    console.log();
  } else {
    console.log(`ID: ${id} — ERROR: ${JSON.stringify(data.errors)}`);
  }
}

// Also get ALL offers across all sites (no site filter) to find the $67 one
console.log("\n=== SEARCHING FOR $67 OFFER ===");
const allSites = ["2148432935", "2148712596", "2148488148"]; // UMA, Gateway to Health, Home Sick Home
for (const siteId of allSites) {
  const res = await fetch(
    `${KAJABI_API_BASE}/offers?filter[site_id]=${siteId}&page[size]=100`,
    { headers }
  );
  const data = await res.json();
  const offers = data.data || [];
  const target = offers.filter(o => {
    const price = o.attributes?.price_in_cents;
    return price && price >= 6500 && price <= 6900; // $65-$69 range
  });
  if (target.length > 0) {
    console.log(`Site ${siteId}:`);
    for (const o of target) {
      console.log(`  ID: ${o.id} | ${o.attributes?.title} | $${(o.attributes.price_in_cents/100).toFixed(2)}`);
    }
  }
}

// Also look for $299, $399, $499 offers
console.log("\n=== $299 / $399 / $499 OFFERS ===");
for (const siteId of allSites) {
  const res = await fetch(
    `${KAJABI_API_BASE}/offers?filter[site_id]=${siteId}&page[size]=100`,
    { headers }
  );
  const data = await res.json();
  const offers = data.data || [];
  const targets = offers.filter(o => {
    const price = o.attributes?.price_in_cents;
    return price && [29900, 39900, 49900, 29700, 39700, 49700].includes(price);
  });
  if (targets.length > 0) {
    console.log(`Site ${siteId}:`);
    for (const o of targets) {
      console.log(`  ID: ${o.id} | ${o.attributes?.title} | $${(o.attributes.price_in_cents/100).toFixed(2)} | ${o.attributes?.payment_type}`);
    }
  }
}
