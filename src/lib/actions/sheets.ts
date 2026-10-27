"use server";

import { revalidatePath } from "next/cache";

import { recordActivity } from "@/lib/activity";
import { assertPermission, assertSignedIn, AuthorizationError } from "@/lib/auth/guards";
import { getSheetColumns } from "@/lib/data/sheets";
import { SHEET_TEMPLATES } from "@/lib/sheet-templates";
import { createClient } from "@/lib/supabase/server";
import { slugify } from "@/lib/validation/profile";
import {
  buildRowSchema,
  compactRowData,
  createSheetSchema,
  sheetMembershipSchema,
  sheetRowAssignmentSchema,
} from "@/lib/validation/sheet";

export type SheetMutationResult =
  | { ok: true; message: string; id?: string; slug?: string }
  | { ok: false; message: string; fieldErrors?: Record<string, string> };

function fieldErrorsFrom(error: { issues: { path: readonly PropertyKey[]; message: string }[] }) {
  const fieldErrors: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    fieldErrors[key] ??= issue.message;
  }
  return fieldErrors;
}

function humanize(message: string): string {
  if (/row-level security/i.test(message)) return "You are not allowed to do that.";
  if (/duplicate key/i.test(message)) return "Something with that name already exists.";
  return message.replace(/^.*?:\s*/, "").trim() || "Something went wrong. Try again.";
}

export async function createSheetAction(formData: FormData): Promise<SheetMutationResult> {
  try {
    const session = await assertPermission("sheets.manage");

    const parsed = createSheetSchema.safeParse({
      title: formData.get("title"),
      description: formData.get("description"),
      template: formData.get("template") ?? "BLANK",
    });

    if (!parsed.success) {
      return {
        ok: false,
        message: "Check the highlighted fields.",
        fieldErrors: fieldErrorsFrom(parsed.error),
      };
    }

    const supabase = await createClient();
    const slug = slugify(parsed.data.title);

    if (!slug) {
      return { ok: false, message: "Use a name with at least one letter or number." };
    }

    const { data: sheet, error } = await supabase
      .from("data_sheets")
      .insert({
        title: parsed.data.title,
        slug,
        description: parsed.data.description,
        created_by: session.id,
      })
      .select("id, slug")
      .single();

    if (error) return { ok: false, message: humanize(error.message) };

    const template = SHEET_TEMPLATES[parsed.data.template];
    if (template && template.columns.length > 0) {
      const { error: columnError } = await supabase.from("data_sheet_columns").insert(
        template.columns.map((column, index) => ({
          sheet_id: sheet.id,
          column_key: column.column_key,
          label: column.label,
          data_type: column.data_type,
          is_required: column.is_required ?? false,
          display_order: index + 1,
          options: column.options ?? [],
        })),
      );

      if (columnError) return { ok: false, message: humanize(columnError.message) };
    }

    await recordActivity(supabase, session.id, {
      action: "SHEET_CREATED",
      entityType: "data_sheet",
      entityId: sheet.id,
      metadata: { title: parsed.data.title, template: parsed.data.template },
    });

    revalidatePath("/data");
    revalidatePath("/admin/sheets");
    return { ok: true, message: "Sheet created.", id: sheet.id, slug: sheet.slug };
  } catch (error) {
    if (error instanceof AuthorizationError) return { ok: false, message: error.message };
    throw error;
  }
}

export async function grantSheetAccessAction(formData: FormData): Promise<SheetMutationResult> {
  try {
    const session = await assertPermission("sheets.manage");

    const parsed = sheetMembershipSchema.safeParse({
      sheetId: formData.get("sheetId"),
      userId: formData.get("userId"),
      accessLevel: formData.get("accessLevel"),
    });

    if (!parsed.success) {
      return { ok: false, message: "Choose a person and an access level." };
    }

    const supabase = await createClient();
    const { error } = await supabase.from("data_sheet_memberships").upsert(
      {
        sheet_id: parsed.data.sheetId,
        user_id: parsed.data.userId,
        access_level: parsed.data.accessLevel,
        created_by: session.id,
      },
      { onConflict: "sheet_id,user_id" },
    );

    if (error) return { ok: false, message: humanize(error.message) };

    await recordActivity(supabase, session.id, {
      action: "SHEET_ACCESS_GRANTED",
      entityType: "data_sheet",
      entityId: parsed.data.sheetId,
      subjectId: parsed.data.userId,
      metadata: { accessLevel: parsed.data.accessLevel },
    });

    revalidatePath("/admin/sheets");
    revalidatePath("/data");
    return { ok: true, message: "Access granted." };
  } catch (error) {
    if (error instanceof AuthorizationError) return { ok: false, message: error.message };
    throw error;
  }
}

export async function revokeSheetAccessAction(
  sheetId: string,
  userId: string,
): Promise<SheetMutationResult> {
  try {
    const session = await assertPermission("sheets.manage");
    const supabase = await createClient();

    const { error } = await supabase
      .from("data_sheet_memberships")
      .delete()
      .eq("sheet_id", sheetId)
      .eq("user_id", userId);

    if (error) return { ok: false, message: humanize(error.message) };

    await recordActivity(supabase, session.id, {
      action: "SHEET_ACCESS_REVOKED",
      entityType: "data_sheet",
      entityId: sheetId,
      subjectId: userId,
    });

    revalidatePath("/admin/sheets");
    revalidatePath("/data");
    // Revocation is enforced by RLS, so it takes effect on the next request
    // rather than when the other person happens to refresh.
    return { ok: true, message: "Access revoked. It stops working immediately." };
  } catch (error) {
    if (error instanceof AuthorizationError) return { ok: false, message: error.message };
    throw error;
  }
}

/**
 * Creates or updates a record.
 *
 * Row data is validated against the sheet's configured columns before it is
 * sent, and again by `app.validate_sheet_row_data` inside the database. No
 * user-supplied key ever becomes a SQL identifier.
 */
export async function saveSheetRowAction(formData: FormData): Promise<SheetMutationResult> {
  try {
    const session = await assertSignedIn();
    const supabase = await createClient();

    const sheetId = String(formData.get("sheetId") ?? "");
    const rowId = String(formData.get("rowId") ?? "");

    if (!sheetId) return { ok: false, message: "Missing sheet." };

    const columns = await getSheetColumns(supabase, sheetId);
    if (columns.length === 0) {
      return { ok: false, message: "This sheet has no columns configured yet." };
    }

    const submitted: Record<string, string> = {};
    for (const column of columns) {
      const value = formData.get(`field.${column.column_key}`);
      if (value !== null) {
        submitted[column.column_key] = String(value).trim();
      }
    }

    const parsed = buildRowSchema(columns).safeParse(
      Object.fromEntries(
        Object.entries(submitted).filter(([, value]) => value.length > 0 || true),
      ),
    );

    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const key = String(issue.path[0] ?? "form");
        fieldErrors[`field.${key}`] ??= issue.message;
      }
      return { ok: false, message: "Check the highlighted fields.", fieldErrors };
    }

    const rowData = compactRowData(parsed.data as Record<string, unknown>);

    if (rowId) {
      const { data, error } = await supabase
        .from("data_sheet_rows")
        .update({ row_data: rowData })
        .eq("id", rowId)
        .select("id")
        .maybeSingle();

      if (error) return { ok: false, message: humanize(error.message) };
      if (!data) return { ok: false, message: "You cannot edit that record." };

      await recordActivity(supabase, session.id, {
        action: "SHEET_ROW_UPDATED",
        entityType: "data_sheet_row",
        entityId: rowId,
        metadata: { sheetId },
      });
    } else {
      const assignedTo = String(formData.get("assignedToUserId") ?? "") || null;

      const { data, error } = await supabase
        .from("data_sheet_rows")
        .insert({
          sheet_id: sheetId,
          row_data: rowData,
          assigned_to_user_id:
            session.actor.role === "INTERN" ? session.id : assignedTo,
        })
        .select("id")
        .maybeSingle();

      if (error) return { ok: false, message: humanize(error.message) };
      if (!data) return { ok: false, message: "You cannot add records to that sheet." };

      await recordActivity(supabase, session.id, {
        action: "SHEET_ROW_CREATED",
        entityType: "data_sheet_row",
        entityId: data.id,
        metadata: { sheetId },
      });
    }

    revalidatePath("/data");
    return { ok: true, message: rowId ? "Record updated." : "Record added." };
  } catch (error) {
    if (error instanceof AuthorizationError) return { ok: false, message: error.message };
    throw error;
  }
}

export async function assignSheetRowAction(formData: FormData): Promise<SheetMutationResult> {
  try {
    const session = await assertPermission("sheets.assignRows");

    const rawAssignee = String(formData.get("assignedToUserId") ?? "");
    const parsed = sheetRowAssignmentSchema.safeParse({
      rowId: formData.get("rowId"),
      assignedToUserId: rawAssignee.length > 0 ? rawAssignee : null,
    });

    if (!parsed.success) {
      return { ok: false, message: "Choose who should own this record." };
    }

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("data_sheet_rows")
      .update({ assigned_to_user_id: parsed.data.assignedToUserId })
      .eq("id", parsed.data.rowId)
      .select("id, sheet_id")
      .maybeSingle();

    if (error) return { ok: false, message: humanize(error.message) };
    if (!data) return { ok: false, message: "You cannot reassign that record." };

    await recordActivity(supabase, session.id, {
      action: "SHEET_ROW_ASSIGNED",
      entityType: "data_sheet_row",
      entityId: data.id,
      subjectId: parsed.data.assignedToUserId,
      metadata: { sheetId: data.sheet_id },
    });

    revalidatePath("/data");
    return { ok: true, message: "Record reassigned." };
  } catch (error) {
    if (error instanceof AuthorizationError) return { ok: false, message: error.message };
    throw error;
  }
}

export async function deleteSheetRowAction(rowId: string): Promise<SheetMutationResult> {
  try {
    const session = await assertPermission("sheets.assignRows");
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("data_sheet_rows")
      .delete()
      .eq("id", rowId)
      .select("id")
      .maybeSingle();

    if (error) return { ok: false, message: humanize(error.message) };
    if (!data) return { ok: false, message: "You cannot delete that record." };

    await recordActivity(supabase, session.id, {
      action: "SHEET_ROW_DELETED",
      entityType: "data_sheet_row",
      entityId: rowId,
    });

    revalidatePath("/data");
    return { ok: true, message: "Record deleted." };
  } catch (error) {
    if (error instanceof AuthorizationError) return { ok: false, message: error.message };
    throw error;
  }
}
