"use server";

import { revalidatePath } from "next/cache";

import { recordActivity } from "@/lib/activity";
import { assertPermission, assertSignedIn, AuthorizationError } from "@/lib/auth/guards";
import type { ProfileRow } from "@/lib/db/database.types";
import { getPublicEnv } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import {
  adminUpdateProfileSchema,
  completeProfileSchema,
  createTeamSchema,
  inviteUserSchema,
  slugify,
} from "@/lib/validation/profile";

export type PeopleMutationResult =
  | { ok: true; message: string; id?: string }
  | { ok: false; message: string; fieldErrors?: Record<string, string> };

function fieldErrorsFrom(error: { issues: { path: readonly PropertyKey[]; message: string }[] }) {
  const fieldErrors: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    fieldErrors[key] ??= issue.message;
  }
  return fieldErrors;
}

function humanize(message: string): string {
  if (/row-level security/i.test(message)) return "You are not allowed to do that.";
  if (/duplicate key|already been registered/i.test(message)) {
    return "Someone with that email already has a Rangverse account.";
  }
  return message.replace(/^.*?:\s*/, "").trim() || "Something went wrong. Try again.";
}

/**
 * Invites someone to Rangverse.
 *
 * This is the only place the service-role key is used for account creation,
 * and it is gated by `assertPermission("users.invite")` before the key is ever
 * touched. Public self-registration does not exist.
 */
export async function inviteUserAction(formData: FormData): Promise<PeopleMutationResult> {
  try {
    const session = await assertPermission("users.invite");

    const parsed = inviteUserSchema.safeParse({
      email: formData.get("email"),
      fullName: formData.get("fullName"),
      role: formData.get("role") ?? "INTERN",
      phone: formData.get("phone") ?? "",
      college: formData.get("college") ?? "",
      course: formData.get("course") ?? "",
      designation: formData.get("designation") ?? "",
      teamId: formData.get("teamId") ?? "",
      managerId: formData.get("managerId") ?? "",
      joiningDate: formData.get("joiningDate") ?? "",
      internshipEndDate: formData.get("internshipEndDate") ?? "",
    });

    if (!parsed.success) {
      return {
        ok: false,
        message: "Check the highlighted fields.",
        fieldErrors: fieldErrorsFrom(parsed.error),
      };
    }

    const input = parsed.data;
    const admin = createAdminClient();
    const env = getPublicEnv();

    const { data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail(
      input.email,
      {
        redirectTo: `${env.NEXT_PUBLIC_SITE_URL}/auth/callback?next=/onboarding`,
        data: { full_name: input.fullName },
      },
    );

    if (inviteError || !invited.user) {
      return { ok: false, message: humanize(inviteError?.message ?? "Could not send the invite.") };
    }

    const { error: profileError } = await admin.from("profiles").insert({
      id: invited.user.id,
      email: input.email,
      full_name: input.fullName,
      phone: input.phone,
      college: input.college,
      course: input.course,
      designation: input.designation,
      role: input.role,
      onboarding_status: "INVITED",
      team_id: input.teamId,
      manager_id: input.managerId,
      joining_date: input.joiningDate,
      internship_end_date: input.internshipEndDate,
    });

    if (profileError) {
      // Leave no orphaned auth user behind if the profile could not be written.
      await admin.auth.admin.deleteUser(invited.user.id);
      return { ok: false, message: humanize(profileError.message) };
    }

    const supabase = await createClient();
    await recordActivity(supabase, session.id, {
      action: "USER_INVITED",
      entityType: "profile",
      entityId: invited.user.id,
      subjectId: invited.user.id,
      metadata: { role: input.role, hasManager: input.managerId !== null },
    });

    revalidatePath("/admin/users");
    revalidatePath("/team");
    return { ok: true, message: `Invitation sent to ${input.email}.`, id: invited.user.id };
  } catch (error) {
    if (error instanceof AuthorizationError) return { ok: false, message: error.message };
    throw error;
  }
}

export async function updateUserAdminAction(formData: FormData): Promise<PeopleMutationResult> {
  try {
    const session = await assertPermission("users.manage");

    const parsed = adminUpdateProfileSchema.safeParse({
      userId: formData.get("userId"),
      role: formData.get("role"),
      onboardingStatus: formData.get("onboardingStatus"),
      designation: formData.get("designation") ?? "",
      teamId: formData.get("teamId") ?? "",
      managerId: formData.get("managerId") ?? "",
      joiningDate: formData.get("joiningDate") ?? "",
      internshipEndDate: formData.get("internshipEndDate") ?? "",
    });

    if (!parsed.success) {
      return {
        ok: false,
        message: "Check the highlighted fields.",
        fieldErrors: fieldErrorsFrom(parsed.error),
      };
    }

    const input = parsed.data;

    // An administrator must not be able to strip their own last privileges by
    // accident and lock the workspace out of administration.
    if (input.userId === session.id && input.role !== "ADMIN") {
      return { ok: false, message: "You cannot remove your own administrator role." };
    }

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("profiles")
      .update({
        role: input.role,
        onboarding_status: input.onboardingStatus,
        designation: input.designation,
        team_id: input.teamId,
        manager_id: input.managerId,
        joining_date: input.joiningDate,
        internship_end_date: input.internshipEndDate,
      })
      .eq("id", input.userId)
      .select("id")
      .maybeSingle();

    if (error) return { ok: false, message: humanize(error.message) };
    if (!data) return { ok: false, message: "That person is not available to you." };

    await recordActivity(supabase, session.id, {
      action: "USER_ROLE_CHANGED",
      entityType: "profile",
      entityId: input.userId,
      subjectId: input.userId,
      metadata: { role: input.role, status: input.onboardingStatus },
    });

    revalidatePath("/admin/users");
    revalidatePath("/team");
    return { ok: true, message: "Profile updated." };
  } catch (error) {
    if (error instanceof AuthorizationError) return { ok: false, message: error.message };
    throw error;
  }
}

export async function setUserStatusAction(
  userId: string,
  status: "ACTIVE" | "PAUSED" | "COMPLETED" | "OFFBOARDED",
): Promise<PeopleMutationResult> {
  try {
    const session = await assertPermission("users.manage");

    if (userId === session.id) {
      return { ok: false, message: "You cannot change your own account status." };
    }

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("profiles")
      .update({ onboarding_status: status })
      .eq("id", userId)
      .select("id")
      .maybeSingle();

    if (error) return { ok: false, message: humanize(error.message) };
    if (!data) return { ok: false, message: "That person is not available to you." };

    await recordActivity(supabase, session.id, {
      action: "USER_STATUS_CHANGED",
      entityType: "profile",
      entityId: userId,
      subjectId: userId,
      metadata: { status },
    });

    revalidatePath("/admin/users");
    revalidatePath("/team");
    return { ok: true, message: `Account marked ${status.toLowerCase()}.` };
  } catch (error) {
    if (error instanceof AuthorizationError) return { ok: false, message: error.message };
    throw error;
  }
}

/** The fields a person may change about themselves. */
export async function completeProfileAction(formData: FormData): Promise<PeopleMutationResult> {
  try {
    const session = await assertSignedIn();

    const parsed = completeProfileSchema.safeParse({
      fullName: formData.get("fullName"),
      phone: formData.get("phone") ?? "",
      college: formData.get("college") ?? "",
      course: formData.get("course") ?? "",
    });

    if (!parsed.success) {
      return {
        ok: false,
        message: "Check the highlighted fields.",
        fieldErrors: fieldErrorsFrom(parsed.error),
      };
    }

    const supabase = await createClient();
    const patch: Partial<ProfileRow> = {
      full_name: parsed.data.fullName,
      phone: parsed.data.phone,
      college: parsed.data.college,
      course: parsed.data.course,
    };

    // The one lifecycle transition a person may make for themselves. Every
    // other status change is rejected by the database trigger.
    if (
      session.profile.onboarding_status === "PROFILE_INCOMPLETE" ||
      session.profile.onboarding_status === "INVITED"
    ) {
      patch.onboarding_status = "ACTIVE";
    }

    const { error } = await supabase.from("profiles").update(patch).eq("id", session.id);

    if (error) return { ok: false, message: humanize(error.message) };

    await recordActivity(supabase, session.id, {
      action: "USER_PROFILE_COMPLETED",
      entityType: "profile",
      entityId: session.id,
      subjectId: session.id,
    });

    revalidatePath("/settings");
    revalidatePath("/overview");
    return { ok: true, message: "Profile saved." };
  } catch (error) {
    if (error instanceof AuthorizationError) return { ok: false, message: error.message };
    throw error;
  }
}

export async function createTeamAction(formData: FormData): Promise<PeopleMutationResult> {
  try {
    const session = await assertPermission("teams.manage");

    const parsed = createTeamSchema.safeParse({
      name: formData.get("name"),
      description: formData.get("description") ?? "",
    });

    if (!parsed.success) {
      return {
        ok: false,
        message: "Check the highlighted fields.",
        fieldErrors: fieldErrorsFrom(parsed.error),
      };
    }

    const slug = slugify(parsed.data.name);
    if (!slug) return { ok: false, message: "Use a name with at least one letter or number." };

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("teams")
      .insert({ name: parsed.data.name, slug, description: parsed.data.description })
      .select("id")
      .maybeSingle();

    if (error) return { ok: false, message: humanize(error.message) };
    if (!data) return { ok: false, message: "You cannot create teams." };

    await recordActivity(supabase, session.id, {
      action: "TEAM_CREATED",
      entityType: "team",
      entityId: data.id,
      metadata: { name: parsed.data.name },
    });

    revalidatePath("/admin/users");
    return { ok: true, message: "Team created.", id: data.id };
  } catch (error) {
    if (error instanceof AuthorizationError) return { ok: false, message: error.message };
    throw error;
  }
}
