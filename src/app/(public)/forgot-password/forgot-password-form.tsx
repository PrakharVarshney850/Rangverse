"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { CheckCircle2Icon, LoaderCircleIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { requestPasswordResetAction } from "../actions";
import { IDLE, type ActionState } from "../action-state";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="brand" size="xl" className="w-full" disabled={pending}>
      {pending ? (
        <>
          <LoaderCircleIcon className="animate-spin" aria-hidden />
          Sending…
        </>
      ) : (
        "Send reset link"
      )}
    </Button>
  );
}

export function ForgotPasswordForm() {
  const [state, formAction] = useActionState<ActionState, FormData>(
    requestPasswordResetAction,
    IDLE,
  );

  if (state.status === "success") {
    return (
      <div
        role="status"
        className="border-status-working/30 bg-status-working/10 rounded-lg border px-4 py-5"
      >
        <p className="text-status-working flex items-center gap-2 text-sm font-medium">
          <CheckCircle2Icon className="size-4 shrink-0" aria-hidden />
          Check your inbox
        </p>
        <p className="text-muted-foreground mt-2 text-sm leading-relaxed">{state.message}</p>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-5" noValidate>
      <div className="space-y-2">
        <Label htmlFor="email">Work email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          required
          placeholder="you@rangmanch.in"
          aria-invalid={Boolean(state.fieldErrors?.email)}
          aria-describedby={state.fieldErrors?.email ? "email-error" : undefined}
        />
        {state.fieldErrors?.email && (
          <p id="email-error" className="text-status-danger text-xs">
            {state.fieldErrors.email}
          </p>
        )}
      </div>

      <SubmitButton />
    </form>
  );
}
