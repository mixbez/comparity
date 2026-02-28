import 'dotenv/config';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import pg from 'pg';

const __dirname = dirname(fileURLToPath(import.meta.url));
const { Client } = pg;

async function migrate() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  const migrations = [
    '../../migrations/001_initial_schema.sql',
    '../../migrations/002_seed_data.sql',
  ];

  for (const file of migrations) {
    const sql = readFileSync(join(__dirname, file), 'utf8');
    console.log(`[Migrate] Running: ${file}`);
    await client.query(sql);
    console.log(`[Migrate] Done: ${file}`);
  }

  await client.end();
  console.log('[Migrate] All migrations complete');
}

migrate().catch((err) => {
  console.error('[Migrate] Error:', err.message);
  process.exit(1);
});
