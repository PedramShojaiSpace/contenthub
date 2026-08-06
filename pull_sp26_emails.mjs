import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '.env') });

const KAJABI_CLIENT_ID = process.env.KAJABI_CLIENT_ID;
const KAJABI_CLIENT_SECRET = process.env.KAJABI_CLIENT_SECRET;
const SEQUENCE_ID = '2148815115';
const SITE_ID = '2148432935'; // Urban Monk Academy

async function getToken() {
  const res = await fetch('https://api.kajabi.com/v1/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: KAJABI_CLIENT_ID,
      client_secret: KAJABI_CLIENT_SECRET,
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Token failed (${res.status}): ${text}`);
  }
  const data = await res.json();
  return data.access_token;
}

async function fetchWithToken(token, url) {
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.api+json',
    },
  });
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text, status: res.status };
  }
}

async function main() {
  const token = await getToken();
  console.log('Token obtained:', token ? 'YES' : 'NO');

  // Get the sequence details
  const seqUrl = `https://api.kajabi.com/v1/sites/${SITE_ID}/email_sequences/${SEQUENCE_ID}`;
  const seq = await fetchWithToken(token, seqUrl);
  console.log('\n=== SEQUENCE ===');
  console.log(JSON.stringify(seq, null, 2).substring(0, 500));

  // Get all emails in the sequence
  const emailsUrl = `https://api.kajabi.com/v1/sites/${SITE_ID}/email_sequences/${SEQUENCE_ID}/email_sequence_emails?page[size]=50`;
  const emails = await fetchWithToken(token, emailsUrl);
  console.log('\n=== EMAILS RESPONSE ===');
  console.log(JSON.stringify(emails, null, 2).substring(0, 2000));

  // Save full response
  fs.writeFileSync('/tmp/sp26_emails_raw.json', JSON.stringify(emails, null, 2));
  console.log('\nFull response saved to /tmp/sp26_emails_raw.json');
  
  if (emails.data) {
    console.log(`\nTotal emails found: ${emails.data.length}`);
    emails.data.forEach((email, i) => {
      const attrs = email.attributes || {};
      console.log(`\n--- Email ${i+1} ---`);
      console.log(`ID: ${email.id}`);
      console.log(`Subject: ${attrs.subject || attrs.name || 'N/A'}`);
      console.log(`Send after days: ${attrs.send_after_days ?? attrs.delay_days ?? 'N/A'}`);
      console.log(`Status: ${attrs.status || 'N/A'}`);
    });
  }
}

main().catch(console.error);
