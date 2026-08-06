import * as dotenv from 'dotenv';
dotenv.config();

const KLAVIYO_KEY = process.env.KLAVIYO_PRIVATE_KEY;
const SMS_LIST_ID = process.env.KLAVIYO_INTERCONNECTED_SMS_LIST_ID;

async function getKajabiToken() {
  const res = await fetch('https://api.kajabi.com/v1/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: process.env.KAJABI_CLIENT_ID,
      client_secret: process.env.KAJABI_CLIENT_SECRET,
    })
  });
  const data = await res.json();
  return data.access_token;
}

async function main() {
  const token = await getKajabiToken();

  // Inspect actual structure of a Kajabi purchase
  console.log('\n=== KAJABI PURCHASE DATA STRUCTURE ===');
  const kRes = await fetch('https://api.kajabi.com/v1/purchases?page[size]=3&sort=-created_at', {
    headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/vnd.api+json' }
  });
  const kData = await kRes.json();
  const purchases = kData.data || [];
  if (purchases.length > 0) {
    console.log('First purchase full structure:');
    console.log(JSON.stringify(purchases[0], null, 2));
    console.log('\nAll purchase IDs and relationships:');
    purchases.forEach((p, i) => {
      console.log(`${i+1}. id: ${p.id} | type: ${p.type}`);
      console.log('   attributes keys:', Object.keys(p.attributes || {}).join(', '));
      console.log('   relationships:', Object.keys(p.relationships || {}).join(', '));
    });
  }

  // Check Klaviyo list - try getting all profiles in the list
  console.log(`\n=== KLAVIYO LIST PROFILES (${SMS_LIST_ID}) ===`);
  // Use the correct endpoint for listing profiles in a list
  const lRes = await fetch(
    `https://a.klaviyo.com/api/lists/${SMS_LIST_ID}/profiles/?page[size]=10&fields[profile]=email,phone_number,first_name,last_name,created`,
    { headers: { 'Authorization': `Klaviyo-API-Key ${KLAVIYO_KEY}`, 'revision': '2024-10-15' } }
  );
  const lData = await lRes.json();
  console.log('Status:', lRes.status);
  if (!lRes.ok) {
    console.error('Error:', JSON.stringify(lData).slice(0, 400));
  } else {
    const profiles = lData.data || [];
    console.log(`${profiles.length} profiles in list`);
    profiles.forEach((p, i) => {
      const a = p.attributes || {};
      console.log(`${i+1}. ${a.first_name||''} ${a.last_name||''} | ${a.email||'no email'} | ${a.phone_number||'no phone'} | created: ${a.created||'?'}`);
    });
    if (lData.links) console.log('Pagination:', JSON.stringify(lData.links));
  }
}

main().catch(console.error);
