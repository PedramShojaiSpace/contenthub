/**
 * kajabi_tag_check.mjs
 * Tests Kajabi API connection, lists all tags, and identifies the correct tag name.
 * Run: node scripts/kajabi_tag_check.mjs
 */
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
require('dotenv').config();

const CLIENT_ID = process.env.KAJABI_CLIENT_ID;
const CLIENT_SECRET = process.env.KAJABI_CLIENT_SECRET;
const KAJABI_API_BASE = 'https://app.kajabi.com/api/v1';

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error('Missing KAJABI_CLIENT_ID or KAJABI_CLIENT_SECRET');
  process.exit(1);
}

async function getToken() {
  const res = await fetch('https://app.kajabi.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
    }),
  });
  if (!res.ok) throw new Error(`Token fetch failed: ${res.status} ${await res.text()}`);
  const data = await res.json();
  return data.access_token;
}

async function main() {
  console.log('Testing Kajabi API connection...');
  let token;
  try {
    token = await getToken();
    console.log(`✅ Token obtained: ${token.substring(0, 12)}...`);
  } catch (e) {
    console.error(`❌ Token failed: ${e.message}`);
    process.exit(1);
  }

  // Get all tags
  console.log('\nFetching all tags...');
  const tagsRes = await fetch(`${KAJABI_API_BASE}/contact_tags?page[size]=100`, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.api+json' },
  });
  if (!tagsRes.ok) {
    console.error(`❌ Tags fetch failed: ${tagsRes.status} ${await tagsRes.text()}`);
    process.exit(1);
  }
  const tagsData = await tagsRes.json();
  const tags = tagsData.data ?? [];
  console.log(`\nTotal tags in Kajabi: ${tags.length}`);
  console.log('\nAll tags (sorted by contact count):');
  const sorted = tags.sort((a, b) => 
    (b.attributes?.contacts_count ?? 0) - (a.attributes?.contacts_count ?? 0)
  );
  for (const t of sorted) {
    const name = t.attributes?.name ?? '';
    const count = t.attributes?.contacts_count ?? 0;
    const id = t.id;
    const marker = name.toLowerCase().includes('interconnect') ? ' ← INTERCONNECTED' : '';
    console.log(`  [${id}] "${name}" — ${count} contacts${marker}`);
  }

  // Search specifically for interconnected tags
  const icTags = tags.filter(t => 
    t.attributes?.name?.toLowerCase().includes('interconnect')
  );
  console.log(`\nInterconnected-related tags: ${icTags.length}`);
  for (const t of icTags) {
    console.log(`  ID: ${t.id} | Name: "${t.attributes?.name}" | Contacts: ${t.attributes?.contacts_count}`);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
