/**
 * verify-recent-leads.mjs
 * Pulls the last 10 Klaviyo leads from the Interconnected SMS list
 * and cross-checks against recent Kajabi purchases
 */
import * as dotenv from 'dotenv';
dotenv.config();

const KLAVIYO_KEY = process.env.KLAVIYO_PRIVATE_KEY;
const INTERCONNECTED_SMS_LIST_ID = process.env.KLAVIYO_INTERCONNECTED_SMS_LIST_ID;

// Pull last 10 members added to the Interconnected SMS list
async function getRecentLeads() {
  const url = `https://a.klaviyo.com/api/lists/${INTERCONNECTED_SMS_LIST_ID}/profiles/?sort=-joined_group_at&page[size]=10`;
  const res = await fetch(url, {
    headers: {
      'Authorization': `Klaviyo-API-Key ${KLAVIYO_KEY}`,
      'revision': '2024-02-15',
      'Accept': 'application/json',
    }
  });
  const data = await res.json();
  if (!res.ok) {
    console.error('Klaviyo error:', JSON.stringify(data, null, 2));
    return [];
  }
  return data.data || [];
}

// Pull recent Kajabi purchases (last 20)
async function getRecentKajabiPurchases() {
  const { createPool } = await import('mysql2/promise');
  const pool = createPool(process.env.DATABASE_URL);
  // Check if we have a cached purchases table or use the API
  pool.end();
  return null; // Will use API directly
}

async function getKajabiPurchasesViaAPI() {
  // Use the same token pattern as the app
  const { createPool } = await import('mysql2/promise');
  const pool = createPool(process.env.DATABASE_URL);
  const [rows] = await pool.execute(
    `SELECT key_name, key_value FROM app_settings WHERE key_name IN ('kajabi_access_token', 'kajabi_site_id') LIMIT 2`
  );
  await pool.end();
  
  const settings = {};
  for (const row of rows) {
    settings[row.key_name] = row.key_value;
  }
  
  if (!settings.kajabi_access_token) {
    console.error('No Kajabi token found in DB');
    return [];
  }

  // Pull last 20 purchases
  const res = await fetch('https://kajabi.com/api/v1/purchases?per_page=20&sort=created_at&direction=desc', {
    headers: {
      'Authorization': `Bearer ${settings.kajabi_access_token}`,
      'Accept': 'application/json',
    }
  });
  
  if (!res.ok) {
    const text = await res.text();
    console.error('Kajabi purchases error:', res.status, text.slice(0, 200));
    return [];
  }
  
  const data = await res.json();
  return data.purchases || data || [];
}

async function main() {
  console.log('=== RECENT KLAVIYO LEADS (Interconnected SMS List) ===\n');
  
  const leads = await getRecentLeads();
  if (leads.length === 0) {
    console.log('No leads found or API error');
  } else {
    leads.forEach((profile, i) => {
      const attrs = profile.attributes || {};
      console.log(`${i+1}. ${attrs.first_name || ''} ${attrs.last_name || ''}`);
      console.log(`   Email: ${attrs.email || 'N/A'}`);
      console.log(`   Phone: ${attrs.phone_number || 'N/A'}`);
      console.log(`   Joined: ${attrs.joined_group_at || attrs.created || 'N/A'}`);
      console.log('');
    });
  }

  console.log('\n=== RECENT KAJABI PURCHASES ===\n');
  const purchases = await getKajabiPurchasesViaAPI();
  if (!purchases || purchases.length === 0) {
    console.log('No purchases found or API error');
  } else {
    purchases.slice(0, 15).forEach((p, i) => {
      console.log(`${i+1}. ${p.member?.name || p.name || 'Unknown'}`);
      console.log(`   Email: ${p.member?.email || p.email || 'N/A'}`);
      console.log(`   Offer: ${p.offer?.title || p.offer_title || p.title || 'N/A'}`);
      console.log(`   Amount: $${p.price || p.amount || 'N/A'}`);
      console.log(`   Date: ${p.created_at || 'N/A'}`);
      console.log('');
    });
  }
}

main().catch(console.error);
