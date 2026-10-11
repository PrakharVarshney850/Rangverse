/**
 * Database types for Rangverse.
 *
 * These mirror `supabase/migrations/*.sql` exactly. They are written by hand
 * because the local Supabase stack (which `supabase gen types` requires) needs
 * Docker; once a Supabase project is available, `npm run db:types` regenerates
 * this file from the live schema. The RLS test suite applies the same
 * migrations to a real PostgreSQL instance, so drift surfaces as a test failure
 * rather than a runtime surprise.
 */

export type AppRole = "ADMIN" | "MANAGER" | "INTERN";

export type OnboardingStatus =
  | "INVITED"
  | "PROFILE_INCOMPLETE"
  | "ACTIVE"
  | "PAUSED"
  | "COMPLETED"
  | "OFFBOARDED";

export type ActivityOutcome = "SUCCESS" | "DENIED" | "FAILED";

export type TaskStatus = "TO_DO" | "IN_PROGRESS" | "IN_REVIEW" | "DONE";

export type TaskPriority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";

export type ReportStatus = "DRAFT" | "SUBMITTED";

export type SheetStatus = "ACTIVE" | "ARCHIVED";

export type SheetAccessLevel = "VIEW" | "EDIT";

export type SheetColumnType =
  | "TEXT"
  | "LONG_TEXT"
  | "NUMBER"
  | "DATE"
  | "EMAIL"
  | "URL"
  | "PHONE"
  | "SELECT"
  | "BOOLEAN";

export type Json = string | number | boolean | null | { [key: string]: Json } | Json[];

export type TeamRow = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export type ProfileRow = {
  id: string;
  email: string;
  full_name: string | null;
  phone: string | null;
  college: string | null;
  course: string | null;
  designation: string | null;
  role: AppRole;
  onboarding_status: OnboardingStatus;
  team_id: string | null;
  manager_id: string | null;
  joining_date: string | null;
  internship_end_date: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

export type ActivityLogRow = {
  id: string;
  actor_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  subject_id: string | null;
  outcome: ActivityOutcome;
  metadata: Record<string, Json>;
  created_at: string;
}

export type AttendanceSessionRow = {
  id: string;
  user_id: string;
  clock_in_at: string;
  clock_out_at: string | null;
  needs_review: boolean;
  review_reason: string | null;
  closed_by: string | null;
  created_at: string;
  updated_at: string;
}

export type BreakRow = {
  id: string;
  session_id: string;
  user_id: string;
  started_at: string;
  ended_at: string | null;
  created_at: string;
  updated_at: string;
}

export type TaskRow = {
  id: string;
  title: string;
  description: string | null;
  assignee_id: string | null;
  created_by: string | null;
  team_id: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  due_date: string | null;
  campaign: string | null;
  client: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export type TaskCommentRow = {
  id: string;
  task_id: string;
  author_id: string | null;
  body: string;
  created_at: string;
  updated_at: string;
}

export type TaskTimeEntryRow = {
  id: string;
  task_id: string;
  user_id: string;
  session_id: string | null;
  started_at: string;
  ended_at: string | null;
  created_at: string;
  updated_at: string;
}

export type DailyWorkReportRow = {
  id: string;
  user_id: string;
  report_date: string;
  summary: string | null;
  progress: string | null;
  blockers: string | null;
  next_steps: string | null;
  evidence_links: string[];
  status: ReportStatus;
  submitted_at: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  manager_feedback: string | null;
  created_at: string;
  updated_at: string;
}

export type DailyReportTaskRow = {
  report_id: string;
  task_id: string;
}

export type DataSheetRow = {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  status: SheetStatus;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export type DataSheetColumnRow = {
  id: string;
  sheet_id: string;
  column_key: string;
  label: string;
  data_type: SheetColumnType;
  is_required: boolean;
  display_order: number;
  options: string[];
  created_at: string;
  updated_at: string;
}

export type DataSheetMembershipRow = {
  id: string;
  sheet_id: string;
  user_id: string;
  access_level: SheetAccessLevel;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export type DataSheetRecordRow = {
  id: string;
  sheet_id: string;
  assigned_to_user_id: string | null;
  row_data: Record<string, string>;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

type Rel<Name extends string, Col extends string, Ref extends string> = {
  foreignKeyName: Name;
  columns: [Col];
  isOneToOne: false;
  referencedRelation: Ref;
  referencedColumns: ["id"];
};

type Table<Row, Relationships extends readonly unknown[] = []> = {
  Row: Row;
  Insert: Partial<Row>;
  Update: Partial<Row>;
  Relationships: Relationships;
};

/**
 * Relationship metadata mirrors the foreign keys declared in the migrations.
 * PostgREST uses these names to resolve embedded selects such as
 * `profiles!tasks_assignee_id_fkey(...)`, so the names here must match the
 * constraint names PostgreSQL generates.
 */
export type Database = {
  public: {
    Tables: {
      teams: Table<TeamRow>;
      profiles: Table<
        ProfileRow,
        [
          Rel<"profiles_team_id_fkey", "team_id", "teams">,
          Rel<"profiles_manager_id_fkey", "manager_id", "profiles">,
        ]
      >;
      activity_logs: Table<
        ActivityLogRow,
        [
          Rel<"activity_logs_actor_id_fkey", "actor_id", "profiles">,
          Rel<"activity_logs_subject_id_fkey", "subject_id", "profiles">,
        ]
      >;
      attendance_sessions: Table<
        AttendanceSessionRow,
        [
          Rel<"attendance_sessions_user_id_fkey", "user_id", "profiles">,
          Rel<"attendance_sessions_closed_by_fkey", "closed_by", "profiles">,
        ]
      >;
      breaks: Table<
        BreakRow,
        [
          Rel<"breaks_session_id_fkey", "session_id", "attendance_sessions">,
          Rel<"breaks_user_id_fkey", "user_id", "profiles">,
        ]
      >;
      tasks: Table<
        TaskRow,
        [
          Rel<"tasks_assignee_id_fkey", "assignee_id", "profiles">,
          Rel<"tasks_created_by_fkey", "created_by", "profiles">,
          Rel<"tasks_team_id_fkey", "team_id", "teams">,
        ]
      >;
      task_comments: Table<
        TaskCommentRow,
        [
          Rel<"task_comments_task_id_fkey", "task_id", "tasks">,
          Rel<"task_comments_author_id_fkey", "author_id", "profiles">,
        ]
      >;
      task_time_entries: Table<
        TaskTimeEntryRow,
        [
          Rel<"task_time_entries_task_id_fkey", "task_id", "tasks">,
          Rel<"task_time_entries_user_id_fkey", "user_id", "profiles">,
          Rel<"task_time_entries_session_id_fkey", "session_id", "attendance_sessions">,
        ]
      >;
      daily_work_reports: Table<
        DailyWorkReportRow,
        [
          Rel<"daily_work_reports_user_id_fkey", "user_id", "profiles">,
          Rel<"daily_work_reports_reviewed_by_fkey", "reviewed_by", "profiles">,
        ]
      >;
      daily_report_tasks: Table<
        DailyReportTaskRow,
        [
          Rel<"daily_report_tasks_report_id_fkey", "report_id", "daily_work_reports">,
          Rel<"daily_report_tasks_task_id_fkey", "task_id", "tasks">,
        ]
      >;
      data_sheets: Table<DataSheetRow, [Rel<"data_sheets_created_by_fkey", "created_by", "profiles">]>;
      data_sheet_columns: Table<
        DataSheetColumnRow,
        [Rel<"data_sheet_columns_sheet_id_fkey", "sheet_id", "data_sheets">]
      >;
      data_sheet_memberships: Table<
        DataSheetMembershipRow,
        [
          Rel<"data_sheet_memberships_sheet_id_fkey", "sheet_id", "data_sheets">,
          Rel<"data_sheet_memberships_user_id_fkey", "user_id", "profiles">,
        ]
      >;
      data_sheet_rows: Table<
        DataSheetRecordRow,
        [
          Rel<"data_sheet_rows_sheet_id_fkey", "sheet_id", "data_sheets">,
          Rel<"data_sheet_rows_assigned_to_user_id_fkey", "assigned_to_user_id", "profiles">,
        ]
      >;
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      rv_clock_in: { Args: Record<PropertyKey, never>; Returns: AttendanceSessionRow };
      rv_clock_out: { Args: Record<PropertyKey, never>; Returns: AttendanceSessionRow };
      rv_start_break: { Args: Record<PropertyKey, never>; Returns: BreakRow };
      rv_end_break: { Args: Record<PropertyKey, never>; Returns: BreakRow };
      rv_start_task_timer: { Args: { target_task: string }; Returns: TaskTimeEntryRow };
      rv_stop_task_timer: { Args: Record<PropertyKey, never>; Returns: TaskTimeEntryRow };
    };
    Enums: {
      app_role: AppRole;
      onboarding_status: OnboardingStatus;
      activity_outcome: ActivityOutcome;
      task_status: TaskStatus;
      task_priority: TaskPriority;
      report_status: ReportStatus;
      sheet_status: SheetStatus;
      sheet_access_level: SheetAccessLevel;
      sheet_column_type: SheetColumnType;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};
