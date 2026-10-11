import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export type StatusTone = "working" | "break" | "danger" | "info" | "urgent" | "idle" | "gold";

const toneClasses: Record<StatusTone, string> = {
  working: "border-status-working/30 bg-status-working/12 text-status-working",
  break: "border-status-break/30 bg-status-break/12 text-status-break",
  danger: "border-status-danger/30 bg-status-danger/12 text-status-danger",
  info: "border-status-info/30 bg-status-info/12 text-status-info",
  urgent: "border-status-urgent/30 bg-status-urgent/12 text-status-urgent",
  idle: "border-border bg-muted text-muted-foreground",
  gold: "border-gold/30 bg-gold/12 text-gold",
};

const dotClasses: Record<StatusTone, string> = {
  working: "bg-status-working",
  break: "bg-status-break",
  danger: "bg-status-danger",
  info: "bg-status-info",
  urgent: "bg-status-urgent",
  idle: "bg-status-idle",
  gold: "bg-gold",
};

/**
 * Status indicator that always pairs colour with a text label, so meaning never
 * depends on colour perception alone.
 */
export function StatusPill({
  tone = "idle",
  children,
  pulse = false,
  className,
}: {
  tone?: StatusTone;
  children: ReactNode;
  pulse?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap",
        toneClasses[tone],
        className,
      )}
    >
      <span className="relative flex size-1.5 shrink-0">
        {pulse && (
          <span
            aria-hidden
            className={cn(
              "absolute inline-flex size-full animate-ping rounded-full opacity-70",
              dotClasses[tone],
            )}
          />
        )}
        <span className={cn("relative inline-flex size-1.5 rounded-full", dotClasses[tone])} />
      </span>
      {children}
    </span>
  );
}
