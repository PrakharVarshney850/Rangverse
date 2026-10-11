import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * Panel wrapper matching the soft dark cards used across therangmanch.in.
 */
export function SectionCard({
  title,
  description,
  actions,
  children,
  className,
  bodyClassName,
}: {
  title?: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section className={cn("bg-card border-border/70 rounded-xl border", className)}>
      {(title ?? actions) && (
        <header className="border-border/60 flex flex-wrap items-start justify-between gap-3 border-b px-5 py-4">
          <div className="min-w-0">
            {title && <h2 className="font-heading text-base font-semibold">{title}</h2>}
            {description && (
              <p className="text-muted-foreground mt-1 text-xs leading-relaxed">{description}</p>
            )}
          </div>
          {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className={cn("p-5", bodyClassName)}>{children}</div>
    </section>
  );
}

/**
 * Inline "not authorized" panel. Used wherever a role can reach a surface but
 * must not see its contents — the page still explains itself instead of 404ing.
 */
export function AccessDenied({
  title = "You do not have access to this",
  description = "Your role does not include permission for this resource. If you believe this is a mistake, contact a Rangverse administrator.",
  className,
}: {
  title?: string;
  description?: string;
  className?: string;
}) {
  return (
    <div
      role="status"
      className={cn(
        "border-status-danger/25 bg-status-danger/8 rounded-xl border px-5 py-6",
        className,
      )}
    >
      <p className="font-heading text-status-danger text-base font-semibold">{title}</p>
      <p className="text-muted-foreground mt-1.5 max-w-xl text-sm leading-relaxed">{description}</p>
    </div>
  );
}
