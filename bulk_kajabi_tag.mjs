/**
 * Bulk push all 743 leads from DB into Kajabi sequence
 * by applying the "Interconnected Opt In" tag via the correct endpoint:
 * POST /contacts/{id}/relationships/tags
 * with Content-Type: application/vnd.api+json
 */

import { createPool } from 'mysql2/promise';

const KAJABI_API_BASE = 'https://api.kajabi.com/v1';
const SITE_ID = '2148432935'; // The Urban Monk Academy
const TAG_NAME = 'Interconnected Opt In';
const TAG_ID = '2150285702'; // Confirmed from earlier check

async function getToken() {
  const res = await fetch('https://api.kajabi.com/v1/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      grant_type: 'client_credentials',
      client_id: process.env.KAJABI_CLIENT_ID,
      client_secret: process.env.KAJABI_CLIENT_SECRET,
    }),
  });
  const data = await res.json();
  if (!data.access_token) throw new Error('No token: ' + JSON.stringify(data));
  return data.access_token;
}

const token = await getToken();
const jsonApiHeaders = {
  'Authorization': `Bearer ${token}`,
  'Content-Type': 'application/vnd.api+json',
  'Accept': 'application/vnd.api+json',
};
const jsonHeaders = {
  'Authorization': `Bearer ${token}`,
  'Content-Type': 'application/json',
  'Accept': 'application/json',
};

// Pull all leads from DB
const pool = createPool(process.env.DATABASE_URL);
const [leads] = await pool.execute(`
  SELECT id, email, name, created_at 
  FROM interconnected_leads 
  ORDER BY created_at ASC
`);
await pool.end();

console.log(`\n=== BULK KAJABI TAG PUSH ===`);
console.log(`Total leads to process: ${leads.length}`);
console.log(`Tag: "${TAG_NAME}" (ID: ${TAG_ID})`);
console.log(`Endpoint: POST /contacts/{id}/relationships/tags\n`);

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

let success = 0, failed = 0, alreadyTagged = 0, created = 0;
const errors = [];

for (let i = 0; i < leads.length; i++) {
  const lead = leads[i];
  
  if (i % 50 === 0) {
    console.log(`Progress: ${i}/${leads.length} | ✅ ${success} | ⚠️ already:${alreadyTagged} | 🆕 created:${created} | ❌ ${failed}`);
  }
  
  try {
    // Step 1: Find or create contact
    let contactId = null;
    
    const findRes = await fetch(
      `${KAJABI_API_BASE}/contacts?filter[site_id]=${SITE_ID}&filter[email_eq]=${encodeURIComponent(lead.email)}&page[size]=1`,
      { headers: jsonHeaders }
    );
    const findData = await findRes.json();
    
    if (findData.data?.length > 0) {
      contactId = findData.data[0].id;
    } else {
      // Create contact
      const createRes = await fetch(`${KAJABI_API_BASE}/contacts`, {
        method: 'POST',
        headers: jsonHeaders,
        body: JSON.stringify({
          data: {
            type: 'contact',
            attributes: { email: lead.email, name: lead.name, site_id: SITE_ID }
          }
        })
      });
      const createData = await createRes.json();
      if (createData.data?.id) {
        contactId = createData.data.id;
        created++;
      } else {
        throw new Error(`Create failed (${createRes.status}): ${JSON.stringify(createData).slice(0, 150)}`);
      }
    }
    
    // Step 2: Apply tag via /relationships/tags endpoint (correct Kajabi v1 approach)
    const tagRes = await fetch(
      `${KAJABI_API_BASE}/contacts/${contactId}/relationships/tags`,
      {
        method: 'POST',
        headers: jsonApiHeaders,
        body: JSON.stringify({ data: [{ id: TAG_ID, type: 'contact_tags' }] })
      }
    );
    
    if (tagRes.status === 204 || tagRes.ok) {
      success++;
    } else {
      const tagText = await tagRes.text();
      // 422 with "already" means they already have the tag — that's fine
      if (tagRes.status === 422 && tagText.toLowerCase().includes('already')) {
        alreadyTagged++;
      } else {
        throw new Error(`Tag failed (${tagRes.status}): ${tagText.slice(0, 150)}`);
      }
    }
    
  } catch (err) {
    failed++;
    errors.push({ email: lead.email, error: err.message });
    if (failed <= 15) console.log(`  ❌ ${lead.email}: ${err.message.slice(0, 120)}`);
  }
  
  // Rate limit: ~1.5 req/sec (700ms between each lead = 2 API calls per lead)
  await sleep(700);
}

console.log(`\n=== BULK PUSH COMPLETE ===`);
console.log(`✅ Successfully tagged: ${success}`);
console.log(`🆕 New contacts created: ${created}`);
console.log(`⚠️  Already had tag (already in sequence): ${alreadyTagged}`);
console.log(`❌ Failed: ${failed}`);
if (errors.length > 0 && errors.length <= 20) {
  console.log('\nFailed leads:');
  errors.forEach(e => console.log(`  ${e.email}: ${e.error.slice(0, 120)}`));
}
const enrolled = success + alreadyTagged;
console.log(`\n${enrolled}/${leads.length} contacts now enrolled in sequence 2148815115`);
