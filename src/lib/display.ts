/**
 * Presentation helpers shared by server and client components.
 *
 * This module deliberately contains no data access and no `server-only`
 * import, so client components can use it without dragging a server module
 * into the browser bundle.
 */

export type PersonSummary = {
  id: string;
  full_name: string | null;
  email: string;
};

export const ROLE_LABELS = {
  ADMIN: "Administrator",
  MANAGER: "Manager",
  INTERN: "Intern",
} as const;

export const ONBOARDING_STATUS_LABELS = {
  INVITED: "Invited",
  PROFILE_INCOMPLETE: "Profile incomplete",
  ACTIVE: "Active",
  PAUSED: "Paused",
  COMPLETED: "Completed",
  OFFBOARDED: "Offboarded",
} as const;

/** Falls back to the email so a half-onboarded account never renders blank. */
export function displayName(person: { full_name: string | null; email: string } | null): string {
  if (!person) return "Unknown";
  return person.full_name?.trim() || person.email;
}
