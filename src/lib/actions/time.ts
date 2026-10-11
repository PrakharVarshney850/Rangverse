"use server";

import { revalidatePath } from "next/cache";

import { recordActivity, type ActivityAction } from "@/lib/activity";
import { assertSignedIn, AuthorizationError } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";

export type TimeActionResult =
  | { ok: true; message: string }
  | { ok: false; message: string };

const AFFECTED_PATHS = ["/overview", "/time", "/tasks", "/team"];

function revalidateTimeSurfaces() {
  for (const path of AFFECTED_PATHS) {
    revalidatePath(path);
  }
}

/**
 * Every transition is a single call to the database state machine, which is
 * idempotent for "start" operations. A double-click or a retried request after
 * a dropped connection therefore cannot create a duplicate record.
 */
async function runTransition(
  rpc: "rv_clock_in" | "rv_clock_out" | "rv_start_break" | "rv_end_break" | "rv_stop_task_timer",
  action: ActivityAction,
  entityType: string,
  successMessage: string,
): Promise<TimeActionResult> {
  try {
    const session = await assertSignedIn();
    const supabase = await createClient();

    const { data, error } = await supabase.rpc(rpc);

    if (error) {
      return { ok: false, message: humanizeDbError(error.message) };
    }

    const record = data as { id?: string } | null;

    await recordActivity(supabase, session.id, {
      action,
      entityType,
      entityId: record?.id ?? null,
      subjectId: session.id,
    });

    revalidateTimeSurfaces();
    return { ok: true, message: successMessage };
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return { ok: false, message: error.message };
    }
    throw error;
  }
}

export async function clockInAction(): Promise<TimeActionResult> {
  return runTransition(
    "rv_clock_in",
    "ATTENDANCE_CLOCK_IN",
    "attendance_session",
    "You are clocked in. Have a good shift.",
  );
}

export async function clockOutAction(): Promise<TimeActionResult> {
  return runTransition(
    "rv_clock_out",
    "ATTENDANCE_CLOCK_OUT",
    "attendance_session",
    "Clocked out. Your hours have been recorded.",
  );
}

export async function startBreakAction(): Promise<TimeActionResult> {
  return runTransition("rv_start_break", "BREAK_STARTED", "break", "Break started.");
}

export async function endBreakAction(): Promise<TimeActionResult> {
  return runTransition("rv_end_break", "BREAK_ENDED", "break", "Break ended. Back to work.");
}

export async function stopTaskTimerAction(): Promise<TimeActionResult> {
  return runTransition(
    "rv_stop_task_timer",
    "TASK_TIMER_STOPPED",
    "task_time_entry",
    "Task timer stopped.",
  );
}

export async function startTaskTimerAction(taskId: string): Promise<TimeActionResult> {
  try {
    const session = await assertSignedIn();
    const supabase = await createClient();

    const { data, error } = await supabase.rpc("rv_start_task_timer", { target_task: taskId });

    if (error) {
      return { ok: false, message: humanizeDbError(error.message) };
    }

    const record = data as { id?: string } | null;

    await recordActivity(supabase, session.id, {
      action: "TASK_TIMER_STARTED",
      entityType: "task_time_entry",
      entityId: record?.id ?? null,
      subjectId: session.id,
      metadata: { taskId },
    });

    revalidateTimeSurfaces();
    return { ok: true, message: "Task timer running." };
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return { ok: false, message: error.message };
    }
    throw error;
  }
}

/**
 * Database guards already raise readable messages; this strips PostgREST noise
 * and gives constraint violations a sentence a person can act on.
 */
function humanizeDbError(message: string): string {
  if (/duplicate key|unique constraint/i.test(message)) {
    return "That is already running — refresh the page to see the current state.";
  }
  if (/row-level security/i.test(message)) {
    return "You are not allowed to do that.";
  }
  return message.replace(/^.*?:\s*/, "").trim() || "Something went wrong. Try again.";
}
