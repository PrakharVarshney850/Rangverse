import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { ActivityLogRow, Database, ProfileRow, TeamRow } from "@/lib/db/database.types";
import { readAllPages } from "@/lib/data/read-pages";

export type PersonSummary = { id: string; full_name: string | null; email: string };

export type ProfileWithRelations = ProfileRow & {
  team: Pick<TeamRow, "id" | "name"> | null;
  manager: PersonSummary | null;
};

const PROFILE_SELECT = "*, team:teams(id, name)";

/**
 * Everyone the caller may see. Row level security performs the scoping.
 *
 * The manager is resolved with a second query rather than an embedded select:
 * `profiles.manager_id` points back at `profiles`, and a self-referential
 * foreign key is ambiguous to PostgREST's embedding (it cannot tell "my
 * manager" from "people I manage"). Two explicit queries keep the result
 * unambiguous and fully typed.
 */
export async function listVisiblePeople(
  supabase: SupabaseClient<Database>,
): Promise<ProfileWithRelations[]> {
  const { data } = await supabase
    .from("profiles")
    .select(PROFILE_SELECT)
    .order("full_name", { ascending: true, nullsFirst: false });

  const profiles = data ?? [];
  const managerIds = [
    ...new Set(profiles.map((profile) => profile.manager_id).filter((id): id is string => Boolean(id))),
  ];

  const managers = new Map<string, PersonSummary>();
  if (managerIds.length > 0) {
    const { data: managerRows } = await supabase
      .from("profiles")
      .select("id, full_name, email")
      .in("id", managerIds);

    for (const manager of managerRows ?? []) {
      managers.set(manager.id, manager);
    }
  }

  return profiles.map((profile) => ({
    ...profile,
    manager: profile.manager_id ? (managers.get(profile.manager_id) ?? null) : null,
  }));
}

/** People who can be given work: the caller's own reports, or everyone for an admin. */
export async function listAssignablepeople(
  supabase: SupabaseClient<Database>,
): Promise<PersonSummary[]> {
  const { data } = await supabase
    .from("profiles")
    .select("id, full_name, email, onboarding_status")
    .in("onboarding_status", ["INVITED", "PROFILE_INCOMPLETE", "ACTIVE"])
    .order("full_name", { ascending: true, nullsFirst: false });

  return ((data ?? []) as (PersonSummary & { onboarding_status: string })[]).map(
    ({ id, full_name, email }) => ({ id, full_name, email }),
  );
}

export async function listTeams(supabase: SupabaseClient<Database>): Promise<TeamRow[]> {
  const { data } = await supabase.from("teams").select("*").order("name", { ascending: true });
  return data ?? [];
}

export async function listManagers(supabase: SupabaseClient<Database>): Promise<PersonSummary[]> {
  const { data } = await supabase
    .from("profiles")
    .select("id, full_name, email")
    .in("role", ["MANAGER", "ADMIN"])
    .order("full_name", { ascending: true, nullsFirst: false });

  return (data ?? []) as PersonSummary[];
}

export type ActivityEntryWithActor = ActivityLogRow & {
  actor: PersonSummary | null;
  subject: PersonSummary | null;
};

export async function listActivity(
  supabase: SupabaseClient<Database>,
  limit = 60,
): Promise<ActivityEntryWithActor[]> {
  const { data } = await supabase
    .from("activity_logs")
    .select(
      "*, actor:profiles!activity_logs_actor_id_fkey(id, full_name, email), subject:profiles!activity_logs_subject_id_fkey(id, full_name, email)",
    )
    .order("created_at", { ascending: false })
    .limit(limit);

  return (data ?? []) as ActivityEntryWithActor[];
}

/** Headline counts for the administrator dashboard. */
export async function getPeopleCounts(supabase: SupabaseClient<Database>) {
  const rows = await readAllPages<Pick<ProfileRow, "role" | "onboarding_status">>((from, to) =>
    supabase
      .from("profiles")
      .select("id, role, onboarding_status", { count: "exact" })
      .order("id", { ascending: true })
      .range(from, to),
  );
  const active = rows.filter((row) => row.onboarding_status === "ACTIVE");

  return {
    total: rows.length,
    activeInterns: active.filter((row) => row.role === "INTERN").length,
    managers: rows.filter((row) => row.role === "MANAGER").length,
    admins: rows.filter((row) => row.role === "ADMIN").length,
    awaitingOnboarding: rows.filter(
      (row) => row.onboarding_status === "INVITED" || row.onboarding_status === "PROFILE_INCOMPLETE",
    ).length,
    paused: rows.filter(
      (row) => row.onboarding_status === "PAUSED" || row.onboarding_status === "OFFBOARDED",
    ).length,
  };
}

export const ONBOARDING_STATUS_LABELS = {
  INVITED: "Invited",
  PROFILE_INCOMPLETE: "Profile incomplete",
  ACTIVE: "Active",
  PAUSED: "Paused",
  COMPLETED: "Completed",
  OFFBOARDED: "Offboarded",
} as const;

export const ROLE_LABELS = {
  ADMIN: "Administrator",
  MANAGER: "Manager",
  INTERN: "Intern",
} as const;

export function displayName(person: { full_name: string | null; email: string } | null): string {
  if (!person) return "Unknown";
  return person.full_name?.trim() || person.email;
}
