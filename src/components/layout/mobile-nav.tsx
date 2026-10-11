"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { MenuIcon } from "lucide-react";

import { RangverseLogo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import type { Actor } from "@/lib/auth/permissions";
import {
  ADMIN_NAV,
  isActivePath,
  MOBILE_NAV,
  PRIMARY_NAV,
  visibleNav,
  type NavItem,
} from "@/lib/navigation";
import { cn } from "@/lib/utils";

function DrawerLink({ item, onNavigate }: { item: NavItem; onNavigate: () => void }) {
  const pathname = usePathname();
  const active = isActivePath(pathname, item.href);

  if (item.comingIn) {
    return (
      <span
        aria-disabled
        className="text-muted-foreground/60 flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm"
      >
        <item.icon className="size-4 shrink-0" aria-hidden />
        <span>{item.label}</span>
        <span className="border-border ml-auto rounded-full border px-1.5 py-0.5 text-[0.6rem] tracking-wider uppercase">
          {item.comingIn}
        </span>
      </span>
    );
  }

  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm",
        active
          ? "bg-sidebar-accent text-foreground font-medium"
          : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground",
      )}
    >
      <item.icon className={cn("size-4 shrink-0", active && "text-gold")} aria-hidden />
      {item.label}
    </Link>
  );
}

/** Hamburger drawer holding the full navigation on small screens. */
export function MobileNavDrawer({ actor }: { actor: Actor }) {
  const [open, setOpen] = useState(false);
  const primary = visibleNav(PRIMARY_NAV, actor);
  const admin = visibleNav(ADMIN_NAV, actor);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon-lg" className="lg:hidden" aria-label="Open menu">
          <MenuIcon className="size-5" aria-hidden />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="bg-sidebar w-[18rem] p-0">
        <SheetHeader className="border-sidebar-border border-b px-5 py-4">
          <SheetTitle asChild>
            <span>
              <RangverseLogo showTagline={false} />
            </span>
          </SheetTitle>
          <SheetDescription className="sr-only">Rangverse navigation</SheetDescription>
        </SheetHeader>

        <nav aria-label="Primary" className="space-y-1 overflow-y-auto px-3 py-4">
          {primary.map((item) => (
            <DrawerLink key={item.href} item={item} onNavigate={() => setOpen(false)} />
          ))}

          {admin.length > 0 && (
            <>
              <p className="text-muted-foreground/70 px-3 pt-5 pb-2 text-[0.6rem] font-medium tracking-[0.2em] uppercase">
                Administration
              </p>
              {admin.map((item) => (
                <DrawerLink key={item.href} item={item} onNavigate={() => setOpen(false)} />
              ))}
            </>
          )}
        </nav>
      </SheetContent>
    </Sheet>
  );
}

/**
 * Bottom bar for the four actions that must always be one tap away on a phone.
 * Nothing here depends on hover.
 */
export function MobileBottomNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Quick navigation"
      className="bg-sidebar/95 border-sidebar-border fixed inset-x-0 bottom-0 z-40 border-t pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
    >
      <ul className="grid grid-cols-4">
        {MOBILE_NAV.map((item) => {
          const active = isActivePath(pathname, item.href);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-[3.75rem] flex-col items-center justify-center gap-1 px-1 py-2 text-[0.65rem]",
                  active ? "text-gold" : "text-muted-foreground",
                )}
              >
                <item.icon className="size-5" aria-hidden />
                <span className="truncate">{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
