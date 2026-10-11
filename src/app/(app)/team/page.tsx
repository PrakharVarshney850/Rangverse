import type { Metadata } from "next";
import { ClockIcon, FileTextIcon, TriangleAlertIcon, UsersIcon } from "lucide-react";

import { EmptyState } from "@/components/common/empty-state";
import { MetricCard } from "@/components/common/metric-card";
import { PageHeader } from "@/components/common/page-header";
import { SectionCard } from "@/components/common/section-card";
import { StatusPill } from "@/components/common/status-pill";
import { ReportReviewForm } from "@/components/reports/report-review-form";
import { requirePermission } from "@/lib/auth/guards";
import { getLiveTeamStatus, getSessionsInRange } from "@/lib/data/attendance";
import { displayName, listVisiblePeople, ONBOARDING_STATUS_LABELS } from "@/lib/data/people";
import { findMissingReports, listTeamReports } from "@/lib/data/reports";
import { getTaskStatusCounts } from "@/lib/data/tasks";
import {
  ATTENDANCE_STATE_LABELS,
  businessDateKey,
  businessWeekRange,
  formatBusinessDate,
  formatDuration,
  sumSessionTotals,
} from "@/lib/domain/time";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Team" };

export default async function TeamPage() {
  const session = await requirePermission("attendance.viewTeam");
  const supabase = await createClient();

  const todayKey = businessDateKey();
  const week = businessWeekRange();

  const [people, live, weekSessions, taskCounts, reports, missing] = await Promise.all([
    listVisiblePeople(supabase),
    getLiveTeamStatus(supabase),
    getSessionsInRange(supabase, week.fromIso, week.toIso),
    getTaskStatusCounts(supabase),
    listTeamReports(supabase, { limit: 20 }),
    findMissingReports(supabase, todayKey),
  ]);

  // Exclude the viewer so "my team" means the people they are responsible for.
  const team = people.filter((person) => person.id !== session.id);
  const weekTotals = sumSessionTotals(weekSessions);

  const hoursByPerson = new Map<string, number>();
  for (const item of weekSessions) {
    const totals = sumSessionTotals([item]);
    hoursByPerson.set(item.user_id, (hoursByPerson.get(item.user_id) ?? 0) + totals.netWorkMs);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Team"
        title="Your team"
        description="Everyone who reports to you, what they are doing now, and what they have submitted. You see only your own team — this is enforced by the database."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="Team members"
          value={team.length}
          hint="People assigned to you"
          icon={UsersIcon}
        />
        <MetricCard
          label="Clocked in now"
          value={live.filter((entry) => entry.profile?.id !== session.id).length}
          hint="Open attendance sessions"
          icon={ClockIcon}
        />
        <MetricCard
          label="Team hours this week"
          value={formatDuration(weekTotals.netWorkMs)}
          hint="Net of breaks, Monday to Sunday"
          icon={ClockIcon}
        />
        <MetricCard
          label="Overdue tasks"
          value={taskCounts.overdue}
          hint="Past their due date and not done"
          icon={TriangleAlertIcon}
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <SectionCard
          title="Team roster"
          description="Weekly hours are calculated from recorded timestamps."
        >
          {team.length === 0 ? (
            <EmptyState
              icon={UsersIcon}
              title="Nobody reports to you yet"
              description="An administrator assigns interns to a manager when they are invited."
              className="border-0"
            />
          ) : (
            <ul className="space-y-3">
              {team.map((person) => {
                const liveEntry = live.find((entry) => entry.profile?.id === person.id);
                return (
                  <li
                    key={person.id}
                    className="border-border/60 flex flex-wrap items-center justify-between gap-3 border-b pb-3 last:border-b-0 last:pb-0"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{displayName(person)}</p>
                      <p className="text-muted-foreground mt-0.5 text-xs">
                        {person.designation ?? ONBOARDING_STATUS_LABELS[person.onboarding_status]}
                        {person.team?.name ? ` · ${person.team.name}` : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-2.5">
                      <span className="font-heading text-xs tabular-nums">
                        {formatDuration(hoursByPerson.get(person.id) ?? 0)}
                      </span>
                      {liveEntry ? (
                        <StatusPill
                          tone={liveEntry.state === "ON_BREAK" ? "break" : "working"}
                          pulse
                        >
                          {ATTENDANCE_STATE_LABELS[liveEntry.state]}
                        </StatusPill>
                      ) : (
                        <StatusPill tone="idle">Not clocked in</StatusPill>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </SectionCard>

        <SectionCard
          title="Missing reports today"
          description="A missing report means nothing has been submitted yet — it is not evidence that no work happened."
        >
          {missing.length === 0 ? (
            <EmptyState
              icon={FileTextIcon}
              title="Everyone has reported"
              description="All active team members have submitted a report for today."
              className="border-0"
            />
          ) : (
            <ul className="space-y-2.5">
              {missing.map((item) => (
                <li
                  key={item.profile.id}
                  className="border-border/60 flex items-center justify-between gap-3 border-b pb-2.5 text-sm last:border-b-0 last:pb-0"
                >
                  <span className="truncate">{displayName(item.profile)}</span>
                  <StatusPill tone="idle">No report yet</StatusPill>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      </div>

      <SectionCard
        title="Submitted reports to review"
        description="Drafts stay private to their author; only submitted reports reach you."
      >
        {reports.length === 0 ? (
          <EmptyState
            icon={FileTextIcon}
            title="Nothing to review"
            description="Submitted reports from your team will appear here."
            className="border-0"
          />
        ) : (
          <ul className="space-y-5">
            {reports.map((report) => (
              <li key={report.id} className="border-border/60 border-b pb-5 last:border-b-0 last:pb-0">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="text-sm font-medium">{displayName(report.author)}</p>
                  <p className="text-muted-foreground text-xs">
                    {formatBusinessDate(`${report.report_date}T00:00:00Z`)}
                  </p>
                </div>

                <p className="text-muted-foreground mt-2 text-sm leading-relaxed whitespace-pre-wrap">
                  {report.summary}
                </p>

                {report.blockers && (
                  <p className="text-status-break mt-2 text-xs leading-relaxed">
                    Blockers: {report.blockers}
                  </p>
                )}

                {report.evidence_links.length > 0 && (
                  <ul className="mt-2 flex flex-wrap gap-2">
                    {report.evidence_links.map((link) => (
                      <li key={link}>
                        <a
                          href={link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-gold text-xs underline-offset-4 hover:underline"
                        >
                          {link.replace(/^https?:\/\//, "").slice(0, 40)}
                        </a>
                      </li>
                    ))}
                  </ul>
                )}

                <div className="mt-4">
                  <ReportReviewForm
                    reportId={report.id}
                    existingFeedback={report.manager_feedback}
                    reviewerName={displayName(report.reviewer)}
                    reviewed={Boolean(report.reviewed_at)}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>
    </div>
  );
}
