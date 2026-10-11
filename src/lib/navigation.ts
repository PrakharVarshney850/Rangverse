import {
  BarChart3Icon,
  BookOpenIcon,
  DatabaseIcon,
  FileTextIcon,
  LayoutDashboardIcon,
  ListChecksIcon,
  SendIcon,
  SettingsIcon,
  ShieldIcon,
  TimerIcon,
  UsersIcon,
  type LucideIcon,
} from "lucide-react";

import type { Actor, Permission } from "@/lib/auth/permissions";
import { can } from "@/lib/auth/permissions";

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  /** When set, the item only renders if the actor holds this permission. */
  permission?: Permission;
  /** Planned for a later version: shown, clearly labelled, but not clickable. */
  comingIn?: "v2" | "v3";
  description?: string;
}

/**
 * The sidebar, in the order specified for Rangverse.
 *
 * Items reserved for later versions are rendered as disabled entries with a
 * visible "v2" tag rather than as buttons that silently do nothing.
 */
export const PRIMARY_NAV: NavItem[] = [
  {
    label: "Overview",
    href: "/overview",
    icon: LayoutDashboardIcon,
    description: "Your day at a glance",
  },
  { label: "My tasks", href: "/tasks", icon: ListChecksIcon, description: "Assigned work" },
  { label: "Time tracker", href: "/time", icon: TimerIcon, description: "Clock, breaks, timers" },
  {
    label: "Daily reports",
    href: "/daily-reports",
    icon: FileTextIcon,
    description: "What you shipped today",
  },
  { label: "Data hub", href: "/data", icon: DatabaseIcon, description: "Business databases" },
  {
    label: "Team",
    href: "/team",
    icon: UsersIcon,
    permission: "attendance.viewTeam",
    description: "Who is on, and on what",
  },
  { label: "Resources", href: "/resources", icon: BookOpenIcon, comingIn: "v2" },
  { label: "Leave and requests", href: "/requests", icon: SendIcon, comingIn: "v2" },
  {
    label: "Reports",
    href: "/reports",
    icon: BarChart3Icon,
    permission: "analytics.viewTeam",
    description: "Hours and delivery",
  },
  { label: "Settings", href: "/settings", icon: SettingsIcon, description: "Your profile" },
];

export const ADMIN_NAV: NavItem[] = [
  { label: "People", href: "/admin/users", icon: UsersIcon, permission: "users.manage" },
  { label: "Data hub admin", href: "/admin/sheets", icon: DatabaseIcon, permission: "sheets.manage" },
  { label: "Activity", href: "/admin/activity", icon: ShieldIcon, permission: "activity.viewAll" },
];

/** The four actions that must be one tap away on a phone. */
export const MOBILE_NAV: NavItem[] = [
  { label: "Overview", href: "/overview", icon: LayoutDashboardIcon },
  { label: "Tasks", href: "/tasks", icon: ListChecksIcon },
  { label: "Time", href: "/time", icon: TimerIcon },
  { label: "Reports", href: "/daily-reports", icon: FileTextIcon },
];

export function visibleNav(items: NavItem[], actor: Actor | null): NavItem[] {
  return items.filter((item) => !item.permission || can(actor, item.permission));
}

/** Whether `href` is the active route for `pathname`. */
export function isActivePath(pathname: string, href: string): boolean {
  if (href === "/overview") {
    return pathname === "/" || pathname === "/overview";
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}
