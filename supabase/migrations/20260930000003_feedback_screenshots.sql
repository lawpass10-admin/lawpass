-- feedback-screenshots — the optional image a student can attach to the
-- "שלחו לנו משוב" box.
--
-- A SEPARATE BUCKET FROM qa-screenshots, not a loosening of that one. The QA
-- bucket's INSERT policy requires profiles.is_qa_tester, which is exactly the
-- restriction it should keep: testers' uploads are part of an internal process
-- with its own retention and its own admin screens. Widening it to every
-- student would put two different kinds of material behind one policy, and the
-- next change to either would have to reason about both.
--
-- PRIVATE, like the QA bucket. A screenshot of a bar-exam practice screen can
-- carry the student's own answers and their score; there is no version of this
-- that belongs on a public URL.
--
-- The path convention is `<user_id>/<uuid>.<ext>`, which is what the INSERT
-- policy checks: the first folder segment must be the caller's own id, so a
-- signed-in student cannot write into anybody else's folder even by asking the
-- storage API directly. app/(app)/_actions.ts builds exactly that path.
--
-- The 5 MB ceiling and the MIME allowlist are duplicated in the Zod schema in
-- that action. The database is the boundary; the schema is there so an
-- oversized file comes back as a Hebrew sentence rather than a storage error.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'feedback-screenshots',
  'feedback-screenshots',
  FALSE,
  5242880,
  ARRAY['image/png', 'image/jpeg', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- Any signed-in student may attach an image to their own feedback, into their
-- own folder. No is_qa_tester requirement and no subscription check: a lapsed
-- student is precisely the one with something to tell us (same reasoning as
-- user_feedback's own INSERT policy, migration 20260923000006).
DROP POLICY IF EXISTS "feedback_screenshots_students_insert_own" ON storage.objects;
CREATE POLICY "feedback_screenshots_students_insert_own"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'feedback-screenshots'
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
  );

-- Read back your own. Nothing in the app does this yet; it is here so a student
-- asking "what did I send you" can be answered without a policy change.
DROP POLICY IF EXISTS "feedback_screenshots_students_select_own" ON storage.objects;
CREATE POLICY "feedback_screenshots_students_select_own"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'feedback-screenshots'
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
  );

-- Admins read every attachment — the whole point of collecting them.
DROP POLICY IF EXISTS "feedback_screenshots_admins_select_all" ON storage.objects;
CREATE POLICY "feedback_screenshots_admins_select_all"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'feedback-screenshots' AND public.is_admin());
