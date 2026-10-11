import type { ComponentType, ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * Deliberate empty state. Every list, table and panel in Rangverse uses this
 * instead of rendering nothing, so a blank screen never looks like a failure.
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon?: ComponentType<{ className?: string }>;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "border-border/70 flex flex-col items-center justify-center rounded-xl border border-dashed px-6 py-12 text-center",
        className,
      )}
    >
      {Icon && (
        <span className="bg-muted text-gold mb-4 flex size-11 items-center justify-center rounded-full">
          <Icon className="size-5" />
        </span>
      )}
      <p className="font-heading text-foreground text-base font-semibold">{title}</p>
      {description && (
        <p className="text-muted-foreground mt-1.5 max-w-sm text-sm leading-relaxed">
          {description}
        </p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
