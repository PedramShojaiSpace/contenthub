/**
 * bulk_kajabi_enroll.mjs
 * 
 * Bulk-enrolls all untagged Interconnected leads via Kajabi form submission.
 * Form submission is the ONLY reliable way to:
 *   1. Create/update the contact in Kajabi
 *   2. Apply the "Interconnected Opt In" tag
 *   3. Trigger the SP26 email sequence enrollment
 * 
 * Run: node scripts/bulk_kajabi_enroll.mjs
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
const FORM_ID = '2149563926'; // Interconnected sequence enrollment form
const DELAY_MS = 400; // 2.5 req/sec — safe for Kajabi

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

async function submitForm(token, email, name) {
  const nameParts = (name || '').trim().split(/\s+/);
  const firstName = nameParts[0] || 'Friend';
  const lastName = nameParts.slice(1).join(' ') || '';
  const fullName = [firstName, lastName].filter(Boolean).join(' ');

  const res = await fetch(`${API_BASE}/forms/${FORM_ID}/submit`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/vnd.api+json',
      Accept: 'application/vnd.api+json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      data: {
        type: 'form_submissions',
        attributes: {
          email,
          name: fullName,
          first_name: firstName,
          ...(lastName ? { last_name: lastName } : {}),
        },
      },
    }),
  });

  if (res.ok) return { ok: true, status: res.status };
  const text = await res.text().catch(() => '');
  return { ok: false, status: res.status, error: text.substring(0, 200) };
}

async function main() {
  console.log('=== Bulk Kajabi Form Enrollment ===');
  console.log(`Form ID: ${FORM_ID} (Interconnected SP26 sequence)\n`);

  const db = await mysql.createConnection(DATABASE_URL);
  console.log('✅ DB connected');

  const [leads] = await db.execute(
    `SELECT id, email, name, kajabi_tagged FROM interconnected_leads WHERE kajabi_tagged = 0 ORDER BY created_at ASC`
  );
  console.log(`🔴 Untagged leads to enroll: ${leads.length}\n`);

  if (leads.length === 0) {
    console.log('Nothing to do — all leads already enrolled!');
    await db.end();
    return;
  }

  let enrolled = 0, failed = 0;
  const failures = [];
  const startTime = Date.now();

  for (let i = 0; i < leads.length; i++) {
    const lead = leads[i];
    const progress = `[${i + 1}/${leads.length}]`;
    const currentToken = await getToken();

    const result = await submitForm(currentToken, lead.email, lead.name || '');

    if (result.ok) {
      await db.execute(
        `UPDATE interconnected_leads SET kajabi_tagged = 1, kajabi_tagged_at = ? WHERE id = ?`,
        [Date.now(), lead.id]
      );
      enrolled++;

      if ((i + 1) % 50 === 0 || i === leads.length - 1) {
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);
        const eta = leads.length > 0 ? ((leads.length - i - 1) * DELAY_MS / 1000).toFixed(0) : 0;
        console.log(`${progress} ✅ ${enrolled} enrolled | ${failed} failed | ${elapsed}s elapsed | ~${eta}s remaining`);
      }
    } else {
      if (failures.length < 10 || (i + 1) % 100 === 0) {
        console.log(`${progress} ❌ ${lead.email} — ${result.status}: ${result.error}`);
      }
      failures.push({ email: lead.email, error: `${result.status}: ${result.error}` });
      failed++;
    }

    await new Promise(r => setTimeout(r, DELAY_MS));
  }

  await db.end();

  const totalTime = ((Date.now() - startTime) / 1000).toFixed(0);
  console.log('\n=== FINAL RESULTS ===');
  console.log(`✅ Successfully enrolled: ${enrolled}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`⏱️  Total time: ${totalTime}s`);

  if (failures.length > 0) {
    console.log('\nFirst 15 failures:');
    for (const f of failures.slice(0, 15)) {
      console.log(`  ${f.email}: ${f.error}`);
    }
    if (failures.length > 15) console.log(`  ... and ${failures.length - 15} more`);
  }
}

main().catch(e => { console.error('Fatal:', e.message); process.exit(1); });
