"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { AlertCircleIcon, LoaderCircleIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { resetPasswordAction } from "../actions";
import { IDLE, type ActionState } from "../action-state";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="brand" size="xl" className="w-full" disabled={pending}>
      {pending ? (
        <>
          <LoaderCircleIcon className="animate-spin" aria-hidden />
          Saving…
        </>
      ) : (
        "Set new password"
      )}
    </Button>
  );
}

export function ResetPasswordForm() {
  const [state, formAction] = useActionState<ActionState, FormData>(resetPasswordAction, IDLE);

  return (
    <form action={formAction} className="space-y-5" noValidate>
      {state.status === "error" && state.message && (
        <p
          role="alert"
          className="border-status-danger/30 bg-status-danger/10 text-status-danger flex items-start gap-2 rounded-lg border px-3 py-2.5 text-sm"
        >
          <AlertCircleIcon className="mt-0.5 size-4 shrink-0" aria-hidden />
          {state.message}
        </p>
      )}

      <div className="space-y-2">
        <Label htmlFor="password">New password</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          aria-invalid={Boolean(state.fieldErrors?.password)}
          aria-describedby="password-help"
        />
        <p id="password-help" className="text-muted-foreground text-xs">
          At least 12 characters, with an uppercase letter, a lowercase letter and a number.
        </p>
        {state.fieldErrors?.password && (
          <p className="text-status-danger text-xs">{state.fieldErrors.password}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="confirmPassword">Confirm new password</Label>
        <Input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          required
          aria-invalid={Boolean(state.fieldErrors?.confirmPassword)}
        />
        {state.fieldErrors?.confirmPassword && (
          <p className="text-status-danger text-xs">{state.fieldErrors.confirmPassword}</p>
        )}
      </div>

      <SubmitButton />
    </form>
  );
}
