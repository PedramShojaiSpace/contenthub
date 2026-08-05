import { createRequire } from 'module';
const require = createRequire(import.meta.url);
require('dotenv').config();
import mysql from 'mysql2/promise';

const start = 1785733200000; // Aug 3 00:00 CT
const end   = 1785819599000; // Aug 3 23:59 CT

const conn = await mysql.createConnection(process.env.DATABASE_URL);

// kajabi_purchases
const [kp] = await conn.execute(
  `SELECT COUNT(*) as count, SUM(amount) as revenue, 
   GROUP_CONCAT(DISTINCT offer_name ORDER BY offer_name SEPARATOR ' | ') as offers
   FROM kajabi_purchases WHERE created_at >= ? AND created_at <= ?`,
  [start, end]
);
console.log('kajabi_purchases Aug 3:', kp[0].count, 'orders | $' + (parseFloat(kp[0].revenue)||0).toFixed(2) + ' revenue');
console.log('  Offers:', kp[0].offers || 'none');

// All kajabi_purchases to understand data range
const [all] = await conn.execute(
  `SELECT COUNT(*) as count, SUM(amount) as revenue, 
   MIN(created_at) as first, MAX(created_at) as last 
   FROM kajabi_purchases`
);
console.log('\nAll kajabi_purchases ever:', all[0].count, 'total | $' + (parseFloat(all[0].revenue)||0).toFixed(2));
if (all[0].first) {
  console.log('  Date range:', new Date(Number(all[0].first)).toISOString().substring(0,10), 'to', new Date(Number(all[0].last)).toISOString().substring(0,10));
}

// attributed_sales
const [as2] = await conn.execute(
  `SELECT COUNT(*) as count, SUM(amount) as revenue FROM attributed_sales WHERE created_at >= ? AND created_at <= ?`,
  [start, end]
);
console.log('\nattributed_sales Aug 3:', as2[0].count, 'orders | $' + (parseFloat(as2[0].revenue)||0).toFixed(2));

// funnel_events for purchases
const [fe] = await conn.execute(
  `SELECT event_type, COUNT(*) as count, SUM(value) as revenue 
   FROM funnel_events WHERE created_at >= ? AND created_at <= ? 
   GROUP BY event_type ORDER BY count DESC LIMIT 10`,
  [start, end]
);
console.log('\nfunnel_events Aug 3:');
fe.forEach(r => console.log('  ' + r.event_type + ': ' + r.count + ' | $' + (parseFloat(r.revenue)||0).toFixed(2)));

await conn.end();
