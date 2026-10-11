"use server";

import { revalidatePath } from "next/cache";

import { recordActivity } from "@/lib/activity";
import { assertPermission, assertSignedIn, AuthorizationError } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { reviewReportSchema, submittableDailyReportSchema } from "@/lib/validation/report";

export type ReportMutationResult =
  | { ok: true; message: string }
  | { ok: false; message: string; fieldErrors?: Record<string, string> };

function fieldErrorsFrom(error: { issues: { path: (string | number)[]; message: string }[] }) {
  const fieldErrors: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    fieldErrors[key] ??= issue.message;
  }
  return fieldErrors;
}

function humanize(message: string): string {
  if (/row-level security/i.test(message)) return "You are not allowed to do that.";
  if (/submitted report cannot be edited/i.test(message)) {
    return "This report has already been submitted and can no longer be edited.";
  }
  return message.replace(/^.*?:\s*/, "").trim() || "Something went wrong. Try again.";
}

export async function saveDailyReportAction(formData: FormData): Promise<ReportMutationResult> {
  try {
    const session = await assertSignedIn();

    const parsed = submittableDailyReportSchema.safeParse({
      reportDate: formData.get("reportDate"),
      summary: formData.get("summary") ?? "",
      progress: formData.get("progress") ?? "",
      blockers: formData.get("blockers") ?? "",
      nextSteps: formData.get("nextSteps") ?? "",
      evidenceLinks: formData
        .getAll("evidenceLinks")
        .map((value) => String(value).trim())
        .filter((value) => value.length > 0),
      taskIds: formData.getAll("taskIds").map((value) => String(value)),
      intent: formData.get("intent") ?? "SAVE_DRAFT",
    });

    if (!parsed.success) {
      return {
        ok: false,
        message: "Check the highlighted fields.",
        fieldErrors: fieldErrorsFrom(parsed.error),
      };
    }

    const input = parsed.data;
    const supabase = await createClient();
    const submitting = input.intent === "SUBMIT";

    const { data: report, error } = await supabase
      .from("daily_work_reports")
      .upsert(
        {
          user_id: session.id,
          report_date: input.reportDate,
          summary: (input.summary ?? "").trim() || null,
          progress: input.progress,
          blockers: input.blockers,
          next_steps: input.nextSteps,
          evidence_links: input.evidenceLinks,
          status: submitting ? "SUBMITTED" : "DRAFT",
        },
        { onConflict: "user_id,report_date" },
      )
      .select("id")
      .single();

    if (error) {
      return { ok: false, message: humanize(error.message) };
    }

    // Replace the task links so the report always reflects the current choice.
    await supabase.from("daily_report_tasks").delete().eq("report_id", report.id);

    if (input.taskIds.length > 0) {
      const { error: linkError } = await supabase.from("daily_report_tasks").insert(
        input.taskIds.map((taskId) => ({ report_id: report.id, task_id: taskId })),
      );

      if (linkError) {
        return { ok: false, message: humanize(linkError.message) };
      }
    }

    await recordActivity(supabase, session.id, {
      action: submitting ? "REPORT_SUBMITTED" : "REPORT_SAVED",
      entityType: "daily_work_report",
      entityId: report.id,
      subjectId: session.id,
      metadata: { reportDate: input.reportDate, taskCount: input.taskIds.length },
    });

    revalidatePath("/daily-reports");
    revalidatePath("/overview");
    revalidatePath("/team");

    return {
      ok: true,
      message: submitting ? "Report submitted. Your manager can see it now." : "Draft saved.",
    };
  } catch (error) {
    if (error instanceof AuthorizationError) return { ok: false, message: error.message };
    throw error;
  }
}

export async function reviewReportAction(formData: FormData): Promise<ReportMutationResult> {
  try {
    const session = await assertPermission("reports.reviewTeam");

    const parsed = reviewReportSchema.safeParse({
      reportId: formData.get("reportId"),
      feedback: formData.get("feedback"),
    });

    if (!parsed.success) {
      return {
        ok: false,
        message: "Write your feedback first.",
        fieldErrors: fieldErrorsFrom(parsed.error),
      };
    }

    const supabase = await createClient();

    // `reviewed_by` and `reviewed_at` are stamped by the database trigger, so
    // a manager cannot attribute a review to somebody else.
    const { data, error } = await supabase
      .from("daily_work_reports")
      .update({ manager_feedback: parsed.data.feedback })
      .eq("id", parsed.data.reportId)
      .select("id, user_id")
      .maybeSingle();

    if (error) return { ok: false, message: humanize(error.message) };
    if (!data) return { ok: false, message: "That report is not available to you." };

    await recordActivity(supabase, session.id, {
      action: "REPORT_REVIEWED",
      entityType: "daily_work_report",
      entityId: data.id,
      subjectId: data.user_id,
    });

    revalidatePath("/team");
    revalidatePath("/daily-reports");
    return { ok: true, message: "Feedback saved." };
  } catch (error) {
    if (error instanceof AuthorizationError) return { ok: false, message: error.message };
    throw error;
  }
}
