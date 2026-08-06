import 'dotenv/config';
import mysql from 'mysql2/promise';

const conn = await mysql.createConnection(process.env.DATABASE_URL);

try {
  // Check total registrations
  const [rows] = await conn.execute(
    'SELECT COUNT(*) as total, MAX(created_at) as latest FROM interconnected_screening'
  );
  console.log('📊 Interconnected Registrations:', rows[0]);

  // Get last 10 registrations
  const [recent] = await conn.execute(
    'SELECT email, name, kajabi_tagged, sms_subscribed, created_at FROM interconnected_screening ORDER BY created_at DESC LIMIT 10'
  );
  console.log('\n📋 Last 10 registrations:');
  recent.forEach(r => {
    const time = new Date(r.created_at).toLocaleString();
    console.log(`  ${time} | ${r.email} | Kajabi: ${r.kajabi_tagged} | SMS: ${r.sms_subscribed}`);
  });
} catch (err) {
  // Table might not exist or have different columns
  console.log('Table query error:', err.message);
  
  // Try to see what tables exist
  const [tables] = await conn.execute('SHOW TABLES LIKE "%interconnected%"');
  console.log('Tables matching interconnected:', tables);
}

await conn.end();
