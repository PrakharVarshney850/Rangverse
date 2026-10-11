import type { Metadata } from "next";
import Link from "next/link";

import { EmptyState } from "@/components/common/empty-state";
import { MetricCard } from "@/components/common/metric-card";
import { PageHeader } from "@/components/common/page-header";
import { SectionCard } from "@/components/common/section-card";
import { StatusPill } from "@/components/common/status-pill";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { requirePermission } from "@/lib/auth/guards";
import { getSessionsInRange } from "@/lib/data/attendance";
import { displayName, listVisiblePeople } from "@/lib/data/people";
import { getTaskStatusCounts } from "@/lib/data/tasks";
import {
  businessDateKey,
  businessDayRange,
  formatDuration,
  sumSessionTotals,
  toDecimalHours,
} from "@/lib/domain/time";
import { createClient } from "@/lib/supabase/server";
import { TASK_STATUS_LABELS } from "@/lib/validation/task";

export const metadata: Metadata = { title: "Reports" };

const RANGES = [
  { value: "7", label: "Last 7 days" },
  { value: "14", label: "Last 14 days" },
  { value: "30", label: "Last 30 days" },
  { value: "90", label: "Last 90 days" },
] as const;

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requirePermission("analytics.viewTeam");
  const supabase = await createClient();
  const params = await searchParams;

  const rangeDays = Number.parseInt(typeof params.days === "string" ? params.days : "30", 10);
  const days = RANGES.some((range) => Number(range.value) === rangeDays) ? rangeDays : 30;

  const to = new Date();
  const from = new Date(to);
  from.setDate(from.getDate() - (days - 1));

  const fromRange = businessDayRange(businessDateKey(from));
  const toRange = businessDayRange(businessDateKey(to));

  const [sessions, people, taskCounts] = await Promise.all([
    getSessionsInRange(supabase, fromRange.fromIso, toRange.toIso),
    listVisiblePeople(supabase),
    getTaskStatusCounts(supabase),
  ]);

  const totals = sumSessionTotals(sessions);

  const perPerson = new Map<string, { netMs: number; attendanceMs: number; sessions: number }>();
  for (const item of sessions) {
    const result = sumSessionTotals([item]);
    const current = perPerson.get(item.user_id) ?? { netMs: 0, attendanceMs: 0, sessions: 0 };
    perPerson.set(item.user_id, {
      netMs: current.netMs + result.netWorkMs,
      attendanceMs: current.attendanceMs + result.attendanceMs,
      sessions: current.sessions + 1,
    });
  }

  const rows = [...perPerson.entries()]
    .map(([userId, value]) => ({
      userId,
      person: people.find((candidate) => candidate.id === userId) ?? null,
      ...value,
    }))
    .sort((a, b) => b.netMs - a.netMs);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Reports"
        title="Hours and delivery"
        description={`Figures cover the last ${days} days of business time (Asia/Kolkata) and include only the people you are authorised to see.`}
        actions={
          <div className="flex flex-wrap gap-2">
            {RANGES.map((range) => (
              <Link
                key={range.value}
                href={`/reports?days=${range.value}`}
                aria-current={Number(range.value) === days ? "true" : undefined}
                className={
                  Number(range.value) === days
                    ? "border-gold/40 bg-gold/12 text-gold rounded-full border px-3 py-1.5 text-xs font-medium"
                    : "border-border text-muted-foreground hover:text-foreground rounded-full border px-3 py-1.5 text-xs"
                }
              >
                {range.label}
              </Link>
            ))}
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="Net working hours"
          value={formatDuration(totals.netWorkMs)}
          hint="Attendance minus recorded breaks"
        />
        <MetricCard
          label="Attendance hours"
          value={formatDuration(totals.attendanceMs)}
          hint="Clock-in to clock-out, breaks included"
        />
        <MetricCard
          label="Sessions"
          value={totals.sessionCount}
          hint={totals.inProgress ? "Includes a session still running" : "All completed"}
        />
        <MetricCard
          label="Tasks completed"
          value={taskCounts.DONE}
          hint={`${taskCounts.total} tasks visible to you`}
        />
      </div>

      <SectionCard
        title="Hours by person"
        description="Net working time is the session length minus completed breaks. Task-timer minutes are reported against tasks and are deliberately not added here."
        bodyClassName="p-0"
      >
        {rows.length === 0 ? (
          <EmptyState
            title="No attendance in this period"
            description="Pick a wider range, or wait for the first clock-in."
            className="border-0"
          />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Person</TableHead>
                  <TableHead className="text-right">Sessions</TableHead>
                  <TableHead className="text-right">Attendance</TableHead>
                  <TableHead className="text-right">Net working</TableHead>
                  <TableHead className="text-right">Decimal hours</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.userId}>
                    <TableCell className="font-medium">{displayName(row.person)}</TableCell>
                    <TableCell className="text-right tabular-nums">{row.sessions}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatDuration(row.attendanceMs)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatDuration(row.netMs)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {toDecimalHours(row.netMs).toFixed(2)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </SectionCard>

      <SectionCard title="Tasks by status" description="Across everything you are authorised to see.">
        <div className="flex flex-wrap gap-3">
          {(["TO_DO", "IN_PROGRESS", "IN_REVIEW", "DONE"] as const).map((status) => (
            <div
              key={status}
              className="border-border/60 min-w-[9rem] flex-1 rounded-lg border px-4 py-3"
            >
              <StatusPill tone={status === "DONE" ? "working" : "info"}>
                {TASK_STATUS_LABELS[status]}
              </StatusPill>
              <p className="font-heading mt-2.5 text-xl font-bold tabular-nums">
                {taskCounts[status]}
              </p>
            </div>
          ))}
          <div className="border-status-danger/25 min-w-[9rem] flex-1 rounded-lg border px-4 py-3">
            <StatusPill tone="danger">Overdue</StatusPill>
            <p className="font-heading mt-2.5 text-xl font-bold tabular-nums">
              {taskCounts.overdue}
            </p>
          </div>
        </div>
      </SectionCard>
    </div>
  );
}
