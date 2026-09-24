// legal_area.mjs — resolve a question's legal area at load time.
//
// WHY THE LOADERS SET IT. open_questions.legal_area decides which writing
// skeletons the study screen offers (lib/db/open-question-templates.ts). The
// page can derive it from the subject at read time, and does when the column is
// NULL — but deriving it on every page load only works while every subject has
// a row in open_question_subject_areas. A question loaded with a NEW subject
// would silently fall through to the general skeletons, and nothing would say
// why: the pane would simply offer תבנית כללית for a labour task.
//
// Setting it here turns that into a warning at load time, when the person
// running the loader can still act on it, and stamps the answer on the row so
// the read path is one column instead of a join.

/**
 * The area for a subject, or null when the mapping does not know it.
 *
 * `warnings` collects the unmapped ones rather than throwing: a question with
 * no area still loads and still gets the general skeletons, which is a usable
 * page. Refusing to load it would be the larger failure.
 */
export async function legalAreaFor(client, subject, warnings, label) {
  const clean = String(subject ?? "").trim();
  if (!clean) return null;

  const { rows } = await client.query(
    `SELECT legal_area FROM public.open_question_subject_areas WHERE subject = $1`,
    [clean]
  );
  if (rows.length > 0 && rows[0].legal_area) return rows[0].legal_area;

  warnings.push(
    `${label}: subject "${clean.slice(0, 48)}" has no legal area — the writing-task ` +
      `screen will offer only the general skeletons. Add a row:\n` +
      `      INSERT INTO public.open_question_subject_areas (subject, legal_area) ` +
      `VALUES ('${clean.replace(/'/g, "''")}', '<civil|labour|administrative|criminal|family|property|insolvency>');`
  );
  return null;
}
