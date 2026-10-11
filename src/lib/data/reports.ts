import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/db/database.types";
import type { PersonSummary } from "@/lib/display";
import { businessDateKey } from "@/lib/domain/time";
import type { ReportWithPeople } from "@/lib/view-models";

export type { ReportWithPeople };

const REPORT_SELECT =
  "*, author:profiles!daily_work_reports_user_id_fkey(id, full_name, email), reviewer:profiles!daily_work_reports_reviewed_by_fkey(id, full_name, email), tasks:daily_report_tasks(task:tasks(id, title))";

export async function getReportForDate(
  supabase: SupabaseClient<Database>,
  userId: string,
  dateKey: string,
): Promise<ReportWithPeople | null> {
  const { data } = await supabase
    .from("daily_work_reports")
    .select(REPORT_SELECT)
    .eq("user_id", userId)
    .eq("report_date", dateKey)
    .maybeSingle();

  return (data as ReportWithPeople | null) ?? null;
}

export async function listMyReports(
  supabase: SupabaseClient<Database>,
  userId: string,
  limit = 30,
): Promise<ReportWithPeople[]> {
  const { data } = await supabase
    .from("daily_work_reports")
    .select(REPORT_SELECT)
    .eq("user_id", userId)
    .order("report_date", { ascending: false })
    .limit(limit);

  return (data ?? []) as ReportWithPeople[];
}

/**
 * Reports visible to a reviewing manager or administrator.
 *
 * RLS already hides drafts belonging to other people, so this returns exactly
 * what the caller is entitled to review.
 */
export async function listTeamReports(
  supabase: SupabaseClient<Database>,
  options: { fromDate?: string; toDate?: string; limit?: number } = {},
): Promise<ReportWithPeople[]> {
  let query = supabase
    .from("daily_work_reports")
    .select(REPORT_SELECT)
    .eq("status", "SUBMITTED")
    .order("report_date", { ascending: false })
    .limit(options.limit ?? 50);

  if (options.fromDate) query = query.gte("report_date", options.fromDate);
  if (options.toDate) query = query.lte("report_date", options.toDate);

  const { data } = await query;
  return (data ?? []) as ReportWithPeople[];
}

export type MissingReport = { profile: PersonSummary; dateKey: string };

/**
 * People with no submitted report for a given day.
 *
 * Absence of a report is reported as exactly that — it is never presented as
 * evidence that no work happened.
 */
export async function findMissingReports(
  supabase: SupabaseClient<Database>,
  dateKey: string = businessDateKey(),
): Promise<MissingReport[]> {
  const [peopleResult, reportsResult] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, full_name, email")
      .eq("role", "INTERN")
      .in("onboarding_status", ["ACTIVE", "PROFILE_INCOMPLETE"]),
    supabase
      .from("daily_work_reports")
      .select("user_id")
      .eq("report_date", dateKey)
      .eq("status", "SUBMITTED"),
  ]);

  const submitted = new Set((reportsResult.data ?? []).map((row) => row.user_id));

  return ((peopleResult.data ?? []) as PersonSummary[])
    .filter((person) => !submitted.has(person.id))
    .map((profile) => ({ profile, dateKey }));
}
