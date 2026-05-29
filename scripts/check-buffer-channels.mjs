/**
 * Temporary debug script to check Buffer channel list and serviceType values.
 * Run with: node scripts/check-buffer-channels.mjs
 * (Must be run from within the server environment where BUFFER_ACCESS_TOKEN is set)
 */
import { config } from 'dotenv';
config({ path: '.env' });

const token = process.env.BUFFER_ACCESS_TOKEN;
if (!token) {
  console.error('BUFFER_ACCESS_TOKEN not set');
  process.exit(1);
}

const query = `query { channels { id name service serviceType serverUrl } }`;

const response = await fetch('https://api.bufferapp.com/graphql', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ query }),
});

const data = await response.json();
if (data.errors) {
  console.error('GraphQL errors:', JSON.stringify(data.errors, null, 2));
  process.exit(1);
}

const channels = data.data?.channels || [];
console.log(`\nFound ${channels.length} channels:\n`);
channels.forEach(c => {
  console.log(`  ID: ${c.id}`);
  console.log(`  Name: ${c.name}`);
  console.log(`  Service: ${c.service}`);
  console.log(`  ServiceType: ${c.serviceType}`);
  console.log('');
});
