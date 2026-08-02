import * as dotenv from 'dotenv';
dotenv.config();
import { createPool } from 'mysql2/promise';

const KLAVIYO_KEY = process.env.KLAVIYO_PRIVATE_KEY;
const SMS_LIST_ID = process.env.KLAVIYO_INTERCONNECTED_SMS_LIST_ID;

async function main() {
  const pool = createPool(process.env.DATABASE_URL);

  // 1. Recent leads from our DB
  console.log('\n=== RECENT INTERCONNECTED LEADS (our DB) ===');
  const [leads] = await pool.execute(
    `SELECT id, email, name, phone, sms_consent, kajabi_tagged, klaviyo_synced, utm_source, utm_campaign, created_at
     FROM interconnected_leads ORDER BY created_at DESC LIMIT 10`
  );
  leads.forEach((l, i) => {
    console.log(`${i+1}. ${l.name||'?'} | ${l.email} | phone: ${l.phone||'none'} | sms_consent: ${l.sms_consent} | kajabi_tagged: ${l.kajabi_tagged} | klaviyo_synced: ${l.klaviyo_synced} | ${l.created_at}`);
  });

  // 2. Kajabi token
  const [tokenRows] = await pool.execute(
    "SELECT `key`, value FROM app_settings WHERE `key` = 'kajabi_access_token' LIMIT 1"
  );
  const kajabiToken = tokenRows[0]?.value;
  console.log('\n=== KAJABI TOKEN ===', kajabiToken ? 'Found (' + kajabiToken.slice(0,15) + '...)' : 'NOT FOUND');

  // 3. Recent Kajabi purchases
  if (kajabiToken) {
    console.log('\n=== RECENT KAJABI PURCHASES ===');
    const kRes = await fetch('https://kajabi.com/api/v1/purchases?per_page=15&sort=created_at&direction=desc', {
      headers: { 'Authorization': `Bearer ${kajabiToken}`, 'Accept': 'application/json' }
    });
    if (!kRes.ok) {
      console.error('Kajabi error:', kRes.status, (await kRes.text()).slice(0, 200));
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
  }

  // 4. Klaviyo list check
  console.log(`\n=== KLAVIYO LIST CHECK (${SMS_LIST_ID}) ===`);
  const kRes = await fetch(`https://a.klaviyo.com/api/lists/${SMS_LIST_ID}/profiles/?page[size]=10`, {
    headers: { 'Authorization': `Klaviyo-API-Key ${KLAVIYO_KEY}`, 'revision': '2024-10-15' }
  });
  const kData = await kRes.json();
  if (!kRes.ok) {
    console.error('Klaviyo error:', kRes.status, JSON.stringify(kData).slice(0, 300));
  } else {
    const profiles = kData.data || [];
    console.log(`${profiles.length} profiles returned`);
    profiles.forEach((p, i) => {
      const a = p.attributes || {};
      console.log(`${i+1}. ${a.first_name||''} ${a.last_name||''} | ${a.email||'no email'} | ${a.phone_number||'no phone'}`);
    });
  }

  await pool.end();
}

main().catch(console.error);
