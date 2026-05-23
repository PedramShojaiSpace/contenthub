/**
 * Marks drizzle migration files as applied in the __drizzle_migrations table
 * when the SQL has already been applied manually via direct SQL execution.
 * Run with: node scripts/mark-migrations-applied.mjs
 */
import 'dotenv/config';
import mysql from 'mysql2/promise';
import { readFileSync } from 'fs';
import { createHash } from 'crypto';

const conn = await mysql.createConnection(process.env.DATABASE_URL);

// Migrations to mark as applied (snapshot file → hash)
const migrations = [
  { file: 'drizzle/meta/0084_snapshot.json', createdAt: Date.now() - 3000 },
  { file: 'drizzle/meta/0085_snapshot.json', createdAt: Date.now() - 2000 },
];

for (const { file, createdAt } of migrations) {
  const content = readFileSync(file, 'utf-8');
  const hash = createHash('sha256').update(content).digest('hex');
  
  // Check if already applied
  const [existing] = await conn.execute(
    'SELECT id FROM __drizzle_migrations WHERE hash = ?',
    [hash]
  );
  
  if (existing.length > 0) {
    console.log(`✓ Already applied: ${file} (hash: ${hash.slice(0, 16)}...)`);
    continue;
  }
  
  await conn.execute(
    'INSERT INTO __drizzle_migrations (hash, created_at) VALUES (?, ?)',
    [hash, createdAt]
  );
  console.log(`✓ Marked as applied: ${file} (hash: ${hash.slice(0, 16)}...)`);
}

await conn.end();
console.log('Done.');
