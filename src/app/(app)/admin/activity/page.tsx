import type { Metadata } from "next";

import { EmptyState } from "@/components/common/empty-state";
import { PageHeader } from "@/components/common/page-header";
import { SectionCard } from "@/components/common/section-card";
import { StatusPill } from "@/components/common/status-pill";
import { requirePermission } from "@/lib/auth/guards";
import { ACTIVITY_ACTION_LABELS, type ActivityAction } from "@/lib/activity";
import { displayName, listActivity } from "@/lib/data/people";
import { formatBusinessDate, formatBusinessTime } from "@/lib/domain/time";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Activity" };

export default async function AdminActivityPage() {
  await requirePermission("activity.viewAll");
  const supabase = await createClient();
  const entries = await listActivity(supabase, 100);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Administration"
        title="Activity history"
        description="An append-only record of significant actions. Application roles hold no UPDATE or DELETE privilege on this table, so entries cannot be rewritten. Credentials and tokens are never recorded."
      />

      <SectionCard title={`Last ${entries.length} events`}>
        {entries.length === 0 ? (
          <EmptyState
            title="Nothing recorded yet"
            description="Invitations, clock-ins, task changes and permission changes will appear here."
            className="border-0"
          />
        ) : (
          <ul className="space-y-3">
            {entries.map((entry) => (
              <li
                key={entry.id}
                className="border-border/60 flex flex-wrap items-start justify-between gap-3 border-b pb-3 last:border-b-0 last:pb-0"
              >
                <div className="min-w-0">
                  <p className="text-sm">
                    <span className="font-medium">{displayName(entry.actor)}</span>{" "}
                    <span className="text-muted-foreground">
                      {ACTIVITY_ACTION_LABELS[entry.action as ActivityAction] ?? entry.action}
                    </span>
                    {entry.subject && entry.subject.id !== entry.actor?.id && (
                      <span className="text-muted-foreground">
                        {" "}
                        · {displayName(entry.subject)}
                      </span>
                    )}
                  </p>
                  <p className="text-muted-foreground mt-0.5 text-xs">
                    {entry.entity_type}
                    {Object.keys(entry.metadata).length > 0 &&
                      ` · ${Object.entries(entry.metadata)
                        .map(([key, value]) => `${key}: ${String(value)}`)
                        .join(", ")}`}
                  </p>
                </div>

                <div className="flex shrink-0 items-center gap-2.5">
                  {entry.outcome !== "SUCCESS" && (
                    <StatusPill tone="danger">{entry.outcome}</StatusPill>
                  )}
                  <span className="text-muted-foreground text-xs whitespace-nowrap">
                    {formatBusinessDate(entry.created_at)} · {formatBusinessTime(entry.created_at)}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>
    </div>
  );
}
