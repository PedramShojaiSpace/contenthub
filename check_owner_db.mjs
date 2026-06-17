import { createConnection } from 'mysql2/promise';

const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) { console.log('No DATABASE_URL'); process.exit(1); }

const conn = await createConnection(dbUrl);

// Check columns in users table
const [cols] = await conn.execute("SHOW COLUMNS FROM users");
console.log('Users table columns:', cols.map(c => c.Field));

// Check all users
const [rows] = await conn.execute("SELECT * FROM users LIMIT 10");
console.log('Users:', JSON.stringify(rows, null, 2));

await conn.end();
