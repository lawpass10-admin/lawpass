import pg from 'pg';
import { readFileSync } from 'node:fs';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config();

const url = process.env.DIRECT_URL || process.env.DATABASE_URL || process.env.SUPABASE_DB_URL;
if (!url) { console.error('DATABASE_URL not set'); process.exit(1); }

const file = process.argv[2];
const sql = readFileSync(file, 'utf8');

const client = new pg.Client({ connectionString: url });
await client.connect();
try {
  await client.query(sql);
  console.log('Applied:', file);
} finally {
  await client.end();
}
