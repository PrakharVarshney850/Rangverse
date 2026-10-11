import type { ReactNode } from "react";
import { redirect } from "next/navigation";

import { MobileBottomNav } from "@/components/layout/mobile-nav";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { getSessionUser } from "@/lib/auth/guards";
import { isAccountActive } from "@/lib/auth/permissions";

/**
 * Authenticated shell.
 *
 * The middleware already blocks unauthenticated requests; this re-check means
 * the boundary does not depend on middleware alone.
 */
export default async function AppLayout({ children }: { children: ReactNode }) {
  const session = await getSessionUser();

  if (!session) {
    redirect("/login");
  }

  if (!isAccountActive(session.actor)) {
    redirect("/account-suspended");
  }

  return (
    <div className="flex min-h-dvh">
      <Sidebar actor={session.actor} />

      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar session={session} />
        <main
          id="main"
          className="flex-1 px-4 pt-6 pb-28 sm:px-6 sm:pb-10 lg:px-8"
        >
          <div className="mx-auto w-full max-w-7xl">{children}</div>
        </main>
      </div>

      <MobileBottomNav />
    </div>
  );
}
