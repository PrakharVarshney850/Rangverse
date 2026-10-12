import { TZDate } from "@date-fns/tz";
import { differenceInCalendarDays, format, startOfWeek } from "date-fns";

/**
 * Attendance and task-time calculations.
 *
 * Rules this module exists to guarantee (see docs/architecture.md):
 *   * every timestamp is stored in UTC and only *displayed* in business time;
 *   * net working time = attendance elapsed − completed break time;
 *   * a session that crosses midnight is one continuous interval, never two;
 *   * an open interval is "in progress" and is never presented as a final total;
 *   * task-timer time is reported against tasks and is NEVER added to
 *     attendance totals — doing so would double-count the same minutes.
 *
 * Everything here is pure, so it is exhaustively unit tested.
 */

export const BUSINESS_TIME_ZONE = "Asia/Kolkata";

export interface Interval {
  start: string | Date;
  end?: string | Date | null;
}

export interface AttendanceSessionLike {
  clock_in_at: string;
  clock_out_at: string | null;
}

export interface BreakLike {
  started_at: string;
  ended_at: string | null;
}

export interface SessionTotals {
  /** Wall-clock milliseconds between clock-in and clock-out (or now). */
  attendanceMs: number;
  /** Milliseconds of completed breaks only. */
  breakMs: number;
  /** attendanceMs − breakMs, never negative. */
  netWorkMs: number;
  /** True while the session (or a break inside it) is still running. */
  inProgress: boolean;
}

export class InvalidIntervalError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidIntervalError";
  }
}

function toTime(value: string | Date): number {
  const time = value instanceof Date ? value.getTime() : Date.parse(value);
  if (Number.isNaN(time)) {
    throw new InvalidIntervalError(`Not a valid timestamp: ${String(value)}`);
  }
  return time;
}

/**
 * Duration of an interval in milliseconds. An open interval is measured to
 * `now`, which the caller supplies so results stay deterministic in tests.
 */
export function intervalDurationMs(interval: Interval, now: Date = new Date()): number {
  const start = toTime(interval.start);
  const end = interval.end === null || interval.end === undefined ? now.getTime() : toTime(interval.end);

  if (end < start) {
    throw new InvalidIntervalError("An interval cannot end before it starts.");
  }

  return end - start;
}

/**
 * Total milliseconds of *completed* breaks. An open break is excluded from the
 * deducted total but is reflected by `inProgress`, so an in-flight break never
 * silently inflates or deflates a finished number.
 */
export function completedBreakMs(breaks: readonly BreakLike[], now: Date = new Date()): number {
  return breaks.reduce((total, entry) => {
    if (!entry.ended_at) {
      return total;
    }
    return total + intervalDurationMs({ start: entry.started_at, end: entry.ended_at }, now);
  }, 0);
}

/**
 * Milliseconds of break time including a break that is still running. Used for
 * the live "on break" display, never for a completed session's final total.
 */
export function elapsedBreakMs(breaks: readonly BreakLike[], now: Date = new Date()): number {
  return breaks.reduce(
    (total, entry) => total + intervalDurationMs({ start: entry.started_at, end: entry.ended_at }, now),
    0,
  );
}

/**
 * Totals for a single attendance session.
 *
 * Works unchanged for sessions that cross midnight because the maths is pure
 * interval subtraction on absolute instants — no calendar-day arithmetic.
 */
export function calculateSessionTotals(
  session: AttendanceSessionLike,
  breaks: readonly BreakLike[] = [],
  now: Date = new Date(),
): SessionTotals {
  const attendanceMs = intervalDurationMs(
    { start: session.clock_in_at, end: session.clock_out_at },
    now,
  );

  const sessionIsOpen = session.clock_out_at === null;
  const hasOpenBreak = breaks.some((entry) => entry.ended_at === null);

  // A running break is counted live so the "working time" display stops
  // advancing the moment someone goes on break.
  const breakMs = sessionIsOpen
    ? elapsedBreakMs(breaks, now)
    : completedBreakMs(breaks, now);

  return {
    attendanceMs,
    breakMs,
    netWorkMs: Math.max(0, attendanceMs - breakMs),
    inProgress: sessionIsOpen || hasOpenBreak,
  };
}

export interface SessionWithBreaks extends AttendanceSessionLike {
  id: string;
  breaks?: readonly BreakLike[];
}

export interface AggregateTotals extends SessionTotals {
  sessionCount: number;
}

/** Sums several sessions. Open sessions make the aggregate `inProgress`. */
export function sumSessionTotals(
  sessions: readonly SessionWithBreaks[],
  now: Date = new Date(),
): AggregateTotals {
  return sessions.reduce<AggregateTotals>(
    (total, session) => {
      const result = calculateSessionTotals(session, session.breaks ?? [], now);
      return {
        attendanceMs: total.attendanceMs + result.attendanceMs,
        breakMs: total.breakMs + result.breakMs,
        netWorkMs: total.netWorkMs + result.netWorkMs,
        inProgress: total.inProgress || result.inProgress,
        sessionCount: total.sessionCount + 1,
      };
    },
    { attendanceMs: 0, breakMs: 0, netWorkMs: 0, inProgress: false, sessionCount: 0 },
  );
}

/**
 * Total milliseconds tracked against tasks. Reported against tasks only —
 * callers must never add this to an attendance total.
 */
export function sumTaskTime(
  entries: readonly Interval[],
  now: Date = new Date(),
): { totalMs: number; inProgress: boolean } {
  let totalMs = 0;
  let inProgress = false;

  for (const entry of entries) {
    totalMs += intervalDurationMs(entry, now);
    if (entry.end === null || entry.end === undefined) {
      inProgress = true;
    }
  }

  return { totalMs, inProgress };
}

// ---------------------------------------------------------------------------
// Attendance state machine
// ---------------------------------------------------------------------------

export type AttendanceState =
  | "NOT_CLOCKED_IN"
  | "WORKING"
  | "ON_BREAK"
  | "CLOCKED_OUT"
  | "NEEDS_REVIEW";

export const ATTENDANCE_STATE_LABELS: Record<AttendanceState, string> = {
  NOT_CLOCKED_IN: "Not clocked in",
  WORKING: "Working",
  ON_BREAK: "On break",
  CLOCKED_OUT: "Clocked out",
  NEEDS_REVIEW: "Needs review",
};

export interface AttendanceSnapshot {
  session: (AttendanceSessionLike & { id: string; needs_review?: boolean }) | null;
  openBreak: BreakLike | null;
}

export function resolveAttendanceState(snapshot: AttendanceSnapshot): AttendanceState {
  const { session, openBreak } = snapshot;

  if (!session) {
    return "NOT_CLOCKED_IN";
  }

  if (session.needs_review) {
    return "NEEDS_REVIEW";
  }

  if (session.clock_out_at !== null) {
    return "CLOCKED_OUT";
  }

  return openBreak ? "ON_BREAK" : "WORKING";
}

export type AttendanceAction =
  | "CLOCK_IN"
  | "CLOCK_OUT"
  | "START_BREAK"
  | "END_BREAK"
  | "START_TASK_TIMER"
  | "STOP_TASK_TIMER";

/**
 * Whether a transition is legal from the current state. The database enforces
 * the same rules; this mirror lets the interface disable impossible actions
 * instead of letting someone discover the error after a round trip.
 */
export function canPerform(
  state: AttendanceState,
  action: AttendanceAction,
  options: { hasRunningTaskTimer?: boolean } = {},
): boolean {
  const { hasRunningTaskTimer = false } = options;

  switch (action) {
    case "CLOCK_IN":
      return state === "NOT_CLOCKED_IN" || state === "CLOCKED_OUT";
    case "CLOCK_OUT":
      return state === "WORKING" || state === "ON_BREAK";
    case "START_BREAK":
      return state === "WORKING";
    case "END_BREAK":
      return state === "ON_BREAK";
    case "START_TASK_TIMER":
      return state === "WORKING";
    case "STOP_TASK_TIMER":
      return hasRunningTaskTimer && (state === "WORKING" || state === "ON_BREAK");
    default:
      return false;
  }
}

// ---------------------------------------------------------------------------
// Anomaly detection
// ---------------------------------------------------------------------------

/** A session left open longer than this is surfaced for administrator review. */
export const LONG_SESSION_THRESHOLD_MS = 16 * 60 * 60 * 1000;

export type AttendanceAnomaly =
  | "OPEN_TOO_LONG"
  | "NEGATIVE_DURATION"
  | "BREAK_OUTSIDE_SESSION"
  | "BREAK_EXCEEDS_SESSION"
  | "FLAGGED_FOR_REVIEW";

export interface AnomalyReport {
  anomalies: AttendanceAnomaly[];
  needsReview: boolean;
}

/**
 * Flags a session for human review. Deliberately never alters or deletes
 * recorded time — it only reports.
 */
export function detectAnomalies(
  session: AttendanceSessionLike & { needs_review?: boolean },
  breaks: readonly BreakLike[] = [],
  now: Date = new Date(),
): AnomalyReport {
  const anomalies: AttendanceAnomaly[] = [];
  const clockIn = toTime(session.clock_in_at);
  const clockOut = session.clock_out_at ? toTime(session.clock_out_at) : null;

  if (session.needs_review) {
    anomalies.push("FLAGGED_FOR_REVIEW");
  }

  if (clockOut !== null && clockOut < clockIn) {
    anomalies.push("NEGATIVE_DURATION");
  }

  const elapsed = (clockOut ?? now.getTime()) - clockIn;
  if (clockOut === null && elapsed > LONG_SESSION_THRESHOLD_MS) {
    anomalies.push("OPEN_TOO_LONG");
  }

  for (const entry of breaks) {
    const breakStart = toTime(entry.started_at);
    const breakEnd = entry.ended_at ? toTime(entry.ended_at) : null;

    if (breakStart < clockIn || (clockOut !== null && breakEnd !== null && breakEnd > clockOut)) {
      anomalies.push("BREAK_OUTSIDE_SESSION");
      break;
    }
  }

  if (elapsed > 0 && completedBreakMs(breaks, now) > elapsed) {
    anomalies.push("BREAK_EXCEEDS_SESSION");
  }

  return { anomalies, needsReview: anomalies.length > 0 };
}

// ---------------------------------------------------------------------------
// Formatting and business-time helpers
// ---------------------------------------------------------------------------

/** `7h 42m`, or `0m` for nothing. Used wherever a duration is displayed. */
export function formatDuration(ms: number): string {
  const safe = Math.max(0, Math.round(ms));
  const totalMinutes = Math.floor(safe / 60_000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours === 0) {
    return `${minutes}m`;
  }
  return `${hours}h ${minutes}m`;
}

/** `07:42:19`, for the live ticking timer. */
export function formatClock(ms: number): string {
  const safe = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const seconds = safe % 60;
  return [hours, minutes, seconds].map((part) => String(part).padStart(2, "0")).join(":");
}

/** Decimal hours, rounded to two places, for reporting tables. */
export function toDecimalHours(ms: number): number {
  return Math.round((Math.max(0, ms) / 3_600_000) * 100) / 100;
}

/** The instant rendered in Rangmanch's business time zone. */
export function toBusinessTime(value: string | Date): TZDate {
  const date = value instanceof Date ? value : new Date(value);
  return new TZDate(date, BUSINESS_TIME_ZONE);
}

export function formatBusinessTime(value: string | Date, pattern = "HH:mm"): string {
  return format(toBusinessTime(value), pattern);
}

export function formatBusinessDate(value: string | Date, pattern = "d MMM yyyy"): string {
  return format(toBusinessTime(value), pattern);
}

/** `YYYY-MM-DD` for the given instant in business time. */
export function businessDateKey(value: string | Date = new Date()): string {
  return format(toBusinessTime(value), "yyyy-MM-dd");
}

/**
 * True when the session begins and ends on different business-time calendar
 * days. Used only for presentation — never for duration maths.
 */
export function crossesBusinessMidnight(session: AttendanceSessionLike): boolean {
  if (!session.clock_out_at) {
    return false;
  }
  return (
    differenceInCalendarDays(
      toBusinessTime(session.clock_out_at),
      toBusinessTime(session.clock_in_at),
    ) > 0
  );
}

/** UTC instants bounding a business-time calendar day, as ISO strings. */
function parseBusinessDateKey(dateKey: string): [number, number, number] {
  const [yearText, monthText, dayText] = dateKey.split("-");
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);

  if ([year, month, day].some((part) => Number.isNaN(part))) {
    throw new InvalidIntervalError(`Invalid business date key: ${dateKey}`);
  }

  return [year, month, day];
}

export function businessDayRange(dateKey: string): { fromIso: string; toIso: string } {
  const [year, month, day] = parseBusinessDateKey(dateKey);
  const from = new TZDate(year, month - 1, day, 0, 0, 0, BUSINESS_TIME_ZONE);
  const to = new TZDate(year, month - 1, day + 1, 0, 0, 0, BUSINESS_TIME_ZONE);
  return { fromIso: new Date(from).toISOString(), toIso: new Date(to).toISOString() };
}

/** UTC instants bounding the business week (Monday start) containing `value`. */
export function businessWeekRange(value: string | Date = new Date()): {
  fromIso: string;
  toIso: string;
} {
  const weekStart = startOfWeek(toBusinessTime(value), { weekStartsOn: 1 });
  const startKey = format(weekStart, "yyyy-MM-dd");
  const [year, month, day] = parseBusinessDateKey(startKey);
  const from = new TZDate(year, month - 1, day, 0, 0, 0, BUSINESS_TIME_ZONE);
  const to = new TZDate(year, month - 1, day + 7, 0, 0, 0, BUSINESS_TIME_ZONE);
  return { fromIso: new Date(from).toISOString(), toIso: new Date(to).toISOString() };
}
