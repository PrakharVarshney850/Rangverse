"use client";

import { useState, useTransition } from "react";
import {
  CoffeeIcon,
  LoaderCircleIcon,
  LogInIcon,
  LogOutIcon,
  PlayIcon,
  SquareIcon,
  TimerIcon,
} from "lucide-react";
import { toast } from "sonner";

import { StatusPill, type StatusTone } from "@/components/common/status-pill";
import { useLiveDuration } from "@/components/common/use-live-duration";
import { Button } from "@/components/ui/button";
import {
  clockInAction,
  clockOutAction,
  endBreakAction,
  startBreakAction,
  stopTaskTimerAction,
  type TimeActionResult,
} from "@/lib/actions/time";
import {
  ATTENDANCE_STATE_LABELS,
  canPerform,
  formatBusinessTime,
  formatClock,
  formatDuration,
  type AttendanceState,
} from "@/lib/domain/time";
import { cn } from "@/lib/utils";
import type { TimeTrackerSnapshot } from "@/lib/view-models";

const STATE_TONE: Record<AttendanceState, StatusTone> = {
  NOT_CLOCKED_IN: "idle",
  WORKING: "working",
  ON_BREAK: "break",
  CLOCKED_OUT: "idle",
  NEEDS_REVIEW: "danger",
};

export function TimeTrackerPanel({
  snapshot,
  compact = false,
}: {
  snapshot: TimeTrackerSnapshot;
  compact?: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [busyAction, setBusyAction] = useState<string | null>(null);

  const { state, openSession, openBreak, runningTimer, today, week } = snapshot;

  // The open session is measured live, so its stored contribution is removed
  // from today's total first — the same minutes are never counted twice.
  const closedTodayMs = openSession
    ? Math.max(0, today.netWorkMs - openSessionNetMs(snapshot))
    : today.netWorkMs;

  const liveWorkMs = useLiveDuration(
    state === "WORKING" ? (openSession?.clock_in_at ?? null) : null,
    state === "WORKING" ? closedTodayMs - completedBreaksInOpenSession(snapshot) : today.netWorkMs,
    state === "WORKING",
  );

  const liveBreakMs = useLiveDuration(openBreak?.started_at ?? null, 0, state === "ON_BREAK");

  const liveTimerMs = useLiveDuration(runningTimer?.started_at ?? null, 0, Boolean(runningTimer));

  function run(label: string, action: () => Promise<TimeActionResult>) {
    setBusyAction(label);
    startTransition(async () => {
      try {
        const result = await action();
        if (result.ok) {
          toast.success(result.message);
        } else {
          toast.error(result.message);
        }
      } catch {
        toast.error("That did not go through. Check your connection and try again.");
      } finally {
        setBusyAction(null);
      }
    });
  }

  const busy = (label: string) => pending && busyAction === label;

  return (
    <section
      aria-label="Time tracker"
      className={cn(
        "bg-card border-border/70 overflow-hidden rounded-xl border",
        state === "WORKING" && "border-status-working/25",
        state === "ON_BREAK" && "border-status-break/25",
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-4 p-5 sm:p-6">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <StatusPill
              tone={STATE_TONE[state]}
              pulse={state === "WORKING" || state === "ON_BREAK"}
            >
              {ATTENDANCE_STATE_LABELS[state]}
            </StatusPill>
            {openSession && (
              <span className="text-muted-foreground text-xs">
                Since {formatBusinessTime(openSession.clock_in_at)} IST
              </span>
            )}
          </div>

          <p
            className="font-heading mt-4 text-4xl font-bold tabular-nums sm:text-5xl"
            aria-live="polite"
            aria-atomic="true"
          >
            {formatClock(state === "ON_BREAK" ? liveBreakMs : liveWorkMs)}
          </p>
          <p className="text-muted-foreground mt-1.5 text-xs">
            {state === "ON_BREAK"
              ? "On break — working time is paused"
              : state === "WORKING"
                ? "Net working time today, breaks already deducted"
                : "Net working time today"}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {canPerform(state, "CLOCK_IN") && (
            <Button
              variant="brand"
              size="xl"
              onClick={() => run("in", clockInAction)}
              disabled={pending}
            >
              {busy("in") ? (
                <LoaderCircleIcon className="animate-spin" aria-hidden />
              ) : (
                <LogInIcon aria-hidden />
              )}
              Clock in
            </Button>
          )}

          {canPerform(state, "START_BREAK") && (
            <Button
              variant="outline"
              size="xl"
              onClick={() => run("break", startBreakAction)}
              disabled={pending}
            >
              {busy("break") ? (
                <LoaderCircleIcon className="animate-spin" aria-hidden />
              ) : (
                <CoffeeIcon aria-hidden />
              )}
              Start break
            </Button>
          )}

          {canPerform(state, "END_BREAK") && (
            <Button
              variant="brand"
              size="xl"
              onClick={() => run("endbreak", endBreakAction)}
              disabled={pending}
            >
              {busy("endbreak") ? (
                <LoaderCircleIcon className="animate-spin" aria-hidden />
              ) : (
                <PlayIcon aria-hidden />
              )}
              End break
            </Button>
          )}

          {canPerform(state, "CLOCK_OUT") && (
            <Button
              variant="outline"
              size="xl"
              onClick={() => run("out", clockOutAction)}
              disabled={pending}
            >
              {busy("out") ? (
                <LoaderCircleIcon className="animate-spin" aria-hidden />
              ) : (
                <LogOutIcon aria-hidden />
              )}
              Clock out
            </Button>
          )}
        </div>
      </div>

      {runningTimer && (
        <div className="border-border/60 bg-surface-raised/50 flex flex-wrap items-center justify-between gap-3 border-t px-5 py-3.5 sm:px-6">
          <div className="flex min-w-0 items-center gap-2.5">
            <TimerIcon className="text-gold size-4 shrink-0" aria-hidden />
            <span className="min-w-0 text-sm">
              <span className="text-muted-foreground">Tracking </span>
              <span className="font-medium">{runningTimer.task?.title ?? "a task"}</span>
            </span>
            <span className="font-heading text-gold text-sm tabular-nums">
              {formatClock(liveTimerMs)}
            </span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => run("timer", stopTaskTimerAction)}
            disabled={pending}
          >
            {busy("timer") ? (
              <LoaderCircleIcon className="animate-spin" aria-hidden />
            ) : (
              <SquareIcon aria-hidden />
            )}
            Stop timer
          </Button>
        </div>
      )}

      {!compact && (
        <dl className="border-border/60 bg-border/40 grid grid-cols-2 gap-px border-t sm:grid-cols-4">
          <Stat label="Today" value={formatDuration(liveWorkMs)} hint="Net of breaks" />
          <Stat
            label="Breaks today"
            value={formatDuration(today.breakMs + (state === "ON_BREAK" ? liveBreakMs : 0))}
            hint={`${today.sessionCount} session${today.sessionCount === 1 ? "" : "s"}`}
          />
          <Stat
            label="This week"
            value={formatDuration(week.netWorkMs)}
            hint={week.inProgress ? "In progress" : "Completed"}
          />
          <Stat
            label="Attendance today"
            value={formatDuration(today.attendanceMs)}
            hint="Clock-in to clock-out"
          />
        </dl>
      )}
    </section>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="bg-card px-5 py-4">
      <dt className="text-muted-foreground text-[0.65rem] font-medium tracking-[0.14em] uppercase">
        {label}
      </dt>
      <dd className="font-heading mt-1.5 text-lg font-bold tabular-nums">{value}</dd>
      <p className="text-muted-foreground mt-0.5 text-[0.7rem]">{hint}</p>
    </div>
  );
}

/** Net milliseconds the still-open session has contributed to today's total. */
function openSessionNetMs(snapshot: TimeTrackerSnapshot): number {
  const { openSession } = snapshot;
  if (!openSession) return 0;

  const started = Date.parse(openSession.clock_in_at);
  if (Number.isNaN(started)) return 0;

  const breakMs = openSession.breaks.reduce((total, entry) => {
    const from = Date.parse(entry.started_at);
    const to = entry.ended_at ? Date.parse(entry.ended_at) : Date.now();
    return total + Math.max(0, to - from);
  }, 0);

  return Math.max(0, Date.now() - started - breakMs);
}

/** Completed break time inside the open session, deducted from the live clock. */
function completedBreaksInOpenSession(snapshot: TimeTrackerSnapshot): number {
  const { openSession } = snapshot;
  if (!openSession) return 0;

  return openSession.breaks.reduce((total, entry) => {
    if (!entry.ended_at) return total;
    const from = Date.parse(entry.started_at);
    const to = Date.parse(entry.ended_at);
    return total + Math.max(0, to - from);
  }, 0);
}
