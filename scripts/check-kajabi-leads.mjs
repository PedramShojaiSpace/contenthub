import 'dotenv/config';

const clientId = process.env.KAJABI_CLIENT_ID;
const clientSecret = process.env.KAJABI_CLIENT_SECRET;
const KAJABI_API_BASE = 'https://api.kajabi.com/v1';

// Get OAuth token
const tokenRes = await fetch(`${KAJABI_API_BASE}/oauth/token`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: clientId,
    client_secret: clientSecret,
  }),
});
const tokenData = await tokenRes.json();
const token = tokenData.access_token;

if (!token) {
  console.error('❌ Failed to get token:', tokenData);
  process.exit(1);
}
console.log('✅ Kajabi token obtained\n');

// Get all tags
const tagsRes = await fetch(`${KAJABI_API_BASE}/contact_tags?page[size]=100`, {
  headers: {
    'Authorization': `Bearer ${token}`,
    'Accept': 'application/vnd.api+json',
  },
});
const tagsData = await tagsRes.json();

if (!tagsData.data) {
  console.log('Tags response:', JSON.stringify(tagsData).substring(0, 300));
  process.exit(1);
}

// Show all tags with contact counts
console.log('📋 All Kajabi Tags:');
tagsData.data.forEach(t => {
  const count = t.attributes.contacts_count ?? 0;
  const name = t.attributes.name;
  const marker = name.toLowerCase().includes('interconnected') ? ' ← INTERCONNECTED' : '';
  console.log(`  [${count} contacts] ${name}${marker}`);
});

// Find the Interconnected Opt In tag
const interconnectedTag = tagsData.data.find(t => 
  t.attributes.name.toLowerCase().includes('interconnected')
);

if (interconnectedTag) {
  console.log(`\n✅ Interconnected tag: "${interconnectedTag.attributes.name}" (ID: ${interconnectedTag.id})`);
  console.log(`   Contact count: ${interconnectedTag.attributes.contacts_count ?? 'unknown'}`);
  
  // Get recent contacts with this tag
  const contactsRes = await fetch(
    `${KAJABI_API_BASE}/contacts?filter[site_id]=2148432935&filter[tag_id]=${interconnectedTag.id}&page[size]=20`,
    {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.api+json',
      },
    }
  );
  const contactsData = await contactsRes.json();
  
  if (contactsData.data?.length > 0) {
    console.log(`\n📊 Last ${contactsData.data.length} contacts with Interconnected tag:`);
    contactsData.data.slice(0, 15).forEach(c => {
      const email = c.attributes.email;
      const name = `${c.attributes.first_name ?? ''} ${c.attributes.last_name ?? ''}`.trim();
      const created = c.attributes.created_at ? new Date(c.attributes.created_at).toLocaleString() : 'unknown';
      console.log(`  ${created} | ${email} | ${name}`);
    });
    if (contactsData.meta?.total_count) {
      console.log(`\n  Total in Kajabi: ${contactsData.meta.total_count}`);
    }
  } else {
    console.log('\n⚠️ No contacts found with this tag yet');
    console.log('Contacts response:', JSON.stringify(contactsData).substring(0, 300));
  }
} else {
  console.log('\n⚠️ No Interconnected tag found in Kajabi yet');
}
