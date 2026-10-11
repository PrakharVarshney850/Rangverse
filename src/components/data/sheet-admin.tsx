"use client";

import { useState, useTransition } from "react";
import { LoaderCircleIcon, PlusIcon, XIcon } from "lucide-react";
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
import {
  createSheetAction,
  grantSheetAccessAction,
  revokeSheetAccessAction,
} from "@/lib/actions/sheets";
import { displayName, type PersonSummary } from "@/lib/display";
import { SHEET_TEMPLATES } from "@/lib/sheet-templates";

export function CreateSheetDialog() {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      const result = await createSheetAction(formData);
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
        <Button variant="brand" size="lg">
          <PlusIcon aria-hidden />
          New sheet
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-heading">Create a sheet</DialogTitle>
          <DialogDescription>
            Pick a template to start with sensible columns, or build one from scratch.
          </DialogDescription>
        </DialogHeader>

        <form action={handleSubmit} className="space-y-4" noValidate>
          <div className="space-y-2">
            <Label htmlFor="title">Sheet name</Label>
            <Input id="title" name="title" required maxLength={120} autoComplete="off" />
            {fieldErrors.title && <p className="text-status-danger text-xs">{fieldErrors.title}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea id="description" name="description" rows={2} maxLength={400} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="template">Template</Label>
            <Select name="template" defaultValue="INFLUENCER_DIRECTORY">
              <SelectTrigger id="template" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(SHEET_TEMPLATES).map(([key, template]) => (
                  <SelectItem key={key} value={key}>
                    {template.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" size="lg" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="brand" size="lg" disabled={pending}>
              {pending && <LoaderCircleIcon className="animate-spin" aria-hidden />}
              Create sheet
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function SheetAccessManager({
  sheetId,
  people,
  members,
}: {
  sheetId: string;
  people: PersonSummary[];
  members: { userId: string; name: string; accessLevel: "VIEW" | "EDIT" }[];
}) {
  const [pending, startTransition] = useTransition();

  function grant(formData: FormData) {
    formData.set("sheetId", sheetId);
    startTransition(async () => {
      const result = await grantSheetAccessAction(formData);
      if (result.ok) {
        toast.success(result.message);
      } else {
        toast.error(result.message);
      }
    });
  }

  function revoke(userId: string) {
    startTransition(async () => {
      const result = await revokeSheetAccessAction(sheetId, userId);
      if (result.ok) {
        toast.success(result.message);
      } else {
        toast.error(result.message);
      }
    });
  }

  const memberIds = new Set(members.map((member) => member.userId));
  const candidates = people.filter((person) => !memberIds.has(person.id));

  return (
    <div className="space-y-4">
      {members.length > 0 && (
        <ul className="space-y-2">
          {members.map((member) => (
            <li
              key={member.userId}
              className="border-border/60 flex items-center justify-between gap-3 rounded-lg border px-3.5 py-2.5"
            >
              <div className="min-w-0">
                <p className="truncate text-sm">{member.name}</p>
                <p className="text-muted-foreground text-xs">
                  {member.accessLevel === "EDIT" ? "Can edit records" : "View only"}
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={`Revoke access for ${member.name}`}
                disabled={pending}
                onClick={() => revoke(member.userId)}
              >
                <XIcon aria-hidden />
              </Button>
            </li>
          ))}
        </ul>
      )}

      {candidates.length > 0 ? (
        <form action={grant} className="flex flex-wrap items-end gap-2">
          <div className="min-w-[10rem] flex-1 space-y-2">
            <Label htmlFor={`grant-${sheetId}`}>Grant access to</Label>
            <Select name="userId" required>
              <SelectTrigger id={`grant-${sheetId}`} className="w-full">
                <SelectValue placeholder="Choose a person" />
              </SelectTrigger>
              <SelectContent>
                {candidates.map((person) => (
                  <SelectItem key={person.id} value={person.id}>
                    {displayName(person)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="w-32 space-y-2">
            <Label htmlFor={`level-${sheetId}`}>Level</Label>
            <Select name="accessLevel" defaultValue="VIEW">
              <SelectTrigger id={`level-${sheetId}`} className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="VIEW">View</SelectItem>
                <SelectItem value="EDIT">Edit</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Button type="submit" variant="outline" size="lg" disabled={pending}>
            {pending && <LoaderCircleIcon className="animate-spin" aria-hidden />}
            Grant
          </Button>
        </form>
      ) : (
        <p className="text-muted-foreground text-xs">Everyone already has access to this sheet.</p>
      )}
    </div>
  );
}
