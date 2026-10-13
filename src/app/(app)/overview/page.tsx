import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRightIcon,
  CalendarClockIcon,
  CircleCheckIcon,
  ClockIcon,
  DatabaseIcon,
  FileTextIcon,
  TriangleAlertIcon,
  UsersIcon,
} from "lucide-react";

import { EmptyState } from "@/components/common/empty-state";
import { MetricCard } from "@/components/common/metric-card";
import { PageHeader } from "@/components/common/page-header";
import { SectionCard } from "@/components/common/section-card";
import { StatusPill } from "@/components/common/status-pill";
import { TaskRowItem } from "@/components/tasks/task-list";
import { TimeTrackerPanel } from "@/components/time/time-tracker-panel";
import { Button } from "@/components/ui/button";
import { requireUser } from "@/lib/auth/guards";
import { can } from "@/lib/auth/permissions";
import { getLiveTeamStatus, getTimeTrackerSnapshot } from "@/lib/data/attendance";
import { displayName, getPeopleCounts } from "@/lib/data/people";
import { findMissingReports, listMyReports, listTeamReports } from "@/lib/data/reports";
import { listSheets } from "@/lib/data/sheets";
import { getOpenTasksForUser, getTaskStatusCounts } from "@/lib/data/tasks";
import {
  ATTENDANCE_STATE_LABELS,
  businessDateKey,
  formatBusinessDate,
  formatDuration,
} from "@/lib/domain/time";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Overview" };

export default async function OverviewPage() {
  const session = await requireUser();
  const supabase = await createClient();

  const firstName = session.profile.full_name?.trim().split(/\s+/)[0] ?? "there";
  const profileIncomplete =
    session.profile.onboarding_status === "INVITED" ||
    session.profile.onboarding_status === "PROFILE_INCOMPLETE" ||
    !session.profile.full_name;

  const isPrivileged = can(session.actor, "attendance.viewTeam");
  const todayKey = businessDateKey();

  const [snapshot, myTasks, mySheets, myReports, live, taskCounts, missing, teamReports, peopleCounts] =
    await Promise.all([
      getTimeTrackerSnapshot(supabase, session.id),
      getOpenTasksForUser(supabase, session.id, 5),
      listSheets(supabase),
      listMyReports(supabase, session.id, 5),
      isPrivileged ? getLiveTeamStatus(supabase) : Promise.resolve([]),
      isPrivileged ? getTaskStatusCounts(supabase) : Promise.resolve({
        TO_DO: 0,
        IN_PROGRESS: 0,
        IN_REVIEW: 0,
        DONE: 0,
        overdue: 0,
        dueToday: 0,
        total: 0,
      }),
      isPrivileged ? findMissingReports(supabase, todayKey) : Promise.resolve([]),
      isPrivileged ? listTeamReports(supabase, { fromDate: todayKey, limit: 8 }) : Promise.resolve([]),
      session.actor.role === "ADMIN" && isPrivileged ? getPeopleCounts(supabase) : Promise.resolve(null),
    ]);

  const submittedToday = myReports.some(
    (report) => report.report_date === todayKey && report.status === "SUBMITTED",
  );

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={formatBusinessDate(new Date())}
        title={`Good to see you, ${firstName}`}
        description={
          isPrivileged
            ? "Your day, and what your team is doing right now."
            : "Your day at a glance. Clock in to start the clock, and keep your tasks moving."
        }
        actions={
          <Button asChild variant="outline" size="lg">
            <Link href="/daily-reports">
              <FileTextIcon aria-hidden />
              Today&apos;s report
            </Link>
          </Button>
        }
      />

      {profileIncomplete && (
        <div
          role="status"
          className="border-gold/30 bg-gold/8 flex flex-wrap items-center justify-between gap-3 rounded-xl border px-5 py-4"
        >
          <div className="min-w-0">
            <p className="font-heading text-gold text-sm font-semibold">Finish your profile</p>
            <p className="text-muted-foreground mt-1 text-xs leading-relaxed">
              Add your name and contact details so your manager can reach you.
            </p>
          </div>
          <Button asChild variant="brand" size="lg">
            <Link href="/onboarding">Complete profile</Link>
          </Button>
        </div>
      )}

      <TimeTrackerPanel snapshot={snapshot} />

      <div className="grid gap-5 lg:grid-cols-3">
        <SectionCard
          className="lg:col-span-2"
          title="Your open tasks"
          description="Sorted by the nearest deadline."
          actions={
            <Button asChild variant="ghost" size="sm">
              <Link href="/tasks">
                All tasks
                <ArrowRightIcon aria-hidden />
              </Link>
            </Button>
          }
          bodyClassName="p-0"
        >
          {myTasks.length === 0 ? (
            <EmptyState
              icon={CircleCheckIcon}
              title="Nothing open right now"
              description="You have no outstanding tasks. New work will appear here as soon as it is assigned."
              className="border-0"
            />
          ) : (
            <ul>
              {myTasks.map((task) => (
                <TaskRowItem key={task.id} task={task} />
              ))}
            </ul>
          )}
        </SectionCard>

        <SectionCard
          title="Your data sheets"
          description="Only the sheets you have been granted."
          actions={
            <Button asChild variant="ghost" size="sm">
              <Link href="/data">
                Open
                <ArrowRightIcon aria-hidden />
              </Link>
            </Button>
          }
        >
          {mySheets.length === 0 ? (
            <EmptyState
              icon={DatabaseIcon}
              title="No sheets yet"
              description="An administrator will grant access when you need it."
              className="border-0"
            />
          ) : (
            <ul className="space-y-2.5">
              {mySheets.slice(0, 6).map((sheet) => (
                <li key={sheet.id}>
                  <Link
                    href={`/data/${sheet.slug}`}
                    className="hover:border-gold/30 border-border/60 block rounded-lg border px-3.5 py-2.5 transition-colors"
                  >
                    <p className="text-sm font-medium">{sheet.title}</p>
                    {sheet.description && (
                      <p className="text-muted-foreground mt-0.5 truncate text-xs">
                        {sheet.description}
                      </p>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      </div>

      <SectionCard
        title="Your recent daily reports"
        description={
          submittedToday
            ? "Today's report is submitted."
            : "Today's report has not been submitted yet."
        }
        actions={
          <Button asChild variant={submittedToday ? "ghost" : "brand"} size="sm">
            <Link href="/daily-reports">{submittedToday ? "View" : "Write today's report"}</Link>
          </Button>
        }
      >
        {myReports.length === 0 ? (
          <EmptyState
            icon={FileTextIcon}
            title="No reports yet"
            description="A short daily report keeps your manager in the loop without a status meeting."
            className="border-0"
          />
        ) : (
          <ul className="space-y-3">
            {myReports.map((report) => (
              <li
                key={report.id}
                className="border-border/60 flex flex-wrap items-center justify-between gap-3 border-b pb-3 last:border-b-0 last:pb-0"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium">
                    {formatBusinessDate(`${report.report_date}T00:00:00Z`)}
                  </p>
                  <p className="text-muted-foreground mt-0.5 truncate text-xs">
                    {report.summary ?? "No summary yet"}
                  </p>
                </div>
                <StatusPill tone={report.status === "SUBMITTED" ? "working" : "idle"}>
                  {report.status === "SUBMITTED" ? "Submitted" : "Draft"}
                </StatusPill>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>

      {isPrivileged && (
        <div className="space-y-5">
          <div className="rv-hairline h-px" />

          <h2 className="font-heading text-lg font-semibold">
            {session.actor.role === "ADMIN" ? "Across Rangmanch" : "Your team"}
          </h2>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <MetricCard
              label="Clocked in now"
              value={live.length}
              hint={live.filter((entry) => entry.state === "ON_BREAK").length > 0 ? `${live.filter((entry) => entry.state === "ON_BREAK").length} on a break` : "Open attendance sessions"}
              icon={ClockIcon}
            />
            <MetricCard
              label="Overdue tasks"
              value={taskCounts.overdue}
              hint="Past their due date and not done"
              icon={TriangleAlertIcon}
            />
            <MetricCard
              label="Due today"
              value={taskCounts.dueToday}
              hint="Open tasks with today's deadline"
              icon={CalendarClockIcon}
            />
            <MetricCard
              label={session.actor.role === "ADMIN" ? "Active interns" : "Reports missing today"}
              value={session.actor.role === "ADMIN" ? (peopleCounts?.activeInterns ?? 0) : missing.length}
              hint={
                session.actor.role === "ADMIN"
                  ? "Accounts with ACTIVE status"
                  : "No submitted report yet — not proof that no work happened"
              }
              icon={UsersIcon}
            />
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            <SectionCard
              title="Who is working right now"
              description="Live attendance for the people you are responsible for."
            >
              {live.length === 0 ? (
                <EmptyState
                  icon={ClockIcon}
                  title="Nobody is clocked in"
                  description="Open sessions will appear here as soon as someone clocks in."
                  className="border-0"
                />
              ) : (
                <ul className="space-y-3">
                  {live.map((entry) => (
                    <li
                      key={entry.session.id}
                      className="border-border/60 flex flex-wrap items-center justify-between gap-3 border-b pb-3 last:border-b-0 last:pb-0"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{displayName(entry.profile)}</p>
                        <p className="text-muted-foreground mt-0.5 text-xs">
                          {formatDuration(entry.totals.netWorkMs)} worked today
                        </p>
                      </div>
                      <StatusPill tone={entry.state === "ON_BREAK" ? "break" : "working"} pulse>
                        {ATTENDANCE_STATE_LABELS[entry.state]}
                      </StatusPill>
                    </li>
                  ))}
                </ul>
              )}
            </SectionCard>

            <SectionCard
              title="Reports submitted today"
              description="Only submitted reports are visible to you — drafts stay private to their author."
              actions={
                <Button asChild variant="ghost" size="sm">
                  <Link href="/team">
                    Review
                    <ArrowRightIcon aria-hidden />
                  </Link>
                </Button>
              }
            >
              {teamReports.length === 0 ? (
                <EmptyState
                  icon={FileTextIcon}
                  title="Nothing submitted yet today"
                  description={
                    missing.length > 0
                      ? `${missing.length} person${missing.length === 1 ? "" : "s"} have not submitted yet.`
                      : "Reports will appear here through the day."
                  }
                  className="border-0"
                />
              ) : (
                <ul className="space-y-3">
                  {teamReports.map((report) => (
                    <li
                      key={report.id}
                      className="border-border/60 border-b pb-3 last:border-b-0 last:pb-0"
                    >
                      <p className="text-sm font-medium">{displayName(report.author)}</p>
                      <p className="text-muted-foreground mt-0.5 line-clamp-2 text-xs leading-relaxed">
                        {report.summary}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </SectionCard>
          </div>
        </div>
      )}
    </div>
  );
}
