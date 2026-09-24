-- Let a real דין דיוני question have no fact pattern.
--
-- WHY IT WAS NOT NULL. The three sittings loaded in 20260923000001 are all
-- scenario questions — a paragraph of facts, then "?מה הדין" — so requiring
-- facts cost nothing and caught a truncated extraction.
--
-- WHY THAT NO LONGER HOLDS. The earlier דיוני papers ask a different kind of
-- question as well: "?מה כלול בחלקו השני של כתב הגנה" and "בחרו את המשפט
-- הנכון ביותר לגבי סיכומי טענות:" have a stem and no facts, and never had any.
-- 19 of the 160 questions in the 2021–2022 papers are of that kind. Refusing
-- them would drop real exam questions over a field their own paper does not
-- have, and the alternative — copying the stem into fact_pattern to satisfy the
-- constraint — would render every one of them twice on screen.
--
-- The stem stays NOT NULL. A question with no stem is not a question, and that
-- is still the shape a failed extraction leaves behind. mahoti_real_questions
-- draws the line in the same place (20260923000004).
--
-- Not data-losing: dropping NOT NULL widens what the column accepts and leaves
-- every existing row untouched.

ALTER TABLE public.diuni_real_questions
  ALTER COLUMN fact_pattern DROP NOT NULL;

COMMENT ON COLUMN public.diuni_real_questions.fact_pattern IS
  'The scenario the question is built on. NULL for a knowledge question that has a stem and no facts — see 20260924000001.';
