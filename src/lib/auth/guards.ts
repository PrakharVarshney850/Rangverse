import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";

import type { Actor, Permission } from "@/lib/auth/permissions";
import { can, isAccountActive } from "@/lib/auth/permissions";
import type { ProfileRow } from "@/lib/db/database.types";
import { createClient } from "@/lib/supabase/server";

export interface SessionUser {
  id: string;
  email: string;
  profile: ProfileRow;
  actor: Actor;
}

/**
 * Resolves the signed-in user and their profile for the current request.
 *
 * Deduplicated with `cache()` so a page that guards itself and then renders
 * several server components issues a single round trip. Returns `null` when
 * there is no valid session, or when the account has no profile yet.
 */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const supabase = await createClient();

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return null;
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile) {
    return null;
  }

  return {
    id: user.id,
    email: user.email ?? profile.email,
    profile,
    actor: {
      id: profile.id,
      role: profile.role,
      onboardingStatus: profile.onboarding_status,
    },
  };
});

/**
 * Requires a usable session. Redirects to sign-in when absent, and to the
 * suspended screen when the account has been paused or offboarded.
 */
export async function requireUser(): Promise<SessionUser> {
  const session = await getSessionUser();

  if (!session) {
    redirect("/login");
  }

  if (!isAccountActive(session.actor)) {
    redirect("/account-suspended");
  }

  return session;
}

/** Requires a usable session that also holds a specific permission. */
export async function requirePermission(permission: Permission): Promise<SessionUser> {
  const session = await requireUser();

  if (!can(session.actor, permission)) {
    redirect("/not-authorized");
  }

  return session;
}

export async function requireAdmin(): Promise<SessionUser> {
  const session = await requireUser();

  if (session.actor.role !== "ADMIN") {
    redirect("/not-authorized");
  }

  return session;
}

/**
 * Server-action variant: throws instead of redirecting, so the caller can turn
 * the failure into a form error state.
 */
export async function assertPermission(permission: Permission): Promise<SessionUser> {
  const session = await getSessionUser();

  if (!session || !isAccountActive(session.actor)) {
    throw new AuthorizationError("You need to sign in again to do that.");
  }

  if (!can(session.actor, permission)) {
    throw new AuthorizationError("Your role does not allow this action.");
  }

  return session;
}

export async function assertSignedIn(): Promise<SessionUser> {
  const session = await getSessionUser();

  if (!session || !isAccountActive(session.actor)) {
    throw new AuthorizationError("You need to sign in again to do that.");
  }

  return session;
}

export class AuthorizationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthorizationError";
  }
}
