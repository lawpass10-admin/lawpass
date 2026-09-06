import { SubjectStatsRow } from "@/app/(app)/dashboard/_components/subject-stats-row";
import { getSubjectStats } from "@/app/(app)/dashboard/_lib/queries";

/**
 * Fetches the three subject squares and renders them.
 *
 * Same shape as the other `*Async` components on this page: one query, one
 * presentational component, streamed behind its own Suspense boundary so the
 * page shell paints before the numbers arrive.
 *
 * The query goes to lawpass_server (GET /api/dashboard/subject-stats), which is
 * where the three answer tables are aggregated. There is no in-app fallback —
 * see the note on `getSubjectStats` — so if the API is unreachable this throws
 * and the route's error boundary handles it, rather than the page quietly
 * rendering three zeroed cards that look like a candidate who has done nothing.
 */
export async function SubjectStatsRowAsync() {
  const subjects = await getSubjectStats();
  return <SubjectStatsRow subjects={subjects} />;
}
