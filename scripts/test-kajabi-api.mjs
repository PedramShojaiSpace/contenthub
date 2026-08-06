import 'dotenv/config';

const clientId = process.env.KAJABI_CLIENT_ID;
const clientSecret = process.env.KAJABI_CLIENT_SECRET;

console.log('KAJABI_CLIENT_ID present:', !!clientId);
console.log('KAJABI_CLIENT_SECRET present:', !!clientSecret);

// Check if we have a stored access token in the DB
// First let's see what Kajabi env vars are available
const keys = Object.keys(process.env).filter(k => k.toLowerCase().includes('kajabi'));
console.log('Kajabi-related env vars:', keys);

// Try the Kajabi REST API - check if there's a stored token
// Kajabi uses OAuth2 - let's check what's in the DB
import { createConnection } from 'mysql2/promise';

const conn = await createConnection(process.env.DATABASE_URL);

// Check for stored Kajabi tokens
const [rows] = await conn.execute(
  "SELECT * FROM oauth_tokens WHERE provider LIKE '%kajabi%' LIMIT 5"
).catch(() => [[]]);

console.log('\nStored Kajabi OAuth tokens:', rows.length > 0 ? rows : 'none found');

// Also check for any token storage table
const [tables] = await conn.execute("SHOW TABLES LIKE '%token%'");
console.log('Token tables:', tables);

const [tables2] = await conn.execute("SHOW TABLES LIKE '%oauth%'");
console.log('OAuth tables:', tables2);

const [tables3] = await conn.execute("SHOW TABLES LIKE '%kajabi%'");
console.log('Kajabi tables:', tables3);

await conn.end();
