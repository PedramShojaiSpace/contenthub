/**
 * Kajabi tag check + bulk enrollment for any leads missing from Kajabi
 * Run from: /home/ubuntu/lights-on-optin
 */
import 'dotenv/config';
import mysql from 'mysql2/promise';

const KAJABI_CLIENT_ID = process.env.KAJABI_CLIENT_ID;
const KAJABI_CLIENT_SECRET = process.env.KAJABI_CLIENT_SECRET;
const DATABASE_URL = process.env.DATABASE_URL;
const KAJABI_FORM_ID = process.env.KAJABI_FORM_ID || '2150211911';

async function getKajabiToken() {
  const r = await fetch('https://api.kajabi.com/v1/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      grant_type: 'client_credentials',
      client_id: KAJABI_CLIENT_ID,
      client_secret: KAJABI_CLIENT_SECRET
    })
  });
  const d = await r.json();
  if (!d.access_token) throw new Error('No token: ' + JSON.stringify(d));
  return d.access_token;
}

async function getTagCount(token, tagName) {
  // Get all tags
  const r = await fetch('https://app.kajabi.com/api/v1/tags?per_page=200', {
    headers: { 'Authorization': 'Bearer ' + token }
  });
  const d = await r.json();
  const tags = d.tags || d.data || [];
  const tag = tags.find(t => t.name === tagName);
  if (!tag) return { found: false, count: 0, id: null };
  
  // Get contacts with this tag
  const r2 = await fetch(`https://app.kajabi.com/api/v1/contacts?tag_id=${tag.id}&per_page=1`, {
    headers: { 'Authorization': 'Bearer ' + token }
  });
  const d2 = await r2.json();
  const total = d2.meta?.total || d2.total_count || (d2.contacts || []).length;
  return { found: true, count: total, id: tag.id, name: tag.name };
}

async function submitToKajabiForm(token, lead) {
  const nameParts = (lead.name || '').trim().split(' ');
  const firstName = nameParts[0] || 'Friend';
  const lastName = nameParts.slice(1).join(' ') || '';
  
  const body = {
    data: {
      email: lead.email,
      first_name: firstName,
      last_name: lastName
    }
  };
  if (lead.phone) body.data.phone = lead.phone;
  
  const r = await fetch(`https://app.kajabi.com/api/v1/forms/${KAJABI_FORM_ID}/submissions`, {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + token,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });
  return r.status;
}

async function main() {
  console.log('=== Kajabi Tag Check & Enrollment ===');
  console.log('Time:', new Date().toLocaleString('en-US', { timeZone: 'America/Chicago' }), 'CT');
  
  // 1. Get Kajabi token
  let token;
  try {
    token = await getKajabiToken();
    console.log('✅ Kajabi API connected');
  } catch(e) {
    console.error('❌ Kajabi API failed:', e.message);
    process.exit(1);
  }
  
  // 2. Check tag count
  const tagInfo = await getTagCount(token, 'Interconnected Opt In');
  console.log(`\nKajabi "Interconnected Opt In" tag: ${tagInfo.found ? '✅ Found' : '❌ NOT FOUND'}`);
  if (tagInfo.found) {
    console.log(`  Contacts with tag: ${tagInfo.count}`);
  }
  
  // 3. Get DB lead count
  const conn = await mysql.createConnection(DATABASE_URL);
  const [rows] = await conn.execute('SELECT COUNT(*) as total FROM interconnected_leads');
  const dbTotal = rows[0].total;
  console.log(`\nDB total leads: ${dbTotal}`);
  console.log(`Kajabi tag count: ${tagInfo.count}`);
  console.log(`Gap: ${dbTotal - tagInfo.count} leads not in Kajabi`);
  
  // 4. Get leads that need enrollment (those without kajabi_tagged_at or with failed tagging)
  const [untagged] = await conn.execute(`
    SELECT email, name, phone 
    FROM interconnected_leads 
    WHERE kajabi_tagged_at IS NULL 
    ORDER BY created_at DESC
    LIMIT 100
  `);
  
  console.log(`\nLeads with NULL kajabi_tagged_at: ${untagged.length}`);
  
  if (untagged.length > 0) {
    console.log('\nEnrolling untagged leads...');
    let success = 0, failed = 0;
    
    for (const lead of untagged) {
      try {
        const status = await submitToKajabiForm(token, lead);
        if (status === 200 || status === 201 || status === 204) {
          await conn.execute(
            'UPDATE interconnected_leads SET kajabi_tagged_at = NOW() WHERE email = ?',
            [lead.email]
          );
          success++;
          if (success % 10 === 0) console.log(`  Progress: ${success}/${untagged.length}`);
        } else {
          failed++;
          console.log(`  Failed (${status}): ${lead.email}`);
        }
        await new Promise(r => setTimeout(r, 300));
      } catch(e) {
        failed++;
        console.log(`  Error: ${lead.email} — ${e.message}`);
      }
    }
    
    console.log(`\nEnrollment complete: ${success} enrolled, ${failed} failed`);
  } else {
    console.log('No untagged leads found — all leads have kajabi_tagged_at set');
    console.log('The gap may be a Kajabi API pagination issue in the watchdog');
  }
  
  await conn.end();
  console.log('\n=== Done ===');
}

main().catch(e => {
  console.error('Fatal error:', e.message);
  process.exit(1);
});
