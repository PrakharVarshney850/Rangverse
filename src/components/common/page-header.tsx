import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * Standard page heading used on every authenticated route so hierarchy and
 * spacing stay consistent across the workspace.
 */
export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  className,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between", className)}>
      <div className="min-w-0">
        {eyebrow && (
          <p className="text-gold mb-2 text-[0.68rem] font-medium tracking-[0.2em] uppercase">
            {eyebrow}
          </p>
        )}
        <h1 className="font-heading text-2xl font-bold sm:text-3xl">{title}</h1>
        {description && (
          <p className="text-muted-foreground mt-2 max-w-2xl text-sm leading-relaxed">
            {description}
          </p>
        )}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}
