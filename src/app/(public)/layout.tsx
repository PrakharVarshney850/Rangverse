import type { ReactNode } from "react";

import { RangverseLogo } from "@/components/brand/logo";

/**
 * Chrome for the unauthenticated screens: the stage glow and typography of
 * therangmanch.in, with the form presented as a single focused card.
 */
export default function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <div className="rv-stage-glow relative flex min-h-dvh flex-col">
      <header className="relative z-10 px-5 py-6 sm:px-10">
        <RangverseLogo />
      </header>

      <main className="relative z-10 flex flex-1 items-center justify-center px-5 pb-16 sm:px-10">
        <div className="w-full max-w-md">{children}</div>
      </main>

      <footer className="text-muted-foreground relative z-10 px-5 pb-8 text-center text-xs sm:px-10">
        <div className="rv-hairline mx-auto mb-5 h-px w-40" />
        <p className="tracking-[0.18em] uppercase">Rangmanch · Express · Inspire · Entertain</p>
        <p className="mt-2">Rangverse is an invite-only internal workspace.</p>
      </footer>
    </div>
  );
}
