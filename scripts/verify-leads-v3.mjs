import * as dotenv from 'dotenv';
dotenv.config();
import { createPool } from 'mysql2/promise';

const KLAVIYO_KEY = process.env.KLAVIYO_PRIVATE_KEY;
const SMS_LIST_ID = process.env.KLAVIYO_INTERCONNECTED_SMS_LIST_ID; // Xer7ua

async function main() {
  const pool = createPool(process.env.DATABASE_URL);

  // 1. Check recent interconnected leads from our own DB
  console.log('\n=== RECENT INTERCONNECTED LEADS (our DB) ===');
  const [leads] = await pool.execute(
    `SELECT id, email, phone, firstName, lastName, createdAt, source 
     FROM interconnected_leads 
     ORDER BY createdAt DESC 
     LIMIT 10`
  );
  if (leads.length === 0) {
    console.log('No leads in interconnected_leads table yet');
  } else {
    leads.forEach((l, i) => {
      console.log(`${i+1}. ${l.firstName||''} ${l.lastName||''} | ${l.email} | ${l.phone||'no phone'} | ${l.source||'?'} | ${l.createdAt}`);
    });
  }

  // 2. Get Kajabi token from DB (correct column name is 'key')
  console.log('\n=== KAJABI TOKEN LOOKUP ===');
  const [tokenRows] = await pool.execute(
    `SELECT \`key\`, value FROM app_settings WHERE \`key\` LIKE '%kajabi%' LIMIT 5`
  );
  console.log('Kajabi settings found:', tokenRows.length);
  tokenRows.forEach(r => console.log(' -', r.key, ':', r.value?.slice(0,30) + '...'));

  // 3. Try Klaviyo API with correct list ID
  console.log('\n=== KLAVIYO API CHECK (list:', SMS_LIST_ID, ') ===');
  
  // Try the members endpoint
  const membersUrl = `https://a.klaviyo.com/api/lists/${SMS_LIST_ID}/profiles/?page[size]=10`;
  const res = await fetch(membersUrl, {
    headers: {
      'Authorization': `Klaviyo-API-Key ${KLAVIYO_KEY}`,
      'revision': '2024-10-15',
    }
  });
  const data = await res.json();
  if (!res.ok) {
    console.error('Klaviyo error:', res.status, JSON.stringify(data).slice(0, 400));
  } else {
    const profiles = data.data || [];
    console.log(`Found ${profiles.length} profiles in list`);
    profiles.slice(0, 10).forEach((p, i) => {
      const a = p.attributes || {};
      console.log(`${i+1}. ${a.first_name||''} ${a.last_name||''} | ${a.email||'no email'} | ${a.phone_number||'no phone'}`);
    });
  }

  // 4. Pull Kajabi recent purchases using token from DB
  const [kajabiTokenRow] = await pool.execute(
    `SELECT value FROM app_settings WHERE \`key\` = 'kajabi_access_token' LIMIT 1`
  );
  
  if (kajabiTokenRow.length > 0) {
    const kajabiToken = kajabiTokenRow[0].value;
    console.log('\n=== RECENT KAJABI PURCHASES ===');
    const kRes = await fetch('https://kajabi.com/api/v1/purchases?per_page=15&sort=created_at&direction=desc', {
      headers: {
        'Authorization': `Bearer ${kajabiToken}`,
        'Accept': 'application/json',
      }
    });
    if (!kRes.ok) {
      const txt = await kRes.text();
      console.error('Kajabi error:', kRes.status, txt.slice(0, 300));
    } else {
      const kData = await kRes.json();
      const purchases = kData.purchases || kData || [];
      purchases.slice(0, 15).forEach((p, i) => {
        const name = p.member?.name || p.name || 'Unknown';
        const email = p.member?.email || p.email || 'N/A';
        const offer = p.offer?.title || p.offer_title || 'N/A';
        const amount = p.price || p.amount || 'N/A';
        const date = p.created_at || 'N/A';
        console.log(`${i+1}. ${name} | ${email} | ${offer} | $${amount} | ${date}`);
      });
    }
  } else {
    console.log('No Kajabi token in DB — checking kajabiApi.ts pattern');
    // Check user_credentials table
    const [credRows] = await pool.execute(
      `SELECT * FROM user_credentials WHERE service LIKE '%kajabi%' LIMIT 3`
    ).catch(() => [[]]);
    console.log('user_credentials kajabi rows:', credRows.length);
    if (credRows.length > 0) console.log(JSON.stringify(credRows[0]).slice(0, 200));
  }

  await pool.end();
}

main().catch(console.error);
