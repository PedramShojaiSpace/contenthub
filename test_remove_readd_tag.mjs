/**
 * Test: remove tag then re-add to force sequence trigger for existing contacts
 * Uses kdweldon@gmail.com as a real test case (kajabi_tagged=0 in our DB)
 */
import { config } from 'dotenv';
config();

const tokenRes = await fetch('https://api.kajabi.com/v1/oauth/token', {
  method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: process.env.KAJABI_CLIENT_ID,
    client_secret: process.env.KAJABI_CLIENT_SECRET,
  })
});
const { access_token } = await tokenRes.json();
console.log('Token:', access_token ? 'OK' : 'FAILED');

const SITE_ID = '2148432935';
const TAG_NAME = 'Interconnected Opt In';

// Step 1: Find the tag ID
const tagsRes = await fetch(`https://api.kajabi.com/v1/contact_tags?filter[name_cont]=${encodeURIComponent(TAG_NAME)}&filter[site_id]=${SITE_ID}&page[size]=25`, {
  headers: { 'Authorization': `Bearer ${access_token}` }
});
const tagsData = await tagsRes.json();
const tag = tagsData?.data?.find(t => t.attributes?.name === TAG_NAME);
console.log('Tag found:', tag?.id, tag?.attributes?.name);
if (!tag) { console.log('TAG NOT FOUND - aborting'); process.exit(1); }
const TAG_ID = tag.id;

// Step 2: Find the contact for kdweldon@gmail.com
const TEST_EMAIL = 'kdweldon@gmail.com';
const contactsRes = await fetch(`https://api.kajabi.com/v1/contacts?filter[email_eq]=${encodeURIComponent(TEST_EMAIL)}&filter[site_id]=${SITE_ID}`, {
  headers: { 'Authorization': `Bearer ${access_token}` }
});
const contactsData = await contactsRes.json();
// Filter to exact email match
const contact = contactsData?.data?.find(c => c.attributes?.email?.toLowerCase() === TEST_EMAIL.toLowerCase());
console.log('Contact found:', contact?.id, contact?.attributes?.email);
if (!contact) { 
  console.log('Contact not found in Kajabi - they may not exist yet, will create');
  // Create the contact
  const createRes = await fetch(`https://api.kajabi.com/v1/contacts`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${access_token}`, 'Content-Type': 'application/vnd.api+json', 'Accept': 'application/vnd.api+json' },
    body: JSON.stringify({
      data: {
        type: 'contacts',
        attributes: { email: TEST_EMAIL, name: 'K Weldon' },
        relationships: { site: { data: { id: SITE_ID, type: 'sites' } } }
      }
    })
  });
  const createData = await createRes.json();
  console.log('Create status:', createRes.status, createData?.data?.id);
  process.exit(0);
}
const CONTACT_ID = contact.id;

// Step 3: Check if they already have the tag
const contactTagsRes = await fetch(`https://api.kajabi.com/v1/contacts/${CONTACT_ID}/relationships/tags`, {
  headers: { 'Authorization': `Bearer ${access_token}` }
});
const contactTagsData = await contactTagsRes.json();
const hasTag = contactTagsData?.data?.some(t => t.id === TAG_ID);
console.log('Has Interconnected Opt In tag:', hasTag, '| All tag IDs:', contactTagsData?.data?.map(t => t.id).join(', '));

if (hasTag) {
  // Step 4a: Remove the tag
  console.log('\nRemoving tag...');
  const removeRes = await fetch(`https://api.kajabi.com/v1/contacts/${CONTACT_ID}/relationships/tags`, {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${access_token}`, 'Content-Type': 'application/vnd.api+json', 'Accept': 'application/vnd.api+json' },
    body: JSON.stringify({ data: [{ id: TAG_ID, type: 'contact_tags' }] })
  });
  console.log('Remove tag status:', removeRes.status);
  if (!removeRes.ok) {
    const txt = await removeRes.text();
    console.log('Remove error:', txt);
    process.exit(1);
  }
  
  // Wait 2 seconds
  await new Promise(r => setTimeout(r, 2000));
}

// Step 4b: Re-add the tag (or add for first time)
console.log('\nAdding tag...');
const addRes = await fetch(`https://api.kajabi.com/v1/contacts/${CONTACT_ID}/relationships/tags`, {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${access_token}`, 'Content-Type': 'application/vnd.api+json', 'Accept': 'application/vnd.api+json' },
  body: JSON.stringify({ data: [{ id: TAG_ID, type: 'contact_tags' }] })
});
console.log('Add tag status:', addRes.status);
if (!addRes.ok) {
  const txt = await addRes.text();
  console.log('Add error:', txt);
} else {
  console.log('✅ Tag re-applied successfully! Kajabi should now fire the sequence trigger.');
  console.log('Check the sequence subscriber count and Day 0 sends in Kajabi admin to verify.');
}
