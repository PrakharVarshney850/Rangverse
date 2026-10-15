import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/db/database.types";
import { throwIfReadFailed } from "@/lib/data/read-pages";
import {
  businessDateKey,
  businessDayRange,
  businessWeekRange,
  calculateSessionTotals,
  resolveAttendanceState,
  sumSessionTotals,
  type AggregateTotals,
  type AttendanceState,
} from "@/lib/domain/time";
import type {
  RunningTaskTimer,
  SessionWithBreaks,
  TimeTrackerSnapshot,
} from "@/lib/view-models";

export type { RunningTaskTimer, SessionWithBreaks, TimeTrackerSnapshot };

const SESSION_SELECT = "*, breaks(*)";

/**
 * Everything the time tracker needs for one person.
 *
 * Every figure is derived from recorded timestamps; nothing is read from a
 * browser-supplied total.
 */
export async function getTimeTrackerSnapshot(
  supabase: SupabaseClient<Database>,
  userId: string,
  now: Date = new Date(),
): Promise<TimeTrackerSnapshot> {
  const day = businessDayRange(businessDateKey(now));
  const week = businessWeekRange(now);

  const [openResult, todayResult, weekResult, recentResult, timerResult] = await Promise.all([
    supabase
      .from("attendance_sessions")
      .select(SESSION_SELECT)
      .eq("user_id", userId)
      .is("clock_out_at", null)
      .order("clock_in_at", { ascending: false })
      .limit(1),

    supabase
      .from("attendance_sessions")
      .select(SESSION_SELECT)
      .eq("user_id", userId)
      .gte("clock_in_at", day.fromIso)
      .lt("clock_in_at", day.toIso),

    supabase
      .from("attendance_sessions")
      .select(SESSION_SELECT)
      .eq("user_id", userId)
      .gte("clock_in_at", week.fromIso)
      .lt("clock_in_at", week.toIso),

    supabase
      .from("attendance_sessions")
      .select(SESSION_SELECT)
      .eq("user_id", userId)
      .order("clock_in_at", { ascending: false })
      .limit(10),

    supabase
      .from("task_time_entries")
      .select("*, task:tasks(id, title)")
      .eq("user_id", userId)
      .is("ended_at", null)
      .limit(1),
  ]);

  for (const result of [openResult, todayResult, weekResult, recentResult, timerResult]) {
    throwIfReadFailed(result.error);
  }

  const openSession = (openResult.data?.[0] as SessionWithBreaks | undefined) ?? null;
  const openBreak = openSession?.breaks.find((entry) => entry.ended_at === null) ?? null;
  const runningTimer = (timerResult.data?.[0] as RunningTaskTimer | undefined) ?? null;

  return {
    state: resolveAttendanceState({ session: openSession, openBreak }),
    openSession,
    openBreak,
    runningTimer,
    today: sumSessionTotals((todayResult.data ?? []) as SessionWithBreaks[], now),
    week: sumSessionTotals((weekResult.data ?? []) as SessionWithBreaks[], now),
    recent: (recentResult.data ?? []) as SessionWithBreaks[],
  };
}

/** Totals for one person across an arbitrary window, for reports. */
export async function getAttendanceTotals(
  supabase: SupabaseClient<Database>,
  userId: string,
  fromIso: string,
  toIso: string,
  now: Date = new Date(),
): Promise<AggregateTotals> {
  const { data, error } = await supabase
    .from("attendance_sessions")
    .select(SESSION_SELECT)
    .eq("user_id", userId)
    .gte("clock_in_at", fromIso)
    .lt("clock_in_at", toIso);
  throwIfReadFailed(error);

  return sumSessionTotals((data ?? []) as SessionWithBreaks[], now);
}

export type LiveStatusEntry = {
  session: SessionWithBreaks;
  profile: { id: string; full_name: string | null; email: string } | null;
  state: AttendanceState;
  totals: ReturnType<typeof calculateSessionTotals>;
};

/**
 * Who is currently clocked in, across everyone the caller may see.
 *
 * The query asks for every open session; row level security returns only the
 * authorised subset. There is no client-side filtering here by design.
 */
export async function getLiveTeamStatus(
  supabase: SupabaseClient<Database>,
  now: Date = new Date(),
): Promise<LiveStatusEntry[]> {
  const { data, error } = await supabase
    .from("attendance_sessions")
    .select("*, breaks(*), profile:profiles!attendance_sessions_user_id_fkey(id, full_name, email)")
    .is("clock_out_at", null)
    .order("clock_in_at", { ascending: true });
  throwIfReadFailed(error);

  type LiveRow = SessionWithBreaks & {
    profile: { id: string; full_name: string | null; email: string } | null;
  };

  return ((data ?? []) as LiveRow[]).map((session) => {
    const openBreak = session.breaks.find((entry) => entry.ended_at === null) ?? null;
    return {
      session,
      profile: session.profile,
      state: resolveAttendanceState({ session, openBreak }),
      totals: calculateSessionTotals(session, session.breaks, now),
    };
  });
}

/** Sessions for a window across everyone the caller may see. */
export async function getSessionsInRange(
  supabase: SupabaseClient<Database>,
  fromIso: string,
  toIso: string,
): Promise<SessionWithBreaks[]> {
  const { data } = await supabase
    .from("attendance_sessions")
    .select(SESSION_SELECT)
    .gte("clock_in_at", fromIso)
    .lt("clock_in_at", toIso)
    .order("clock_in_at", { ascending: false })
    .limit(1000);

  return (data ?? []) as SessionWithBreaks[];
}
