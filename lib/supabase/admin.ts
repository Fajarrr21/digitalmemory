import "server-only";
import { createClient as createRawClient } from "@supabase/supabase-js";
import { publicEnv } from "@/lib/env";
import { serverEnv } from "@/lib/env";
import type { Database } from "@/lib/supabase/database.types";

/**
 * Service-role client. BYPASSES Row-Level Security. Use ONLY in trusted server
 * code for privileged paths that cannot be expressed as the user (e.g. the
 * race-safe daily-letter assignment). Never import from a client component —
 * `server-only` makes that a build error.
 */
export function createAdminClient() {
  return createRawClient<Database>(
    publicEnv.supabaseUrl,
    serverEnv.serviceRoleKey,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
