import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

import CompleteProfileForm from "./_components/complete-profile-form";

/**
 * /onboarding/complete-profile — Server Component for the Google OAuth
 * profile-completion form (SPEC §6.2 step 5).
 *
 * Resolves a default value for the editable full_name field from
 * auth.users.user_metadata so the user sees Google's name pre-filled
 * (and can edit before submit). Fallback chain — first non-empty wins:
 *   1. user_metadata.full_name
 *   2. user_metadata.name
 *   3. email local part (everything before "@")
 *   4. "" (form lets the user fill it themselves)
 */
export default async function CompleteProfilePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const metaFullName =
    typeof user.user_metadata?.full_name === "string"
      ? user.user_metadata.full_name
      : null;
  const metaName =
    typeof user.user_metadata?.name === "string"
      ? user.user_metadata.name
      : null;
  const defaultFullName: string =
    metaFullName ||
    metaName ||
    (user.email ?? "").split("@")[0] ||
    "";

  return <CompleteProfileForm defaultFullName={defaultFullName} />;
}
