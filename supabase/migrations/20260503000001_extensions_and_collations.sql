-- Migration 0001: Extensions and Collations
-- Enables required PostgreSQL extensions and creates ICU collation for Hebrew text.

-- Extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";      -- gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS "pg_trgm";       -- trigram similarity search
CREATE EXTENSION IF NOT EXISTS "btree_gist";    -- exclusion constraints support

-- ICU Collation for Hebrew text fields (Hardening Rule #5 equivalent — SPEC 8.8)
-- Using deterministic = true because deterministic = false breaks:
--   1. UNIQUE constraints on COLLATE'd columns (subtopics.title, source_choices.letter, etc.)
--   2. pg_trgm GIN indexes
-- deterministic = true still provides correct Hebrew alphabetical sorting via ICU.
CREATE COLLATION IF NOT EXISTS hebrew (
  provider = icu,
  locale = 'he-IL',
  deterministic = true
);
