import { z } from "zod";

/**
 * Environment contract for Rangverse.
 *
 * Missing or malformed configuration must fail loudly with an actionable
 * message rather than rendering a blank page. Values are never logged.
 */

const publicSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z
    .string()
    .url("NEXT_PUBLIC_SUPABASE_URL must be a full URL, e.g. https://xyz.supabase.co"),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z
    .string()
    .min(20, "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY looks too short to be a real key"),
  NEXT_PUBLIC_SITE_URL: z
    .string()
    .url("NEXT_PUBLIC_SITE_URL must be a full URL, e.g. http://localhost:3000"),
});

const serverSchema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: z
    .string()
    .min(20, "SUPABASE_SERVICE_ROLE_KEY looks too short to be a real key"),
});

export type PublicEnv = z.infer<typeof publicSchema>;
export type ServerEnv = z.infer<typeof serverSchema>;

function formatIssues(issues: z.ZodIssue[]): string {
  return issues.map((issue) => `  • ${issue.path.join(".")}: ${issue.message}`).join("\n");
}

const SETUP_HINT = [
  "",
  "Rangverse is not configured yet.",
  "",
  "  1. Copy .env.example to .env.local",
  "  2. Fill in the values from your Supabase project",
  "     (Project Settings → API), or from `supabase status`",
  "     if you are running the local stack.",
  "  3. Restart the dev server.",
  "",
  "See docs/deployment.md for the full setup walkthrough.",
].join("\n");

/**
 * Public configuration. Safe to read in both server and browser bundles —
 * these values are inlined by Next at build time and are not secrets.
 */
export function getPublicEnv(): PublicEnv {
  const parsed = publicSchema.safeParse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
  });

  if (!parsed.success) {
    throw new Error(
      `Invalid public environment configuration:\n${formatIssues(parsed.error.issues)}\n${SETUP_HINT}`,
    );
  }

  return parsed.data;
}

/**
 * Server-only configuration. Never import this from a client component.
 */
export function getServerEnv(): ServerEnv {
  const parsed = serverSchema.safeParse({
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  });

  if (!parsed.success) {
    throw new Error(
      `Invalid server environment configuration:\n${formatIssues(parsed.error.issues)}\n${SETUP_HINT}`,
    );
  }

  return parsed.data;
}

/**
 * Non-throwing probe used by health checks, the configuration banner and the
 * E2E suite to decide whether a live Supabase is reachable.
 */
export function isSupabaseConfigured(): boolean {
  return publicSchema.safeParse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
  }).success;
}
