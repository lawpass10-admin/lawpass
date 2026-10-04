import {
  ExamStartPage,
  INSTRUCTION_ANSWER_ALL,
  INSTRUCTION_ANSWER_SHEET,
  INSTRUCTION_CHEATING,
  INSTRUCTION_INVIGILATORS,
  INSTRUCTIONS_PREAMBLE,
} from "@/app/(app)/_components/exam-start/exam-start-page";
import { requireActiveSubscription } from "@/lib/auth/subscription-gate";
import {
  getMyMahotiSittings,
  listMahotiSets,
  listMyCustomMahotiSets,
  type MahotiSetSummary,
  type MahotiSittingSummary,
} from "@/lib/db/mahoti";

/**
 * /mahoti-start — the instructions for חלק ג' of the paper, then the choice of
 * which דין מהותי paper to sit. See ExamStartPage.
 *
 * A sibling of /mahoti rather than a child for the same reason as /diuni-start:
 * everything under /mahoti renders in focus mode, and this page comes before
 * the sitting.
 *
 * Five instructions, the same five as /diuni-start apart from the duration.
 */
export default async function MahotiStartPage() {
  const { user } = await requireActiveSubscription();
  const [sets, customSets, sittings] = await Promise.all([
    listMahotiSets(),
    listMyCustomMahotiSets(user.id),
    getMyMahotiSittings(),
  ]);

  /**
   * "הושלם · 85%" on a paper this candidate has already sat.
   *
   * Merged here rather than inside the two list reads because those go through
   * the service-role client (the content is admin-only under RLS) while the
   * sittings must not — they are per-candidate, and reading them with the
   * service role would show one person another's results. Two reads, one for
   * content and one for the candidate, joined in the page that has both.
   */
  const withProgress = (list: MahotiSetSummary[]) =>
    list.map((set) => {
      const sat: MahotiSittingSummary | undefined = sittings[set.questionId];
      return { ...set, sittings: sat?.sittings ?? 0, bestScore: sat?.bestScore ?? null };
    });

  return (
    <ExamStartPage
      part="חלק ג' – דין מהותי"
      crumb="דין מהותי"
      preamble={INSTRUCTIONS_PREAMBLE}
      instructions={[
        "משך הבחינה: 160 דקות (שעתיים ו-40 דק').",
        INSTRUCTION_ANSWER_ALL,
        INSTRUCTION_ANSWER_SHEET,
        INSTRUCTION_CHEATING,
        INSTRUCTION_INVIGILATORS,
      ]}
      sets={withProgress(sets)}
      customSets={withProgress(customSets)}
      examRoute="/mahoti"
      listLabel="מבחני דין מהותי"
      emptyLabel="אין עדיין מבחני דין מהותי זמינים."
    />
  );
}
