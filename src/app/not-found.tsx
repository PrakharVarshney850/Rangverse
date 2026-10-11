import Link from "next/link";

import { RangverseLogo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="rv-stage-glow flex min-h-dvh flex-col items-center justify-center px-5 text-center">
      <RangverseLogo className="mb-10" />
      <p className="text-gold text-[0.68rem] font-medium tracking-[0.22em] uppercase">404</p>
      <h1 className="font-heading mt-3 text-3xl font-bold">Nothing on this stage</h1>
      <p className="text-muted-foreground mt-3 max-w-md text-sm leading-relaxed">
        The page you were looking for does not exist, or you do not have access to it.
      </p>
      <Button asChild variant="brand" size="xl" className="mt-8">
        <Link href="/overview">Back to overview</Link>
      </Button>
    </div>
  );
}
