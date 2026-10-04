import { requireActiveSubscription } from "@/lib/auth/subscription-gate";

import { MaterialIndex } from "../../study-material/_components/material-index";

/**
 * /mahoti/study-material — חומר ללימוד for דין מהותי.
 *
 * Sits under /mahoti/ rather than beside /study-material so the sidebar lights
 * the right row: the דין מהותי entry already declares `activeFor: ["/mahoti"]`
 * and the check is a `startsWith`, so this route lights it for free. A query
 * parameter on /study-material would not — `usePathname()` drops the query.
 */
export default async function MahotiStudyMaterialPage() {
  await requireActiveSubscription();
  return <MaterialIndex part="mahoti" />;
}
