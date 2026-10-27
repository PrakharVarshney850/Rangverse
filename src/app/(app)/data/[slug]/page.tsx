import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeftIcon } from "lucide-react";

import { AccessDenied } from "@/components/common/section-card";
import { PageHeader } from "@/components/common/page-header";
import { SheetTable } from "@/components/data/sheet-table";
import { Button } from "@/components/ui/button";
import { requireUser } from "@/lib/auth/guards";
import { can } from "@/lib/auth/permissions";
import { listAssignablepeople } from "@/lib/data/people";
import {
  getMyAccessLevel,
  getSheetBySlug,
  getSheetColumns,
  listSheetRows,
} from "@/lib/data/sheets";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Sheet" };

export default async function SheetPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { slug } = await params;
  const query = await searchParams;
  const session = await requireUser();
  const supabase = await createClient();

  const sheet = await getSheetBySlug(supabase, slug);

  // Row level security hides sheets the caller has no membership for, so an
  // unauthorised slug is indistinguishable from one that does not exist.
  if (!sheet) {
    notFound();
  }

  const isAdmin = can(session.actor, "sheets.manage");
  const canAssign = can(session.actor, "sheets.assignRows");

  const search = typeof query.q === "string" ? query.q : "";
  const page = Number.parseInt(typeof query.page === "string" ? query.page : "1", 10) || 1;

  const [columns, accessLevel, rowPage, assignees] = await Promise.all([
    getSheetColumns(supabase, sheet.id),
    getMyAccessLevel(supabase, sheet.id, session.id, isAdmin),
    listSheetRows(supabase, sheet.id, { page, search }),
    canAssign ? listAssignablepeople(supabase) : Promise.resolve([]),
  ]);

  if (!accessLevel) {
    return (
      <div className="space-y-6">
        <PageHeader eyebrow="Data hub" title={sheet.title} />
        <AccessDenied description="You can see this sheet exists, but your access has been revoked. Ask an administrator if you still need it." />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link href="/data">
          <ArrowLeftIcon aria-hidden />
          All sheets
        </Link>
      </Button>

      <PageHeader
        eyebrow="Data hub"
        title={sheet.title}
        description={
          sheet.description ??
          "Every record here is scoped to you by the database, not by this page."
        }
      />

      {columns.length === 0 ? (
        <AccessDenied
          title="This sheet has no columns yet"
          description="An administrator needs to configure the columns before records can be added."
        />
      ) : (
        <SheetTable
          sheetId={sheet.id}
          columns={columns}
          page={rowPage}
          canEdit={accessLevel === "EDIT"}
          canAssign={canAssign}
          assignees={assignees}
          sheetSlug={slug}
          searchTerm={search}
        />
      )}
    </div>
  );
}
