"use client";

import { useState, useTransition } from "react";
import { LoaderCircleIcon, UserPlusIcon } from "lucide-react";
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
import { inviteUserAction } from "@/lib/actions/people";
import { displayName, type PersonSummary } from "@/lib/display";
import type { TeamRow } from "@/lib/db/database.types";

export function InviteUserDialog({
  teams,
  managers,
}: {
  teams: TeamRow[];
  managers: PersonSummary[];
}) {
  const [open, setOpen] = useState(false);
  const [role, setRole] = useState("INTERN");
  const [pending, startTransition] = useTransition();
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      const result = await inviteUserAction(formData);
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
          <UserPlusIcon aria-hidden />
          Invite someone
        </Button>
      </DialogTrigger>

      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="font-heading">Invite to Rangverse</DialogTitle>
          <DialogDescription>
            They receive a secure invitation link by email. Rangverse has no public sign-up.
          </DialogDescription>
        </DialogHeader>

        <form action={handleSubmit} className="space-y-4" noValidate>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="fullName">Full name</Label>
              <Input id="fullName" name="fullName" required maxLength={120} autoComplete="off" />
              {fieldErrors.fullName && (
                <p className="text-status-danger text-xs">{fieldErrors.fullName}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" required autoComplete="off" />
              {fieldErrors.email && (
                <p className="text-status-danger text-xs">{fieldErrors.email}</p>
              )}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="role">Role</Label>
              <Select name="role" value={role} onValueChange={setRole}>
                <SelectTrigger id="role" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="INTERN">Intern</SelectItem>
                  <SelectItem value="MANAGER">Manager</SelectItem>
                  <SelectItem value="ADMIN">Administrator</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="designation">Designation</Label>
              <Input id="designation" name="designation" maxLength={120} autoComplete="off" />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="managerId">
                Assigned manager
                {role === "INTERN" && <span className="text-gold ml-1">*</span>}
              </Label>
              <Select name="managerId">
                <SelectTrigger id="managerId" className="w-full">
                  <SelectValue placeholder="Choose a manager" />
                </SelectTrigger>
                <SelectContent>
                  {managers.map((manager) => (
                    <SelectItem key={manager.id} value={manager.id}>
                      {displayName(manager)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {fieldErrors.managerId && (
                <p className="text-status-danger text-xs">{fieldErrors.managerId}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="teamId">Team</Label>
              <Select name="teamId">
                <SelectTrigger id="teamId" className="w-full">
                  <SelectValue placeholder="Choose a team" />
                </SelectTrigger>
                <SelectContent>
                  {teams.map((team) => (
                    <SelectItem key={team.id} value={team.id}>
                      {team.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input id="phone" name="phone" type="tel" autoComplete="off" />
              {fieldErrors.phone && (
                <p className="text-status-danger text-xs">{fieldErrors.phone}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="college">College or university</Label>
              <Input id="college" name="college" maxLength={120} autoComplete="off" />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="course">Course</Label>
              <Input id="course" name="course" maxLength={120} autoComplete="off" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="joiningDate">Joining date</Label>
              <Input id="joiningDate" name="joiningDate" type="date" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="internshipEndDate">Ends</Label>
              <Input id="internshipEndDate" name="internshipEndDate" type="date" />
              {fieldErrors.internshipEndDate && (
                <p className="text-status-danger text-xs">{fieldErrors.internshipEndDate}</p>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" size="lg" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="brand" size="lg" disabled={pending}>
              {pending && <LoaderCircleIcon className="animate-spin" aria-hidden />}
              Send invitation
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
