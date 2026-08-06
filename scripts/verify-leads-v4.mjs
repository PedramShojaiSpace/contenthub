import * as dotenv from 'dotenv';
dotenv.config();
import { createPool } from 'mysql2/promise';

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
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Kajabi token failed (${res.status}): ${txt.slice(0,200)}`);
  }
  const data = await res.json();
  return data.access_token;
}

async function main() {
  const pool = createPool(process.env.DATABASE_URL);

  // 1. Recent leads from our DB
  console.log('\n=== RECENT INTERCONNECTED LEADS (our DB) ===');
  const [leads] = await pool.execute(
    `SELECT id, email, name, phone, sms_consent, kajabi_tagged, klaviyo_synced, utm_source, utm_campaign, created_at
     FROM interconnected_leads ORDER BY created_at DESC LIMIT 10`
  );
  leads.forEach((l, i) => {
    const date = new Date(Number(l.created_at)).toISOString();
    console.log(`${i+1}. ${l.name||'?'} | ${l.email} | phone: ${l.phone||'none'} | sms_consent: ${l.sms_consent} | kajabi_tagged: ${l.kajabi_tagged} | klaviyo_synced: ${l.klaviyo_synced} | ${date}`);
  });

  await pool.end();

  // 2. Kajabi recent purchases via client_credentials
  console.log('\n=== RECENT KAJABI PURCHASES ===');
  try {
    const token = await getKajabiToken();
    console.log('Kajabi token obtained ✓');

    // Try purchases endpoint
    const kRes = await fetch('https://api.kajabi.com/v1/purchases?page[size]=15&sort=-created_at', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.api+json',
      }
    });
    if (!kRes.ok) {
      const txt = await kRes.text();
      console.error('Kajabi purchases error:', kRes.status, txt.slice(0, 300));
      
      // Try orders endpoint as fallback
      console.log('\nTrying /orders endpoint...');
      const oRes = await fetch('https://api.kajabi.com/v1/orders?page[size]=15&sort=-created_at', {
        headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/vnd.api+json' }
      });
      const oTxt = await oRes.text();
      console.log('Orders response:', oRes.status, oTxt.slice(0, 400));
    } else {
      const kData = await kRes.json();
      const purchases = kData.data || kData.purchases || kData || [];
      console.log(`${purchases.length} purchases returned`);
      purchases.slice(0, 15).forEach((p, i) => {
        const attrs = p.attributes || p;
        const name = attrs.member_name || attrs.name || 'Unknown';
        const email = attrs.member_email || attrs.email || 'N/A';
        const offer = attrs.offer_title || attrs.title || 'N/A';
        const amount = attrs.price || attrs.amount || 'N/A';
        const date = attrs.created_at || 'N/A';
        console.log(`${i+1}. ${name} | ${email} | ${offer} | $${amount} | ${date}`);
      });
    }
  } catch (e) {
    console.error('Kajabi error:', e.message);
  }

  // 3. Klaviyo list check
  console.log(`\n=== KLAVIYO LIST CHECK (${SMS_LIST_ID}) ===`);
  try {
    // Try getting list members via profiles endpoint with filter
    const kRes = await fetch(
      `https://a.klaviyo.com/api/profiles/?filter=equals(subscriptions.sms.marketing.list_id,"${SMS_LIST_ID}")&sort=-created&page[size]=10`,
      { headers: { 'Authorization': `Klaviyo-API-Key ${KLAVIYO_KEY}`, 'revision': '2024-10-15' } }
    );
    const kData = await kRes.json();
    if (!kRes.ok) {
      console.error('Klaviyo profiles error:', kRes.status, JSON.stringify(kData).slice(0, 300));
      
      // Try direct list members endpoint
      console.log('Trying list relationships endpoint...');
      const lRes = await fetch(
        `https://a.klaviyo.com/api/lists/${SMS_LIST_ID}/relationships/profiles/?page[size]=10`,
        { headers: { 'Authorization': `Klaviyo-API-Key ${KLAVIYO_KEY}`, 'revision': '2024-10-15' } }
      );
      const lData = await lRes.json();
      console.log('List relationships:', lRes.status, JSON.stringify(lData).slice(0, 400));
    } else {
      const profiles = kData.data || [];
      console.log(`${profiles.length} profiles returned`);
      profiles.forEach((p, i) => {
        const a = p.attributes || {};
        console.log(`${i+1}. ${a.first_name||''} ${a.last_name||''} | ${a.email||'no email'} | ${a.phone_number||'no phone'}`);
      });
    }
  } catch (e) {
    console.error('Klaviyo error:', e.message);
  }
}

main().catch(console.error);
