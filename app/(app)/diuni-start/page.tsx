import {
  ExamStartPage,
  INSTRUCTION_ANSWER_ALL,
  INSTRUCTION_ANSWER_SHEET,
  INSTRUCTION_CHEATING,
  INSTRUCTION_INVIGILATORS,
  INSTRUCTIONS_PREAMBLE,
} from "@/app/(app)/_components/exam-start/exam-start-page";
import { requireActiveSubscription } from "@/lib/auth/subscription-gate";
import { listDiuniSets, listMyCustomDiuniSets } from "@/lib/db/diuni";

/**
 * /diuni-start — the instructions for חלק ב' of the paper, then the choice of
 * which דין דיוני paper to sit. See ExamStartPage.
 *
 * WHY /diuni-start AND NOT /diuni/start. Every route under /diuni renders in
 * focus mode, without the sidebar (FOCUS_ROUTES in app-shell.tsx), because it is
 * a clocked sitting. This page comes before the sitting — the candidate is still
 * choosing — so it keeps the ordinary chrome, and a sibling path keeps it out of
 * that prefix without a special case in the shell.
 */
export default async function DiuniStartPage() {
  const { user } = await requireActiveSubscription();
  const [sets, customSets] = await Promise.all([
    listDiuniSets(),
    listMyCustomDiuniSets(user.id),
  ]);

  return (
    <ExamStartPage
      part="חלק ב' – דין דיוני"
      crumb="דין דיוני"
      preamble={INSTRUCTIONS_PREAMBLE}
      instructions={[
        "משך הבחינה: 100 דקות.",
        INSTRUCTION_ANSWER_ALL,
        INSTRUCTION_ANSWER_SHEET,
        INSTRUCTION_CHEATING,
        INSTRUCTION_INVIGILATORS,
        // The printed paper has a sixth instruction — the 14:10 finishing-time
        // rule about raising a hand for the invigilator. Left out on PM request:
        // it describes the physical exam hall, with no counterpart on this screen.
      ]}
      sets={sets}
      customSets={customSets}
      examRoute="/diuni"
      listLabel="מבחני דין דיוני"
      emptyLabel="אין עדיין מבחני דין דיוני זמינים."
    />
  );
}
