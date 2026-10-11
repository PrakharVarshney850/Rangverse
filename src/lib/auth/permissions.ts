import type { AppRole, OnboardingStatus } from "@/lib/db/database.types";

/**
 * The central permission model.
 *
 * This is the single description of what each role may attempt. It drives
 * navigation, page guards and server-action checks — but it is deliberately
 * *not* the only line of defence: every one of these permissions is mirrored by
 * a row level security policy, so bypassing this module changes nothing about
 * what the database will return.
 */
export const PERMISSIONS = [
  "users.invite",
  "users.manage",
  "users.viewAll",
  "teams.manage",
  "tasks.createAny",
  "tasks.createForTeam",
  "tasks.viewTeam",
  "tasks.viewAll",
  "attendance.viewTeam",
  "attendance.viewAll",
  "reports.reviewTeam",
  "reports.viewAll",
  "sheets.manage",
  "sheets.assignRows",
  "activity.viewTeam",
  "activity.viewAll",
  "analytics.viewTeam",
  "analytics.viewAll",
  "settings.manage",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

const ROLE_PERMISSIONS: Record<AppRole, readonly Permission[]> = {
  ADMIN: PERMISSIONS,
  MANAGER: [
    "tasks.createForTeam",
    "tasks.viewTeam",
    "attendance.viewTeam",
    "reports.reviewTeam",
    "sheets.assignRows",
    "activity.viewTeam",
    "analytics.viewTeam",
  ],
  INTERN: [],
};

/** Statuses that keep an account able to sign in and use the workspace. */
const USABLE_STATUSES: readonly OnboardingStatus[] = [
  "INVITED",
  "PROFILE_INCOMPLETE",
  "ACTIVE",
  "COMPLETED",
];

export interface Actor {
  id: string;
  role: AppRole;
  onboardingStatus: OnboardingStatus;
}

/** A paused or offboarded account retains no permissions at all. */
export function isAccountActive(actor: Pick<Actor, "onboardingStatus">): boolean {
  return USABLE_STATUSES.includes(actor.onboardingStatus);
}

export function can(actor: Actor | null | undefined, permission: Permission): boolean {
  if (!actor || !isAccountActive(actor)) {
    return false;
  }
  return ROLE_PERMISSIONS[actor.role].includes(permission);
}

export function canAny(actor: Actor | null | undefined, permissions: Permission[]): boolean {
  return permissions.some((permission) => can(actor, permission));
}

export function isAdmin(actor: Actor | null | undefined): boolean {
  return Boolean(actor && isAccountActive(actor) && actor.role === "ADMIN");
}

export function isManager(actor: Actor | null | undefined): boolean {
  return Boolean(actor && isAccountActive(actor) && actor.role === "MANAGER");
}

export function isIntern(actor: Actor | null | undefined): boolean {
  return Boolean(actor && isAccountActive(actor) && actor.role === "INTERN");
}

/**
 * Whether `actor` may look at `targetUserId`'s work. Mirrors `app.can_view_user`.
 */
export function canViewUser(
  actor: Actor | null | undefined,
  targetUserId: string,
  managerIdOfTarget: string | null | undefined,
): boolean {
  if (!actor || !isAccountActive(actor)) return false;
  if (actor.id === targetUserId) return true;
  if (actor.role === "ADMIN") return true;
  return actor.role === "MANAGER" && managerIdOfTarget === actor.id;
}

/**
 * Whether a manager may direct work at a given person. Mirrors the
 * `app.guard_task_columns` trigger.
 */
export function canAssignTaskTo(
  actor: Actor | null | undefined,
  assigneeId: string | null,
  managerIdOfAssignee: string | null | undefined,
): boolean {
  if (!actor || !isAccountActive(actor)) return false;
  if (actor.role === "ADMIN") return true;
  if (actor.role !== "MANAGER") return false;
  if (assigneeId === null) return true;
  return assigneeId === actor.id || managerIdOfAssignee === actor.id;
}

/** Fields an intern is allowed to edit on their own profile. */
export const SELF_EDITABLE_PROFILE_FIELDS = [
  "full_name",
  "phone",
  "college",
  "course",
  "avatar_url",
] as const;

export type SelfEditableProfileField = (typeof SELF_EDITABLE_PROFILE_FIELDS)[number];
