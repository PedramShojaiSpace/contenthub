/**
 * Backfill all leads with phone numbers + SMS consent into Klaviyo SMS list
 * Submits one at a time to skip invalid numbers without blocking the whole batch
 */
import * as dotenv from 'dotenv';
import { createConnection } from 'mysql2/promise';
dotenv.config();

const KEY = process.env.KLAVIYO_PRIVATE_KEY;
const SMS_LIST = process.env.KLAVIYO_INTERCONNECTED_SMS_LIST_ID || 'Xer7ua';
const DB_URL = process.env.DATABASE_URL;

function formatPhone(phone) {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 10) return '+1' + digits;
  if (digits.length === 11 && digits.startsWith('1')) return '+' + digits;
  if (digits.length > 7) return '+' + digits;
  return null;
}

async function subscribeOne(email, phone) {
  const res = await fetch('https://a.klaviyo.com/api/profile-subscription-bulk-create-jobs/', {
    method: 'POST',
    headers: {
      Authorization: `Klaviyo-API-Key ${KEY}`,
      revision: '2024-02-15',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      data: {
        type: 'profile-subscription-bulk-create-job',
        attributes: {
          profiles: {
            data: [{
              type: 'profile',
              attributes: {
                email,
                phone_number: phone,
                subscriptions: {
                  sms: { marketing: { consent: 'SUBSCRIBED' } }
                }
              }
            }]
          }
        },
        relationships: {
          list: { data: { type: 'list', id: SMS_LIST } }
        }
      }
    })
  });
  if (res.status === 202) return { ok: true };
  const data = await res.json();
  return { ok: false, error: data.errors?.[0]?.detail || 'Unknown error' };
}

async function main() {
  console.log('=== Klaviyo SMS Backfill (one-by-one) ===\n');

  const db = await createConnection(DB_URL);
  const [leads] = await db.execute(
    `SELECT id, name, email, phone FROM interconnected_leads 
     WHERE sms_consent = 1 AND phone IS NOT NULL AND phone != ''
     ORDER BY created_at ASC`
  );
  await db.end();

  console.log(`Found ${leads.length} leads with SMS consent\n`);

  let success = 0, skipped = 0, failed = 0;

  for (const lead of leads) {
    const phone = formatPhone(lead.phone);
    if (!phone) {
      console.log(`  SKIP  ${lead.email} — bad format: "${lead.phone}"`);
      skipped++;
      continue;
    }

    const result = await subscribeOne(lead.email, phone);
    if (result.ok) {
      console.log(`  ✅  ${lead.email} (${phone})`);
      success++;
    } else {
      console.log(`  ❌  ${lead.email} (${phone}) — ${result.error}`);
      failed++;
    }

    // Small delay to avoid rate limits
    await new Promise(r => setTimeout(r, 200));
  }

  console.log(`\n=== Done ===`);
  console.log(`✅ Subscribed: ${success}`);
  console.log(`❌ Failed (invalid numbers): ${failed}`);
  console.log(`⏭  Skipped (bad format): ${skipped}`);
}

main().catch(console.error);
