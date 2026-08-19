-- open_question_answers.hand_writing — where the student's handwritten pages live.
--
-- The bar exam is written by hand, so a student rehearsing it wants to answer on
-- paper and photograph the result. The photos themselves are NOT stored here:
-- they go to Cloudinary, and this column keeps the reference to them.
--
-- WHY jsonb AND NOT text. The request said "a reference link". An answer is up
-- to two pages, which is two photos and therefore two links, so a single text
-- column would have to encode a list — and the link alone turns out not to be
-- enough anyway. `public_id` is what Cloudinary needs to delete, replace or
-- transform an asset later; a URL cannot be turned back into one reliably.
-- jsonb also matches answer_body next door, which is jsonb for the same reason:
-- the submission's shape is still moving.
--
-- Stored shape — an array, page order significant:
--   [
--     { "page": 1,
--       "url": "https://res.cloudinary.com/<cloud>/image/upload/v1/lawpass/handwriting/…jpg",
--       "public_id": "lawpass/handwriting/<user>/<question>/<stamp>-p1",
--       "width": 3024, "height": 4032, "bytes": 2411004, "format": "jpg" },
--     { "page": 2, … }
--   ]
--
-- NULL = a typed answer, which is still the normal case. An empty array is not
-- expected but is not an error either — it reads the same as NULL.
--
-- No index: nothing queries by this. It is read with the row it belongs to.

ALTER TABLE public.open_question_answers
  ADD COLUMN IF NOT EXISTS hand_writing jsonb NULL;

-- Two pages is the answer limit the exam itself sets, and the upload endpoint
-- refuses a third. The constraint is here as well because the endpoint is not
-- the boundary — RLS and the schema are, and a client posting straight at the
-- REST API skips every check the endpoint makes.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'open_question_answers_hand_writing_check'
  ) THEN
    ALTER TABLE public.open_question_answers
      ADD CONSTRAINT open_question_answers_hand_writing_check
      CHECK (
        hand_writing IS NULL
        OR (
          jsonb_typeof(hand_writing) = 'array'
          AND jsonb_array_length(hand_writing) <= 2
        )
      );
  END IF;
END $$;

COMMENT ON COLUMN public.open_question_answers.hand_writing
  IS 'Handwritten answer pages on Cloudinary: [{page,url,public_id,width,height,bytes,format}], max 2. NULL for a typed answer.';
