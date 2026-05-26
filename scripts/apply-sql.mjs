// scripts/apply-sql.mjs — apply a .sql file to the project DB.
//
// Connection strategy: prefer DIRECT_URL (port 5432 to db.<ref>.supabase.co)
// because it's faster and avoids the Supavisor pgbouncer transaction-mode
// limits (no prepared statements, etc). If that host is DNS-unreachable
// (Supabase routinely deactivates the public DNS for db.<ref>.supabase.co
// on some projects), automatically fall back to DATABASE_URL (the
// Supavisor pooler — Hardening Rule #1 compliant).
//
// To force the pooler unconditionally for one invocation, run with
// `DIRECT_URL='' node scripts/apply-sql.mjs <file>`.
//
// Usage:
//   node scripts/apply-sql.mjs path/to/migration.sql

import pg from 'pg';
import { readFileSync } from 'node:fs';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config();

const directUrl = process.env.DIRECT_URL;
const pooledUrl = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL;

if (!directUrl && !pooledUrl) {
  console.error('Neither DIRECT_URL nor DATABASE_URL is set');
  process.exit(1);
}

const file = process.argv[2];
if (!file) {
  console.error('usage: node scripts/apply-sql.mjs <file.sql>');
  process.exit(2);
}
const sql = readFileSync(file, 'utf8');

/**
 * Try connecting via `url`. Returns the connected client on success, or
 * `null` if the host's DNS lookup fails (`ENOTFOUND` / `EAI_AGAIN`). Any
 * other error is rethrown — we don't want to silently swallow auth
 * failures, password mismatches, etc.
 */
async function tryConnect(url) {
  const client = new pg.Client({ connectionString: url });
  try {
    await client.connect();
    return client;
  } catch (err) {
    if (err && (err.code === 'ENOTFOUND' || err.code === 'EAI_AGAIN')) {
      await client.end().catch(() => {});
      return null;
    }
    throw err;
  }
}

let client = null;
let usedFallback = false;

if (directUrl) {
  client = await tryConnect(directUrl);
  if (!client) {
    console.log('DIRECT_URL host unreachable (DNS) — falling back to DATABASE_URL pooler');
    usedFallback = true;
  }
}

if (!client) {
  if (!pooledUrl) {
    console.error('DIRECT_URL unreachable and no DATABASE_URL fallback set');
    process.exit(1);
  }
  client = await tryConnect(pooledUrl);
  if (!client) {
    console.error('Both DIRECT_URL and DATABASE_URL are DNS-unreachable');
    process.exit(1);
  }
}

try {
  await client.query(sql);
  console.log(`Applied${usedFallback ? ' (via pooler)' : ''}:`, file);
} finally {
  await client.end();
}
