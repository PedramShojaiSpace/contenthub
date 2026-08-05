/**
 * Test Kajabi contact import/upsert endpoint
 * Goal: find a way to get the contact ID for an existing contact by email
 * so we can apply a tag to them
 */
import { config } from 'dotenv';
config();

const tokenRes = await fetch('https://api.kajabi.com/v1/oauth/token', {
  method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams({ grant_type: 'client_credentials', client_id: process.env.KAJABI_CLIENT_ID, client_secret: process.env.KAJABI_CLIENT_SECRET })
});
const { access_token } = await tokenRes.json();
const SITE_ID = '2148432935';
const TAG_ID = '2150285702'; // Interconnected Opt In

// Test 1: Try PATCH to update existing contact - does Kajabi return the contact ID?
console.log('=== Test 1: PATCH existing contact (kdweldon@gmail.com) ===');
const patchRes = await fetch(`https://api.kajabi.com/v1/contacts`, {
  method: 'PATCH',
  headers: { 'Authorization': `Bearer ${access_token}`, 'Content-Type': 'application/vnd.api+json', 'Accept': 'application/vnd.api+json' },
  body: JSON.stringify({ data: { type: 'contacts', attributes: { email: 'kdweldon@gmail.com', name: 'K Weldon' }, relationships: { site: { data: { id: SITE_ID, type: 'sites' } } } } })
});
console.log('PATCH status:', patchRes.status);
const patchText = await patchRes.text();
console.log('PATCH response:', patchText.slice(0, 300));

// Test 2: Try PUT
console.log('\n=== Test 2: PUT existing contact ===');
const putRes = await fetch(`https://api.kajabi.com/v1/contacts`, {
  method: 'PUT',
  headers: { 'Authorization': `Bearer ${access_token}`, 'Content-Type': 'application/vnd.api+json', 'Accept': 'application/vnd.api+json' },
  body: JSON.stringify({ data: { type: 'contacts', attributes: { email: 'kdweldon@gmail.com', name: 'K Weldon' }, relationships: { site: { data: { id: SITE_ID, type: 'sites' } } } } })
});
console.log('PUT status:', putRes.status);
const putText = await putRes.text();
console.log('PUT response:', putText.slice(0, 300));

// Test 3: Try the import endpoint
console.log('\n=== Test 3: POST /contacts/import ===');
const importRes = await fetch(`https://api.kajabi.com/v1/contacts/import`, {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${access_token}`, 'Content-Type': 'application/vnd.api+json', 'Accept': 'application/vnd.api+json' },
  body: JSON.stringify({ data: { type: 'contacts', attributes: { email: 'kdweldon@gmail.com', name: 'K Weldon' }, relationships: { site: { data: { id: SITE_ID, type: 'sites' } } } } })
});
console.log('Import status:', importRes.status);
const importText = await importRes.text();
console.log('Import response:', importText.slice(0, 300));

// Test 4: Try POST with upsert flag
console.log('\n=== Test 4: POST with upsert=true ===');
const upsertRes = await fetch(`https://api.kajabi.com/v1/contacts?upsert=true`, {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${access_token}`, 'Content-Type': 'application/vnd.api+json', 'Accept': 'application/vnd.api+json' },
  body: JSON.stringify({ data: { type: 'contacts', attributes: { email: 'kdweldon@gmail.com', name: 'K Weldon' }, relationships: { site: { data: { id: SITE_ID, type: 'sites' } } } } })
});
console.log('Upsert status:', upsertRes.status);
const upsertText = await upsertRes.text();
console.log('Upsert response:', upsertText.slice(0, 300));

// Test 5: Try tag application directly with just the email (no contact ID)
console.log('\n=== Test 5: Tag by email directly ===');
const tagByEmailRes = await fetch(`https://api.kajabi.com/v1/contact_tags/${TAG_ID}/contacts`, {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${access_token}`, 'Content-Type': 'application/vnd.api+json', 'Accept': 'application/vnd.api+json' },
  body: JSON.stringify({ data: [{ type: 'contacts', attributes: { email: 'kdweldon@gmail.com' }, relationships: { site: { data: { id: SITE_ID, type: 'sites' } } } }] })
});
console.log('Tag by email status:', tagByEmailRes.status);
const tagByEmailText = await tagByEmailRes.text();
console.log('Tag by email response:', tagByEmailText.slice(0, 300));
