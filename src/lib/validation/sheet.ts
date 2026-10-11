import { z } from "zod";

import type { DataSheetColumnRow, SheetColumnType } from "@/lib/db/database.types";

export const sheetColumnTypeSchema = z.enum([
  "TEXT",
  "LONG_TEXT",
  "NUMBER",
  "DATE",
  "EMAIL",
  "URL",
  "PHONE",
  "SELECT",
  "BOOLEAN",
]);

export const SHEET_COLUMN_TYPE_LABELS: Record<SheetColumnType, string> = {
  TEXT: "Text",
  LONG_TEXT: "Long text",
  NUMBER: "Number",
  DATE: "Date",
  EMAIL: "Email",
  URL: "Link",
  PHONE: "Phone",
  SELECT: "Choice",
  BOOLEAN: "Yes / no",
};

export const createSheetSchema = z.object({
  title: z.string().trim().min(2, "Give the sheet a name").max(120),
  description: z
    .string()
    .trim()
    .max(400)
    .optional()
    .or(z.literal(""))
    .transform((value) => (value && value.length > 0 ? value : null)),
  template: z
    .enum(["BLANK", "INFLUENCER_DIRECTORY", "BRAND_LEADS", "CAMPAIGN_TRACKER", "OUTREACH_TRACKER"])
    .default("BLANK"),
});

export const sheetColumnSchema = z.object({
  sheetId: z.string().uuid(),
  columnKey: z
    .string()
    .trim()
    .regex(/^[a-z][a-z0-9_]{0,48}$/, "Use lowercase letters, numbers and underscores"),
  label: z.string().trim().min(1, "Give the column a label").max(80),
  dataType: sheetColumnTypeSchema,
  isRequired: z.boolean().default(false),
  displayOrder: z.coerce.number().int().min(0).max(999).default(0),
  options: z.array(z.string().trim().min(1).max(80)).max(40).default([]),
});

export const sheetMembershipSchema = z.object({
  sheetId: z.string().uuid(),
  userId: z.string().uuid(),
  accessLevel: z.enum(["VIEW", "EDIT"]),
});

export const sheetRowAssignmentSchema = z.object({
  rowId: z.string().uuid(),
  assignedToUserId: z.string().uuid().nullable(),
});

/**
 * Builds a Zod schema for a sheet's configured columns.
 *
 * This is the server-side gate for JSONB row data: only declared keys survive,
 * and each value must match its column's type. The database repeats the same
 * checks in `app.validate_sheet_row_data`, so a direct PostgREST write is
 * validated identically.
 */
export function buildRowSchema(columns: readonly DataSheetColumnRow[]) {
  const shape: Record<string, z.ZodTypeAny> = {};

  for (const column of columns) {
    let field: z.ZodTypeAny;

    switch (column.data_type) {
      case "NUMBER":
        field = z
          .string()
          .trim()
          .regex(/^-?\d+(\.\d+)?$/, `${column.label} must be a number`);
        break;
      case "BOOLEAN":
        field = z.enum(["true", "false"], {
          errorMap: () => ({ message: `${column.label} must be yes or no` }),
        });
        break;
      case "DATE":
        field = z
          .string()
          .trim()
          .regex(/^\d{4}-\d{2}-\d{2}$/, `${column.label} must be a date`);
        break;
      case "EMAIL":
        field = z.string().trim().email(`${column.label} must be an email address`);
        break;
      case "URL":
        field = z
          .string()
          .trim()
          .regex(/^https?:\/\/\S+$/, `${column.label} must be an http or https link`);
        break;
      case "PHONE":
        field = z
          .string()
          .trim()
          .regex(/^[+]?[0-9 ()-]{7,24}$/, `${column.label} must be a phone number`);
        break;
      case "SELECT":
        field =
          column.options.length > 0
            ? z.enum(column.options as [string, ...string[]], {
                errorMap: () => ({ message: `Choose a valid option for ${column.label}` }),
              })
            : z.string().trim().max(200);
        break;
      case "LONG_TEXT":
        field = z.string().trim().max(8000, `${column.label} is too long`);
        break;
      default:
        field = z.string().trim().max(2000, `${column.label} is too long`);
    }

    shape[column.column_key] = column.is_required
      ? field.refine((value) => String(value ?? "").trim().length > 0, {
          message: `${column.label} is required`,
        })
      : z
          .union([field, z.literal("")])
          .optional()
          .transform((value) => (value === "" || value === undefined ? undefined : value));
  }

  // `strict()` rejects any key that is not a declared column.
  return z.object(shape).strict();
}

/** Drops empty values so blank optional fields are not stored as "". */
export function compactRowData(data: Record<string, unknown>): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(data)) {
    if (value === undefined || value === null) continue;
    const text = String(value).trim();
    if (text.length === 0) continue;
    result[key] = text;
  }
  return result;
}

export type CreateSheetInput = z.input<typeof createSheetSchema>;
export type SheetColumnInput = z.input<typeof sheetColumnSchema>;
