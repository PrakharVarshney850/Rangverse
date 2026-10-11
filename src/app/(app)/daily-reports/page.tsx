import type { Metadata } from "next";

import { EmptyState } from "@/components/common/empty-state";
import { PageHeader } from "@/components/common/page-header";
import { SectionCard } from "@/components/common/section-card";
import { StatusPill } from "@/components/common/status-pill";
import { DailyReportForm } from "@/components/reports/daily-report-form";
import { requireUser } from "@/lib/auth/guards";
import { getReportForDate, listMyReports } from "@/lib/data/reports";
import { getOpenTasksForUser } from "@/lib/data/tasks";
import { businessDateKey, formatBusinessDate } from "@/lib/domain/time";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Daily reports" };

export default async function DailyReportsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requireUser();
  const supabase = await createClient();
  const params = await searchParams;

  const requested = typeof params.date === "string" ? params.date : undefined;
  const dateKey = requested && /^\d{4}-\d{2}-\d{2}$/.test(requested) ? requested : businessDateKey();

  const [report, tasks, history] = await Promise.all([
    getReportForDate(supabase, session.id, dateKey),
    getOpenTasksForUser(supabase, session.id, 20),
    listMyReports(supabase, session.id, 20),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Daily reports"
        title={formatBusinessDate(`${dateKey}T00:00:00Z`)}
        description="A short, honest note on what you did today. Your manager sees it once you submit; drafts stay private to you."
      />

      <div className="grid gap-5 lg:grid-cols-3">
        <SectionCard className="lg:col-span-2" title="Today's report">
          <DailyReportForm dateKey={dateKey} report={report} tasks={tasks} />
        </SectionCard>

        <SectionCard title="History" description="Your last 20 reports.">
          {history.length === 0 ? (
            <EmptyState
              title="No reports yet"
              description="Your submitted reports will build up here."
              className="border-0"
            />
          ) : (
            <ul className="space-y-2.5">
              {history.map((item) => (
                <li key={item.id}>
                  <a
                    href={`/daily-reports?date=${item.report_date}`}
                    className="border-border/60 hover:border-gold/30 flex items-center justify-between gap-3 rounded-lg border px-3.5 py-2.5 transition-colors"
                  >
                    <span className="text-sm">
                      {formatBusinessDate(`${item.report_date}T00:00:00Z`)}
                    </span>
                    <StatusPill tone={item.status === "SUBMITTED" ? "working" : "idle"}>
                      {item.status === "SUBMITTED" ? "Submitted" : "Draft"}
                    </StatusPill>
                  </a>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      </div>
    </div>
  );
}
