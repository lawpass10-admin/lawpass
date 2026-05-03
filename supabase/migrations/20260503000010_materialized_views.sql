-- Migration 0010: Materialized Views (SPEC 8.8.1, Hardening Rule #5)
-- Pre-computed aggregations for dashboards. Refreshed hourly via Vercel Cron.

-- ============================================================
-- mv_user_chapter_stats
-- Per-user success stats by chapter (for user dashboard)
-- ============================================================
CREATE MATERIALIZED VIEW mv_user_chapter_stats AS
SELECT
  a.user_id,
  sq.chapter_id,
  COUNT(*) AS total_attempts,
  COUNT(*) FILTER (WHERE a.is_correct = TRUE) AS correct_attempts,
  ROUND(
    100.0 * COUNT(*) FILTER (WHERE a.is_correct = TRUE) / NULLIF(COUNT(*), 0), 1
  ) AS success_rate,
  MAX(a.attempted_at) AS last_attempted_at
FROM attempts a
JOIN source_questions sq ON sq.id = a.source_question_id
WHERE a.source_question_id IS NOT NULL
GROUP BY a.user_id, sq.chapter_id

UNION ALL

SELECT
  a.user_id,
  sq.chapter_id,
  COUNT(*) AS total_attempts,
  COUNT(*) FILTER (WHERE a.is_correct = TRUE) AS correct_attempts,
  ROUND(
    100.0 * COUNT(*) FILTER (WHERE a.is_correct = TRUE) / NULLIF(COUNT(*), 0), 1
  ) AS success_rate,
  MAX(a.attempted_at) AS last_attempted_at
FROM attempts a
JOIN angle_questions aq ON aq.id = a.angle_question_id
JOIN source_questions sq ON sq.id = aq.source_question_id
WHERE a.angle_question_id IS NOT NULL
GROUP BY a.user_id, sq.chapter_id
WITH NO DATA;

CREATE UNIQUE INDEX idx_mv_user_chapter_stats
  ON mv_user_chapter_stats (user_id, chapter_id);

-- ============================================================
-- mv_admin_dashboard_metrics
-- Global KPIs for admin dashboard (single row)
-- ============================================================
CREATE MATERIALIZED VIEW mv_admin_dashboard_metrics AS
SELECT
  COUNT(DISTINCT p.id) AS total_users,
  COUNT(DISTINCT p.id) FILTER (
    WHERE EXISTS (
      SELECT 1 FROM attempts att
      WHERE att.user_id = p.id AND att.attempted_at > NOW() - INTERVAL '30 days'
    )
  ) AS active_users_30d,
  (SELECT COUNT(*) FROM attempts) AS total_attempts,
  (SELECT COUNT(*) FROM attempts WHERE is_correct = TRUE) AS correct_attempts,
  (SELECT ROUND(AVG(duration_seconds)) FROM attempts WHERE duration_seconds IS NOT NULL) AS avg_time_per_question,
  NOW() AS computed_at
FROM profiles p
WITH NO DATA;

CREATE UNIQUE INDEX idx_mv_admin_dashboard_metrics
  ON mv_admin_dashboard_metrics (computed_at);

-- ============================================================
-- mv_question_difficulty
-- Difficulty rating per question (global success rate)
-- ============================================================
CREATE MATERIALIZED VIEW mv_question_difficulty AS
SELECT
  'source' AS question_type,
  source_question_id AS question_id,
  COUNT(*) AS total_attempts,
  COUNT(*) FILTER (WHERE is_correct = TRUE) AS correct_attempts,
  ROUND(
    100.0 * COUNT(*) FILTER (WHERE is_correct = TRUE) / NULLIF(COUNT(*), 0), 1
  ) AS success_rate
FROM attempts
WHERE source_question_id IS NOT NULL
GROUP BY source_question_id

UNION ALL

SELECT
  'angle' AS question_type,
  angle_question_id AS question_id,
  COUNT(*) AS total_attempts,
  COUNT(*) FILTER (WHERE is_correct = TRUE) AS correct_attempts,
  ROUND(
    100.0 * COUNT(*) FILTER (WHERE is_correct = TRUE) / NULLIF(COUNT(*), 0), 1
  ) AS success_rate
FROM attempts
WHERE angle_question_id IS NOT NULL
GROUP BY angle_question_id
WITH NO DATA;

CREATE UNIQUE INDEX idx_mv_question_difficulty
  ON mv_question_difficulty (question_type, question_id);
