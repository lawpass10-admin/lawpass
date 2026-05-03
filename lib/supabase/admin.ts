// WARNING: This client uses the service-role (secret) key and BYPASSES RLS.
// NEVER use in Client Components or user-triggered Server Actions.
// Only for: webhooks, cron jobs, admin operations with manual auth checks.
// See SPEC 9.4.3 for usage rules.

import { createClient } from "@supabase/supabase-js";

export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}
