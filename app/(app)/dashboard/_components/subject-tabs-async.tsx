import { SubjectTabs } from "@/app/(app)/dashboard/_components/subject-tabs";
import { getTopicStats } from "@/app/(app)/dashboard/_lib/queries";

/**
 * Fetches the per-law aggregates and renders the subject tabs.
 *
 * Same `*Async` shape as the rest of the page: one query, one presentational
 * component, behind its own Suspense boundary. The query is the heaviest on the
 * dashboard — it reads every sitting and resolves each paper's laws — so it
 * streams last rather than holding the three cards above it.
 */
export async function SubjectTabsAsync() {
  const topics = await getTopicStats();
  return <SubjectTabs topics={topics} />;
}
