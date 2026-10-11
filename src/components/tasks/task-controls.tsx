"use client";

import { useTransition } from "react";
import { LoaderCircleIcon, PlayIcon, SquareIcon } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { startTaskTimerAction, stopTaskTimerAction } from "@/lib/actions/time";
import { changeTaskStatusAction } from "@/lib/actions/tasks";
import type { TaskStatus } from "@/lib/db/database.types";
import { TASK_STATUS_LABELS } from "@/lib/validation/task";

export function TaskStatusSelect({
  taskId,
  status,
  disabled = false,
}: {
  taskId: string;
  status: TaskStatus;
  disabled?: boolean;
}) {
  const [pending, startTransition] = useTransition();

  function change(next: string) {
    const formData = new FormData();
    formData.set("taskId", taskId);
    formData.set("status", next);

    startTransition(async () => {
      const result = await changeTaskStatusAction(formData);
      if (result.ok) {
        toast.success(result.message);
      } else {
        toast.error(result.message);
      }
    });
  }

  return (
    <Select value={status} onValueChange={change} disabled={disabled || pending}>
      <SelectTrigger className="w-44" aria-label="Task status">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {Object.entries(TASK_STATUS_LABELS).map(([value, label]) => (
          <SelectItem key={value} value={value}>
            {label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/**
 * Starts or stops the task timer.
 *
 * `canTrack` reflects the same rules the database enforces (an open attendance
 * session, no running break, and the task assigned to you), so an impossible
 * action is explained rather than offered and then rejected.
 */
export function TaskTimerButton({
  taskId,
  isRunningForThisTask,
  canTrack,
  reason,
}: {
  taskId: string;
  isRunningForThisTask: boolean;
  canTrack: boolean;
  reason?: string;
}) {
  const [pending, startTransition] = useTransition();

  function toggle() {
    startTransition(async () => {
      const result = isRunningForThisTask
        ? await stopTaskTimerAction()
        : await startTaskTimerAction(taskId);

      if (result.ok) {
        toast.success(result.message);
      } else {
        toast.error(result.message);
      }
    });
  }

  if (!canTrack && !isRunningForThisTask) {
    return (
      <div className="text-muted-foreground text-xs">
        {reason ?? "Clock in to track time against this task."}
      </div>
    );
  }

  return (
    <Button
      variant={isRunningForThisTask ? "outline" : "brand"}
      size="lg"
      onClick={toggle}
      disabled={pending}
    >
      {pending ? (
        <LoaderCircleIcon className="animate-spin" aria-hidden />
      ) : isRunningForThisTask ? (
        <SquareIcon aria-hidden />
      ) : (
        <PlayIcon aria-hidden />
      )}
      {isRunningForThisTask ? "Stop timer" : "Start timer"}
    </Button>
  );
}
