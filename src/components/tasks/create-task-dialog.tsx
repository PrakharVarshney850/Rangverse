"use client";

import { useState, useTransition } from "react";
import { LoaderCircleIcon, PlusIcon } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { createTaskAction } from "@/lib/actions/tasks";
import type { PersonSummary } from "@/lib/display";
import { displayName } from "@/lib/display";
import { TASK_PRIORITY_LABELS } from "@/lib/validation/task";

export function CreateTaskDialog({ assignees }: { assignees: PersonSummary[] }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      const result = await createTaskAction(formData);
      if (result.ok) {
        toast.success(result.message);
        setFieldErrors({});
        setOpen(false);
      } else {
        setFieldErrors(result.fieldErrors ?? {});
        toast.error(result.message);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="brand" size="lg" disabled={assignees.length === 0}>
          <PlusIcon aria-hidden />
          New task
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-heading">Assign a task</DialogTitle>
          <DialogDescription>
            You can only assign work to people who report to you.
          </DialogDescription>
        </DialogHeader>

        <form action={handleSubmit} className="space-y-4" noValidate>
          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input id="title" name="title" required maxLength={200} autoComplete="off" />
            {fieldErrors.title && <p className="text-status-danger text-xs">{fieldErrors.title}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea id="description" name="description" rows={3} maxLength={4000} />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="assigneeId">Assign to</Label>
              <Select name="assigneeId" required>
                <SelectTrigger id="assigneeId" className="w-full">
                  <SelectValue placeholder="Choose a person" />
                </SelectTrigger>
                <SelectContent>
                  {assignees.map((person) => (
                    <SelectItem key={person.id} value={person.id}>
                      {displayName(person)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {fieldErrors.assigneeId && (
                <p className="text-status-danger text-xs">{fieldErrors.assigneeId}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="priority">Priority</Label>
              <Select name="priority" defaultValue="MEDIUM">
                <SelectTrigger id="priority" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(TASK_PRIORITY_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="dueDate">Due date</Label>
              <Input id="dueDate" name="dueDate" type="date" />
              {fieldErrors.dueDate && (
                <p className="text-status-danger text-xs">{fieldErrors.dueDate}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="campaign">Campaign</Label>
              <Input id="campaign" name="campaign" maxLength={120} autoComplete="off" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="client">Client</Label>
              <Input id="client" name="client" maxLength={120} autoComplete="off" />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" size="lg" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="brand" size="lg" disabled={pending}>
              {pending && <LoaderCircleIcon className="animate-spin" aria-hidden />}
              Create task
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
