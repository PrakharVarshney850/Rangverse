import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type {
  Database,
  DataSheetColumnRow,
  DataSheetMembershipRow,
  DataSheetRow,
} from "@/lib/db/database.types";
import type { PersonSummary } from "@/lib/display";
import type { SheetRecord, SheetRowPage } from "@/lib/view-models";

export { SHEET_TEMPLATES, type SheetTemplateKey, type TemplateColumn } from "@/lib/sheet-templates";
export type { SheetRecord, SheetRowPage };

export type SheetSummary = DataSheetRow & {
  memberships: Pick<DataSheetMembershipRow, "access_level" | "user_id">[];
};

export const SHEET_ROWS_PAGE_SIZE = 25;

/** Sheets the caller may open. Row level security performs the filtering. */
export async function listSheets(supabase: SupabaseClient<Database>): Promise<SheetSummary[]> {
  const { data } = await supabase
    .from("data_sheets")
    .select("*, memberships:data_sheet_memberships(user_id, access_level)")
    .eq("status", "ACTIVE")
    .order("title", { ascending: true });

  return (data ?? []) as SheetSummary[];
}

export async function getSheetBySlug(
  supabase: SupabaseClient<Database>,
  slug: string,
): Promise<DataSheetRow | null> {
  const { data } = await supabase.from("data_sheets").select("*").eq("slug", slug).maybeSingle();
  return data ?? null;
}

export async function getSheetColumns(
  supabase: SupabaseClient<Database>,
  sheetId: string,
): Promise<DataSheetColumnRow[]> {
  const { data } = await supabase
    .from("data_sheet_columns")
    .select("*")
    .eq("sheet_id", sheetId)
    .order("display_order", { ascending: true });

  return data ?? [];
}

/**
 * The caller's own access level for a sheet.
 *
 * Administrators are not members, so they are reported as EDIT directly rather
 * than being given a synthetic membership row.
 */
export async function getMyAccessLevel(
  supabase: SupabaseClient<Database>,
  sheetId: string,
  userId: string,
  isAdministrator: boolean,
): Promise<"VIEW" | "EDIT" | null> {
  if (isAdministrator) return "EDIT";

  const { data } = await supabase
    .from("data_sheet_memberships")
    .select("access_level")
    .eq("sheet_id", sheetId)
    .eq("user_id", userId)
    .maybeSingle();

  return data?.access_level ?? null;
}

export async function listSheetRows(
  supabase: SupabaseClient<Database>,
  sheetId: string,
  options: { page?: number; search?: string; assignedTo?: string } = {},
): Promise<SheetRowPage> {
  const page = Math.max(1, options.page ?? 1);
  const from = (page - 1) * SHEET_ROWS_PAGE_SIZE;
  const to = from + SHEET_ROWS_PAGE_SIZE - 1;

  let query = supabase
    .from("data_sheet_rows")
    .select("*, assignee:profiles!data_sheet_rows_assigned_to_user_id_fkey(id, full_name, email)", {
      count: "exact",
    })
    .eq("sheet_id", sheetId);

  if (options.assignedTo) {
    query = query.eq("assigned_to_user_id", options.assignedTo);
  }

  if (options.search) {
    // Search the serialised row payload. The term is escaped so it cannot
    // alter the PostgREST filter grammar.
    const term = options.search.replace(/[%_,().*]/g, " ").trim();
    if (term) {
      query = query.filter("row_data::text", "ilike", `%${term}%`);
    }
  }

  const { data, count } = await query
    .order("created_at", { ascending: false })
    .range(from, to);

  const total = count ?? 0;

  return {
    rows: (data ?? []) as SheetRecord[],
    total,
    page,
    pageCount: Math.max(1, Math.ceil(total / SHEET_ROWS_PAGE_SIZE)),
  };
}

export async function getSheetRow(
  supabase: SupabaseClient<Database>,
  rowId: string,
): Promise<SheetRecord | null> {
  const { data } = await supabase
    .from("data_sheet_rows")
    .select("*, assignee:profiles!data_sheet_rows_assigned_to_user_id_fkey(id, full_name, email)")
    .eq("id", rowId)
    .maybeSingle();

  return (data as SheetRecord | null) ?? null;
}

export type SheetMembershipWithPerson = DataSheetMembershipRow & {
  profile: PersonSummary | null;
};

export async function listSheetMemberships(
  supabase: SupabaseClient<Database>,
  sheetId: string,
): Promise<SheetMembershipWithPerson[]> {
  const { data } = await supabase
    .from("data_sheet_memberships")
    .select("*, profile:profiles!data_sheet_memberships_user_id_fkey(id, full_name, email)")
    .eq("sheet_id", sheetId)
    .order("created_at", { ascending: true });

  return (data ?? []) as SheetMembershipWithPerson[];
}
