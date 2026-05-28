-- Slice 10 — QA Feedback System (additive)
ALTER TABLE public.profiles
  ADD COLUMN is_qa_tester BOOLEAN NOT NULL DEFAULT FALSE;
CREATE INDEX idx_profiles_is_qa_tester ON public.profiles(is_qa_tester) WHERE is_qa_tester = TRUE;

CREATE TABLE public.qa_reports (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  report_type     TEXT        NOT NULL CONSTRAINT qa_reports_report_type_check CHECK (report_type IN ('bug','content','design')),
  page_path       TEXT        NOT NULL,
  question_id     UUID        NULL,
  question_type   TEXT        NULL CONSTRAINT qa_reports_question_type_check CHECK (question_type IS NULL OR question_type IN ('source','angle')),
  problem_text    TEXT        NOT NULL,
  expected_text   TEXT        NOT NULL,
  screenshot_path TEXT        NULL,
  user_agent      TEXT        NULL,
  viewport        TEXT        NULL,
  status          TEXT        NOT NULL DEFAULT 'open' CONSTRAINT qa_reports_status_check CHECK (status IN ('open','in_progress','resolved')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT qa_reports_question_identity_paired_check CHECK ((question_id IS NULL) = (question_type IS NULL))
);
CREATE INDEX idx_qa_reports_status_created_at ON public.qa_reports(status, created_at DESC);
CREATE INDEX idx_qa_reports_user_id ON public.qa_reports(user_id);
CREATE INDEX idx_qa_reports_question ON public.qa_reports(question_type, question_id) WHERE question_id IS NOT NULL;

ALTER TABLE public.qa_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "qa_reports_testers_insert_own" ON public.qa_reports FOR INSERT TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()) AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = (SELECT auth.uid()) AND p.is_qa_tester = TRUE));
CREATE POLICY "qa_reports_testers_view_own" ON public.qa_reports FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()));
CREATE POLICY "qa_reports_admins_view_all" ON public.qa_reports FOR SELECT TO authenticated USING (public.is_admin());
CREATE POLICY "qa_reports_admins_update_all" ON public.qa_reports FOR UPDATE TO authenticated USING (public.is_admin());

-- private screenshots bucket + policies
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('qa-screenshots','qa-screenshots',FALSE,5242880,ARRAY['image/png','image/jpeg','image/webp']) ON CONFLICT (id) DO NOTHING;
CREATE POLICY "qa_screenshots_testers_insert_own" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id='qa-screenshots' AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
    AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = (SELECT auth.uid()) AND p.is_qa_tester = TRUE));
CREATE POLICY "qa_screenshots_testers_select_own" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id='qa-screenshots' AND (storage.foldername(name))[1] = (SELECT auth.uid())::text);
CREATE POLICY "qa_screenshots_admins_select_all" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id='qa-screenshots' AND public.is_admin());

-- Slice 10.1 — explicit grants. A table created outside the normal
-- tooling pipeline didn't auto-grant the authenticated role, which
-- caused "permission denied for table qa_reports" at runtime. The
-- live DB already received this grant via execute_sql; this line is
-- here so fresh environments (CI, local resets) reproduce the
-- correct privileges. RLS continues to do the row-level filtering on
-- top of these table-level grants.
GRANT SELECT, INSERT, UPDATE ON public.qa_reports TO authenticated;
