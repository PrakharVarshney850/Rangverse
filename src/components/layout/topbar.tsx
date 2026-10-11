import Link from "next/link";
import { LogOutIcon, SettingsIcon } from "lucide-react";

import { signOutAction } from "@/app/(public)/actions";
import { MobileNavDrawer } from "@/components/layout/mobile-nav";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { SessionUser } from "@/lib/auth/guards";

const ROLE_LABELS = {
  ADMIN: "Administrator",
  MANAGER: "Manager",
  INTERN: "Intern",
} as const;

function initials(name: string | null, email: string): string {
  const source = name?.trim() || email;
  const parts = source.split(/[\s@._-]+/).filter(Boolean);
  const first = parts[0]?.[0] ?? "R";
  const second = parts.length > 1 ? (parts[1]?.[0] ?? "") : "";
  return `${first}${second}`.toUpperCase();
}

export function Topbar({ session }: { session: SessionUser }) {
  const { profile } = session;
  const displayName = profile.full_name?.trim() || session.email;

  return (
    <header className="bg-background/90 border-border/70 sticky top-0 z-30 flex h-16 shrink-0 items-center gap-3 border-b px-4 backdrop-blur sm:px-6">
      <MobileNavDrawer actor={session.actor} />

      <div className="min-w-0 flex-1">
        <p className="text-muted-foreground truncate text-xs tracking-[0.16em] uppercase">
          {ROLE_LABELS[profile.role]}
          {profile.designation ? ` · ${profile.designation}` : ""}
        </p>
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            className="h-10 gap-2.5 px-2"
            aria-label={`Account menu for ${displayName}`}
          >
            <Avatar className="size-7">
              <AvatarFallback className="bg-gold/15 text-gold text-xs font-semibold">
                {initials(profile.full_name, session.email)}
              </AvatarFallback>
            </Avatar>
            <span className="hidden max-w-[12rem] truncate text-sm sm:inline">{displayName}</span>
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end" className="w-60">
          <DropdownMenuLabel className="font-normal">
            <span className="block truncate text-sm font-medium">{displayName}</span>
            <span className="text-muted-foreground block truncate text-xs">{session.email}</span>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <Link href="/settings">
              <SettingsIcon className="size-4" aria-hidden />
              Profile and settings
            </Link>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild variant="destructive">
            <form action={signOutAction} className="w-full">
              <button type="submit" className="flex w-full items-center gap-2 text-left">
                <LogOutIcon className="size-4" aria-hidden />
                Sign out
              </button>
            </form>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
