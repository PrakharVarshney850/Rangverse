import type { Metadata } from "next";
import Link from "next/link";
import { DatabaseIcon, LockIcon } from "lucide-react";

import { EmptyState } from "@/components/common/empty-state";
import { PageHeader } from "@/components/common/page-header";
import { StatusPill } from "@/components/common/status-pill";
import { Button } from "@/components/ui/button";
import { requireUser } from "@/lib/auth/guards";
import { can } from "@/lib/auth/permissions";
import { listSheets } from "@/lib/data/sheets";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Data hub" };

export default async function DataHubPage() {
  const session = await requireUser();
  const supabase = await createClient();
  const sheets = await listSheets(supabase);
  const isAdmin = can(session.actor, "sheets.manage");

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Data hub"
        title="Business databases"
        description="Spreadsheet-style company data. You see only the sheets you have been granted, and inside each one, only the records assigned to you."
        actions={
          isAdmin ? (
            <Button asChild variant="brand" size="lg">
              <Link href="/admin/sheets">Manage sheets</Link>
            </Button>
          ) : undefined
        }
      />

      {sheets.length === 0 ? (
        <EmptyState
          icon={LockIcon}
          title="No sheets have been shared with you"
          description="Access to each sheet is granted individually by an administrator and enforced by the database. Ask your manager if you need a sheet."
          className="bg-card"
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {sheets.map((sheet) => {
            const myAccess = sheet.memberships.find(
              (membership) => membership.user_id === session.id,
            );
            const level = isAdmin ? "Full access" : myAccess?.access_level === "EDIT" ? "Can edit" : "View only";

            return (
              <Link
                key={sheet.id}
                href={`/data/${sheet.slug}`}
                className="bg-card border-border/70 hover:border-gold/30 group flex flex-col rounded-xl border p-5 transition-colors"
              >
                <span className="bg-gold/12 text-gold mb-4 flex size-9 items-center justify-center rounded-lg">
                  <DatabaseIcon className="size-4" aria-hidden />
                </span>
                <p className="font-heading group-hover:text-gold text-base font-semibold transition-colors">
                  {sheet.title}
                </p>
                {sheet.description && (
                  <p className="text-muted-foreground mt-1.5 line-clamp-2 flex-1 text-xs leading-relaxed">
                    {sheet.description}
                  </p>
                )}
                <div className="mt-4">
                  <StatusPill tone={level === "View only" ? "idle" : "gold"}>{level}</StatusPill>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
