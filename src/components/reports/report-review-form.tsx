"use client";

import { useState, useTransition } from "react";
import { LoaderCircleIcon, MessageSquareIcon } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { reviewReportAction } from "@/lib/actions/reports";

export function ReportReviewForm({
  reportId,
  existingFeedback,
  reviewerName,
  reviewed,
}: {
  reportId: string;
  existingFeedback: string | null;
  reviewerName: string;
  reviewed: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      const result = await reviewReportAction(formData);
      if (result.ok) {
        toast.success(result.message);
        setOpen(false);
      } else {
        toast.error(result.message);
      }
    });
  }

  if (reviewed && !open) {
    return (
      <div className="border-gold/25 bg-gold/8 rounded-lg border px-3.5 py-3">
        <p className="text-gold text-xs font-medium">Reviewed by {reviewerName}</p>
        <p className="text-muted-foreground mt-1 text-sm leading-relaxed whitespace-pre-wrap">
          {existingFeedback}
        </p>
        <Button variant="ghost" size="xs" className="mt-2" onClick={() => setOpen(true)}>
          Edit feedback
        </Button>
      </div>
    );
  }

  if (!open) {
    return (
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <MessageSquareIcon aria-hidden />
        Add feedback
      </Button>
    );
  }

  return (
    <form action={handleSubmit} className="space-y-3">
      <input type="hidden" name="reportId" value={reportId} />
      <div className="space-y-2">
        <Label htmlFor={`feedback-${reportId}`}>Your feedback</Label>
        <Textarea
          id={`feedback-${reportId}`}
          name="feedback"
          rows={3}
          maxLength={4000}
          required
          defaultValue={existingFeedback ?? ""}
        />
      </div>
      <div className="flex gap-2">
        <Button type="submit" variant="brand" size="sm" disabled={pending}>
          {pending && <LoaderCircleIcon className="animate-spin" aria-hidden />}
          Save feedback
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
