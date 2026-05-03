-- Migration 0013: Restrict materialized views to service_role only.
-- MViews are computed from RLS-bypassed aggregations; they should never be
-- exposed via the Data API. Admin dashboard reads them via service-role client.

REVOKE ALL ON public.mv_admin_dashboard_metrics FROM anon, authenticated, public;
REVOKE ALL ON public.mv_question_difficulty FROM anon, authenticated, public;
REVOKE ALL ON public.mv_user_chapter_stats FROM anon, authenticated, public;

GRANT SELECT ON public.mv_admin_dashboard_metrics TO service_role;
GRANT SELECT ON public.mv_question_difficulty TO service_role;
GRANT SELECT ON public.mv_user_chapter_stats TO service_role;
