"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { PanelLeftCloseIcon, PanelLeftOpenIcon } from "lucide-react";

import { RangmanchMark, RangverseLogo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import type { Actor } from "@/lib/auth/permissions";
import { ADMIN_NAV, isActivePath, PRIMARY_NAV, visibleNav, type NavItem } from "@/lib/navigation";
import { cn } from "@/lib/utils";

function NavLink({ item, collapsed }: { item: NavItem; collapsed: boolean }) {
  const pathname = usePathname();
  const active = isActivePath(pathname, item.href);

  if (item.comingIn) {
    return (
      <span
        aria-disabled
        title={`Planned for version ${item.comingIn}`}
        className={cn(
          "text-muted-foreground/60 flex cursor-not-allowed items-center gap-3 rounded-lg px-3 py-2 text-sm",
          collapsed && "justify-center px-0",
        )}
      >
        <item.icon className="size-4 shrink-0" aria-hidden />
        {!collapsed && (
          <>
            <span className="truncate">{item.label}</span>
            <span className="border-border text-muted-foreground/70 ml-auto rounded-full border px-1.5 py-0.5 text-[0.6rem] tracking-wider uppercase">
              {item.comingIn}
            </span>
          </>
        )}
      </span>
    );
  }

  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
        active
          ? "bg-sidebar-accent text-foreground font-medium"
          : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground",
        collapsed && "justify-center px-0",
      )}
      title={collapsed ? item.label : undefined}
    >
      {active && (
        <span
          aria-hidden
          className="bg-gold absolute top-1.5 bottom-1.5 -left-3 w-0.5 rounded-full"
        />
      )}
      <item.icon
        className={cn("size-4 shrink-0", active ? "text-gold" : "text-current")}
        aria-hidden
      />
      {!collapsed && <span className="truncate">{item.label}</span>}
    </Link>
  );
}

function NavGroup({
  title,
  items,
  collapsed,
}: {
  title: string;
  items: NavItem[];
  collapsed: boolean;
}) {
  if (items.length === 0) return null;

  return (
    <div className="space-y-1">
      {!collapsed && (
        <p className="text-muted-foreground/70 px-3 pt-5 pb-2 text-[0.6rem] font-medium tracking-[0.2em] uppercase">
          {title}
        </p>
      )}
      {collapsed && <div className="bg-border my-4 h-px" />}
      {items.map((item) => (
        <NavLink key={item.href} item={item} collapsed={collapsed} />
      ))}
    </div>
  );
}

/** Desktop sidebar. Collapses to an icon rail; the state is purely local. */
export function Sidebar({ actor }: { actor: Actor }) {
  const [collapsed, setCollapsed] = useState(false);
  const primary = visibleNav(PRIMARY_NAV, actor);
  const admin = visibleNav(ADMIN_NAV, actor);

  return (
    <aside
      data-collapsed={collapsed}
      className={cn(
        "bg-sidebar border-sidebar-border hidden shrink-0 flex-col border-r lg:flex",
        collapsed ? "w-[4.5rem]" : "w-64",
      )}
    >
      <div
        className={cn(
          "flex h-16 items-center border-b border-sidebar-border px-5",
          collapsed && "justify-center px-0",
        )}
      >
        {collapsed ? (
          <Link href="/overview" aria-label="Rangverse overview">
            <RangmanchMark className="text-sidebar size-7" />
          </Link>
        ) : (
          <Link href="/overview" aria-label="Rangverse overview">
            <RangverseLogo showTagline={false} />
          </Link>
        )}
      </div>

      <nav
        aria-label="Primary"
        className={cn("flex-1 overflow-y-auto px-3 py-4", collapsed && "px-3")}
      >
        <div className="space-y-1">
          {primary.map((item) => (
            <NavLink key={item.href} item={item} collapsed={collapsed} />
          ))}
        </div>
        <NavGroup title="Administration" items={admin} collapsed={collapsed} />
      </nav>

      <div className="border-sidebar-border border-t p-3">
        <Button
          variant="ghost"
          size="sm"
          className="text-muted-foreground w-full justify-center"
          onClick={() => setCollapsed((value) => !value)}
          aria-expanded={!collapsed}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? (
            <PanelLeftOpenIcon className="size-4" aria-hidden />
          ) : (
            <>
              <PanelLeftCloseIcon className="size-4" aria-hidden />
              Collapse
            </>
          )}
        </Button>
      </div>
    </aside>
  );
}
