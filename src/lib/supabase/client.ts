"use client";

import { createBrowserClient } from "@supabase/ssr";

import type { Database } from "@/lib/db/database.types";
import { getPublicEnv } from "@/lib/env";

let cached: ReturnType<typeof createBrowserClient<Database>> | undefined;

/**
 * Browser Supabase client. Carries only the publishable key, and every request
 * it makes is still subject to row level security.
 */
export function createClient() {
  if (!cached) {
    const env = getPublicEnv();
    cached = createBrowserClient<Database>(
      env.NEXT_PUBLIC_SUPABASE_URL,
      env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    );
  }
  return cached;
}
