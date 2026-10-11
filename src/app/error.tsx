"use client";

import { useEffect } from "react";
import { AlertTriangleIcon } from "lucide-react";

import { Button } from "@/components/ui/button";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // The message is logged server-side; nothing sensitive is shown to the user.
    console.error("[rangverse] unhandled error", error.digest ?? error.message);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-5 text-center">
      <span className="bg-status-danger/12 text-status-danger mb-5 flex size-12 items-center justify-center rounded-full">
        <AlertTriangleIcon className="size-5" aria-hidden />
      </span>
      <h1 className="font-heading text-2xl font-bold">Something went wrong</h1>
      <p className="text-muted-foreground mt-3 max-w-md text-sm leading-relaxed">
        That did not load correctly. Try again — if it keeps happening, tell a Rangverse
        administrator{error.digest ? ` and quote reference ${error.digest}` : ""}.
      </p>
      <Button variant="brand" size="xl" className="mt-8" onClick={reset}>
        Try again
      </Button>
    </div>
  );
}
