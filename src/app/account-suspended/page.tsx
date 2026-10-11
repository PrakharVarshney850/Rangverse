import { PauseCircleIcon } from "lucide-react";

import { signOutAction } from "@/app/(public)/actions";
import { RangverseLogo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Account paused" };

/**
 * Lives outside the authenticated layout on purpose: that layout redirects
 * suspended accounts here, so rendering it inside would loop.
 */
export default function AccountSuspendedPage() {
  return (
    <div className="rv-stage-glow flex min-h-dvh flex-col items-center justify-center px-5 text-center">
      <RangverseLogo className="mb-10" />
      <span className="bg-status-break/12 text-status-break mb-5 flex size-12 items-center justify-center rounded-full">
        <PauseCircleIcon className="size-5" aria-hidden />
      </span>
      <h1 className="font-heading text-2xl font-bold">Your account is not active</h1>
      <p className="text-muted-foreground mt-3 max-w-md text-sm leading-relaxed">
        A Rangverse administrator has paused or closed this account, so it cannot reach workspace
        data right now. If you think that is a mistake, contact your manager.
      </p>
      <form action={signOutAction} className="mt-8">
        <Button type="submit" variant="outline" size="xl">
          Sign out
        </Button>
      </form>
    </div>
  );
}
