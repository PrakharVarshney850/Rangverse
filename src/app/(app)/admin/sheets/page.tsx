import type { Metadata } from "next";
import Link from "next/link";
import { DatabaseIcon } from "lucide-react";

import { EmptyState } from "@/components/common/empty-state";
import { PageHeader } from "@/components/common/page-header";
import { SectionCard } from "@/components/common/section-card";
import { CreateSheetDialog, SheetAccessManager } from "@/components/data/sheet-admin";
import { requireAdmin } from "@/lib/auth/guards";
import { displayName, listVisiblePeople } from "@/lib/data/people";
import { getSheetColumns, listSheetMemberships, listSheets } from "@/lib/data/sheets";
import { createClient } from "@/lib/supabase/server";
import { SHEET_COLUMN_TYPE_LABELS } from "@/lib/validation/sheet";

export const metadata: Metadata = { title: "Data hub administration" };

export default async function AdminSheetsPage() {
  await requireAdmin();
  const supabase = await createClient();

  const [sheets, people] = await Promise.all([listSheets(supabase), listVisiblePeople(supabase)]);

  const details = await Promise.all(
    sheets.map(async (sheet) => ({
      sheet,
      columns: await getSheetColumns(supabase, sheet.id),
      memberships: await listSheetMemberships(supabase, sheet.id),
    })),
  );

  const assignable = people.map((person) => ({
    id: person.id,
    full_name: person.full_name,
    email: person.email,
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Administration"
        title="Data hub"
        description="Create sheets, configure their columns and decide exactly who can open each one. Revoking access takes effect on the next request."
        actions={<CreateSheetDialog />}
      />

      {details.length === 0 ? (
        <EmptyState
          icon={DatabaseIcon}
          title="No sheets yet"
          description="Create your first business database — Influencer Directory and Brand Leads come with ready-made columns."
          className="bg-card"
          action={<CreateSheetDialog />}
        />
      ) : (
        <div className="space-y-5">
          {details.map(({ sheet, columns, memberships }) => (
            <SectionCard
              key={sheet.id}
              title={sheet.title}
              description={sheet.description ?? undefined}
              actions={
                <Link
                  href={`/data/${sheet.slug}`}
                  className="text-gold text-xs underline-offset-4 hover:underline"
                >
                  Open sheet
                </Link>
              }
            >
              <div className="grid gap-6 lg:grid-cols-2">
                <div>
                  <p className="text-muted-foreground mb-3 text-[0.68rem] font-medium tracking-[0.12em] uppercase">
                    Columns ({columns.length})
                  </p>
                  {columns.length === 0 ? (
                    <p className="text-muted-foreground text-xs">
                      No columns configured. Records cannot be added until at least one exists.
                    </p>
                  ) : (
                    <ul className="flex flex-wrap gap-2">
                      {columns.map((column) => (
                        <li
                          key={column.id}
                          className="border-border/60 rounded-lg border px-2.5 py-1.5 text-xs"
                        >
                          <span className="font-medium">{column.label}</span>
                          <span className="text-muted-foreground ml-1.5">
                            {SHEET_COLUMN_TYPE_LABELS[column.data_type]}
                            {column.is_required ? " · required" : ""}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div>
                  <p className="text-muted-foreground mb-3 text-[0.68rem] font-medium tracking-[0.12em] uppercase">
                    Access ({memberships.length})
                  </p>
                  <SheetAccessManager
                    sheetId={sheet.id}
                    people={assignable}
                    members={memberships.map((membership) => ({
                      userId: membership.user_id,
                      name: displayName(membership.profile),
                      accessLevel: membership.access_level,
                    }))}
                  />
                </div>
              </div>
            </SectionCard>
          ))}
        </div>
      )}
    </div>
  );
}
