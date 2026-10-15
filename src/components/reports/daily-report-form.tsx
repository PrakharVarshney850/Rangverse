"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircleIcon, PlusIcon, SaveIcon, SendIcon, XIcon } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { saveDailyReportAction } from "@/lib/actions/reports";
import type { ReportWithPeople } from "@/lib/view-models";
import type { TaskWithPeople } from "@/lib/view-models";

export function DailyReportForm({
  dateKey,
  report,
  tasks,
}: {
  dateKey: string;
  report: ReportWithPeople | null;
  tasks: TaskWithPeople[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [links, setLinks] = useState<string[]>(report?.evidence_links ?? []);
  const [newLink, setNewLink] = useState("");

  const locked = report?.status === "SUBMITTED";
  const selectedTaskIds = new Set(
    (report?.tasks ?? []).map((item) => item.task?.id).filter((id): id is string => Boolean(id)),
  );

  function submit(formData: FormData, intent: "SAVE_DRAFT" | "SUBMIT") {
    formData.set("intent", intent);
    formData.delete("evidenceLinks");
    for (const link of links) {
      formData.append("evidenceLinks", link);
    }

    startTransition(async () => {
      const result = await saveDailyReportAction(formData);
      if (result.ok) {
        toast.success(result.message);
        setFieldErrors({});
        if (intent === "SUBMIT") router.refresh();
      } else {
        setFieldErrors(result.fieldErrors ?? {});
        toast.error(result.message);
      }
    });
  }

  function addLink() {
    const value = newLink.trim();
    if (!value) return;
    if (!/^https?:\/\/\S+$/.test(value)) {
      toast.error("Evidence links must start with http:// or https://");
      return;
    }
    if (links.length >= 10) {
      toast.error("You can attach at most 10 links.");
      return;
    }
    setLinks((current) => [...current, value]);
    setNewLink("");
  }

  if (locked) {
    return (
      <div className="space-y-5">
        <div
          role="status"
          className="border-status-working/25 bg-status-working/8 rounded-lg border px-4 py-3"
        >
          <p className="text-status-working text-sm font-medium">Submitted</p>
          <p className="text-muted-foreground mt-1 text-xs leading-relaxed">
            This report has been submitted and is visible to your manager. Submitted reports are
            locked so the record stays reliable — ask an administrator if it needs reopening.
          </p>
        </div>

        <ReadOnlyField label="Summary" value={report.summary} />
        <ReadOnlyField label="Progress and deliverables" value={report.progress} />
        <ReadOnlyField label="Blockers" value={report.blockers} />
        <ReadOnlyField label="Planned next steps" value={report.next_steps} />

        {report.evidence_links.length > 0 && (
          <div>
            <p className="text-muted-foreground text-[0.68rem] font-medium tracking-[0.12em] uppercase">
              Evidence
            </p>
            <ul className="mt-2 space-y-1.5">
              {report.evidence_links.map((link) => (
                <li key={link}>
                  <a
                    href={link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-gold text-sm break-all underline-offset-4 hover:underline"
                  >
                    {link}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}

        {report.manager_feedback && (
          <div className="border-gold/25 bg-gold/8 rounded-lg border px-4 py-3">
            <p className="text-gold text-sm font-medium">Manager feedback</p>
            <p className="text-muted-foreground mt-1.5 text-sm leading-relaxed whitespace-pre-wrap">
              {report.manager_feedback}
            </p>
          </div>
        )}
      </div>
    );
  }

  return (
    <form className="space-y-5" noValidate>
      <input type="hidden" name="reportDate" value={dateKey} />

      <div className="space-y-2">
        <Label htmlFor="summary">What did you work on today?</Label>
        <Textarea
          id="summary"
          name="summary"
          rows={4}
          maxLength={4000}
          defaultValue={report?.summary ?? ""}
          placeholder="A few lines on what you completed."
          aria-invalid={Boolean(fieldErrors.summary)}
        />
        {fieldErrors.summary && (
          <p className="text-status-danger text-xs">{fieldErrors.summary}</p>
        )}
      </div>

      {tasks.length > 0 && (
        <fieldset className="space-y-2.5">
          <legend className="text-sm font-medium">Tasks you worked on</legend>
          <div className="space-y-2">
            {tasks.map((task) => (
              <label
                key={task.id}
                className="border-border/60 hover:border-gold/30 flex items-start gap-3 rounded-lg border px-3.5 py-2.5 transition-colors"
              >
                <Checkbox
                  name="taskIds"
                  value={task.id}
                  defaultChecked={selectedTaskIds.has(task.id)}
                  className="mt-0.5"
                />
                <span className="min-w-0 text-sm">{task.title}</span>
              </label>
            ))}
          </div>
        </fieldset>
      )}

      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="progress">Progress and deliverables</Label>
          <Textarea
            id="progress"
            name="progress"
            rows={3}
            maxLength={4000}
            defaultValue={report?.progress ?? ""}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="blockers">Blockers</Label>
          <Textarea
            id="blockers"
            name="blockers"
            rows={3}
            maxLength={4000}
            defaultValue={report?.blockers ?? ""}
            placeholder="Anything stopping you?"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="nextSteps">Planned next steps</Label>
        <Textarea
          id="nextSteps"
          name="nextSteps"
          rows={2}
          maxLength={4000}
          defaultValue={report?.next_steps ?? ""}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="newLink">Supporting links</Label>
        <div className="flex gap-2">
          <Input
            id="newLink"
            value={newLink}
            onChange={(event) => setNewLink(event.target.value)}
            placeholder="https://…"
            inputMode="url"
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                addLink();
              }
            }}
          />
          <Button type="button" variant="outline" size="lg" onClick={addLink}>
            <PlusIcon aria-hidden />
            Add
          </Button>
        </div>
        {links.length > 0 && (
          <ul className="mt-2 space-y-1.5">
            {links.map((link) => (
              <li
                key={link}
                className="border-border/60 flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-xs"
              >
                <span className="min-w-0 truncate">{link}</span>
                <button
                  type="button"
                  onClick={() => setLinks((current) => current.filter((item) => item !== link))}
                  className="text-muted-foreground hover:text-status-danger shrink-0"
                  aria-label={`Remove ${link}`}
                >
                  <XIcon className="size-3.5" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="border-border/60 flex flex-wrap gap-2 border-t pt-5">
        <Button
          type="submit"
          variant="outline"
          size="xl"
          disabled={pending}
          formAction={(formData) => submit(formData, "SAVE_DRAFT")}
        >
          {pending ? <LoaderCircleIcon className="animate-spin" aria-hidden /> : <SaveIcon aria-hidden />}
          Save draft
        </Button>
        <Button
          type="submit"
          variant="brand"
          size="xl"
          disabled={pending}
          formAction={(formData) => submit(formData, "SUBMIT")}
        >
          {pending ? <LoaderCircleIcon className="animate-spin" aria-hidden /> : <SendIcon aria-hidden />}
          Submit report
        </Button>
      </div>
    </form>
  );
}

function ReadOnlyField({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;

  return (
    <div>
      <p className="text-muted-foreground text-[0.68rem] font-medium tracking-[0.12em] uppercase">
        {label}
      </p>
      <p className="mt-1.5 text-sm leading-relaxed whitespace-pre-wrap">{value}</p>
    </div>
  );
}
