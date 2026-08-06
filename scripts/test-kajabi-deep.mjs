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

// 1. Get site info to find site_id
console.log("=== SITE INFO ===");
const siteRes = await fetch(`${KAJABI_API_BASE}/sites`, { headers });
const siteData = await siteRes.json();
console.log(JSON.stringify(siteData, null, 2));

// 2. Inspect first purchase to see its full attribute structure
console.log("\n=== PURCHASE SAMPLE (full attributes) ===");
const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
const pRes = await fetch(
  `${KAJABI_API_BASE}/purchases?filter[created_at_gteq]=${thirtyDaysAgo}&page[size]=3`,
  { headers }
);
const pData = await pRes.json();
if (pData.data && pData.data.length > 0) {
  console.log(JSON.stringify(pData.data[0], null, 2));
  console.log("\nRelationships:", JSON.stringify(pData.data[0].relationships, null, 2));
}

// 3. Try fetching a specific offer to see price structure
console.log("\n=== OFFER SAMPLE (Lights On Course ID: 2150989697) ===");
const offerRes = await fetch(`${KAJABI_API_BASE}/offers/2150989697`, { headers });
const offerData = await offerRes.json();
console.log(JSON.stringify(offerData, null, 2));
