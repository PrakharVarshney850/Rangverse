import type { Metadata } from "next";

import { EmptyState } from "@/components/common/empty-state";
import { PageHeader } from "@/components/common/page-header";
import { SectionCard } from "@/components/common/section-card";
import { StatusPill } from "@/components/common/status-pill";
import { TimeTrackerPanel } from "@/components/time/time-tracker-panel";
import { requireUser } from "@/lib/auth/guards";
import { getTimeTrackerSnapshot } from "@/lib/data/attendance";
import { getTaskTimeEntries } from "@/lib/data/tasks";
import {
  calculateSessionTotals,
  crossesBusinessMidnight,
  detectAnomalies,
  formatBusinessDate,
  formatBusinessTime,
  formatDuration,
  intervalDurationMs,
} from "@/lib/domain/time";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Time tracker" };

export default async function TimePage() {
  const session = await requireUser();
  const supabase = await createClient();

  const [snapshot, timeEntries] = await Promise.all([
    getTimeTrackerSnapshot(supabase, session.id),
    getTaskTimeEntries(supabase, { userId: session.id, limit: 25 }),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Attendance"
        title="Time tracker"
        description="Clock in, take breaks and track time against tasks. Every timestamp is recorded by the server in UTC and shown here in India Standard Time."
      />

      <TimeTrackerPanel snapshot={snapshot} />

      <div className="grid gap-5 lg:grid-cols-2">
        <SectionCard
          title="Recent attendance"
          description="Working time is the session length minus recorded breaks."
        >
          {snapshot.recent.length === 0 ? (
            <EmptyState
              title="No attendance recorded yet"
              description="Your first clock-in will appear here."
            />
          ) : (
            <ul className="space-y-3">
              {snapshot.recent.map((item) => {
                const totals = calculateSessionTotals(item, item.breaks);
                const anomalies = detectAnomalies(item, item.breaks);

                return (
                  <li
                    key={item.id}
                    className="border-border/60 flex flex-wrap items-center justify-between gap-3 border-b pb-3 last:border-b-0 last:pb-0"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium">
                        {formatBusinessDate(item.clock_in_at)}
                        {crossesBusinessMidnight(item) && (
                          <span className="text-muted-foreground ml-2 text-xs">
                            → {formatBusinessDate(item.clock_out_at ?? item.clock_in_at)}
                          </span>
                        )}
                      </p>
                      <p className="text-muted-foreground mt-0.5 text-xs">
                        {formatBusinessTime(item.clock_in_at)} –{" "}
                        {item.clock_out_at ? formatBusinessTime(item.clock_out_at) : "in progress"}
                        {totals.breakMs > 0 && ` · ${formatDuration(totals.breakMs)} break`}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      {anomalies.needsReview && <StatusPill tone="danger">Needs review</StatusPill>}
                      <span className="font-heading text-sm tabular-nums">
                        {totals.inProgress ? "In progress" : formatDuration(totals.netWorkMs)}
                      </span>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </SectionCard>

        <SectionCard
          title="Task time history"
          description="Time attributed to individual tasks. Completed entries cannot be edited — corrections are a Version 2 workflow."
        >
          {timeEntries.length === 0 ? (
            <EmptyState
              title="No task time yet"
              description="Open a task and start its timer to record time against it."
            />
          ) : (
            <ul className="space-y-3">
              {timeEntries.map((entry) => (
                <li
                  key={entry.id}
                  className="border-border/60 flex flex-wrap items-center justify-between gap-3 border-b pb-3 last:border-b-0 last:pb-0"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      {entry.task?.title ?? "Removed task"}
                    </p>
                    <p className="text-muted-foreground mt-0.5 text-xs">
                      {formatBusinessDate(entry.started_at)} ·{" "}
                      {formatBusinessTime(entry.started_at)} –{" "}
                      {entry.ended_at ? formatBusinessTime(entry.ended_at) : "running"}
                    </p>
                  </div>
                  <span className="font-heading text-sm tabular-nums">
                    {entry.ended_at
                      ? formatDuration(
                          intervalDurationMs({ start: entry.started_at, end: entry.ended_at }),
                        )
                      : "In progress"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      </div>
    </div>
  );
}
