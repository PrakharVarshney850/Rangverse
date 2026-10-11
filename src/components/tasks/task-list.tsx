import Link from "next/link";
import { CalendarIcon } from "lucide-react";

import { EmptyState } from "@/components/common/empty-state";
import { StatusPill, type StatusTone } from "@/components/common/status-pill";
import { Button } from "@/components/ui/button";
import { displayName } from "@/lib/display";
import { businessDateKey, formatBusinessDate } from "@/lib/domain/time";
import { cn } from "@/lib/utils";
import { TASK_PRIORITY_LABELS, TASK_STATUS_LABELS } from "@/lib/validation/task";
import type { TaskPage, TaskWithPeople } from "@/lib/view-models";

const STATUS_TONE: Record<TaskWithPeople["status"], StatusTone> = {
  TO_DO: "idle",
  IN_PROGRESS: "info",
  IN_REVIEW: "break",
  DONE: "working",
};

const PRIORITY_TONE: Record<TaskWithPeople["priority"], StatusTone> = {
  LOW: "idle",
  MEDIUM: "info",
  HIGH: "break",
  URGENT: "urgent",
};

export function TaskRowItem({ task }: { task: TaskWithPeople }) {
  const today = businessDateKey();
  const overdue = task.status !== "DONE" && task.due_date !== null && task.due_date < today;
  const dueToday = task.due_date === today && task.status !== "DONE";

  return (
    <li className="border-border/60 hover:bg-surface-raised/40 border-b transition-colors last:border-b-0">
      <Link href={`/tasks/${task.id}`} className="flex flex-col gap-3 px-5 py-4 sm:px-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <p className="min-w-0 flex-1 text-sm font-medium">{task.title}</p>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <StatusPill tone={PRIORITY_TONE[task.priority]}>
              {TASK_PRIORITY_LABELS[task.priority]}
            </StatusPill>
            <StatusPill tone={STATUS_TONE[task.status]}>
              {TASK_STATUS_LABELS[task.status]}
            </StatusPill>
          </div>
        </div>

        <div className="text-muted-foreground flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs">
          <span>{displayName(task.assignee)}</span>
          {task.due_date && (
            <span
              className={cn(
                "inline-flex items-center gap-1.5",
                overdue && "text-status-danger",
                dueToday && "text-status-break",
              )}
            >
              <CalendarIcon className="size-3" aria-hidden />
              {overdue ? "Overdue · " : dueToday ? "Due today · " : "Due "}
              {formatBusinessDate(`${task.due_date}T00:00:00Z`)}
            </span>
          )}
          {task.campaign && <span>Campaign: {task.campaign}</span>}
          {task.client && <span>Client: {task.client}</span>}
        </div>
      </Link>
    </li>
  );
}

export function TaskList({
  page,
  buildHref,
  emptyTitle = "No tasks here yet",
  emptyDescription = "When work is assigned to you it will appear in this list.",
  emptyAction,
}: {
  page: TaskPage;
  buildHref: (pageNumber: number) => string;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyAction?: React.ReactNode;
}) {
  if (page.tasks.length === 0) {
    return (
      <EmptyState
        title={emptyTitle}
        description={emptyDescription}
        action={emptyAction}
        className="bg-card"
      />
    );
  }

  return (
    <div className="bg-card border-border/70 overflow-hidden rounded-xl border">
      <ul>
        {page.tasks.map((task) => (
          <TaskRowItem key={task.id} task={task} />
        ))}
      </ul>

      {page.pageCount > 1 && (
        <nav
          aria-label="Task pages"
          className="border-border/60 flex items-center justify-between gap-3 border-t px-5 py-3.5"
        >
          <p className="text-muted-foreground text-xs">
            Page {page.page} of {page.pageCount} · {page.total} task
            {page.total === 1 ? "" : "s"}
          </p>
          <div className="flex gap-2">
            <Button asChild variant="outline" size="sm" disabled={page.page <= 1}>
              <Link href={buildHref(Math.max(1, page.page - 1))} aria-disabled={page.page <= 1}>
                Previous
              </Link>
            </Button>
            <Button asChild variant="outline" size="sm" disabled={page.page >= page.pageCount}>
              <Link
                href={buildHref(Math.min(page.pageCount, page.page + 1))}
                aria-disabled={page.page >= page.pageCount}
              >
                Next
              </Link>
            </Button>
          </div>
        </nav>
      )}
    </div>
  );
}
