"use client";

import { useTransition } from "react";
import { LoaderCircleIcon } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { setUserStatusAction } from "@/lib/actions/people";
import type { OnboardingStatus } from "@/lib/db/database.types";

/**
 * Pausing an account revokes every permission immediately, because the
 * database helper `app.is_active()` is consulted by every policy — not just by
 * this interface.
 */
export function UserStatusControl({
  userId,
  name,
  status,
  isSelf,
}: {
  userId: string;
  name: string;
  status: OnboardingStatus;
  isSelf: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const suspended = status === "PAUSED" || status === "OFFBOARDED";

  function change(next: "ACTIVE" | "PAUSED" | "OFFBOARDED") {
    startTransition(async () => {
      const result = await setUserStatusAction(userId, next);
      if (result.ok) {
        toast.success(result.message);
      } else {
        toast.error(result.message);
      }
    });
  }

  if (isSelf) {
    return <span className="text-muted-foreground text-xs">That&apos;s you</span>;
  }

  if (suspended) {
    return (
      <Button variant="outline" size="sm" disabled={pending} onClick={() => change("ACTIVE")}>
        {pending && <LoaderCircleIcon className="animate-spin" aria-hidden />}
        Reactivate
      </Button>
    );
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="destructive" size="sm" disabled={pending}>
          {pending && <LoaderCircleIcon className="animate-spin" aria-hidden />}
          Pause access
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="font-heading">Pause {name}?</AlertDialogTitle>
          <AlertDialogDescription>
            They will immediately lose access to every task, sheet and report — on their next
            request, not when they next refresh. Their recorded hours and history are kept.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={() => change("PAUSED")}>Pause access</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
