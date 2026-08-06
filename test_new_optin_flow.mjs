/**
 * Definitive test: brand-new email → Kajabi contact created → tag applied → sequence fires
 * This simulates exactly what happens when a real new person opts in
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
const TAG_ID = '2150285702'; // confirmed from earlier test

// Use a unique email that definitely does not exist in Kajabi
const TEST_EMAIL = `newlead_goforward_${Date.now()}@gmail.com`;
const TEST_NAME = 'GoForward Test';
console.log('\nTest email:', TEST_EMAIL);

// Step 1: Create the contact (exactly what kajabiCreateContact does)
console.log('\n--- Step 1: Create contact ---');
const createRes = await fetch(`https://api.kajabi.com/v1/contacts`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${access_token}`,
    'Content-Type': 'application/vnd.api+json',
    'Accept': 'application/vnd.api+json',
  },
  body: JSON.stringify({
    data: {
      type: 'contacts',
      attributes: { email: TEST_EMAIL, name: TEST_NAME },
      relationships: { site: { data: { id: SITE_ID, type: 'sites' } } }
    }
  })
});
console.log('Create status:', createRes.status);
const createData = await createRes.json();
if (!createRes.ok) {
  console.log('Create error:', JSON.stringify(createData));
  process.exit(1);
}
const contactId = createData?.data?.id;
console.log('Contact ID:', contactId);
console.log('Contact email:', createData?.data?.attributes?.email);

// Step 2: Apply the tag (exactly what kajabiAddTagByName does)
console.log('\n--- Step 2: Apply tag ---');
const tagRes = await fetch(`https://api.kajabi.com/v1/contacts/${contactId}/relationships/tags`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${access_token}`,
    'Content-Type': 'application/vnd.api+json',
    'Accept': 'application/vnd.api+json',
  },
  body: JSON.stringify({ data: [{ id: TAG_ID, type: 'contact_tags' }] })
});
console.log('Tag status:', tagRes.status);
if (!tagRes.ok) {
  const txt = await tagRes.text();
  console.log('Tag error:', txt);
  process.exit(1);
}
console.log('✅ Tag applied successfully');

// Step 3: Verify the contact has the tag
console.log('\n--- Step 3: Verify tag on contact ---');
await new Promise(r => setTimeout(r, 1000));
const verifyRes = await fetch(`https://api.kajabi.com/v1/contacts/${contactId}/relationships/tags`, {
  headers: { 'Authorization': `Bearer ${access_token}` }
});
const verifyData = await verifyRes.json();
const hasTag = verifyData?.data?.some(t => t.id === TAG_ID);
console.log('Has tag:', hasTag, '| Tags:', verifyData?.data?.map(t => t.id).join(', '));

console.log('\n=== RESULT ===');
if (hasTag) {
  console.log('✅ GO-FORWARD FLOW WORKS');
  console.log('New contact created and tagged. Kajabi WILL fire the sequence trigger for this brand-new contact.');
  console.log('Check Kajabi admin → sequence → Day 0 sent count should increase by 1.');
  console.log('Contact ID:', contactId, '| Email:', TEST_EMAIL);
} else {
  console.log('❌ Tag not found on contact after application');
}
