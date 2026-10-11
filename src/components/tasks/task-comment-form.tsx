"use client";

import { useTransition } from "react";
import { LoaderCircleIcon, SendIcon } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { addTaskCommentAction } from "@/lib/actions/tasks";

export function TaskCommentForm({ taskId }: { taskId: string }) {
  const [pending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      const result = await addTaskCommentAction(formData);
      if (result.ok) {
        toast.success(result.message);
      } else {
        toast.error(result.message);
      }
    });
  }

  return (
    <form
      action={(formData) => {
        handleSubmit(formData);
        (document.getElementById("comment-body") as HTMLTextAreaElement | null)?.form?.reset();
      }}
      className="space-y-3"
    >
      <input type="hidden" name="taskId" value={taskId} />
      <div className="space-y-2">
        <Label htmlFor="comment-body">Add a comment</Label>
        <Textarea
          id="comment-body"
          name="body"
          rows={3}
          maxLength={4000}
          required
          placeholder="Share progress, ask a question or leave feedback…"
        />
      </div>
      <Button type="submit" variant="outline" size="lg" disabled={pending}>
        {pending ? (
          <LoaderCircleIcon className="animate-spin" aria-hidden />
        ) : (
          <SendIcon aria-hidden />
        )}
        Post comment
      </Button>
    </form>
  );
}
