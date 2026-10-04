import { requireActiveSubscription } from "@/lib/auth/subscription-gate";

import { MaterialIndex } from "../../study-material/_components/material-index";

/**
 * /diuni/study-material — חומר ללימוד for דין דיוני.
 *
 * The twin of /mahoti/study-material; see that file for why it lives under
 * /diuni/ rather than taking a query parameter on /study-material.
 */
export default async function DiuniStudyMaterialPage() {
  await requireActiveSubscription();
  return <MaterialIndex part="diuni" />;
}
