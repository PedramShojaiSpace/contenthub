/**
 * bulk_kajabi_tag_v2.mjs
 * 
 * Fast bulk tagger — creates contact (or handles 422 duplicate) then applies tag.
 * No pagination search needed — we just create and extract the ID from the 422 error.
 * 
 * Run: node scripts/bulk_kajabi_tag_v2.mjs
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
const DELAY_MS = 500; // 2 req/sec

let cachedToken = null;
let tokenExpiry = 0;

async function getToken() {
  if (cachedToken && Date.now() < tokenExpiry - 60000) return cachedToken;
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'client_credentials', client_id: CLIENT_ID, client_secret: CLIENT_SECRET }),
  });
  if (!res.ok) throw new Error(`Token failed: ${res.status}`);
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
  if (!exact) throw new Error(`Tag "${TAG_NAME}" not found`);
  return exact.id;
}

/**
 * Create contact. If 422 "already taken", extract the existing contact ID from 
 * the error response (Kajabi includes it in some 422 responses) or do a targeted search.
 */
async function ensureContact(token, email, name) {
  const nameParts = (name || '').trim().split(/\s+/);
  const firstName = nameParts[0] || '';
  const lastName = nameParts.slice(1).join(' ') || '';

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
    return { id: data.data?.id, status: 'created' };
  }

  if (createRes.status === 422) {
    const errBody = await createRes.json().catch(() => ({}));
    const detail = errBody?.errors?.[0]?.detail || '';
    
    // Check if Kajabi returns the existing contact ID in the error
    const existingId = errBody?.errors?.[0]?.meta?.existing_id || errBody?.meta?.existing_id;
    if (existingId) return { id: existingId, status: 'found_via_error' };
    
    if (detail.includes('already been taken') || detail.includes('already taken') || detail.includes('double check your email')) {
      // Contact exists — use a targeted search with email filter (even though it doesn't work perfectly,
      // try with email_cont which does a contains search)
      const searchRes = await fetch(`${API_BASE}/contacts?filter[site_id]=${URBAN_MONK_SITE_ID}&filter[email_cont]=${encodeURIComponent(email.split('@')[0])}&page[size]=50`, {
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.api+json' },
      });
      if (searchRes.ok) {
        const searchData = await searchRes.json();
        const match = (searchData.data || []).find(c => c.attributes?.email?.toLowerCase().trim() === email.toLowerCase().trim());
        if (match) return { id: match.id, status: 'found_via_search' };
      }
      // Last resort: search by first 5 chars of email username
      return { id: null, status: 'exists_but_not_found', error: detail };
    }
    return { id: null, status: 'error_422', error: detail };
  }

  const errText = await createRes.text().catch(() => '');
  return { id: null, status: `error_${createRes.status}`, error: errText.substring(0, 100) };
}

async function applyTag(token, contactId, tagId) {
  const res = await fetch(`${API_BASE}/contacts/${contactId}/relationships/tags`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/vnd.api+json', Accept: 'application/vnd.api+json' },
    body: JSON.stringify({ data: [{ id: tagId, type: 'contact_tags' }] }),
  });
  if (res.ok || res.status === 204) return { ok: true };
  const text = await res.text().catch(() => '');
  return { ok: false, error: `${res.status}: ${text.substring(0, 100)}` };
}

async function main() {
  console.log('=== Bulk Kajabi Tagger v2 — Fast Mode ===\n');

  const db = await mysql.createConnection(DATABASE_URL);
  console.log('✅ DB connected');

  const [leads] = await db.execute(
    `SELECT id, email, name, kajabi_tagged FROM interconnected_leads WHERE kajabi_tagged = 0 ORDER BY created_at ASC`
  );
  console.log(`🔴 Untagged leads to process: ${leads.length}\n`);

  if (leads.length === 0) {
    console.log('Nothing to do!');
    await db.end();
    return;
  }

  const token = await getToken();
  const tagId = await resolveTagId(token);
  console.log(`✅ Tag ID: ${tagId} ("${TAG_NAME}")\n`);

  let tagged = 0, created = 0, found = 0, failed = 0;
  const failures = [];

  for (let i = 0; i < leads.length; i++) {
    const lead = leads[i];
    const progress = `[${i + 1}/${leads.length}]`;
    const currentToken = await getToken();

    const contactResult = await ensureContact(currentToken, lead.email, lead.name || '');

    if (!contactResult.id) {
      if ((i + 1) % 10 === 0 || failures.length < 5) {
        console.log(`${progress} ⚠️  ${lead.email} — ${contactResult.status}: ${contactResult.error || ''}`);
      }
      failures.push({ email: lead.email, error: `${contactResult.status}: ${contactResult.error}` });
      failed++;
      await new Promise(r => setTimeout(r, DELAY_MS));
      continue;
    }

    if (contactResult.status === 'created') created++;
    else found++;

    const tagResult = await applyTag(currentToken, contactResult.id, tagId);

    if (tagResult.ok) {
      await db.execute(
        `UPDATE interconnected_leads SET kajabi_tagged = 1, kajabi_tagged_at = ? WHERE id = ?`,
        [Date.now(), lead.id]
      );
      tagged++;
      if ((i + 1) % 50 === 0 || i === leads.length - 1) {
        console.log(`${progress} ✅ ${tagged} tagged (${created} new contacts, ${found} existing) | ${failed} failed`);
      }
    } else {
      console.log(`${progress} ❌ Tag failed for ${lead.email}: ${tagResult.error}`);
      failures.push({ email: lead.email, error: `tag: ${tagResult.error}` });
      failed++;
    }

    await new Promise(r => setTimeout(r, DELAY_MS));
  }

  await db.end();

  console.log('\n=== FINAL RESULTS ===');
  console.log(`✅ Successfully tagged: ${tagged}`);
  console.log(`   New contacts created: ${created}`);
  console.log(`   Existing contacts found: ${found}`);
  console.log(`❌ Failed: ${failed}`);

  if (failures.length > 0) {
    console.log('\nFirst 10 failures:');
    for (const f of failures.slice(0, 10)) {
      console.log(`  ${f.email}: ${f.error}`);
    }
  }
}

main().catch(e => { console.error('Fatal:', e.message); process.exit(1); });
