"use client";

import { useState, useTransition } from "react";
import { LoaderCircleIcon, SaveIcon } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { completeProfileAction } from "@/lib/actions/people";
import type { ProfileRow } from "@/lib/db/database.types";

/**
 * The only profile fields a person may change about themselves. Role, manager,
 * team and employment dates are administrator-controlled and are rejected by a
 * database trigger if submitted here.
 */
export function ProfileForm({
  profile,
  submitLabel = "Save profile",
}: {
  profile: ProfileRow;
  submitLabel?: string;
}) {
  const [pending, startTransition] = useTransition();
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      const result = await completeProfileAction(formData);
      if (result.ok) {
        toast.success(result.message);
        setFieldErrors({});
      } else {
        setFieldErrors(result.fieldErrors ?? {});
        toast.error(result.message);
      }
    });
  }

  return (
    <form action={handleSubmit} className="space-y-5" noValidate>
      <div className="space-y-2">
        <Label htmlFor="fullName">Full name</Label>
        <Input
          id="fullName"
          name="fullName"
          defaultValue={profile.full_name ?? ""}
          required
          maxLength={120}
          autoComplete="name"
          aria-invalid={Boolean(fieldErrors.fullName)}
        />
        {fieldErrors.fullName && (
          <p className="text-status-danger text-xs">{fieldErrors.fullName}</p>
        )}
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="phone">Phone</Label>
          <Input
            id="phone"
            name="phone"
            type="tel"
            inputMode="tel"
            defaultValue={profile.phone ?? ""}
            autoComplete="tel"
            aria-invalid={Boolean(fieldErrors.phone)}
          />
          {fieldErrors.phone && <p className="text-status-danger text-xs">{fieldErrors.phone}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="college">College or university</Label>
          <Input
            id="college"
            name="college"
            defaultValue={profile.college ?? ""}
            maxLength={120}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="course">Course or qualification</Label>
        <Input id="course" name="course" defaultValue={profile.course ?? ""} maxLength={120} />
      </div>

      <Button type="submit" variant="brand" size="xl" disabled={pending}>
        {pending ? (
          <LoaderCircleIcon className="animate-spin" aria-hidden />
        ) : (
          <SaveIcon aria-hidden />
        )}
        {submitLabel}
      </Button>
    </form>
  );
}
