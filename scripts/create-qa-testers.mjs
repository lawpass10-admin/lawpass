// scripts/create-qa-testers.mjs — one-off Slice 10 helper.
//
// Creates two email+password test users via the Supabase service-role
// Auth Admin API (email_confirm: true so no Resend delivery is needed),
// then inserts a matching profiles row with is_qa_tester=true.
//
// IMPORTANT: there is no create_profile RPC in this codebase. We use a
// direct INSERT via the service-role client, which bypasses RLS — the
// only path that works for cross-user profile bootstrap.
//
// Usage:
//   node scripts/create-qa-testers.mjs
//
// Idempotent: if the email already exists in auth.users, skips creation
// and falls through to the profile + is_qa_tester upsert.

import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";
import pg from "pg";

dotenv.config({ path: ".env.local" });
dotenv.config();

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY;
const DIRECT_URL = process.env.DIRECT_URL;
const POOLED_URL = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL;

if (!SUPABASE_URL || !SUPABASE_SECRET_KEY) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL and/or SUPABASE_SECRET_KEY in .env.local. Aborting."
  );
  process.exit(1);
}
if (!DIRECT_URL && !POOLED_URL) {
  console.error(
    "Missing DATABASE_URL / DIRECT_URL in .env.local (needed for auth.users lookup by email). Aborting."
  );
  process.exit(1);
}

const admin = createClient(SUPABASE_URL, SUPABASE_SECRET_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// Direct pg connection — Supabase's PostgREST doesn't expose the auth
// schema for SELECT, and auth.admin.listUsers errors with "Database
// error finding users" in some project states (observed live). pg
// against auth.users is the reliable lookup-by-email path.
//
// Connection strategy mirrors scripts/apply-sql.mjs: prefer DIRECT_URL
// (port 5432); fall back to DATABASE_URL (Supavisor pooler) on DNS
// resolution failure — the public DNS for db.<ref>.supabase.co is
// often deactivated on managed projects.
async function connectPg() {
  const tried = [];
  for (const url of [DIRECT_URL, POOLED_URL].filter(Boolean)) {
    const client = new pg.Client({
      connectionString: url,
      ssl: { rejectUnauthorized: false },
    });
    try {
      await client.connect();
      return client;
    } catch (err) {
      tried.push(`${url.split("@")[1]?.split("/")[0] ?? url}: ${err.code ?? err.message}`);
    }
  }
  throw new Error(`Could not connect to Postgres. Tried: ${tried.join(" | ")}`);
}
const pgClient = await connectPg();

const TESTERS = [
  {
    email: "qa1@lawpass.com",
    password: "BarPrep-QA1!",
    full_name: "בודק QA 1",
  },
  {
    email: "qa2@lawpass.com",
    password: "BarPrep-QA2!",
    full_name: "בודק QA 2",
  },
];

const PROFILE_DEFAULTS = {
  gender: "prefer_not_to_say",
  birth_date: "1990-01-01",
  signup_source: "email",
};

// Look up an auth.users row by email via direct pg. PostgREST hides
// the auth schema; auth.admin.listUsers errors on this project state.
async function findUserIdByEmail(email) {
  const { rows } = await pgClient.query(
    "SELECT id FROM auth.users WHERE LOWER(email) = LOWER($1) LIMIT 1",
    [email]
  );
  return rows[0]?.id ?? null;
}

async function ensureTester(spec) {
  const { email, password, full_name } = spec;
  let userId = await findUserIdByEmail(email);

  if (userId) {
    console.log(`[skip-create] ${email} already exists → ${userId}`);
  } else {
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name },
    });
    if (createErr || !created?.user) {
      throw new Error(`createUser ${email}: ${createErr?.message ?? "no user"}`);
    }
    userId = created.user.id;
    console.log(`[created] ${email} → ${userId}`);
  }

  // Profile row — upsert by id. Required NOT NULL columns are:
  // id, full_name, gender, birth_date, signup_source, terms_accepted_at.
  // We also set is_qa_tester=true here so the tester flag is in place
  // even if the row already exists from a prior run.
  const { error: profileErr } = await admin.from("profiles").upsert(
    {
      id: userId,
      full_name,
      gender: PROFILE_DEFAULTS.gender,
      birth_date: PROFILE_DEFAULTS.birth_date,
      signup_source: PROFILE_DEFAULTS.signup_source,
      terms_accepted_at: new Date().toISOString(),
      is_qa_tester: true,
    },
    { onConflict: "id" }
  );
  if (profileErr) {
    throw new Error(`profiles upsert ${email}: ${profileErr.message}`);
  }

  console.log(`[ok] ${email} is a QA tester → ${userId}`);
  return { email, userId };
}

const results = [];
for (const spec of TESTERS) {
  try {
    const r = await ensureTester(spec);
    results.push(r);
  } catch (e) {
    console.error(`[fail] ${spec.email}: ${e instanceof Error ? e.message : e}`);
    results.push({ email: spec.email, error: e instanceof Error ? e.message : String(e) });
  }
}

await pgClient.end();

console.log("\n=== Summary ===");
for (const r of results) {
  if (r.userId) console.log(`${r.email}\t${r.userId}`);
  else console.log(`${r.email}\tERROR: ${r.error}`);
}
