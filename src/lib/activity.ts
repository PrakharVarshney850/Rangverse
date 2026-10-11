import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { ActivityOutcome, Database } from "@/lib/db/database.types";
import { sanitizeMetadata } from "@/lib/redact";

export { sanitizeMetadata };

export type ActivityAction =
  | "AUTH_SIGN_IN"
  | "AUTH_SIGN_OUT"
  | "AUTH_PASSWORD_RESET_REQUESTED"
  | "AUTH_PASSWORD_CHANGED"
  | "USER_INVITED"
  | "USER_ROLE_CHANGED"
  | "USER_STATUS_CHANGED"
  | "USER_PROFILE_COMPLETED"
  | "TEAM_CREATED"
  | "TASK_CREATED"
  | "TASK_UPDATED"
  | "TASK_STATUS_CHANGED"
  | "TASK_COMMENTED"
  | "ATTENDANCE_CLOCK_IN"
  | "ATTENDANCE_CLOCK_OUT"
  | "BREAK_STARTED"
  | "BREAK_ENDED"
  | "TASK_TIMER_STARTED"
  | "TASK_TIMER_STOPPED"
  | "REPORT_SAVED"
  | "REPORT_SUBMITTED"
  | "REPORT_REVIEWED"
  | "SHEET_CREATED"
  | "SHEET_COLUMN_CHANGED"
  | "SHEET_ACCESS_GRANTED"
  | "SHEET_ACCESS_REVOKED"
  | "SHEET_ROW_CREATED"
  | "SHEET_ROW_UPDATED"
  | "SHEET_ROW_DELETED"
  | "SHEET_ROW_ASSIGNED";

export const ACTIVITY_ACTION_LABELS: Record<ActivityAction, string> = {
  AUTH_SIGN_IN: "Signed in",
  AUTH_SIGN_OUT: "Signed out",
  AUTH_PASSWORD_RESET_REQUESTED: "Requested a password reset",
  AUTH_PASSWORD_CHANGED: "Changed their password",
  USER_INVITED: "Invited a user",
  USER_ROLE_CHANGED: "Changed a role",
  USER_STATUS_CHANGED: "Changed an account status",
  USER_PROFILE_COMPLETED: "Completed their profile",
  TEAM_CREATED: "Created a team",
  TASK_CREATED: "Created a task",
  TASK_UPDATED: "Updated a task",
  TASK_STATUS_CHANGED: "Changed a task status",
  TASK_COMMENTED: "Commented on a task",
  ATTENDANCE_CLOCK_IN: "Clocked in",
  ATTENDANCE_CLOCK_OUT: "Clocked out",
  BREAK_STARTED: "Started a break",
  BREAK_ENDED: "Ended a break",
  TASK_TIMER_STARTED: "Started a task timer",
  TASK_TIMER_STOPPED: "Stopped a task timer",
  REPORT_SAVED: "Saved a daily report",
  REPORT_SUBMITTED: "Submitted a daily report",
  REPORT_REVIEWED: "Reviewed a daily report",
  SHEET_CREATED: "Created a sheet",
  SHEET_COLUMN_CHANGED: "Changed sheet columns",
  SHEET_ACCESS_GRANTED: "Granted sheet access",
  SHEET_ACCESS_REVOKED: "Revoked sheet access",
  SHEET_ROW_CREATED: "Added a record",
  SHEET_ROW_UPDATED: "Updated a record",
  SHEET_ROW_DELETED: "Deleted a record",
  SHEET_ROW_ASSIGNED: "Assigned a record",
};

export interface ActivityEntry {
  action: ActivityAction;
  entityType: string;
  entityId?: string | null;
  subjectId?: string | null;
  outcome?: ActivityOutcome;
  metadata?: Record<string, unknown>;
}

/**
 * Appends an audit entry.
 *
 * Logging must never break the operation it describes, so failures are
 * swallowed after being reported to the server console. The table itself is
 * append-only: application roles hold no UPDATE or DELETE privilege.
 */
export async function recordActivity(
  supabase: SupabaseClient<Database>,
  actorId: string,
  entry: ActivityEntry,
): Promise<void> {
  const { error } = await supabase.from("activity_logs").insert({
    actor_id: actorId,
    action: entry.action,
    entity_type: entry.entityType,
    entity_id: entry.entityId ?? null,
    subject_id: entry.subjectId ?? null,
    outcome: entry.outcome ?? "SUCCESS",
    metadata: sanitizeMetadata(entry.metadata ?? {}),
  });

  if (error) {
    console.error(`[rangverse] failed to record activity ${entry.action}: ${error.message}`);
  }
}
