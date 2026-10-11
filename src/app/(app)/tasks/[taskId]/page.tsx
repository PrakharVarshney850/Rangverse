import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeftIcon } from "lucide-react";

import { EmptyState } from "@/components/common/empty-state";
import { PageHeader } from "@/components/common/page-header";
import { SectionCard } from "@/components/common/section-card";
import { StatusPill } from "@/components/common/status-pill";
import { TaskCommentForm } from "@/components/tasks/task-comment-form";
import { TaskStatusSelect, TaskTimerButton } from "@/components/tasks/task-controls";
import { Button } from "@/components/ui/button";
import { requireUser } from "@/lib/auth/guards";
import { getTimeTrackerSnapshot } from "@/lib/data/attendance";
import { displayName } from "@/lib/data/people";
import { getTask, getTaskComments, getTaskTimeEntries } from "@/lib/data/tasks";
import {
  formatBusinessDate,
  formatBusinessTime,
  formatDuration,
  intervalDurationMs,
} from "@/lib/domain/time";
import { createClient } from "@/lib/supabase/server";
import { TASK_PRIORITY_LABELS, TASK_STATUS_LABELS } from "@/lib/validation/task";

export const metadata: Metadata = { title: "Task" };

export default async function TaskDetailPage({
  params,
}: {
  params: Promise<{ taskId: string }>;
}) {
  const { taskId } = await params;
  const session = await requireUser();
  const supabase = await createClient();

  const task = await getTask(supabase, taskId);

  // A task the caller cannot see simply does not exist for them: row level
  // security returns nothing, so guessing an id reveals nothing either.
  if (!task) {
    notFound();
  }

  const [comments, entries, snapshot] = await Promise.all([
    getTaskComments(supabase, taskId),
    getTaskTimeEntries(supabase, { taskId }),
    getTimeTrackerSnapshot(supabase, session.id),
  ]);

  const isAssignee = task.assignee_id === session.id;
  const runningForThisTask = snapshot.runningTimer?.task_id === taskId;

  const totalTrackedMs = entries.reduce(
    (total, entry) => total + intervalDurationMs({ start: entry.started_at, end: entry.ended_at }),
    0,
  );

  const canTrack = isAssignee && snapshot.state === "WORKING";
  const trackReason = !isAssignee
    ? "Only the person assigned to this task can track time against it."
    : snapshot.state === "ON_BREAK"
      ? "End your break to start the timer."
      : "Clock in to track time against this task.";

  return (
    <div className="space-y-6">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link href="/tasks">
          <ArrowLeftIcon aria-hidden />
          All tasks
        </Link>
      </Button>

      <PageHeader
        eyebrow={task.campaign ?? "Task"}
        title={task.title}
        description={task.description ?? undefined}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {isAssignee && <TaskStatusSelect taskId={task.id} status={task.status} />}
            <TaskTimerButton
              taskId={task.id}
              isRunningForThisTask={runningForThisTask}
              canTrack={canTrack}
              reason={trackReason}
            />
          </div>
        }
      />

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <SectionCard title="Activity" description="Comments and manager feedback on this task.">
            {comments.length === 0 ? (
              <EmptyState
                title="No comments yet"
                description="Use comments to record decisions, blockers and feedback."
              />
            ) : (
              <ul className="space-y-4">
                {comments.map((comment) => (
                  <li
                    key={comment.id}
                    className="border-border/60 border-b pb-4 last:border-b-0 last:pb-0"
                  >
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <p className="text-sm font-medium">{displayName(comment.author)}</p>
                      <p className="text-muted-foreground text-xs">
                        {formatBusinessDate(comment.created_at)} ·{" "}
                        {formatBusinessTime(comment.created_at)}
                      </p>
                    </div>
                    <p className="text-muted-foreground mt-1.5 text-sm leading-relaxed whitespace-pre-wrap">
                      {comment.body}
                    </p>
                  </li>
                ))}
              </ul>
            )}

            <div className="border-border/60 mt-6 border-t pt-6">
              <TaskCommentForm taskId={task.id} />
            </div>
          </SectionCard>

          <SectionCard
            title="Time tracked against this task"
            description="Recorded by the task timer. These minutes are reported against the task — they are never added on top of attendance totals."
          >
            {entries.length === 0 ? (
              <EmptyState
                title="No time recorded yet"
                description="Start the timer when you begin working on this task."
              />
            ) : (
              <>
                <p className="text-muted-foreground mb-4 text-sm">
                  Total:{" "}
                  <span className="text-foreground font-medium">
                    {formatDuration(totalTrackedMs)}
                  </span>
                </p>
                <ul className="space-y-2.5">
                  {entries.map((entry) => (
                    <li
                      key={entry.id}
                      className="border-border/60 flex flex-wrap items-center justify-between gap-2 border-b pb-2.5 text-sm last:border-b-0 last:pb-0"
                    >
                      <span className="text-muted-foreground text-xs">
                        {formatBusinessDate(entry.started_at)} ·{" "}
                        {formatBusinessTime(entry.started_at)} –{" "}
                        {entry.ended_at ? formatBusinessTime(entry.ended_at) : "running"}
                      </span>
                      <span className="font-heading tabular-nums">
                        {entry.ended_at
                          ? formatDuration(
                              intervalDurationMs({
                                start: entry.started_at,
                                end: entry.ended_at,
                              }),
                            )
                          : "In progress"}
                      </span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </SectionCard>
        </div>

        <SectionCard title="Details">
          <dl className="space-y-4 text-sm">
            <Detail label="Status">
              <StatusPill tone={task.status === "DONE" ? "working" : "info"}>
                {TASK_STATUS_LABELS[task.status]}
              </StatusPill>
            </Detail>
            <Detail label="Priority">
              <StatusPill tone={task.priority === "URGENT" ? "urgent" : "idle"}>
                {TASK_PRIORITY_LABELS[task.priority]}
              </StatusPill>
            </Detail>
            <Detail label="Assigned to">{displayName(task.assignee)}</Detail>
            <Detail label="Assigned by">{displayName(task.creator)}</Detail>
            <Detail label="Due">
              {task.due_date ? formatBusinessDate(`${task.due_date}T00:00:00Z`) : "No deadline"}
            </Detail>
            {task.client && <Detail label="Client">{task.client}</Detail>}
            <Detail label="Created">{formatBusinessDate(task.created_at)}</Detail>
            {task.completed_at && (
              <Detail label="Completed">{formatBusinessDate(task.completed_at)}</Detail>
            )}
          </dl>
        </SectionCard>
      </div>
    </div>
  );
}

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-muted-foreground text-[0.68rem] font-medium tracking-[0.12em] uppercase">
        {label}
      </dt>
      <dd className="mt-1.5">{children}</dd>
    </div>
  );
}
