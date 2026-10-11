import type { ComponentType, ReactNode } from "react";

import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/**
 * Dashboard metric tile. `hint` is used to spell out how a number is derived,
 * because every metric in Rangverse must be explainable.
 */
export function MetricCard({
  label,
  value,
  hint,
  icon: Icon,
  footer,
  className,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  icon?: ComponentType<{ className?: string }>;
  footer?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "bg-card border-border/70 relative overflow-hidden rounded-xl border p-5",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-muted-foreground text-xs font-medium tracking-[0.12em] uppercase">
          {label}
        </p>
        {Icon && <Icon className="text-gold/70 size-4 shrink-0" />}
      </div>
      <p className="font-heading text-foreground mt-3 text-2xl font-bold tabular-nums">{value}</p>
      {hint && <p className="text-muted-foreground mt-1.5 text-xs leading-relaxed">{hint}</p>}
      {footer && <div className="mt-3">{footer}</div>}
    </div>
  );
}

export function MetricCardSkeleton() {
  return (
    <div className="bg-card border-border/70 rounded-xl border p-5">
      <Skeleton className="h-3 w-24" />
      <Skeleton className="mt-4 h-7 w-20" />
      <Skeleton className="mt-3 h-3 w-32" />
    </div>
  );
}
