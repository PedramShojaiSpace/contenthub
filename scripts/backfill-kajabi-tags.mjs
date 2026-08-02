/**
 * backfill-kajabi-tags.mjs
 * Tags all interconnected_leads where kajabi_tagged = 0 with "Interconnected Opt In" in Kajabi.
 * Run once to fix the backlog, then the live fix in kajabiApi.ts handles new leads.
 */
import * as dotenv from 'dotenv';
dotenv.config();
import { createPool } from 'mysql2/promise';

const SITE_ID = '2148432935';
const TAG_NAME = 'Interconnected Opt In';

async function getToken() {
  const res = await fetch('https://api.kajabi.com/v1/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: process.env.KAJABI_CLIENT_ID,
      client_secret: process.env.KAJABI_CLIENT_SECRET,
    })
  });
  const d = await res.json();
  if (!res.ok) throw new Error('Token failed: ' + JSON.stringify(d));
  return d.access_token;
}

async function findOrCreateContact(token, email, name) {
  // Try to find existing contact first
  const findRes = await fetch(
    `https://api.kajabi.com/v1/contacts?filter[email_eq]=${encodeURIComponent(email)}&filter[site_id]=${SITE_ID}&page[size]=1`,
    { headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/vnd.api+json' } }
  );
  const findData = await findRes.json();
  if (findData.data?.length > 0) return findData.data[0].id;

  // Create new contact
  const nameParts = (name || '').trim().split(/\s+/);
  const attrs = { email };
  if (nameParts[0]) attrs.first_name = nameParts[0];
  if (nameParts[1]) attrs.last_name = nameParts.slice(1).join(' ');

  const createRes = await fetch('https://api.kajabi.com/v1/contacts', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/vnd.api+json', 'Content-Type': 'application/vnd.api+json' },
    body: JSON.stringify({
      data: {
        type: 'contacts',
        attributes: attrs,
        relationships: { site: { data: { type: 'sites', id: SITE_ID } } }
      }
    })
  });
  const createData = await createRes.json();
  if (!createRes.ok) {
    // 422 duplicate — try lookup again
    if (createRes.status === 422) {
      const retry = await fetch(
        `https://api.kajabi.com/v1/contacts?filter[email_eq]=${encodeURIComponent(email)}&filter[site_id]=${SITE_ID}&page[size]=1`,
        { headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/vnd.api+json' } }
      );
      const retryData = await retry.json();
      if (retryData.data?.length > 0) return retryData.data[0].id;
    }
    throw new Error(`Create contact failed (${createRes.status}): ${JSON.stringify(createData).slice(0,200)}`);
  }
  return createData.data.id;
}

async function getTagId(token) {
  const res = await fetch(`https://api.kajabi.com/v1/contact_tags?filter[name_cont]=${encodeURIComponent(TAG_NAME)}&page[size]=25`, {
    headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/vnd.api+json' }
  });
  const data = await res.json();
  const exact = (data.data || []).find(t => t.attributes?.name === TAG_NAME);
  if (exact) return exact.id;
  
  // Create the tag
  const createRes = await fetch('https://api.kajabi.com/v1/contact_tags', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/vnd.api+json', 'Content-Type': 'application/vnd.api+json' },
    body: JSON.stringify({ data: { type: 'contact_tags', attributes: { name: TAG_NAME }, relationships: { site: { data: { type: 'sites', id: SITE_ID } } } } })
  });
  const createData = await createRes.json();
  if (!createRes.ok) throw new Error('Create tag failed: ' + JSON.stringify(createData).slice(0,200));
  return createData.data.id;
}

async function applyTag(token, contactId, tagId) {
  const res = await fetch(`https://api.kajabi.com/v1/contacts/${contactId}/relationships/tags`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/vnd.api+json', 'Content-Type': 'application/vnd.api+json' },
    body: JSON.stringify({ data: [{ id: tagId, type: 'contact_tags' }] })
  });
  return res.ok || res.status === 204;
}

async function main() {
  const pool = createPool(process.env.DATABASE_URL);
  const token = await getToken();
  console.log('Kajabi token obtained ✓');
  
  const tagId = await getTagId(token);
  console.log('Tag ID:', tagId, '(' + TAG_NAME + ')');

  // Get all untagged leads
  const [leads] = await pool.execute(
    `SELECT id, email, name FROM interconnected_leads WHERE kajabi_tagged = 0 ORDER BY created_at ASC`
  );
  console.log(`\nFound ${leads.length} untagged leads to backfill\n`);

  let success = 0, failed = 0;
  for (const lead of leads) {
    try {
      const contactId = await findOrCreateContact(token, lead.email, lead.name);
      const tagged = await applyTag(token, contactId, tagId);
      if (tagged) {
        await pool.execute(
          `UPDATE interconnected_leads SET kajabi_tagged = 1, kajabi_tagged_at = ? WHERE id = ?`,
          [Date.now(), lead.id]
        );
        console.log(`✓ ${lead.email}`);
        success++;
      } else {
        console.log(`✗ ${lead.email} — tag apply failed`);
        failed++;
      }
    } catch (e) {
      console.error(`✗ ${lead.email} — ${e.message}`);
      failed++;
    }
    // Rate limit: 2 requests/sec to be safe
    await new Promise(r => setTimeout(r, 500));
  }

  console.log(`\n=== BACKFILL COMPLETE ===`);
  console.log(`Success: ${success} | Failed: ${failed}`);
  await pool.end();
}

main().catch(console.error);
