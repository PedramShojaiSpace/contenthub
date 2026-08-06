import { createConnection } from 'mysql2/promise';
import { readFileSync } from 'fs';

// Load env
const envFile = readFileSync('/home/ubuntu/lights-on-optin/.env', 'utf8');
const env = {};
for (const line of envFile.split('\n')) {
  const [k, ...v] = line.split('=');
  if (k && v.length) env[k.trim()] = v.join('=').trim().replace(/^["']|["']$/g, '');
}

const db = await createConnection(env.DATABASE_URL);

// Get all leads in last 6 hours
const [leads] = await db.execute(`
  SELECT 
    id, name, email, phone,
    kajabi_tagged as kajabiTagged,
    kajabi_tag_error as kajabiTagError,
    page_variant as pageVariant,
    created_at as createdAt
  FROM interconnected_leads
  WHERE created_at >= NOW() - INTERVAL 6 HOUR
  ORDER BY created_at DESC
`);

console.log(`\n=== LEADS IN LAST 6 HOURS: ${leads.length} total ===\n`);

const tagged = leads.filter(l => l.kajabiTagged);
const untagged = leads.filter(l => !l.kajabiTagged);

console.log(`✅ Successfully tagged in Kajabi: ${tagged.length}`);
console.log(`❌ NOT tagged in Kajabi: ${untagged.length}`);

if (untagged.length > 0) {
  console.log('\n=== UNTAGGED LEADS (need to push to Kajabi) ===');
  for (const lead of untagged) {
    const age = Math.round((Date.now() - new Date(lead.createdAt).getTime()) / 60000);
    console.log(`  ${age}m ago — ${lead.name} <${lead.email}> variant=${lead.pageVariant || 'unknown'}`);
    if (lead.kajabiTagError) console.log(`    Error: ${lead.kajabiTagError}`);
  }
}

if (tagged.length > 0) {
  console.log('\n=== TAGGED LEADS (confirmed in Kajabi) ===');
  for (const lead of tagged) {
    const age = Math.round((Date.now() - new Date(lead.createdAt).getTime()) / 60000);
    console.log(`  ${age}m ago — ${lead.name} <${lead.email}> variant=${lead.pageVariant || 'unknown'}`);
  }
}

await db.end();
