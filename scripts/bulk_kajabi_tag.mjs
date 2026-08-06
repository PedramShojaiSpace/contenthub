/**
 * bulk_kajabi_tag.mjs
 * 
 * Bulk-tags all Interconnected leads in our DB with the "Interconnected Opt In" tag in Kajabi.
 * Strategy:
 *   1. Pull all leads from DB (email + name)
 *   2. For each lead: create/find contact in Kajabi, then apply the tag
 *   3. Rate-limit to ~2 req/sec to avoid hitting Kajabi API limits
 *   4. Report progress and any failures
 * 
 * Run: node scripts/bulk_kajabi_tag.mjs
 */
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
require('dotenv').config();
import mysql from 'mysql2/promise';

const CLIENT_ID = process.env.KAJABI_CLIENT_ID;
const CLIENT_SECRET = process.env.KAJABI_CLIENT_SECRET;
const DATABASE_URL = process.env.DATABASE_URL;
const TOKEN_URL = 'https://api.kajabi.com/v1/oauth/token';
const API_BASE = 'https://api.kajabi.com/v1';
const URBAN_MONK_SITE_ID = '2148432935';
const TAG_NAME = 'Interconnected Opt In';
const DELAY_MS = 600; // ~1.6 req/sec — safe for Kajabi rate limits

let cachedToken = null;
let tokenExpiry = 0;

async function getToken() {
  if (cachedToken && Date.now() < tokenExpiry - 60000) return cachedToken;
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'client_credentials', client_id: CLIENT_ID, client_secret: CLIENT_SECRET }),
  });
  if (!res.ok) throw new Error(`Token failed: ${res.status} ${await res.text()}`);
  const data = await res.json();
  cachedToken = data.access_token;
  tokenExpiry = Date.now() + (data.expires_in ?? 3600) * 1000;
  return cachedToken;
}

async function resolveTagId(token) {
  const res = await fetch(`${API_BASE}/contact_tags?filter[name_cont]=${encodeURIComponent(TAG_NAME)}&page[size]=25`, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.api+json' },
  });
  const data = await res.json();
  const exact = (data.data || []).find(t => t.attributes?.name?.toLowerCase() === TAG_NAME.toLowerCase());
  if (!exact) throw new Error(`Tag "${TAG_NAME}" not found in Kajabi`);
  return exact.id;
}

async function createOrFindContact(token, email, name) {
  const nameParts = (name || '').trim().split(/\s+/);
  const firstName = nameParts[0] || '';
  const lastName = nameParts.slice(1).join(' ') || '';

  // Try to create — if 422 "already taken", that's fine (contact exists)
  const createRes = await fetch(`${API_BASE}/contacts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/vnd.api+json', Accept: 'application/vnd.api+json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      data: {
        type: 'contacts',
        attributes: { email, ...(firstName ? { first_name: firstName } : {}), ...(lastName ? { last_name: lastName } : {}) },
        relationships: { site: { data: { type: 'sites', id: URBAN_MONK_SITE_ID } } },
      },
    }),
  });

  if (createRes.ok) {
    const data = await createRes.json();
    return { id: data.data?.id, created: true };
  }

  // 422 = already exists — need to find by paginating
  if (createRes.status === 422) {
    const errBody = await createRes.json().catch(() => ({}));
    const detail = errBody?.errors?.[0]?.detail || '';
    if (detail.includes('already been taken') || detail.includes('already taken')) {
      // Find by paginating contacts (Kajabi doesn't support email filter)
      const normalizedEmail = email.toLowerCase().trim();
      let page = 1;
      while (page <= 20) { // search up to 2000 contacts
        const listRes = await fetch(`${API_BASE}/contacts?filter[site_id]=${URBAN_MONK_SITE_ID}&page[size]=100&page[number]=${page}`, {
          headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.api+json' },
        });
        if (!listRes.ok) break;
        const listData = await listRes.json();
        const contacts = listData.data || [];
        const match = contacts.find(c => c.attributes?.email?.toLowerCase().trim() === normalizedEmail);
        if (match) return { id: match.id, created: false };
        if (contacts.length < 100) break;
        page++;
        await new Promise(r => setTimeout(r, 200));
      }
      return { id: null, created: false, error: 'contact_not_found_after_pagination' };
    }
    return { id: null, created: false, error: `create_422: ${detail}` };
  }

  const errText = await createRes.text().catch(() => '');
  return { id: null, created: false, error: `create_${createRes.status}: ${errText.substring(0, 100)}` };
}

async function applyTag(token, contactId, tagId) {
  const res = await fetch(`${API_BASE}/contacts/${contactId}/relationships/tags`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/vnd.api+json', Accept: 'application/vnd.api+json' },
    body: JSON.stringify({ data: [{ id: tagId, type: 'contact_tags' }] }),
  });
  if (res.ok || res.status === 204) return { ok: true };
  const text = await res.text().catch(() => '');
  return { ok: false, error: `tag_${res.status}: ${text.substring(0, 100)}` };
}

async function main() {
  console.log('=== Bulk Kajabi Tagger — Interconnected Opt In ===\n');

  if (!CLIENT_ID || !CLIENT_SECRET) throw new Error('Missing Kajabi credentials');
  if (!DATABASE_URL) throw new Error('Missing DATABASE_URL');

  // Connect to DB
  const db = await mysql.createConnection(DATABASE_URL);
  console.log('✅ DB connected');

  // Pull all leads
  const [leads] = await db.execute(
    `SELECT id, email, name, kajabi_tagged FROM interconnected_leads ORDER BY created_at ASC`
  );
  console.log(`📋 Total leads in DB: ${leads.length}`);

  const untagged = leads.filter(l => !l.kajabi_tagged);
  console.log(`🔴 Untagged leads (kajabi_tagged=0): ${untagged.length}`);
  console.log(`🟢 Already tagged: ${leads.length - untagged.length}\n`);

  if (untagged.length === 0) {
    console.log('Nothing to do — all leads already tagged!');
    await db.end();
    return;
  }

  // Get Kajabi token and tag ID
  const token = await getToken();
  console.log('✅ Kajabi token obtained');
  const tagId = await resolveTagId(token);
  console.log(`✅ Tag ID: ${tagId} ("${TAG_NAME}")\n`);

  // Process each untagged lead
  let tagged = 0, failed = 0, skipped = 0;
  const failures = [];

  for (let i = 0; i < untagged.length; i++) {
    const lead = untagged[i];
    const progress = `[${i + 1}/${untagged.length}]`;

    // Refresh token if needed
    const currentToken = await getToken();

    // Create or find contact
    const contactResult = await createOrFindContact(currentToken, lead.email, lead.name || '');

    if (!contactResult.id) {
      console.log(`${progress} ❌ ${lead.email} — ${contactResult.error}`);
      failures.push({ email: lead.email, error: contactResult.error });
      failed++;
      await new Promise(r => setTimeout(r, DELAY_MS));
      continue;
    }

    // Apply tag
    const tagResult = await applyTag(currentToken, contactResult.id, tagId);

    if (tagResult.ok) {
      // Update DB
      await db.execute(
        `UPDATE interconnected_leads SET kajabi_tagged = 1, kajabi_tagged_at = ? WHERE id = ?`,
        [Date.now(), lead.id]
      );
      tagged++;
      if ((i + 1) % 25 === 0 || i === untagged.length - 1) {
        console.log(`${progress} ✅ Progress: ${tagged} tagged, ${failed} failed, ${skipped} skipped`);
      }
    } else {
      console.log(`${progress} ❌ ${lead.email} — tag failed: ${tagResult.error}`);
      failures.push({ email: lead.email, error: tagResult.error });
      failed++;
    }

    await new Promise(r => setTimeout(r, DELAY_MS));
  }

  await db.end();

  console.log('\n=== FINAL RESULTS ===');
  console.log(`✅ Successfully tagged: ${tagged}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`⏭️  Skipped: ${skipped}`);

  if (failures.length > 0) {
    console.log('\nFailed leads:');
    for (const f of failures.slice(0, 20)) {
      console.log(`  ${f.email}: ${f.error}`);
    }
    if (failures.length > 20) console.log(`  ... and ${failures.length - 20} more`);
  }
}

main().catch(e => { console.error('Fatal error:', e); process.exit(1); });
