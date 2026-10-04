import { requireActiveSubscription } from "@/lib/auth/subscription-gate";

import { MaterialIndex } from "./_components/material-index";

/**
 * /study-material — חומר ללימוד: what a candidate reads before practising.
 *
 * The sibling of /writing-task under מטלת כתיבה. That route drills; this one
 * teaches, and the two are deliberately separate pages rather than tabs — a
 * candidate revising at 23:00 is doing one or the other, not switching between
 * them mid-thought.
 *
 * Server Component. `requireActiveSubscription()` re-runs the gate here for the
 * same reason /practice and /writing-task do: the layout's Router Cache must
 * not be able to replay this route for an expired user.
 *
 * The list itself lives in _components/material-index.tsx, shared with
 * /mahoti/study-material and /diuni/study-material — the same screen over a
 * different text_field.
 */
export default async function StudyMaterialIndexPage() {
  await requireActiveSubscription();
  return <MaterialIndex part="open_questions" />;
}
