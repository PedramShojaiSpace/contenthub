import * as dotenv from 'dotenv';
dotenv.config();
import { createPool } from 'mysql2/promise';

const KLAVIYO_KEY = process.env.KLAVIYO_PRIVATE_KEY;
const SMS_LIST_ID = process.env.KLAVIYO_INTERCONNECTED_SMS_LIST_ID;

async function getKajabiToken() {
  const pool = createPool(process.env.DATABASE_URL);
  const [rows] = await pool.execute('SHOW TABLES');
  const tables = rows.map(t => Object.values(t)[0]);
  console.log('DB Tables:', tables.join(', '));
  
  // Find the settings/oauth table
  let token = null;
  for (const table of tables) {
    if (table.includes('setting') || table.includes('oauth') || table.includes('token') || table.includes('integration')) {
      const [cols] = await pool.execute(`DESCRIBE ${table}`);
      console.log(`Table ${table} columns:`, cols.map(c => c.Field).join(', '));
      const [data] = await pool.execute(`SELECT * FROM ${table} LIMIT 3`);
      console.log(`Table ${table} sample:`, JSON.stringify(data).slice(0, 300));
    }
  }
  await pool.end();
  return token;
}

async function getRecentKlaviyoLeads() {
  if (!SMS_LIST_ID) {
    console.log('SMS_LIST_ID not set, env value:', SMS_LIST_ID);
    return [];
  }
  
  const url = `https://a.klaviyo.com/api/lists/${SMS_LIST_ID}/profiles/?sort=-joined_group_at&page[size]=10`;
  const res = await fetch(url, {
    headers: {
      'Authorization': `Klaviyo-API-Key ${KLAVIYO_KEY}`,
      'revision': '2024-02-15',
    }
  });
  const data = await res.json();
  if (!res.ok) {
    console.error('Klaviyo error:', res.status, JSON.stringify(data).slice(0, 300));
    return [];
  }
  return data.data || [];
}

async function getRecentKajabiPurchases(token, siteId) {
  const res = await fetch(`https://kajabi.com/api/v1/purchases?per_page=15&sort=created_at&direction=desc`, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/json',
    }
  });
  if (!res.ok) {
    const text = await res.text();
    console.error('Kajabi error:', res.status, text.slice(0, 300));
    return [];
  }
  const data = await res.json();
  return data.purchases || data || [];
}

async function main() {
  console.log('\n=== ENV CHECK ===');
  console.log('KLAVIYO_KEY present:', !!KLAVIYO_KEY);
  console.log('SMS_LIST_ID:', SMS_LIST_ID);
  
  console.log('\n=== DB / KAJABI TOKEN LOOKUP ===');
  await getKajabiToken();
  
  console.log('\n=== RECENT KLAVIYO LEADS ===');
  const leads = await getRecentKlaviyoLeads();
  if (leads.length === 0) {
    console.log('No leads returned');
  } else {
    leads.forEach((p, i) => {
      const a = p.attributes || {};
      console.log(`${i+1}. ${a.first_name||''} ${a.last_name||''} | ${a.email||'no email'} | ${a.phone_number||'no phone'} | joined: ${a.joined_group_at||'?'}`);
    });
  }
}

main().catch(console.error);
