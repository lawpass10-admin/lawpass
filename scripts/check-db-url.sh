#!/usr/bin/env bash
# Hardening Rule #1: DATABASE_URL must use Supavisor (pooler.supabase.com).
# Direct connections are forbidden in production/CI builds.

if [ -z "$DATABASE_URL" ]; then
  echo "⚠ DATABASE_URL is not set — skipping pooler check (OK for static builds)"
  exit 0
fi

if echo "$DATABASE_URL" | grep -q "pooler.supabase.com"; then
  echo "✓ DATABASE_URL uses Supavisor pooler"
  exit 0
else
  echo "✗ DATABASE_URL does NOT contain pooler.supabase.com"
  echo "  Direct connections are forbidden in production (Hardening Rule #1)."
  echo "  Use the Supavisor transaction-mode URL (port 6543)."
  exit 1
fi
