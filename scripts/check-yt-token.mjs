import 'dotenv/config';
import mysql from 'mysql2/promise';

const conn = await mysql.createConnection(process.env.DATABASE_URL);
const [tables] = await conn.query('SHOW TABLES');
console.log('Tables:', tables.map(t => Object.values(t)[0]).join(', '));

try {
  const [creds] = await conn.query('SELECT * FROM user_credentials LIMIT 1');
  if (creds.length) {
    const c = creds[0];
    const ytKeys = Object.keys(c).filter(k => k.toLowerCase().includes('youtube'));
    console.log('YT-related columns:', ytKeys);
    for (const k of ytKeys) {
      console.log(`  ${k}: ${c[k] ? c[k].toString().slice(0, 40) + '...' : 'NULL'}`);
    }
  } else {
    console.log('No rows in user_credentials');
  }
} catch (e) {
  console.log('user_credentials error:', e.message);
}

await conn.end();
