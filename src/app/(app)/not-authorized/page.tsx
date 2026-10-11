import Link from "next/link";
import { ShieldAlertIcon } from "lucide-react";

import { Button } from "@/components/ui/button";

export const metadata = { title: "Not authorized" };

export default function NotAuthorizedPage() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
      <span className="bg-status-danger/12 text-status-danger mb-5 flex size-12 items-center justify-center rounded-full">
        <ShieldAlertIcon className="size-5" aria-hidden />
      </span>
      <h1 className="font-heading text-2xl font-bold">You do not have access to this</h1>
      <p className="text-muted-foreground mt-3 max-w-md text-sm leading-relaxed">
        Your role does not include permission for this area. Access in Rangverse is granted by an
        administrator and enforced by the database, so this is not something you can change
        yourself.
      </p>
      <Button asChild variant="outline" size="xl" className="mt-8">
        <Link href="/overview">Back to overview</Link>
      </Button>
    </div>
  );
}
