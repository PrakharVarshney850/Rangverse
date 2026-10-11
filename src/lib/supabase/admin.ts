import "server-only";

import { createClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/db/database.types";
import { getPublicEnv, getServerEnv } from "@/lib/env";

/**
 * Service-role Supabase client.
 *
 * This key bypasses row level security, so it exists for exactly two purposes:
 * inviting users through the Auth admin API, and the administrative writes that
 * follow an invitation. It must never be imported from a client component —
 * `server-only` turns that mistake into a build error rather than a leak.
 *
 * Every caller is responsible for performing its own authorization check first;
 * see `requireAdmin()` in `@/lib/auth/guards`.
 */
export function createAdminClient() {
  const publicEnv = getPublicEnv();
  const serverEnv = getServerEnv();

  return createClient<Database>(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL,
    serverEnv.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false,
      },
    },
  );
}
