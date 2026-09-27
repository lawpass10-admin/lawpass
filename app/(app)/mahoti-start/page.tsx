import {
  ExamStartPage,
  INSTRUCTION_ANSWER_ALL,
  INSTRUCTION_ANSWER_SHEET,
  INSTRUCTION_CHEATING,
  INSTRUCTION_INVIGILATORS,
  INSTRUCTIONS_PREAMBLE,
} from "@/app/(app)/_components/exam-start/exam-start-page";
import { requireActiveSubscription } from "@/lib/auth/subscription-gate";
import { listMahotiSets, listMyCustomMahotiSets } from "@/lib/db/mahoti";

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
  const [sets, customSets] = await Promise.all([
    listMahotiSets(),
    listMyCustomMahotiSets(user.id),
  ]);

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
      sets={sets}
      customSets={customSets}
      examRoute="/mahoti"
      listLabel="מבחני דין מהותי"
      emptyLabel="אין עדיין מבחני דין מהותי זמינים."
    />
  );
}
