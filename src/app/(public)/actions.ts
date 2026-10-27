"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { recordActivity } from "@/lib/activity";
import { getSessionUser } from "@/lib/auth/guards";
import { getPublicEnv } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { forgotPasswordSchema, resetPasswordSchema, signInSchema } from "@/lib/validation/auth";

import type { ActionState } from "./action-state";

function fieldErrorsFrom(error: { issues: { path: readonly PropertyKey[]; message: string }[] }) {
  const fieldErrors: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    fieldErrors[key] ??= issue.message;
  }
  return fieldErrors;
}

/** Only ever redirect to an in-app path, never to an attacker-supplied URL. */
function safeRedirect(next: FormDataEntryValue | null): string {
  const value = typeof next === "string" ? next : "";
  if (value.startsWith("/") && !value.startsWith("//")) {
    return value;
  }
  return "/overview";
}

/**
 * Distinguishes "the auth server is unreachable or misconfigured" from "those
 * credentials are wrong".
 *
 * Supabase reports a failed fetch as `AuthRetryableFetchError`, usually with
 * status 0 or a 5xx. A rejected credential is a 400 with an explicit code.
 */
function isConnectivityError(error: { name?: string; status?: number; message?: string }): boolean {
  if (error.name === "AuthRetryableFetchError") return true;
  if (typeof error.status === "number" && (error.status === 0 || error.status >= 500)) return true;
  return /fetch failed|network|ENOTFOUND|ECONNREFUSED|EAI_AGAIN|timeout/i.test(
    error.message ?? "",
  );
}

export async function signInAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = signInSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { status: "error", fieldErrors: fieldErrorsFrom(parsed.error) };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  if (error || !data.user) {
    // A connectivity or configuration failure is reported as such. Saying
    // "wrong password" when the server is unreachable sends people hunting for
    // a problem that does not exist. This leaks nothing: a network error says
    // nothing about whether an account exists.
    if (error && isConnectivityError(error)) {
      return {
        status: "error",
        message:
          "Cannot reach the Rangverse database right now. Check your connection, or ask an administrator to confirm the server configuration.",
      };
    }

    // Otherwise deliberately generic: never reveal whether an address is registered.
    return { status: "error", message: "That email and password combination did not work." };
  }

  await recordActivity(supabase, data.user.id, {
    action: "AUTH_SIGN_IN",
    entityType: "auth_user",
    entityId: data.user.id,
    subjectId: data.user.id,
  });

  revalidatePath("/", "layout");
  redirect(safeRedirect(formData.get("next")));
}

export async function signOutAction(): Promise<void> {
  const supabase = await createClient();
  const session = await getSessionUser();

  if (session) {
    await recordActivity(supabase, session.id, {
      action: "AUTH_SIGN_OUT",
      entityType: "auth_user",
      entityId: session.id,
      subjectId: session.id,
    });
  }

  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/login");
}

export async function requestPasswordResetAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = forgotPasswordSchema.safeParse({ email: formData.get("email") });

  if (!parsed.success) {
    return { status: "error", fieldErrors: fieldErrorsFrom(parsed.error) };
  }

  const supabase = await createClient();
  const env = getPublicEnv();

  await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${env.NEXT_PUBLIC_SITE_URL}/auth/callback?next=/reset-password`,
  });

  // The same confirmation is shown whether or not the address exists, so this
  // form cannot be used to enumerate accounts.
  return {
    status: "success",
    message: "If that address belongs to a Rangverse account, a reset link is on its way.",
  };
}

export async function resetPasswordAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = resetPasswordSchema.safeParse({
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });

  if (!parsed.success) {
    return { status: "error", fieldErrors: fieldErrorsFrom(parsed.error) };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      status: "error",
      message: "That reset link has expired. Request a new one and try again.",
    };
  }

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });

  if (error) {
    return { status: "error", message: error.message };
  }

  await recordActivity(supabase, user.id, {
    action: "AUTH_PASSWORD_CHANGED",
    entityType: "auth_user",
    entityId: user.id,
    subjectId: user.id,
  });

  revalidatePath("/", "layout");
  redirect("/overview");
}
