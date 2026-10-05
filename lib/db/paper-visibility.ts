/**
 * Who may open which generated paper.
 *
 * WHY THIS EXISTS AS ITS OWN FILE. mahoti_questions and diuni_questions hold
 * three kinds of row in one table — published papers, drafts awaiting
 * publication, and the custom exams candidates build for themselves — and
 * `lib/db/mahoti.ts` and `lib/db/diuni.ts` are deliberate mirrors of each
 * other. A rule written twice is a rule that will eventually be two rules;
 * the two publication migrations already drifted on an index direction. One
 * predicate, imported by both, cannot.
 *
 * THESE READS RUN ON THE SERVICE ROLE. Both tables are admin-only under RLS
 * (there is no candidate-facing policy yet — see the note at the top of each
 * DAL), so the queries use `createAdminClient()` and RLS is not enforcing
 * anything here. That makes the filter below THE authorization, in the same
 * way `built_for = userId` is the authorization in `listMyCustomMahotiSets`.
 * It is not defence in depth; it is the only defence, which is why it is
 * expressed once and why the viewer id is a required argument rather than an
 * optional one.
 *
 * THE RULE. A candidate may open a paper when either:
 *   - it is published to everyone — `exam_status = 'prod'` AND `built_for IS
 *     NULL`; or
 *   - it is their own custom exam — `built_for = <viewer>`.
 *
 * A draft belonging to nobody, and another candidate's custom exam, satisfy
 * neither and come back as "not found".
 */

/**
 * Loose on purpose: this guards a value that is INTERPOLATED INTO A POSTGREST
 * FILTER STRING, so what matters is that it cannot contain a comma, a bracket
 * or a dot and break out of the `or(...)` expression. Hex and dashes cannot.
 * Checking UUID version and variant bits as well would risk rejecting a real
 * id for no security gain.
 */
const UUID_SHAPED = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * The PostgREST `or(...)` expression for "this viewer may see this row".
 *
 * Applied ALONGSIDE `.eq("question_id", id)`, so the two AND together: the
 * named row is returned only if it also passes this. A row the viewer may not
 * see is not filtered out after the fact — the database never returns it, so
 * it cannot be logged, cached or leaked by a later change to the mapping code.
 *
 * @throws if `viewerId` is not UUID-shaped. A caller that cannot supply a real
 * viewer must not be silently downgraded to "published only": that would turn
 * a missing argument into a quiet behaviour change, which is the failure this
 * whole file is fixing.
 */
export function visibleToViewerFilter(viewerId: string): string {
  if (!UUID_SHAPED.test(viewerId)) {
    throw new Error(
      "visibleToViewerFilter: viewerId must be a UUID — pass the authenticated user's id"
    );
  }
  return `and(exam_status.eq.prod,built_for.is.null),built_for.eq.${viewerId}`;
}

/**
 * The ordering that decides which paper is "the default one".
 *
 * Shared because the questions screen and the review screen MUST agree: if
 * one answers with מבחן מספר 1 and the other with whichever row was generated
 * most recently, a candidate reading the review of the paper they just sat is
 * shown the review of a different paper, with no indication that anything is
 * wrong. That is exactly what was happening — `getMahotiSet` moved to
 * `exam_number ASC` when publication landed (20261004000001) and the review
 * readers were left on `created_at DESC`.
 */
export const DEFAULT_PAPER_ORDER = {
  column: "exam_number",
  ascending: true,
} as const;
